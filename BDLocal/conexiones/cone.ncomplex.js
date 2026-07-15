/* =========================================================
Nombre completo: cone.ncomplex.js
Ruta: /BDLocal/conexiones/cone.ncomplex.js
Función:
- Exponer inmediatamente un proxy oficial ConNcomplex.
- Preparar internamente esquema V3, repositorios y servicios.
- Delegar las operaciones a cone.ncomplex.api.js cuando esté listo.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="2.1.0-immediate-proxy";
  var SCREEN="ncomplex";
  var SOURCE="ConNcomplex";
  var base=document.currentScript&&document.currentScript.src||document.baseURI;
  var loading=Object.create(null);
  var readyPromise=null;
  var lastError="";

  function url(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function existing(src){return Array.prototype.slice.call(document.scripts||[]).some(function(item){return item.src===src||item.getAttribute("data-conncomplex-src")===src;});}
  function waitFor(test,label,timeout){timeout=Math.max(500,Number(timeout||15000));var started=Date.now();return new Promise(function(resolve,reject){(function check(){var value=null;try{value=test();}catch(error){}if(value){resolve(value);return;}if(Date.now()-started>=timeout){reject(new Error("No se pudo preparar "+label+"."));return;}setTimeout(check,40);})();});}
  function load(relative,test){
    var src=url(relative),current=null;try{current=test&&test();}catch(error){}
    if(current){return Promise.resolve(current);}if(loading[src]){return loading[src];}if(existing(src)){return test?waitFor(test,relative,15000):Promise.resolve(src);}
    loading[src]=new Promise(function(resolve,reject){var script=document.createElement("script");script.src=src;script.async=false;script.defer=false;script.setAttribute("data-conncomplex-src",src);script.onload=function(){var value=src;try{value=test?test():src;}catch(error){value=null;}value?resolve(value):reject(new Error(relative+" no expuso la API esperada."));};script.onerror=function(){reject(new Error("No se pudo cargar "+relative+"."));};(document.head||document.documentElement).appendChild(script);}).finally(function(){delete loading[src];});
    return loading[src];
  }
  function sequence(files){return files.reduce(function(chain,item){return chain.then(function(){return load(item.path,item.test);});},Promise.resolve());}
  function actual(){var current=window.ConNcomplex;return current&&current.__loaderProxy!==true?current:null;}

  function prepare(){
    if(actual()){return Promise.resolve(actual());}
    if(readyPromise){return readyPromise;}
    lastError="";
    readyPromise=sequence([
      {path:"../bl2.config.js",test:function(){return window.BL2Config;}},
      {path:"../bl2.config.v2.js"},
      {path:"../bl2.config.v3.js"},
      {path:"../bl2.db.js",test:function(){return window.BL2DB;}},
      {path:"../adapters/bdl.screen-deps.js",test:function(){return window.BDLocalScreenDeps;}}
    ]).then(function(){
      var adapter=window.BDLocalScreenDeps;
      return adapter&&typeof adapter.ready==="function"?adapter.ready():adapter;
    }).then(function(){
      return sequence([
        {path:"../rules/bdl.rules.index.js",test:function(){return window.BDLRules;}},
        {path:"../rules/bdl.rules.persona.js"},
        {path:"../rules/bdl.rules.matricula.js"},
        {path:"../rules/bdl.rules.evaluaciones-titulacion.js"},
        {path:"../repositories/bdl.repo.periodos.js"},
        {path:"../repositories/bdl.repo.estudiantes.js"},
        {path:"../repositories/bdl.repo.personas.js"},
        {path:"../repositories/bdl.repo.matriculas.js"},
        {path:"../repositories/bdl.repo.cambios.js"},
        {path:"../repositories/bdl.repo.evaluaciones-titulacion.js",test:function(){return window.BDLRepoEvaluacionesTitulacion;}},
        {path:"../repositories/bdl.repo.importaciones.js"},
        {path:"../services/bdl.service.periodos.js"},
        {path:"../services/bdl.service.estudiantes.js"},
        {path:"../services/bdl.service.ncomplex.js",test:function(){return window.BDLServiceNcomplex;}},
        {path:"../migrations/bdl.migration.index.js"},
        {path:"../migrations/bdl.migration.v3.ncomplex.js",test:function(){return window.BDLMigrationV3Ncomplex;}},
        {path:"cone.ncomplex.api.js",test:actual}
      ]);
    }).then(function(){if(!actual()){throw new Error("cone.ncomplex.api.js no expuso la API real.");}return actual();}).catch(function(error){lastError=error&&error.message?error.message:String(error);throw error;}).finally(function(){readyPromise=null;});
    return readyPromise;
  }

  function invoke(method,args,fallback){
    return prepare().then(function(api){
      if(!api||typeof api[method]!=="function"){if(fallback!==undefined){return fallback;}throw new Error("ConNcomplex no admite "+method+".");}
      return api[method].apply(api,args||[]);
    });
  }
  function ready(options){return invoke("ready",[options||{}]);}
  function status(){var api=actual();return api&&typeof api.status==="function"?api.status():{ok:!lastError&&!!api,ready:!!api,loading:!!readyPromise,version:VERSION,screen:SCREEN,source:SOURCE,error:lastError};}

  var proxy={
    __loaderProxy:true,version:VERSION,screen:SCREEN,source:SOURCE,
    ready:ready,status:status,
    read:function(options){return invoke("read",[options||{}]);},
    refresh:function(options){return invoke("refresh",[options||{}]);},reload:function(options){return invoke("refresh",[options||{}]);},
    listPeriods:function(){return invoke("listPeriods",[],[]);},getPeriods:function(){return invoke("listPeriods",[],[]);},
    listStudents:function(options){return invoke("listStudents",[options||{}],[]);},getStudents:function(options){return invoke("listStudents",[options||{}],[]);},
    getPage:function(options){return invoke("getPage",[options||{}],{rows:[],page:1,limit:25,total:0,totalPages:1});},page:function(options){return invoke("getPage",[options||{}]);},
    getSummary:function(options){return invoke("getSummary",[options||{}],{});},summary:function(options){return invoke("getSummary",[options||{}],{});},
    listEvaluations:function(options){return invoke("listEvaluations",[options||{}],[]);},
    getEvaluation:function(periodoId,cedula){return invoke("getEvaluation",[periodoId,cedula],null);},getByPeriodoCedula:function(periodoId,cedula){return invoke("getEvaluation",[periodoId,cedula],null);},
    saveEvaluation:function(row,context){return invoke("saveEvaluation",[row||{},context||{}]);},save:function(row,context){return invoke("saveEvaluation",[row||{},context||{}]);},
    saveMany:function(rows,context){return invoke("saveMany",[Array.isArray(rows)?rows:[],context||{}],[]);},
    changeModality:function(periodoId,cedula,modalidad){return invoke("changeModality",[periodoId,cedula,modalidad]);},
    saveImport:function(row){return invoke("saveImport",[row||{}]);},listImports:function(options){return invoke("listImports",[options||{}],[]);}
  };

  window.ConNcomplex=proxy;window.BDLocalConeNcomplex=proxy;window.BDLocalNcomplex=proxy;
  window.ConNcomplexLoader={version:VERSION,prepare:prepare,status:status};
  var hub=window.BDLocalConexiones;if(hub&&typeof hub.register==="function"){hub.register(SCREEN,proxy);}
  prepare().catch(function(error){try{console.error("[ConNcomplexLoader]",error);}catch(innerError){}});
})(window,document);
