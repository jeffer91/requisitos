/* =========================================================
Nombre completo: stats.bootstrap.js
Ruta: /Stats/stats.bootstrap.js
Función:
- Abrir Stats desde la caché compartida.
- Cargar primero cálculo e interfaz y diferir Firebase/Telegram hasta después del primer render.
- Cargar el reporte de cierre del período después de StatsApp.
- Cargar la exportación XLSX/PDF de la vista de estudiantes.
- Mostrar errores concretos en lugar de permanecer indefinidamente en “Conectando”.
========================================================= */
(function(window,document){
  "use strict";

  var loading=Object.create(null);
  var base=document.currentScript&&document.currentScript.src||document.baseURI;

  function url(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function existing(src){return Array.prototype.slice.call(document.scripts||[]).some(function(script){return script.src===src||script.getAttribute("data-stats-bootstrap-src")===src;});}
  function setStatus(message,cls){var node=document.getElementById("stats-status");if(node){node.textContent=message;node.className="stats-status "+(cls||"");}}
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
      var script=document.createElement("script");script.src=src;script.async=false;script.defer=false;script.setAttribute("data-stats-bootstrap-src",src);
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
        if(window.ConStats||window.BDLocalStats){return window.ConStats||window.BDLocalStats;}
        return load("../BDLocal/conexiones/cone.stats.js",function(){return window.ConStats||window.BDLocalStats;});
      })
      .then(function(con){return Promise.resolve(con&&typeof con.ready==="function"?con.ready({timeout:700}):true).then(function(status){if(status&&status.ok===false){throw new Error(status.error||"ConStats no está listo.");}return con;});})
      .then(function(con){
        return load("../BDLocal/conexiones/cone.stats.notes.js",function(){return window.ConStatsNotes&&window.ConStatsNotes.install&&window.ConStatsNotes.install()?window.ConStatsNotes:null;})
          .then(function(){if(typeof con.listNotes!=="function"){throw new Error("ConStats.listNotes no quedó disponible.");}return con;});
      });
  }

  function scheduleOptionalConnectorFeatures(){
    var run=function(){
      load("../BDLocal/conexiones/cone.stats.firebase.js",function(){return window.ConStatsFirebase&&window.ConStatsFirebase.install&&window.ConStatsFirebase.install()?window.ConStatsFirebase:null;})
        .then(function(){return load("stats.telegram.firebase-sync.js",function(){return window.StatsTelegramFirebaseSync;});})
        .then(function(){emit("stats:optional-ready",{ok:true,officialRefresh:!!(window.ConStats&&window.ConStats.refreshOfficialStudents),telegram:true});})
        .catch(function(error){emit("stats:optional-error",{ok:false,error:error.message||String(error)});});
    };
    if(typeof window.requestIdleCallback==="function"){window.requestIdleCallback(run,{timeout:1800});}else{window.setTimeout(run,250);}
  }

  function boot(){
    setStatus("Preparando estadísticas desde la caché local...","");
    connectorReady()
      .then(function(){return load("stats.data.connector-patch.js",function(){return window.StatsDataPatch;});})
      .then(function(patch){return patch&&typeof patch.ready==="function"?patch.ready():true;})
      .then(function(){return load("stats.rules.js",function(){return window.StatsRules;});})
      .then(function(){return load("stats.notes.guard.js");})
      .then(function(){return load("stats.core.js",function(){return window.StatsCore;});})
      .then(function(){return load("stats.sede.filter.js",function(){return window.StatsSedeFilter;});})
      .then(function(){return load("stats.carrera.guard.js");})
      .then(function(){return load("stats.filters.patch.js",function(){return window.StatsFiltersPatch;});})
      .then(function(){return load("stats.charts.js",function(){return window.StatsCharts;});})
      .then(function(){return load("stats.tables.js",function(){return window.StatsTables;});})
      .then(function(){return load("stats.students.js",function(){return window.StatsStudents;});})
      .then(function(){return load("stats.students.export.js",function(){return window.StatsStudentsExport;});})
      .then(function(){return load("stats.notes.js",function(){return window.StatsNotes;});})
      .then(function(){return load("stats.ui.patch.js",function(){return window.StatsUIPatch;});})
      .then(function(){return load("stats.app.js",function(){return window.StatsApp;});})
      .then(function(){return load("stats.closure.js",function(){return window.StatsClosure;});})
      .then(function(){return load("stats.summary.js",function(){return window.StatsSummary;});})
      .then(function(){return load("stats.sections.js",function(){return window.StatsSections;});})
      .then(function(){return load("stats.render-ready.js",function(){return window.StatsRenderReady;});})
      .then(function(){
        if(window.StatsSedeFilter&&typeof window.StatsSedeFilter.install==="function"){window.StatsSedeFilter.install();}
        if(window.StatsStudentsExport&&typeof window.StatsStudentsExport.install==="function"){window.StatsStudentsExport.install();}
        emit("stats:bootstrap-ready",{ok:true,source:"ConStats",cacheFirst:true,directFirebase:false,optionalDeferred:true,closureReport:true,studentExports:true});
        scheduleOptionalConnectorFeatures();
      })
      .catch(function(error){
        setStatus("No se pudo abrir Stats: "+(error.message||String(error)),"warn");
        emit("stats:bootstrap-error",{ok:false,source:"ConStats",error:error.message||String(error)});
      });
  }

  window.StatsBootstrap={version:"2.2.0-student-exports",boot:boot,connectorReady:connectorReady};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
})(window,document);
