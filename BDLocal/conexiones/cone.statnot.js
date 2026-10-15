/* =========================================================
Nombre completo: cone.statnot.js
Ruta: /BDLocal/conexiones/cone.statnot.js
Función:
- Exponer a Stat Not una conexión exclusivamente de lectura.
- Leer los mismos estudiantes y notas hidratadas que usa Defensas.
- No exponer operaciones de guardado de calificaciones.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.1.0-hydrated-requirements-official-matricula";
  var SCREEN="stat_not";
  var SOURCE="BDLocal/StatNot";
  var base=document.currentScript&&document.currentScript.src||document.baseURI;
  var loading=Object.create(null);
  var state={ready:false,loading:false,promise:null,error:"",loadedAt:"",reads:0};

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function url(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function existing(src){return Array.prototype.slice.call(document.scripts||[]).some(function(item){return item.src===src||item.getAttribute("data-statnot-con-src")===src;});}
  function waitFor(test,label,timeout){timeout=Math.max(500,Number(timeout||15000));var started=Date.now();return new Promise(function(resolve,reject){(function check(){var value=null;try{value=test();}catch(error){}if(value){resolve(value);return;}if(Date.now()-started>=timeout){reject(new Error("No se pudo preparar "+label+"."));return;}window.setTimeout(check,40);})();});}
  function load(relative,test){
    var src=url(relative),current=null;try{current=test&&test();}catch(error){}
    if(current){return Promise.resolve(current);}if(loading[src]){return loading[src];}if(existing(src)){return test?waitFor(test,relative,15000):Promise.resolve(src);}
    loading[src]=new Promise(function(resolve,reject){var script=document.createElement("script");script.src=src;script.async=false;script.defer=false;script.setAttribute("data-statnot-con-src",src);script.onload=function(){var value=src;try{value=test?test():src;}catch(error){value=null;}value?resolve(value):reject(new Error(relative+" no expuso la API esperada."));};script.onerror=function(){reject(new Error("No se pudo cargar "+relative+"."));};(document.head||document.documentElement).appendChild(script);}).finally(function(){delete loading[src];});
    return loading[src];
  }
  function service(name,globalName){var registry=window.BDLServices;return registry&&typeof registry.get==="function"?(registry.get(name)||window[globalName]||null):(window[globalName]||null);}
  function defensas(){return service("defensas","BDLServiceDefensas");}
  function periodos(){return service("periodos","BDLServicePeriodos");}
  function hub(){return window.BDLocalConexiones||null;}

  function register(){
    var registry=window.BDLocalConeRegistry;
    if(registry&&typeof registry.register==="function"){
      registry.register(SCREEN,{label:"Stat Not",global:"ConStatNot",file:"cone.statnot.js",pathHints:["/statnot/","stat-not.html"],aliases:["statnot","estadisticas_notas"],canRead:true,canWrite:false,operations:["ready","read","refresh","status","diagnose"],tables:["periodos","personas","matriculas_periodo","requisitos_estudiante","notas_titulacion","divisiones_estudiante"],description:"Conector de solo lectura para estadísticas de notas y elegibilidad de defensas."});
    }
  }
  function ensureDependencies(){
    return load("../adapters/bdl.screen-deps.js",function(){return window.BDLocalScreenDeps;})
      .then(function(deps){return deps&&typeof deps.ready==="function"?deps.ready({timeout:1200}):true;})
      .then(function(){return load("cone.runtime-deps.js",function(){return window.BDLocalRuntimeDeps;});})
      .then(function(runtime){return runtime.ensure("defensas");})
      .then(function(){if(!defensas()||!periodos()||!window.BDLDefenseEligibility){throw new Error("Los servicios de notas no quedaron disponibles.");}return true;});
  }

  // Unión de solo lectura con requisitos_estudiante por cédula + período.
  function canonicalPeriod(value){
    var raw=text(value),m=raw.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return m?m[1]+"-"+m[2]+"__"+m[3]+"-"+m[4]:raw.replace(/_+/g,"__");
  }
  function canonicalCedula(value){
    var raw=text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
    return /^\d{9}$/.test(raw)?"0"+raw:raw;
  }
  function studentKey(row){
    row=row||{};
    var cedula=canonicalCedula(row.cedula||row._cedula||row.numeroIdentificacion||row.NumeroIdentificacion||row.Cedula||row["Cédula"]);
    var period=canonicalPeriod(row.periodoId||row.periodId||row.periodoCanonicoId||row._periodoId||row._bl2PeriodoId);
    return cedula&&period?cedula+"__"+period:"";
  }
  function compactKey(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"");}
  function requirementName(item){return text(item.requisitoKey||item.requirementKey||item.key||item.campo||item.field||item.nombre||item.requisitoLabel||item.requisitoNombre);}
  function requirementValue(item){
    for(var i=0,fields=["valor","value","estado","cumple","aprobado","resultado"];i<fields.length;i++){
      var value=item[fields[i]];
      if(value!==undefined&&value!==null&&text(value)!==""){
        if(value&&typeof value==="object"){return value.id||value.value||value.label||"";}
        return value;
      }
    }
    return "";
  }
  var officialFields={
    academico:"Academico",documentacion:"Documentacion",financiero:"Financiero",
    titulacion:"Titulacion",practicasvinculacion:"PrácticasVinculacion",
    practicas:"PrácticasVinculacion",vinculacion:"Vinculacion",
    seguimientograduados:"SeguimientoGraduados",
    seguimientoagraduados:"SeguimientoGraduados",
    ingles:"Ingles",actualizaciondatos:"ActualizaciónDatos"
  };
  function joinLoadedRequirements(rows,requirements){
    var byStudent=Object.create(null);
    (Array.isArray(requirements)?requirements:[]).forEach(function(item){
      var id=studentKey(item),name=requirementName(item);
      if(!id||!name){return;}
      (byStudent[id]||(byStudent[id]=[])).push(item);
    });
    return rows.map(function(original){
      var student=Object.assign({},original||{});
      var matched=byStudent[studentKey(student)]||[];
      matched.forEach(function(item){
        var name=requirementName(item),compact=compactKey(name),value=requirementValue(item);
        student[name]=value;
        student[compact]=value;
        if(officialFields[compact]){student[officialFields[compact]]=value;}
      });
      student.requisitos=matched.map(function(item){return Object.assign({},item);});
      student.requirements=student.requisitos.map(function(item){return Object.assign({},item);});
      student._bdlRequirementsLoaded=true;
      student._bdlRequirementsHydrated=true;
      student._bdlRequirementsCount=matched.length;
      return student;
    });
  }
  function requirementsRepo(){
    if(window.BDLRepoRequisitos&&typeof window.BDLRepoRequisitos.list==="function"){return window.BDLRepoRequisitos;}
    return window.BDLRepositories&&typeof window.BDLRepositories.get==="function"
      ?window.BDLRepositories.get("requisitos"):null;
  }
  function joinRequirements(rows,options){
    rows=Array.isArray(rows)?rows:[];
    if(!rows.length){return Promise.resolve([]);}
    var repo=requirementsRepo();
    if(!repo||typeof repo.list!=="function"){
      return Promise.reject(new Error("No se pudo leer requisitos_estudiante; no se calculará habilitación con datos incompletos."));
    }
    options=options||{};
    var selected=canonicalPeriod(options.periodoId||options.periodId||"");
    var periods=Object.create(null);
    rows.forEach(function(row){
      var p=canonicalPeriod(row.periodoId||row.periodId||row._periodoId||selected);
      if(p){periods[p]=true;}
    });
    var ids=Object.keys(periods);
    if(!ids.length){return Promise.reject(new Error("Sin período canónico para vincular requisitos."));}
    return Promise.all(ids.map(function(periodoId){return repo.list({periodoId:periodoId});}))
      .then(function(groups){
        var all=[];
        groups.forEach(function(group){if(Array.isArray(group)){all=all.concat(group);}});
        return joinLoadedRequirements(rows,all);
      });
  }

  function status(){return {ok:state.ready&&!state.error,version:VERSION,screen:SCREEN,source:SOURCE,ready:state.ready,loading:state.loading,error:state.error,loadedAt:state.loadedAt,reads:state.reads,canRead:true,canWrite:false};}
  function ready(options){
    options=options||{};if(state.ready&&!options.force){return Promise.resolve(status());}if(state.promise){return state.promise;}
    state.loading=true;state.error="";
    state.promise=ensureDependencies().then(function(){state.ready=true;state.loadedAt=now();register();var currentHub=hub();if(currentHub&&typeof currentHub.register==="function"){currentHub.register(SCREEN,api);}return status();}).catch(function(error){state.ready=false;state.error=error&&error.message?error.message:String(error);return status();}).finally(function(){state.loading=false;state.promise=null;});
    return state.promise;
  }
  function requireReady(){return ready().then(function(result){if(!result.ok){throw new Error(result.error||"Stat Not no está listo.");}return result;});}
  function listPeriods(){return requireReady().then(function(){var current=periodos();return current&&typeof current.list==="function"?current.list():[];});}
  function listStudents(options){return requireReady().then(function(){var current=defensas();if(!current||typeof current.getFiltered!=="function"){throw new Error("Servicio Defensas no disponible.");}return current.getFiltered(options||{});}).then(function(rows){return joinRequirements(rows,options||{});});}
  function read(options){state.reads+=1;return Promise.all([listPeriods(),listStudents(options||{})]).then(function(values){return {ok:true,source:SOURCE,screen:SCREEN,data:{periods:values[0]||[],students:values[1]||[]},meta:{generatedAt:now(),version:VERSION,readOnly:true}};});}
  function refresh(){state.ready=false;return ready({force:true});}
  function diagnose(){return Promise.resolve(status());}

  var api={version:VERSION,screen:SCREEN,source:SOURCE,ready:ready,read:read,refresh:refresh,reload:refresh,status:status,diagnose:diagnose,listPeriods:listPeriods,getPeriods:listPeriods,listStudents:listStudents,getStudents:listStudents,getFiltered:listStudents};
  window.ConStatNot=api;window.BDLocalConeStatNot=api;register();var currentHub=hub();if(currentHub&&typeof currentHub.register==="function"){currentHub.register(SCREEN,api);}
})(window,document);
