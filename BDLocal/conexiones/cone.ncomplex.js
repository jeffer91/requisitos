/* =========================================================
Nombre completo: cone.ncomplex.js
Ruta: /BDLocal/conexiones/cone.ncomplex.js
Función:
- Conectar la pantalla Ncomplex con BDLServiceNcomplex.
- Exponer períodos, estudiantes, evaluaciones, resúmenes y guardado.
- Registrar Ncomplex en BDLocalConexiones.
- Notificar y refrescar la pantalla cuando cambien datos locales.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-ncomplex";
  var HUB=window.BDLocalConexiones||null;
  var state={ready:false,loading:false,promise:null,error:"",loadedAt:"",eventsBound:false};

  function text(value){return String(value==null?"":value).trim();}
  function service(){
    if(window.BDLServiceNcomplex){return window.BDLServiceNcomplex;}
    return window.BDLServices&&typeof window.BDLServices.get==="function"
      ? window.BDLServices.get("ncomplex")
      : null;
  }
  function evaluationsRepo(){
    if(window.BDLRepoEvaluacionesTitulacion){return window.BDLRepoEvaluacionesTitulacion;}
    return window.BDLRepositories&&typeof window.BDLRepositories.get==="function"
      ? window.BDLRepositories.get("evaluaciones_titulacion")
      : null;
  }

  function status(){
    return {
      ok:state.ready&&!state.error,
      ready:state.ready,
      loading:state.loading,
      version:VERSION,
      source:"BDLocal/conexiones/cone.ncomplex.js",
      service:!!service(),
      repository:!!evaluationsRepo(),
      loadedAt:state.loadedAt,
      error:state.error
    };
  }

  function dispatch(name,detail){
    try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(error){}
  }

  function ready(options){
    options=options||{};
    if(state.ready&&!options.force){return Promise.resolve(status());}
    if(state.loading&&state.promise&&!options.force){return state.promise;}

    state.loading=true;
    state.error="";
    var coreReady=HUB&&typeof HUB.ensureCoreReady==="function"
      ? HUB.ensureCoreReady().catch(function(){return null;})
      : Promise.resolve(null);

    state.promise=coreReady.then(function(){
      var current=service();
      var repo=evaluationsRepo();
      if(!current){throw new Error("BDLServiceNcomplex no está cargado.");}
      if(!repo){throw new Error("BDLRepoEvaluacionesTitulacion no está cargado.");}
      state.ready=true;
      state.loadedAt=new Date().toISOString();
      dispatch("bdlocal:ncomplex-ready",status());
      return status();
    }).catch(function(error){
      state.ready=false;
      state.error=error&&error.message?error.message:String(error);
      return status();
    }).finally(function(){
      state.loading=false;
      state.promise=null;
    });

    return state.promise;
  }

  function call(method,args,fallback){
    args=Array.isArray(args)?args:[];
    return ready().then(function(){
      var current=service();
      if(!current||typeof current[method]!=="function"){
        if(fallback!==undefined){return fallback;}
        throw new Error("Ncomplex no dispone de la operación "+method+".");
      }
      return current[method].apply(current,args);
    });
  }

  function refresh(options){
    options=options||{};
    var refresh=HUB&&typeof HUB.refreshCache==="function"
      ? HUB.refreshCache({
          source:"cone.ncomplex",
          periodoId:options.periodoId||options.periodId||"",
          full:options.full===true,
          light:options.full!==true,
          immediate:true,
          force:options.force===true
        }).catch(function(){return null;})
      : Promise.resolve(null);
    return refresh.then(function(){return ready({force:true});});
  }

  function listPeriods(){return call("listPeriods",[],[]);}
  function listStudents(options){return call("list",[options||{}],[]);}
  function getPage(options){return call("getPage",[options||{}],{rows:[],page:1,limit:25,total:0,totalPages:1,hasPrev:false,hasNext:false});}
  function getSummary(options){return call("getSummary",[options||{}],{});}
  function getEvaluation(periodoId,cedula){return call("getByPeriodoCedula",[periodoId,cedula],null);}
  function saveEvaluation(row,context){return call("saveEvaluation",[row||{},context||{}]);}
  function saveMany(rows,context){return call("saveMany",[Array.isArray(rows)?rows:[],context||{}],[]);}
  function changeModality(periodoId,cedula,modalidad){return call("changeModality",[periodoId,cedula,modalidad]);}
  function saveImport(row){return call("saveImport",[row||{}]);}
  function listImports(options){return call("listImports",[options||{}],[]);}
  function listEvaluations(options){
    return ready().then(function(){
      var repo=evaluationsRepo();
      return repo&&typeof repo.list==="function"?repo.list(options||{}):[];
    });
  }

  function scheduleRefresh(){
    window.clearTimeout(scheduleRefresh.timer);
    scheduleRefresh.timer=window.setTimeout(function(){
      dispatch("ncomplex:data-changed",{at:new Date().toISOString()});
    },120);
  }

  function bindEvents(){
    if(state.eventsBound){return;}
    state.eventsBound=true;
    [
      "bdlocal:evaluaciones-titulacion-updated",
      "bdlocal:ncomplex-saved",
      "bdlocal:importaciones-updated",
      "bl2:students-saved",
      "bl2:student-updated"
    ].forEach(function(name){window.addEventListener(name,scheduleRefresh);});
  }

  var api={
    version:VERSION,
    source:"BDLocal/conexiones/cone.ncomplex.js",
    ready:ready,
    refresh:refresh,
    reload:refresh,
    status:status,
    listPeriods:listPeriods,
    getPeriods:listPeriods,
    listStudents:listStudents,
    getStudents:listStudents,
    getPage:getPage,
    page:getPage,
    getSummary:getSummary,
    summary:getSummary,
    listEvaluations:listEvaluations,
    getEvaluation:getEvaluation,
    getByPeriodoCedula:getEvaluation,
    saveEvaluation:saveEvaluation,
    save:saveEvaluation,
    saveMany:saveMany,
    changeModality:changeModality,
    saveImport:saveImport,
    listImports:listImports
  };

  window.ConNcomplex=api;
  window.BDLocalConeNcomplex=api;
  window.BDLocalNcomplex=api;

  if(HUB&&typeof HUB.register==="function"){
    HUB.register("ncomplex",api);
  }

  bindEvents();
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",function(){ready();});
  }else{
    ready();
  }
})(window,document);
