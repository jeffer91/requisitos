/* =========================================================
Nombre completo: maq-carga-cache-recovery.js
Ruta o ubicación: /Maqueta/maq-carga-cache-recovery.js
Función o funciones:
- Recuperar para la caché compartida los estudiantes que Carga ya guardó en BDLocal.
- Corregir únicamente la entrega BDLocal -> pantallas cuando la caché compartida queda vacía para un período.
- Leer desde el iframe de Carga sin modificar ni repetir la importación.
- Publicar la recuperación a Stats, Coordi y demás pantallas mediante MAQ_BASELOCAL_SESSION.
- No escribir en IndexedDB, Firebase, Supabase ni Google Sheets.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.1-carga-frame-id";
  var MESSAGE_PUBLISH="requisitos:bdlocal-cache:publish";
  var state={installed:false,recoveries:0,skipped:0,failures:0,lastPeriodId:"",lastStudents:0,lastRequirements:0,lastDurationMs:0,lastError:"",updatedAt:""};
  var active=Object.create(null);
  var retryTimer=null;

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function canonicalPeriodId(value){
    value=text(value);
    if(!value){return "";}
    var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }
  function samePeriod(a,b){return canonicalPeriodId(a)===canonicalPeriodId(b);}
  function periodOf(row){
    row=row||{};
    return canonicalPeriodId(row.periodoId||row.periodId||row.periodoCanonicoId||row.ultimoPeriodoId||row._periodoId||row._bl2PeriodoId||"");
  }
  function session(){return window.MAQ_BASELOCAL_SESSION||null;}
  function frames(){return Array.prototype.slice.call(document.querySelectorAll("iframe")||[]);}
  function moduleId(frame){return text(frame&&frame.dataset&&frame.dataset.moduleId||frame&&frame.getAttribute&&frame.getAttribute("data-module-id")||"");}
  function cargaFrame(){
    return frames().filter(function(frame){
      var id=moduleId(frame);
      var src=text(frame&&frame.getAttribute&&frame.getAttribute("src")||"").toLowerCase();
      return id==="carga_excel"||id==="carga"||src.indexOf("/carga/carga.html")>=0||src.indexOf("../carga/carga.html")>=0;
    })[0]||null;
  }
  function cargaWindow(){var frame=cargaFrame();try{return frame&&frame.contentWindow||null;}catch(error){return null;}}
  function isCargaSource(source){var frame=cargaFrame();return !!(frame&&source&&frame.contentWindow===source);}
  function snapshot(){var current=session();if(!current||typeof current.getSnapshot!=="function"){return null;}try{return current.getSnapshot({clone:false});}catch(error){return current.getSnapshot();}}
  function rowsForPeriod(rows,periodoId){return (Array.isArray(rows)?rows:[]).filter(function(row){return samePeriod(periodOf(row),periodoId);});}
  function replacePeriod(existing,fresh,periodoId){
    existing=Array.isArray(existing)?existing:[];
    fresh=Array.isArray(fresh)?fresh:[];
    return existing.filter(function(row){return !samePeriod(periodOf(row),periodoId);}).concat(fresh);
  }
  function selectedCargaPeriod(child){
    child=child||cargaWindow();
    if(!child){return "";}
    try{
      var node=child.document&&child.document.getElementById("cargaPeriodoSelect");
      if(node&&text(node.value)){return canonicalPeriodId(node.value);}
    }catch(error){}
    try{return canonicalPeriodId(child.localStorage.getItem("carga.periodoSeleccionado")||"");}catch(error2){return "";}
  }
  function connector(child){return child&&(child.ConCarga||child.BDLocalCarga)||null;}
  function core(child){return child&&child.BL2Core||null;}
  function publish(next,periodoId,reason){
    var current=session();
    if(!current||typeof current.publishSnapshot!=="function"){return false;}
    next.meta=Object.assign({},next.meta||{}, {
      source:"maq-carga-cache-recovery",
      sourceScreen:"carga",
      operation:"cache_recovery",
      periodoId:periodoId,
      recoveredFromCarga:true,
      recoveryReason:text(reason||"shared-cache-empty"),
      updatedAt:now()
    });
    current.publishSnapshot(next,{source:"maq-carga-cache-recovery",allowEmpty:false,clone:false});
    return true;
  }

  function recoverPeriod(periodoId,reason){
    periodoId=canonicalPeriodId(periodoId);
    if(!periodoId||active[periodoId]){return Promise.resolve(false);}

    var child=cargaWindow();
    var con=connector(child);
    if(!child||!con||typeof con.listStudents!=="function"){
      state.skipped+=1;
      return Promise.resolve(false);
    }

    var started=Date.now();
    active[periodoId]=true;

    var studentsTask=Promise.resolve(con.listStudents({periodoId:periodoId,periodId:periodoId,matricula:"",limit:0})).then(function(result){
      if(Array.isArray(result)){return result;}
      result=result||{};
      return Array.isArray(result.rows)?result.rows:Array.isArray(result.students)?result.students:Array.isArray(result.estudiantes)?result.estudiantes:[];
    });

    var currentCore=core(child);
    var requirementsTask=currentCore&&typeof currentCore.getRequirements==="function"
      ?Promise.resolve(currentCore.getRequirements({periodoId:periodoId,periodId:periodoId})).catch(function(){return [];})
      :Promise.resolve([]);

    return Promise.all([studentsTask,requirementsTask]).then(function(values){
      var students=Array.isArray(values[0])?values[0]:[];
      var requirements=Array.isArray(values[1])?values[1]:[];
      var current=snapshot();

      if(!students.length||!current){state.skipped+=1;return false;}

      var currentStudents=rowsForPeriod(current.students,periodoId);
      var currentRequirements=rowsForPeriod(current.requirements,periodoId);
      var studentsNeedRecovery=currentStudents.length<students.length;
      var requirementsNeedRecovery=requirements.length>0&&currentRequirements.length<requirements.length;

      if(!studentsNeedRecovery&&!requirementsNeedRecovery){state.skipped+=1;return false;}

      var next=Object.assign({},current,{
        meta:Object.assign({},current.meta||{}),
        periods:Array.isArray(current.periods)?current.periods.slice():[],
        students:studentsNeedRecovery?replacePeriod(current.students,students,periodoId):(Array.isArray(current.students)?current.students.slice():[]),
        requirements:requirementsNeedRecovery?replacePeriod(current.requirements,requirements,periodoId):(Array.isArray(current.requirements)?current.requirements.slice():[]),
        summaries:Object.assign({},current.summaries||{}),
        diagnostics:Array.isArray(current.diagnostics)?current.diagnostics.slice():[]
      });

      if(!publish(next,periodoId,reason)){state.failures+=1;state.lastError="No se pudo publicar la recuperación en la sesión compartida.";return false;}

      state.recoveries+=1;
      state.lastPeriodId=periodoId;
      state.lastStudents=students.length;
      state.lastRequirements=requirements.length;
      state.lastDurationMs=Date.now()-started;
      state.lastError="";
      state.updatedAt=now();

      try{window.dispatchEvent(new CustomEvent("maq:carga-cache-recovered",{detail:{periodoId:periodoId,students:students.length,requirements:requirements.length,durationMs:state.lastDurationMs,reason:text(reason||"shared-cache-empty"),at:state.updatedAt}}));}catch(error){}
      return true;
    }).catch(function(error){
      state.failures+=1;
      state.lastError=error&&error.message?error.message:String(error);
      state.updatedAt=now();
      return false;
    }).finally(function(){delete active[periodoId];});
  }

  function recoverSelected(reason){
    var child=cargaWindow();
    var periodoId=selectedCargaPeriod(child);
    if(!periodoId){
      var current=snapshot();
      periodoId=canonicalPeriodId(current&&current.meta&&(current.meta.periodoId||current.meta.periodId)||"");
    }
    return periodoId?recoverPeriod(periodoId,reason):Promise.resolve(false);
  }

  function scheduleRecovery(reason,delay){
    if(retryTimer){window.clearTimeout(retryTimer);}
    retryTimer=window.setTimeout(function(){retryTimer=null;recoverSelected(reason);},Math.max(0,Number(delay||0)));
  }

  function onMessage(event){
    var data=event&&event.data;
    if(!data||data.type!==MESSAGE_PUBLISH||!isCargaSource(event.source)){return;}
    var periodoId=canonicalPeriodId(data.periodoId||data.cache&&data.cache.meta&&data.cache.meta.periodoId||"");
    window.setTimeout(function(){
      if(periodoId){recoverPeriod(periodoId,"carga-publish");}
      else{recoverSelected("carga-publish");}
    },35);
  }

  function bindCore(){
    var current=window.MAQ_CORE;
    if(current&&current.bus&&typeof current.bus.on==="function"){
      current.bus.on("modulo:cambiado",function(){scheduleRecovery("module-activated",40);});
    }
  }

  function install(){
    if(state.installed){return status();}
    state.installed=true;
    window.addEventListener("message",onMessage,true);
    bindCore();
    [180,600,1400,2800].forEach(function(delay){window.setTimeout(function(){recoverSelected("startup-recovery");},delay);});
    state.updatedAt=now();
    return status();
  }

  function status(){return Object.assign({version:VERSION,installed:state.installed,cargaAvailable:!!connector(cargaWindow()),selectedPeriod:selectedCargaPeriod(cargaWindow())},state);}

  window.MAQCargaCacheRecovery={version:VERSION,install:install,recoverPeriod:recoverPeriod,recoverSelected:recoverSelected,status:status};
  install();
})(window,document);
