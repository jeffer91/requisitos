/* =========================================================
Nombre completo: coordi.bootstrap.js
Ruta: /Coordi/coordi.bootstrap.js
Función:
- Abrir Coordi desde la caché compartida sin reconstruir BDLocal.
- Cargar primero datos y reporte; preparar Outlook y WhatsApp después del primer render.
- Mostrar errores concretos en lugar de mantener “Conectando” indefinidamente.
========================================================= */
(function(window,document){
  "use strict";

  var loading=Object.create(null);
  var base=document.currentScript&&document.currentScript.src||document.baseURI;

  function url(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function existing(src){return Array.prototype.slice.call(document.scripts||[]).some(function(script){return script.src===src||script.getAttribute("data-coordi-bootstrap-src")===src;});}
  function setStatus(message,cls,hidden){var node=document.getElementById("coordi-status");if(node){node.hidden=hidden===true;node.textContent=message||"";node.className="coordi-status "+(cls||"");}}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(error){}}
  function waitFor(test,label,timeout){
    timeout=Math.max(500,Number(timeout||8000));var started=Date.now();
    return new Promise(function(resolve,reject){
      (function check(){var value=null;try{value=test();}catch(error){}if(value){resolve(value);return;}if(Date.now()-started>=timeout){reject(new Error("No se pudo preparar "+label+"."));return;}setTimeout(check,40);})();
    });
  }
  function load(relative,test){
    var src=url(relative);var ready=null;try{ready=test&&test();}catch(error){}
    if(ready){return Promise.resolve(ready);}if(loading[src]){return loading[src];}
    if(existing(src)){return test?waitFor(test,relative,8000):Promise.resolve(src);}
    loading[src]=new Promise(function(resolve,reject){
      var script=document.createElement("script");script.src=src;script.async=false;script.defer=false;script.setAttribute("data-coordi-bootstrap-src",src);
      script.onload=function(){var value=src;try{value=test?test():src;}catch(error){value=null;}value?resolve(value):reject(new Error(relative+" no expuso la API esperada."));};
      script.onerror=function(){reject(new Error("No se pudo cargar "+relative+"."));};
      (document.head||document.documentElement).appendChild(script);
    }).finally(function(){delete loading[src];});
    return loading[src];
  }

  function adapterReady(){
    if(window.BDLocalScreenDeps&&typeof window.BDLocalScreenDeps.ready==="function"){return window.BDLocalScreenDeps.ready({timeout:700});}
    if(window.BDLScreenDepsReady&&typeof window.BDLScreenDepsReady.then==="function"){return window.BDLScreenDepsReady;}
    return Promise.reject(new Error("La caché compartida de BDLocal no está disponible."));
  }

  function connectorReady(){
    return adapterReady()
      .then(function(){
        if(window.ConCoordi||window.BDLocalCoordi){return window.ConCoordi||window.BDLocalCoordi;}
        return load("../BDLocal/conexiones/cone.coordi.js",function(){return window.ConCoordi||window.BDLocalCoordi;});
      })
      .then(function(con){return Promise.resolve(con&&typeof con.ready==="function"?con.ready({timeout:700}):true).then(function(status){if(status&&status.ok===false){throw new Error(status.error||"ConCoordi no está listo.");}return con;});});
  }

  function scheduleCommunicationFeatures(){
    var run=function(){
      load("coo.mail.js",function(){return window.COOMail;})
        .then(function(){return load("coo.whatsapp.js",function(){return window.COOWhatsApp;});})
        .then(function(){emit("coordi:communications-ready",{ok:true,mail:true,whatsapp:true});})
        .catch(function(error){emit("coordi:communications-error",{ok:false,error:error.message||String(error)});});
    };
    if(typeof window.requestIdleCallback==="function"){window.requestIdleCallback(run,{timeout:1400});}else{window.setTimeout(run,180);}
  }

  function boot(){
    setStatus("Preparando Coordi desde la caché local...","",false);
    connectorReady()
      .then(function(){return load("../Stats/stats.rules.js",function(){return window.StatsRules;});})
      .then(function(){return load("coo.config.js",function(){return window.COOConfig;});})
      .then(function(){return load("coo.data.js",function(){return window.COOData;});})
      .then(function(){return load("coo.report.js",function(){return window.COOReport;});})
      .then(function(){return load("coo.report.compliance-fix.js",function(){return window.COOReportComplianceFix;});})
      .then(function(){return load("coo.render.js",function(){return window.COORender;});})
      .then(function(){return load("coordi.app.js",function(){return window.CoordiApp;});})
      .then(function(){return load("coordi.render-ready.js",function(){return window.CoordiRenderReady;});})
      .then(function(){
        setStatus("","",true);
        emit("coordi:bootstrap-ready",{ok:true,source:"ConCoordi",cacheFirst:true,communicationsDeferred:true});
        scheduleCommunicationFeatures();
      })
      .catch(function(error){
        setStatus("No se pudo abrir Coordi: "+(error.message||String(error)),"warn",false);
        emit("coordi:bootstrap-error",{ok:false,source:"ConCoordi",error:error.message||String(error)});
      });
  }

  window.CoordiBootstrap={version:"2.0.0-cache-first",boot:boot,connectorReady:connectorReady};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
})(window,document);
