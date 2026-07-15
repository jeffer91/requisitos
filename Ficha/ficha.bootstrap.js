/* =========================================================
Nombre completo: ficha.bootstrap.js
Ruta o ubicación: /Ficha/ficha.bootstrap.js
Función o funciones:
- Esperar a que BDLocalScreenDeps termine de preparar conexiones.
- Cargar cone.ficha.js antes de FichaCore y FichaApp.
- Instalar el puente de ConFicha y evitar condiciones de carrera.
- Cargar los editores confirmados de matrícula y modalidad.
Con qué se conecta:
- ../BDLocal/adapters/bdl.screen-deps.js
- ../BDLocal/conexiones/cone.ficha.js
- ficha.core.js
- ficha.connection-bridge.js
- ficha.periodo-normalizer.js
- ficha.app.js
- ficha.modalidad.js
- ficha.modalidad-ui.js
- ficha.matricula.js
========================================================= */
(function(window,document){
  "use strict";

  var loading={};
  var base=document.currentScript&&document.currentScript.src||document.baseURI;

  function source(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(error){}}
  function existing(src){return Array.prototype.slice.call(document.scripts||[]).some(function(script){return script.src===src||script.getAttribute("data-ficha-bootstrap-src")===src;});}
  function waitFor(test,label,timeout){
    timeout=Math.max(500,Number(timeout||15000));var started=Date.now();
    return new Promise(function(resolve,reject){
      (function check(){
        var value=null;try{value=test();}catch(error){}
        if(value){resolve(value);return;}
        if(Date.now()-started>=timeout){reject(new Error("No se pudo preparar "+label+"."));return;}
        setTimeout(check,40);
      })();
    });
  }
  function load(relative,test){
    var src=source(relative);var value=null;try{value=test&&test();}catch(error){}
    if(value){return Promise.resolve(value);}
    if(loading[src]){return loading[src];}
    if(existing(src)){return waitFor(test||function(){return true;},relative,15000);}
    loading[src]=new Promise(function(resolve,reject){
      var script=document.createElement("script");script.src=src;script.async=false;script.defer=false;script.setAttribute("data-ficha-bootstrap-src",src);
      script.onload=function(){var output=true;try{output=test?test():true;}catch(error){output=null;}output?resolve(output):reject(new Error(relative+" no expuso la API esperada."));};
      script.onerror=function(){reject(new Error("No se pudo cargar "+relative+"."));};
      (document.head||document.documentElement).appendChild(script);
    }).finally(function(){delete loading[src];});
    return loading[src];
  }
  function readyAdapter(){
    if(window.BDLocalScreenDeps&&typeof window.BDLocalScreenDeps.ready==="function"){return window.BDLocalScreenDeps.ready();}
    if(window.BDLScreenDepsReady&&typeof window.BDLScreenDepsReady.then==="function"){return window.BDLScreenDepsReady;}
    return Promise.reject(new Error("BDLocalScreenDeps no está disponible."));
  }
  function readyConnector(){
    return readyAdapter().then(function(){
      if(window.ConFicha){return window.ConFicha;}
      return load("../BDLocal/conexiones/cone.ficha.js",function(){return window.ConFicha||window.BDLocalFicha;});
    }).then(function(con){
      return Promise.resolve(con&&typeof con.ready==="function"?con.ready():true).then(function(status){
        if(status&&status.ok===false){throw new Error(status.error||"ConFicha no está listo.");}
        return con;
      });
    });
  }
  function boot(){
    var status=document.getElementById("ficha-status");if(status){status.textContent="Conectando Ficha con BDLocal...";}
    readyConnector()
      .then(function(){return load("ficha.core.js",function(){return window.FichaCore;});})
      .then(function(){return load("ficha.connection-bridge.js",function(){return window.FichaConnectionBridge;});})
      .then(function(bridge){return bridge&&typeof bridge.ready==="function"?bridge.ready():bridge;})
      .then(function(){return load("ficha.periodo-normalizer.js",function(){return window.FichaPeriodoNormalizer;});})
      .then(function(){return load("ficha.app.js",function(){return window.FichaApp;});})
      .then(function(){return load("ficha.modalidad.js",function(){return window.FichaModalidad;});})
      .then(function(){return load("ficha.modalidad-ui.js",function(){return window.FichaModalidadUI;});})
      .then(function(ui){if(ui&&typeof ui.bind==="function"){ui.bind();}return ui;})
      .then(function(){return load("ficha.matricula.js",function(){return window.FichaMatricula;});})
      .then(function(editor){if(editor&&typeof editor.render==="function"){editor.render();}})
      .then(function(){
        emit("ficha:bootstrap-ready",{ok:true,source:"ConFicha",editors:["matricula","modalidad"],at:new Date().toISOString()});
      })
      .catch(function(error){
        if(status){status.textContent=error.message||String(error);status.className="ficha-status warn";}
        emit("ficha:bootstrap-error",{ok:false,source:"ConFicha",error:error.message||String(error),at:new Date().toISOString()});
      });
  }

  window.FichaBootstrap={version:"1.1.0-ficha-editors",boot:boot,readyConnector:readyConnector};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
})(window,document);