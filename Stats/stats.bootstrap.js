/* =========================================================
Nombre completo: stats.bootstrap.js
Ruta o ubicación: /Stats/stats.bootstrap.js
Función o funciones:
- Esperar a que BDLocalScreenDeps prepare las conexiones.
- Cargar ConStats, notas, filtros e interfaz en orden secuencial.
- Evitar rutas paralelas de datos y condiciones de carrera.
========================================================= */
(function(window,document){
  "use strict";

  var loading={};
  var base=document.currentScript&&document.currentScript.src||document.baseURI;

  function url(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function existing(src){return Array.prototype.slice.call(document.scripts||[]).some(function(script){return script.src===src||script.getAttribute("data-stats-bootstrap-src")===src;});}
  function waitFor(test,label,timeout){
    timeout=Math.max(500,Number(timeout||15000));
    var started=Date.now();
    return new Promise(function(resolve,reject){
      (function check(){
        var value=null;
        try{value=test();}catch(error){}
        if(value){resolve(value);return;}
        if(Date.now()-started>=timeout){reject(new Error("No se pudo preparar "+label+"."));return;}
        setTimeout(check,40);
      })();
    });
  }
  function load(relative,test){
    var src=url(relative);
    var ready=null;
    try{ready=test&&test();}catch(error){}
    if(ready){return Promise.resolve(ready);}
    if(loading[src]){return loading[src];}
    if(existing(src)){return test?waitFor(test,relative,15000):Promise.resolve(src);}
    loading[src]=new Promise(function(resolve,reject){
      var script=document.createElement("script");
      script.src=src;
      script.async=false;
      script.defer=false;
      script.setAttribute("data-stats-bootstrap-src",src);
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
  function connectorReady(){
    return adapterReady().then(function(){
      if(window.ConStats||window.BDLocalStats){return window.ConStats||window.BDLocalStats;}
      return load("../BDLocal/conexiones/cone.stats.js",function(){return window.ConStats||window.BDLocalStats;});
    }).then(function(con){
      return Promise.resolve(con&&typeof con.ready==="function"?con.ready():true).then(function(status){
        if(status&&status.ok===false){throw new Error(status.error||"ConStats no está listo.");}
        return con;
      });
    });
  }
  function boot(){
    var status=document.getElementById("stats-status");
    if(status){status.textContent="Conectando Stats con BDLocal...";}
    connectorReady()
      .then(function(){return load("stats.data.patch.js",function(){return window.StatsDataPatch;});})
      .then(function(patch){return patch&&typeof patch.ready==="function"?patch.ready():true;})
      .then(function(){return load("stats.rules.js",function(){return window.StatsRules;});})
      .then(function(){return load("stats.notes.guard.js");})
      .then(function(){return load("stats.core.js",function(){return window.StatsCore;});})
      .then(function(){return load("stats.carrera.guard.js");})
      .then(function(){return load("stats.filters.patch.js",function(){return window.StatsFiltersPatch;});})
      .then(function(){return load("stats.charts.js",function(){return window.StatsCharts;});})
      .then(function(){return load("stats.tables.js",function(){return window.StatsTables;});})
      .then(function(){return load("stats.students.js",function(){return window.StatsStudents;});})
      .then(function(){return load("stats.notes.js",function(){return window.StatsNotes;});})
      .then(function(){return load("stats.ui.patch.js",function(){return window.StatsUIPatch;});})
      .then(function(){return load("stats.app.js",function(){return window.StatsApp;});})
      .then(function(){return load("stats.summary.js",function(){return window.StatsSummary;});})
      .then(function(){return load("stats.sections.js",function(){return window.StatsSections;});})
      .then(function(){
        try{window.dispatchEvent(new CustomEvent("stats:bootstrap-ready",{detail:{ok:true,source:"ConStats"}}));}catch(error){}
      })
      .catch(function(error){
        if(status){status.textContent=error.message||String(error);status.className="stats-status warn";}
        try{window.dispatchEvent(new CustomEvent("stats:bootstrap-error",{detail:{ok:false,source:"ConStats",error:error.message||String(error)}}));}catch(innerError){}
      });
  }

  window.StatsBootstrap={version:"1.1.0-connected-stats",boot:boot,connectorReady:connectorReady};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
})(window,document);
