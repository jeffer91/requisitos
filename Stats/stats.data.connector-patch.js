/* =========================================================
Nombre completo: stats.data.connector-patch.js
Ruta: /Stats/stats.data.connector-patch.js
Función:
- Hidratar estudiantes con notas entregadas por ConStats.
- Mantener las notas fuera de la ruta crítica de arranque de Stats.
- Cargar notas únicamente para el período seleccionado.
- No cargar repositorios ni abrir BDLocal directamente desde Stats.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.1.0-period-deferred-notes";
  var state={
    installed:false,
    bound:false,
    loading:null,
    loadingPeriod:"",
    currentPeriod:"",
    requestSeq:0,
    notes:[],
    byKey:Object.create(null),
    byCedula:Object.create(null),
    error:"",
    loadedAt:""
  };

  function text(value){return String(value==null?"":value).trim();}
  function cedula(value){var raw=text(value).replace(/[^0-9A-Za-z]/g,"");return /^\d{9}$/.test(raw)?"0"+raw:raw;}
  function period(value){value=text(value);var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");}
  function api(){return window.ConStats||window.BDLocalStats||null;}
  function selectedPeriod(){var node=document.getElementById("stats-periodo");return period(node&&node.value||"");}
  function cedulaOf(row){row=row||{};return cedula(row.cedula||row._cedula||row.numeroIdentificacion||row.NumeroIdentificacion||row.Cedula||row["Cédula"]);}
  function periodOf(row){row=row||{};return period(row.periodoId||row.periodId||row.periodoCanonicoId||row.ultimoPeriodoId||row._periodoId||row._bl2PeriodoId);}
  function keyOf(row){var c=cedulaOf(row),p=periodOf(row);return c&&p?c+"__"+p:"";}
  function number(value){if(value===null||value===undefined||text(value)===""){return null;}var result=Number(text(value).replace(",","."));return Number.isFinite(result)?result:null;}
  function first(row,names){row=row||{};for(var i=0;i<names.length;i+=1){if(Object.prototype.hasOwnProperty.call(row,names[i])&&text(row[names[i]])!==""){return row[names[i]];}}return "";}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(error){}}

  function normalizeNote(input){
    var row=Object.assign({},input||{});
    var nested=row._bdlNotas&&typeof row._bdlNotas==="object"?row._bdlNotas:(row.notas&&typeof row.notas==="object"?row.notas:{});
    var source=Object.assign({},nested,row);
    var nart=number(first(source,["Notart","Nart","nart","notart","notaArticulo","nota_articulo","_nart"]));
    var ndef=number(first(source,["Notdef","Ndef","ndef","notdef","notaDefensa","nota_defensa","_ndef"]));
    var storedFinal=number(first(source,["Notafinal","NotaFinal","Nfinal","Nfin","nfin","notafinal","notaFinal","nota_final","_nfin"]));
    var nfin=storedFinal;
    if(nfin===null&&nart!==null&&ndef!==null&&nart>=7){nfin=Math.round(((nart*0.70)+(ndef*0.30))*100)/100;}
    return Object.assign({},row,{
      cedula:cedulaOf(row),periodoId:periodOf(row),
      Notart:nart,Nart:nart,nart:nart,notaArticulo:nart,
      Notdef:ndef,Ndef:ndef,ndef:ndef,notaDefensa:ndef,
      Notafinal:nfin,NotaFinal:nfin,Nfin:nfin,nfin:nfin,notaFinal:nfin,
      _bdlNotas:{nart:nart,ndef:ndef,nfin:nfin,nfinCalculado:nfin,nfinGuardado:storedFinal,completo:nfin!==null}
    });
  }

  function index(rows,periodoId){
    state.currentPeriod=period(periodoId||"");
    state.notes=(Array.isArray(rows)?rows:[]).map(normalizeNote).filter(function(note){return !state.currentPeriod||periodOf(note)===state.currentPeriod;});
    state.byKey=Object.create(null);
    state.byCedula=Object.create(null);
    state.notes.forEach(function(note){
      var key=keyOf(note),id=cedulaOf(note);
      if(key){state.byKey[key]=note;}
      if(id){if(!state.byCedula[id]){state.byCedula[id]=[];}state.byCedula[id].push(note);}
    });
    state.loadedAt=new Date().toISOString();
    state.error="";
    return state.notes;
  }

  function clear(periodoId){
    state.requestSeq+=1;
    state.loading=null;
    state.loadingPeriod="";
    return index([],periodoId||"");
  }

  function loadPeriod(periodoId,force){
    periodoId=period(periodoId||selectedPeriod());
    if(!periodoId){return Promise.resolve(clear(""));}
    if(!force&&state.currentPeriod===periodoId&&state.loadedAt){return Promise.resolve(state.notes);}
    if(state.loading&&state.loadingPeriod===periodoId&&!force){return state.loading;}

    var current=api();
    if(!current||typeof current.listNotes!=="function"){
      return Promise.reject(new Error("ConStats.listNotes no está disponible."));
    }

    var seq=++state.requestSeq;
    state.loadingPeriod=periodoId;
    state.loading=Promise.resolve(current.listNotes({periodoId:periodoId,periodId:periodoId})).then(function(rows){
      if(seq!==state.requestSeq){return state.notes;}
      return index(rows,periodoId);
    }).catch(function(error){
      if(seq===state.requestSeq){
        index([],periodoId);
        state.error=error&&error.message?error.message:String(error);
      }
      return [];
    }).finally(function(){
      if(seq===state.requestSeq){state.loading=null;state.loadingPeriod="";}
    });
    return state.loading;
  }

  function noteFor(row){
    var key=keyOf(row);
    if(key&&state.byKey[key]){return state.byKey[key];}
    var id=cedulaOf(row),list=id&&state.byCedula[id]?state.byCedula[id]:[];
    if(list.length===1){return list[0];}
    var p=periodOf(row);
    return list.filter(function(note){return !p||periodOf(note)===p;})[0]||null;
  }

  function hydrate(row){
    var copy=Object.assign({},row||{}),note=noteFor(row);
    copy._telegramUser=text(copy._telegramUser||copy.telegramUser||copy.usuarioTelegram||copy.telegram);
    copy._telegramChatId=text(copy._telegramChatId||copy.telegramChatId||copy.chatIdTelegram||copy.chatId);
    copy._hasTelegram=!!(copy._telegramUser||copy._telegramChatId);
    if(!note){return copy;}
    ["Notart","Nart","nart","notaArticulo","Notdef","Ndef","ndef","notaDefensa","Notafinal","NotaFinal","Nfin","nfin","notaFinal"].forEach(function(name){copy[name]=note[name];});
    copy._bdlNotas=Object.assign({},note._bdlNotas||{});
    copy._bdlNotaRegistro=Object.assign({},note);
    return copy;
  }

  function hydrateRows(rows){return (Array.isArray(rows)?rows:[]).map(hydrate);}
  function mapResult(result){
    if(Array.isArray(result)){return hydrateRows(result);}
    result=result&&typeof result==="object"?result:{};
    var rows=hydrateRows(result.rows||result.estudiantes||result.students||[]);
    return Object.assign({},result,{rows:rows,estudiantes:rows,students:rows,total:rows.length});
  }
  function maybe(value,mapper){return value&&typeof value.then==="function"?value.then(mapper):mapper(value);}
  function wrap(apiObject,name,mapper){
    var original=apiObject&&apiObject[name];
    if(typeof original!=="function"||original.__statsConnectorPatch){return;}
    var wrapped=function(){return maybe(original.apply(apiObject,arguments),mapper);};
    wrapped.__statsConnectorPatch=true;
    wrapped.__original=original;
    apiObject[name]=wrapped;
  }

  function refreshStatsAfterNotes(periodoId){
    if(selectedPeriod()!==periodoId){return;}
    try{
      if(window.StatsCore&&typeof window.StatsCore.invalidate==="function"){
        window.StatsCore.invalidate({keepPeriods:true,reason:"notes-loaded"});
      }
      if(window.StatsApp&&typeof window.StatsApp.render==="function"){
        window.StatsApp.render({force:false,reason:"notes-loaded"});
      }
    }catch(error){}
    emit("stats:notes-loaded",{ok:true,periodoId:periodoId,total:state.notes.length,at:new Date().toISOString()});
  }

  function requestSelectedPeriod(force){
    var periodoId=selectedPeriod();
    if(!periodoId){clear("");return Promise.resolve([]);}
    return loadPeriod(periodoId,force===true).then(function(rows){
      if(state.currentPeriod===periodoId&&!state.error){refreshStatsAfterNotes(periodoId);}
      return rows;
    });
  }

  function bind(){
    if(state.bound){return;}
    state.bound=true;
    var periodNode=document.getElementById("stats-periodo");
    if(periodNode){
      periodNode.addEventListener("change",function(){requestSelectedPeriod(false);});
    }
    window.addEventListener("stats:cache-invalidated",function(event){
      var reason=text(event&&event.detail&&event.detail.reason||"");
      if(reason==="refresh-button"||reason==="manual-refresh"){requestSelectedPeriod(true);}
    });
  }

  function install(){
    var current=api();
    if(!current){return false;}
    if(current.__statsConnectorDataPatch){state.installed=true;bind();return true;}
    ["students","getStudents","rows","getRows"].forEach(function(name){wrap(current,name,hydrateRows);});
    wrap(current,"listStudents",mapResult);
    current.__statsConnectorDataPatch=true;
    state.installed=true;
    bind();
    return true;
  }

  function ready(){
    if(!install()){return Promise.reject(new Error("ConStats no está disponible."));}
    return Promise.resolve(status());
  }

  function status(){return {
    ok:!state.error,
    version:VERSION,
    source:"ConStats",
    installed:state.installed,
    deferred:true,
    currentPeriod:state.currentPeriod,
    loadingPeriod:state.loadingPeriod,
    notes:state.notes.length,
    loadedAt:state.loadedAt,
    error:state.error
  };}

  window.StatsDataPatch={
    version:VERSION,
    install:install,
    ready:ready,
    loadPeriod:loadPeriod,
    reload:function(){return requestSelectedPeriod(true);},
    hydrateStudent:hydrate,
    status:status
  };
})(window,document);
