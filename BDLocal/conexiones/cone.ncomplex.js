/* =========================================================
Nombre completo: cone.ncomplex.js
Ruta: /BDLocal/conexiones/cone.ncomplex.js
Función:
- Preparar internamente esquema V3, repositorios y servicios.
- Cargar la API de ConNcomplex después de confirmar dependencias.
- Ser la única entrada conocida por la pantalla Ncomplex.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="2.0.0-self-contained-loader";
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

  function prepare(){
    if(window.ConNcomplex&&typeof window.ConNcomplex.ready==="function"){return Promise.resolve(window.ConNcomplex);}
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
        {path:"cone.ncomplex.api.js",test:function(){return window.ConNcomplex;}}
      ]);
    }).then(function(){
      if(!window.ConNcomplex){throw new Error("cone.ncomplex.api.js no expuso ConNcomplex.");}
      return window.ConNcomplex;
    }).catch(function(error){lastError=error&&error.message?error.message:String(error);throw error;}).finally(function(){readyPromise=null;});
    return readyPromise;
  }

  window.ConNcomplexLoader={version:VERSION,prepare:prepare,status:function(){return {ok:!lastError,ready:!!window.ConNcomplex,source:"ConNcomplex",error:lastError};}};
  prepare().catch(function(error){try{console.error("[ConNcomplexLoader]",error);}catch(innerError){}});
})(window,document);
