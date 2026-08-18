/* =========================================================
Nombre completo: carga.index.js
Ruta o ubicación: /Carga/carga.index.js
Función o funciones:
- Preparar BDLocal, cone.carga.js y sus operaciones exclusivas.
- Aplicar correcciones de integridad antes de habilitar la interfaz.
- Exponer una única preparación del conector para la interfaz.
- Evitar refrescos duplicados durante el arranque.
- Reintentar auditorías pendientes después de recuperar la conexión.
========================================================= */
(function(window,document){
  "use strict";

  var ADAPTER_PATH="../BDLocal/adapters/bdl.screen-deps.js";
  var CONNECTOR_PATH="../BDLocal/conexiones/cone.carga.js";
  var OPS_PATH="../BDLocal/conexiones/cone.carga.ops.js";
  var FIXES_PATH="./carga.integrity-fixes.js";
  var loading={};
  var connectorTask=null;

  function resolve(relative){try{return new URL(relative,window.location.href).href;}catch(error){return relative;}}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(error){}}
  function connector(){return window.ConCarga||window.BDLocalCarga||null;}
  function scriptExists(src){return Array.prototype.slice.call(document.scripts||[]).some(function(script){return script.src===src||script.getAttribute("data-carga-connection-src")===src;});}
  function waitFor(test,label){
    var started=Date.now();
    return new Promise(function(resolvePromise,reject){(function check(){var value=null;try{value=test();}catch(error){}if(value){resolvePromise(value);return;}if(Date.now()-started>15000){reject(new Error("No se preparó "+label+"."));return;}setTimeout(check,40);})();});
  }
  function loadScript(relative,test){
    var src=resolve(relative),existing=null;try{existing=test();}catch(error){}
    if(existing){return Promise.resolve(existing);}if(loading[src]){return loading[src];}if(scriptExists(src)){return waitFor(test,relative);}
    loading[src]=new Promise(function(resolvePromise,reject){var script=document.createElement("script");script.src=src;script.async=false;script.defer=false;script.setAttribute("data-carga-connection-src",src);script.onload=function(){var value=null;try{value=test();}catch(error){}value?resolvePromise(value):reject(new Error(relative+" no expuso la API esperada."));};script.onerror=function(){reject(new Error("No se pudo cargar "+src));};document.head.appendChild(script);}).finally(function(){delete loading[src];});
    return loading[src];
  }
  function ensureAdapter(){
    if(window.BDLocalScreenDeps&&typeof window.BDLocalScreenDeps.ready==="function"){return window.BDLocalScreenDeps.ready();}
    if(window.BDLScreenDepsReady&&typeof window.BDLScreenDepsReady.then==="function"){return window.BDLScreenDepsReady;}
    return loadScript(ADAPTER_PATH,function(){return window.BDLocalScreenDeps;}).then(function(adapter){return adapter&&typeof adapter.ready==="function"?adapter.ready():adapter;});
  }
  function ensureConnector(){
    if(connectorTask){return connectorTask;}
    connectorTask=ensureAdapter()
      .then(function(){return connector()||loadScript(CONNECTOR_PATH,connector);})
      .then(function(){return loadScript(OPS_PATH,function(){var con=connector();return con&&typeof con.listStudents==="function"&&typeof con.saveDivisions==="function"?con:null;});})
      .then(function(con){
        return loadScript(FIXES_PATH,function(){return window.CargaIntegrityFixes;}).then(function(fixes){
          return Promise.resolve(fixes&&typeof fixes.patch==="function"?fixes.patch():con).then(function(){return con;});
        });
      })
      .then(function(con){return Promise.resolve(typeof con.ready==="function"?con.ready():true).then(function(status){if(status&&status.ok===false){throw new Error(status.error||"ConCarga no está listo.");}return con;});})
      .catch(function(error){connectorTask=null;throw error;});
    return connectorTask;
  }
  function refreshPeriods(){
    return ensureConnector().then(function(con){return typeof con.getPeriods==="function"?con.getPeriods():typeof con.listPeriods==="function"?con.listPeriods():[];}).then(function(periods){periods=Array.isArray(periods)?periods:[];emit("carga:periods-refreshed",{ok:true,source:"ConCarga",periods:periods,total:periods.length,at:new Date().toISOString()});return periods;});
  }
  function retryAudits(){
    if(!window.CargaSave||typeof window.CargaSave.retryPendingAudits!=="function"){return Promise.resolve({ok:true,total:0,saved:0,pending:0});}
    return window.CargaSave.retryPendingAudits().then(function(result){result=result||{};if(Number(result.saved||0)>0||Number(result.pending||0)>0){emit("carga:audit-recovery",Object.assign({source:"CargaConnectionIndex",at:new Date().toISOString()},result));}return result;});
  }
  function boot(){
    ensureConnector().then(function(con){
      emit("carga:bdlocal-ready",{ok:true,source:"ConCarga",status:typeof con.status==="function"?con.status():{},at:new Date().toISOString()});
      emit("carga:connection-ready",{ok:true,source:"ConCarga",app:window.CargaApp&&window.CargaApp.version||"",ui:window.CargaUI&&window.CargaUI.version||"",at:new Date().toISOString()});
      return retryAudits();
    }).catch(function(error){emit("carga:bdlocal-error",{ok:false,source:"ConCarga",error:error.message||String(error),at:new Date().toISOString()});});
  }

  window.CargaConnectionIndex={version:"4.2.0-integrity-fixes",ensureConnector:ensureConnector,refreshPeriods:refreshPeriods,retryAudits:retryAudits};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
})(window,document);
