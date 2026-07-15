/* =========================================================
Nombre completo: repo.bootstrap.js
Ruta o ubicación: /Reportes/repo.bootstrap.js
Función o funciones:
- Esperar a que BDLocalScreenDeps prepare las conexiones.
- Cargar cone.reportes.js antes de RepoCore y RepoApp.
- Cargar reglas y módulos de Reportes en orden secuencial.
========================================================= */
(function(window,document){
  "use strict";

  var loading={};
  var base=document.currentScript&&document.currentScript.src||document.baseURI;

  function url(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function existing(src){return Array.prototype.slice.call(document.scripts||[]).some(function(script){return script.src===src||script.getAttribute("data-repo-bootstrap-src")===src;});}
  function waitFor(test,label,timeout){
    timeout=Math.max(500,Number(timeout||15000));var started=Date.now();
    return new Promise(function(resolve,reject){
      (function check(){var value=null;try{value=test();}catch(error){}if(value){resolve(value);return;}if(Date.now()-started>=timeout){reject(new Error("No se pudo preparar "+label+"."));return;}setTimeout(check,40);})();
    });
  }
  function load(relative,test){
    var src=url(relative),ready=null;try{ready=test&&test();}catch(error){}
    if(ready){return Promise.resolve(ready);}if(loading[src]){return loading[src];}if(existing(src)){return test?waitFor(test,relative,15000):Promise.resolve(src);}
    loading[src]=new Promise(function(resolve,reject){
      var script=document.createElement("script");script.src=src;script.async=false;script.defer=false;script.setAttribute("data-repo-bootstrap-src",src);
      script.onload=function(){var value=src;try{value=test?test():src;}catch(error){value=null;}value?resolve(value):reject(new Error(relative+" no expuso la API esperada."));};
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
      if(window.ConReportes||window.BDLocalReportes){return window.ConReportes||window.BDLocalReportes;}
      return load("../BDLocal/conexiones/cone.reportes.js",function(){return window.ConReportes||window.BDLocalReportes;});
    }).then(function(con){
      return Promise.resolve(con&&typeof con.ready==="function"?con.ready():true).then(function(status){if(status&&status.ok===false){throw new Error(status.error||"ConReportes no está listo.");}return con;});
    });
  }
  function boot(){
    var status=document.getElementById("repo-status");
    if(status){status.textContent="Conectando Reportes con BDLocal...";}
    connectorReady()
      .then(function(){return load("../Stats/stats.rules.js",function(){return window.StatsRules;});})
      .then(function(){return load("repo.core.js",function(){return window.RepoCore;});})
      .then(function(){return load("repo.export.js",function(){return window.RepoExport;});})
      .then(function(){return load("repo.app.js",function(){return window.RepoApp;});})
      .then(function(){try{window.dispatchEvent(new CustomEvent("reportes:bootstrap-ready",{detail:{ok:true,source:"ConReportes"}}));}catch(error){}})
      .catch(function(error){if(status){status.textContent=error.message||String(error);status.className="repo-status warn";}try{window.dispatchEvent(new CustomEvent("reportes:bootstrap-error",{detail:{ok:false,source:"ConReportes",error:error.message||String(error)}}));}catch(innerError){}});
  }

  window.RepoBootstrap={version:"1.0.0-conreportes",boot:boot,connectorReady:connectorReady};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
})(window,document);
