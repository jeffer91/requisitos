/* =========================================================
Nombre completo: coordi.bootstrap.js
Ruta o ubicación: /Coordi/coordi.bootstrap.js
Función o funciones:
- Esperar a BDLocalScreenDeps.
- Cargar cone.coordi.js antes de los módulos de Coordi.
- Evitar rutas paralelas y condiciones de carrera.
========================================================= */
(function(window,document){
  "use strict";
  var loading={};
  var base=document.currentScript&&document.currentScript.src||document.baseURI;
  function url(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function existing(src){return Array.prototype.slice.call(document.scripts||[]).some(function(script){return script.src===src||script.getAttribute("data-coordi-bootstrap-src")===src;});}
  function waitFor(test,label,timeout){
    timeout=Math.max(500,Number(timeout||15000));var started=Date.now();
    return new Promise(function(resolve,reject){
      (function check(){var value=null;try{value=test();}catch(error){}if(value){resolve(value);return;}if(Date.now()-started>=timeout){reject(new Error("No se pudo preparar "+label+"."));return;}setTimeout(check,40);})();
    });
  }
  function load(relative,test){
    var src=url(relative),ready=null;try{ready=test&&test();}catch(error){}
    if(ready){return Promise.resolve(ready);}if(loading[src]){return loading[src];}if(existing(src)){return waitFor(test||function(){return true;},relative,15000);}
    loading[src]=new Promise(function(resolve,reject){
      var script=document.createElement("script");script.src=src;script.async=false;script.defer=false;script.setAttribute("data-coordi-bootstrap-src",src);
      script.onload=function(){var value=true;try{value=test?test():true;}catch(error){value=null;}value?resolve(value):reject(new Error(relative+" no expuso la API esperada."));};
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
  function connectorReady(){
    return adapterReady().then(function(){
      if(window.ConCoordi||window.BDLocalCoordi){return window.ConCoordi||window.BDLocalCoordi;}
      return load("../BDLocal/conexiones/cone.coordi.js",function(){return window.ConCoordi||window.BDLocalCoordi;});
    }).then(function(con){
      return Promise.resolve(con&&typeof con.ready==="function"?con.ready():true).then(function(status){if(status&&status.ok===false){throw new Error(status.error||"ConCoordi no está listo.");}return con;});
    });
  }
  function boot(){
    var status=document.getElementById("coordi-status");
    if(status){status.hidden=false;status.textContent="Conectando Coordi con BDLocal...";}
    connectorReady()
      .then(function(){return load("../Stats/stats.rules.js",function(){return window.StatsRules;});})
      .then(function(){return load("coo.config.js",function(){return window.COOConfig;});})
      .then(function(){return load("coo.data.js",function(){return window.COOData;});})
      .then(function(){return load("coo.report.js",function(){return window.COOReport;});})
      .then(function(){return load("coo.render.js",function(){return window.COORender;});})
      .then(function(){return load("coo.mail.js",function(){return window.COOMail;});})
      .then(function(){return load("coo.whatsapp.js",function(){return window.COOWhatsApp;});})
      .then(function(){return load("coordi.app.js",function(){return window.CoordiApp;});})
      .then(function(){try{window.dispatchEvent(new CustomEvent("coordi:bootstrap-ready",{detail:{ok:true,source:"ConCoordi"}}));}catch(error){}})
      .catch(function(error){if(status){status.hidden=false;status.textContent=error.message||String(error);status.className="coordi-status warn";}try{window.dispatchEvent(new CustomEvent("coordi:bootstrap-error",{detail:{ok:false,source:"ConCoordi",error:error.message||String(error)}}));}catch(innerError){}});
  }
  window.CoordiBootstrap={version:"1.0.0-concoordi",boot:boot,connectorReady:connectorReady};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
})(window,document);
