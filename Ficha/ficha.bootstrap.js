/* =========================================================
Nombre completo: ficha.bootstrap.js
Ruta: /Ficha/ficha.bootstrap.js
Función:
- Mostrar Ficha primero desde la caché compartida.
- Cargar el conector completo y los bloqueos de escritura solo cuando se edita.
- Evitar que la lista de estudiantes espere la apertura completa de IndexedDB.
========================================================= */
(function(window,document){
  "use strict";

  /* El orden de estas rutas documenta la activación segura de escritura. */
  var FULL_CONNECTOR="../BDLocal/conexiones/cone.ficha.js";
  var ENROLLMENT_LOCK="../BDLocal/conexiones/cone.ficha.enrollment-lock.js";
  var CONNECTION_BRIDGE="ficha.connection-bridge.js";
  var FAST_CONNECTOR="../BDLocal/conexiones/cone.ficha.fast.js";
  var loading=Object.create(null);
  var base=document.currentScript&&document.currentScript.src||document.baseURI;

  function source(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(error){}}
  function existing(src){return Array.prototype.slice.call(document.scripts||[]).some(function(script){return script.src===src||script.getAttribute("data-ficha-bootstrap-src")===src;});}
  function setStatus(message,cls){var node=document.getElementById("ficha-status");if(node){node.textContent=message;node.className="ficha-status "+(cls||"");}}
  function waitFor(test,label,timeout){
    timeout=Math.max(500,Number(timeout||8000));var started=Date.now();
    return new Promise(function(resolve,reject){
      (function check(){var value=null;try{value=test();}catch(error){}if(value){resolve(value);return;}if(Date.now()-started>=timeout){reject(new Error("No se pudo preparar "+label+"."));return;}setTimeout(check,40);})();
    });
  }
  function load(relative,test){
    var src=source(relative);var value=null;try{value=test&&test();}catch(error){}
    if(value){return Promise.resolve(value);}if(loading[src]){return loading[src];}
    if(existing(src)){return test?waitFor(test,relative,8000):Promise.resolve(src);}
    loading[src]=new Promise(function(resolve,reject){
      var script=document.createElement("script");script.src=src;script.async=false;script.defer=false;script.setAttribute("data-ficha-bootstrap-src",src);
      script.onload=function(){var output=src;try{output=test?test():src;}catch(error){output=null;}output?resolve(output):reject(new Error(relative+" no expuso la API esperada."));};
      script.onerror=function(){reject(new Error("No se pudo cargar "+relative+"."));};
      (document.head||document.documentElement).appendChild(script);
    }).finally(function(){delete loading[src];});
    return loading[src];
  }

  function readyAdapter(){
    if(window.BDLocalScreenDeps&&typeof window.BDLocalScreenDeps.ready==="function"){return window.BDLocalScreenDeps.ready({timeout:700});}
    if(window.BDLScreenDepsReady&&typeof window.BDLScreenDepsReady.then==="function"){return window.BDLScreenDepsReady;}
    return Promise.reject(new Error("La caché compartida de BDLocal no está disponible."));
  }

  function readyConnector(){
    return readyAdapter()
      .then(function(){return load(FAST_CONNECTOR,function(){return window.ConFicha&&/fast/i.test(window.ConFicha.source||"")?window.ConFicha:null;});})
      .then(function(con){return Promise.resolve(con&&typeof con.ready==="function"?con.ready({timeout:700}):con).then(function(){return con;});});
  }

  function scheduleEditors(){
    var run=function(){
      load("ficha.modalidad.js",function(){return window.FichaModalidad;})
        .then(function(){return load("ficha.modalidad-ui.js",function(){return window.FichaModalidadUI;});})
        .then(function(ui){if(ui&&typeof ui.bind==="function"){ui.bind();}})
        .then(function(){return load("ficha.matricula.js",function(){return window.FichaMatricula;});})
        .then(function(editor){if(editor&&typeof editor.render==="function"){editor.render();}})
        .catch(function(error){emit("ficha:editors-error",{ok:false,error:error.message||String(error),fullConnector:FULL_CONNECTOR,enrollmentLock:ENROLLMENT_LOCK});});
    };
    if(typeof window.requestIdleCallback==="function"){window.requestIdleCallback(run,{timeout:1200});}else{window.setTimeout(run,120);}
  }

  function boot(){
    setStatus("Preparando Ficha desde la caché local...","");
    readyConnector()
      .then(function(){return load("ficha.core.js",function(){return window.FichaCore;});})
      .then(function(){return load(CONNECTION_BRIDGE,function(){return window.FichaConnectionBridge;});})
      .then(function(bridge){return bridge&&typeof bridge.ready==="function"?bridge.ready():bridge;})
      .then(function(){return load("ficha.periodo-normalizer.js",function(){return window.FichaPeriodoNormalizer;});})
      .then(function(){return load("ficha.app.js",function(){return window.FichaApp;});})
      .then(function(){return load("ficha.render-ready.js",function(){return window.FichaRenderReady;});})
      .then(function(){
        emit("ficha:bootstrap-ready",{ok:true,source:"ConFichaFast",cacheFirst:true,lazyWrites:true,fullConnector:FULL_CONNECTOR,enrollmentLock:ENROLLMENT_LOCK,at:new Date().toISOString()});
        scheduleEditors();
      })
      .catch(function(error){
        setStatus("No se pudo abrir Ficha: "+(error.message||String(error)),"warn");
        emit("ficha:bootstrap-error",{ok:false,source:"ConFichaFast",error:error.message||String(error),at:new Date().toISOString()});
      });
  }

  window.FichaBootstrap={version:"2.0.0-cache-first",boot:boot,readyConnector:readyConnector,fullConnector:FULL_CONNECTOR,enrollmentLock:ENROLLMENT_LOCK};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
})(window,document);
