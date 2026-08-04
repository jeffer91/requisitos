/* =========================================================
Nombre completo: global.bootstrap.js
Ruta o ubicación: /Global/global.bootstrap.js
Función o funciones:
- Preparar ConGlobal mediante la caché compartida sin bloquear la pantalla.
- Dejar la inicialización completa de Base Local en segundo plano.
- Validar que GlobalCore use exclusivamente ConGlobal.
- Cargar los módulos de Global en orden secuencial.
- Preparar PDF y Word antes de habilitar sus botones.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.3.0-direct-report-runtime";
  var loading={};
  var base=document.currentScript&&document.currentScript.src||document.baseURI;
  var adapterWarmup=null;

  function url(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function existing(src){return Array.prototype.slice.call(document.scripts||[]).some(function(script){return script.src===src||script.getAttribute("data-global-bootstrap-src")===src;});}
  function waitFor(test,label,timeout){
    timeout=Math.max(500,Number(timeout||15000));
    var started=Date.now();
    return new Promise(function(resolve,reject){
      (function check(){
        var value=null;
        try{value=test();}catch(error){}
        if(value){resolve(value);return;}
        if(Date.now()-started>=timeout){reject(new Error("No se pudo preparar "+label+"."));return;}
        window.setTimeout(check,40);
      })();
    });
  }
  function load(relative,test){
    var src=url(relative),ready=null;
    try{ready=test&&test();}catch(error){}
    if(ready){return Promise.resolve(ready);}
    if(loading[src]){return loading[src];}
    if(existing(src)){return test?waitFor(test,relative,15000):Promise.resolve(src);}
    loading[src]=new Promise(function(resolve,reject){
      var script=document.createElement("script");
      script.src=src;
      script.async=false;
      script.defer=false;
      script.setAttribute("data-global-bootstrap-src",src);
      script.onload=function(){
        var value=src;
        try{value=test?test():src;}catch(error){value=null;}
        value?resolve(value):reject(new Error(relative+" no expuso la API esperada."));
      };
      script.onerror=function(){reject(new Error("No se pudo cargar "+relative+"."));};
      (document.head||document.documentElement).appendChild(script);
    }).finally(function(){delete loading[src];});
    return loading[src];
  }

  function adapterReady(){
    if(window.BDLocalScreenDeps&&typeof window.BDLocalScreenDeps.ready==="function"){return window.BDLocalScreenDeps.ready();}
    if(window.BDLScreenDepsReady&&typeof window.BDLScreenDepsReady.then==="function"){return window.BDLScreenDepsReady;}
    return Promise.reject(new Error("BDLocalScreenDeps no está disponible."));
  }

  function startAdapterWarmup(){
    if(adapterWarmup){return adapterWarmup;}
    adapterWarmup=Promise.resolve().then(adapterReady).catch(function(error){
      try{console.warn("[GlobalBootstrap] Base Local continuará preparándose en segundo plano.",error);}catch(innerError){}
      return null;
    }).finally(function(){adapterWarmup=null;});
    return adapterWarmup;
  }

  function ensureConnectorModules(){
    startAdapterWarmup();
    return Promise.resolve()
      .then(function(){
        return window.BDLocalConUtils
          ?window.BDLocalConUtils
          :load("../BDLocal/conexiones/cone.utils.js",function(){return window.BDLocalConUtils;});
      })
      .then(function(){
        return window.BDLocalConexiones
          ?window.BDLocalConexiones
          :load("../BDLocal/conexiones/cone.index.js",function(){return window.BDLocalConexiones;});
      })
      .then(function(){
        return window.ConGlobal||window.BDLocalGlobal
          ?window.ConGlobal||window.BDLocalGlobal
          :load("../BDLocal/conexiones/cone.global.js",function(){return window.ConGlobal||window.BDLocalGlobal;});
      })
      .then(function(){
        return load("global.baselocal-fast.js",function(){return window.GlobalBaseLocalFast;});
      })
      .then(function(fast){
        if(fast&&typeof fast.prepareConnector==="function"){fast.prepareConnector();}
        var con=window.ConGlobal||window.BDLocalGlobal;
        if(!con){throw new Error("ConGlobal no quedó disponible.");}
        return Promise.resolve(typeof con.ready==="function"?con.ready({force:false,sharedTimeout:500}):con).then(function(){return con;});
      });
  }

  function connectorReady(){return ensureConnectorModules();}
  function pdfReady(){
    var api=window.GlobalPDF;
    return api&&typeof api.generate==="function"&&typeof api.tableForSection==="function"&&typeof api.summaryText==="function"?api:null;
  }
  function wordReady(){
    var api=window.GlobalWord;
    return api&&typeof api.generate==="function"&&api.version!=="loading"?api:null;
  }

  function boot(){
    var state=document.getElementById("globalSectionState");
    if(state){state.textContent="Leyendo Base Local";state.setAttribute("data-state","loading");}
    connectorReady()
      .then(function(){
        if(state){state.textContent="Caché local disponible";}
        return load("global.config.js",function(){return window.GlobalConfig;});
      })
      .then(function(){return load("global.core.js",function(){return window.GlobalCore;});})
      .then(function(){return load("global.connection-guard.js",function(){return window.GlobalConnectionGuard;});})
      .then(function(guard){return guard&&typeof guard.ready==="function"?guard.ready():Promise.reject(new Error("La protección de ConGlobal no está disponible."));})
      .then(function(){return load("global.table.js");})
      .then(function(){return load("global.chart.js");})
      .then(function(){return load("global.pdf.runtime.js",pdfReady);})
      .then(function(){return window.__globalPdfReady&&typeof window.__globalPdfReady.then==="function"?window.__globalPdfReady:pdfReady();})
      .then(function(api){if(!api){throw new Error("GlobalPDF no quedó disponible.");}return load("global.word.js",function(){return window.GlobalWord;});})
      .then(function(){return window.__globalWordReady&&typeof window.__globalWordReady.then==="function"?window.__globalWordReady:waitFor(wordReady,"GlobalWord",15000);})
      .then(function(api){if(!api||typeof api.generate!=="function"){throw new Error("GlobalWord no quedó disponible.");}return load("global.app.js",function(){return window.GlobalApp;});})
      .then(function(){
        var fast=window.GlobalBaseLocalFast;
        if(fast&&typeof fast.installRuntime==="function"){fast.installRuntime();}
        return load("global.ui.fix.js");
      })
      .then(function(){return load("global.index.js");})
      .then(function(){
        if(state){state.textContent="Datos listos";state.setAttribute("data-state","ready");}
        try{window.dispatchEvent(new CustomEvent("global:bootstrap-ready",{detail:{ok:true,source:"ConGlobal",strictSource:true,instantCache:true,reportsReady:true,version:VERSION}}));}catch(error){}
      })
      .catch(function(error){
        if(state){state.textContent=error.message||String(error);state.setAttribute("data-state","error");}
        try{window.dispatchEvent(new CustomEvent("global:bootstrap-error",{detail:{ok:false,source:"ConGlobal",error:error.message||String(error),version:VERSION}}));}catch(innerError){}
      });
  }

  window.GlobalBootstrap={version:VERSION,boot:boot,connectorReady:connectorReady,startAdapterWarmup:startAdapterWarmup};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
})(window,document);
