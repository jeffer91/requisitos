/* =========================================================
Nombre completo: cone.ncomplex.api.js
Ruta: /BDLocal/conexiones/cone.ncomplex.api.js
Función:
- Exponer la API de Ncomplex después de preparar sus dependencias.
- Leer y guardar exclusivamente mediante BDLServiceNcomplex.
========================================================= */
(function(window){
  "use strict";

  var VERSION="2.0.0-api";
  var SCREEN="ncomplex";
  var SOURCE="ConNcomplex";
  var state={ready:false,loading:false,promise:null,error:"",loadedAt:"",schemaReady:false,eventsBound:false};

  function hub(){return window.BDLocalConexiones||null;}
  function service(){return window.BDLServiceNcomplex||(window.BDLServices&&typeof window.BDLServices.get==="function"?window.BDLServices.get("ncomplex"):null);}
  function repo(){return window.BDLRepoEvaluacionesTitulacion||(window.BDLRepositories&&typeof window.BDLRepositories.get==="function"?window.BDLRepositories.get("evaluaciones_titulacion"):null);}
  function migration(){return window.BDLMigrationV3Ncomplex||null;}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(error){}}
  function register(){
    var registry=window.BDLocalConeRegistry;
    if(registry&&typeof registry.register==="function"){
      registry.register(SCREEN,{label:"Ncomplex",global:"ConNcomplex",file:"cone.ncomplex.js",pathHints:["/ncomplex/","ncomplex.html"],aliases:["complexivo"],canRead:true,canWrite:true,operations:["ready","read","save","update","refresh","status","diagnose"],tables:["periodos","personas","matriculas_periodo","requisitos_estudiante","evaluaciones_titulacion","importaciones","cambios_pendientes"],description:"Conector exclusivo de Ncomplex."});
    }
    var currentHub=hub();
    if(currentHub&&typeof currentHub.register==="function"){currentHub.register(SCREEN,api);}
  }
  function status(){return {ok:state.ready&&!state.error,ready:state.ready,loading:state.loading,schemaReady:state.schemaReady,version:VERSION,screen:SCREEN,source:SOURCE,service:!!service(),repository:!!repo(),loadedAt:state.loadedAt,error:state.error};}
  function ensureSchema(){
    var current=migration();
    if(!current||typeof current.ensure!=="function"){state.schemaReady=false;return Promise.reject(new Error("BDLMigrationV3Ncomplex no está disponible."));}
    return current.ensure().then(function(result){state.schemaReady=!!(result&&result.ok);if(!state.schemaReady){throw new Error("No se pudo preparar evaluaciones_titulacion.");}return result;});
  }
  function ready(options){
    options=options||{};
    if(state.ready&&!options.force){return Promise.resolve(status());}
    if(state.loading&&state.promise&&!options.force){return state.promise;}
    state.loading=true;state.error="";
    state.promise=ensureSchema().then(function(){
      if(!service()){throw new Error("BDLServiceNcomplex no está disponible.");}
      if(!repo()){throw new Error("BDLRepoEvaluacionesTitulacion no está disponible.");}
      state.ready=true;state.loadedAt=new Date().toISOString();register();emit("bdlocal:ncomplex-ready",status());return status();
    }).catch(function(error){state.ready=false;state.error=error&&error.message?error.message:String(error);return status();}).finally(function(){state.loading=false;state.promise=null;});
    return state.promise;
  }
  function call(method,args,fallback){
    args=Array.isArray(args)?args:[];
    return ready().then(function(result){
      if(!result.ok){throw new Error(result.error||"Ncomplex no está listo.");}
      var current=service();
      if(!current||typeof current[method]!=="function"){if(fallback!==undefined){return fallback;}throw new Error("Ncomplex no dispone de la operación "+method+".");}
      return current[method].apply(current,args);
    });
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
  function listEvaluations(options){return ready().then(function(result){if(!result.ok){throw new Error(result.error||"Ncomplex no está listo.");}var current=repo();return current&&typeof current.list==="function"?current.list(options||{}):[];});}
  function read(options){options=options||{};return Promise.all([listPeriods(),listStudents(options),listEvaluations(options)]).then(function(values){return {ok:true,screen:SCREEN,source:SOURCE,data:{periods:values[0]||[],students:values[1]||[],evaluations:values[2]||[]},meta:{generatedAt:new Date().toISOString(),version:VERSION}};});}
  function refresh(options){
    options=options||{};var currentHub=hub();
    var task=currentHub&&typeof currentHub.refreshCache==="function"?currentHub.refreshCache({source:"cone.ncomplex",sourceScreen:SCREEN,periodoId:options.periodoId||options.periodId||"",full:options.full===true,light:options.full!==true,immediate:true,force:options.force===true}).catch(function(){return null;}):Promise.resolve(null);
    return task.then(function(){return ready({force:true});});
  }
  function schedule(){window.clearTimeout(schedule.timer);schedule.timer=window.setTimeout(function(){emit("ncomplex:data-changed",{at:new Date().toISOString(),source:SOURCE});},120);}
  function bind(){if(state.eventsBound){return;}state.eventsBound=true;["bdlocal:evaluaciones-titulacion-updated","bdlocal:ncomplex-saved","bdlocal:importaciones-updated","bl2:students-saved","bl2:student-updated"].forEach(function(name){window.addEventListener(name,schedule);});}

  var api={version:VERSION,screen:SCREEN,source:SOURCE,ready:ready,ensureSchema:ensureSchema,refresh:refresh,reload:refresh,status:status,read:read,listPeriods:listPeriods,getPeriods:listPeriods,listStudents:listStudents,getStudents:listStudents,getPage:getPage,page:getPage,getSummary:getSummary,summary:getSummary,listEvaluations:listEvaluations,getEvaluation:getEvaluation,getByPeriodoCedula:getEvaluation,saveEvaluation:saveEvaluation,save:saveEvaluation,saveMany:saveMany,changeModality:changeModality,saveImport:saveImport,listImports:listImports};

  window.ConNcomplex=api;window.BDLocalConeNcomplex=api;window.BDLocalNcomplex=api;register();bind();
})(window);
