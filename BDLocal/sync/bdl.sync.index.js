/* =========================================================
Archivo: bdl.sync.index.js
Ruta: /BDLocal/sync/bdl.sync.index.js
Función:
- Crear el punto de entrada de sincronización nueva de BDLocal.
- Usar BDLSyncOutbox para leer cambios pendientes.
- Usar BDLSyncOrchestrator para procesar destinos.
- Autocargar adaptador Firebase para notas_titulacion.
- Mantener compatibilidad inicial con BL2Sync y bdlocal-sync.manager.js.
Con qué se conecta:
- BDLocal/sync/bdl.sync.outbox.js
- BDLocal/sync/bdl.sync.orchestrator.js
- BDLocal/sync/targets/bdl.sync.targets.index.js
- BDLocal/sync/targets/bdl.sync.target.firebase.js
- js/bdlocal-config/bdlocal-sync.manager.js
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "0.3.0-block22";
  var state = { running:false, pausedReason:"", lastRunAt:"", lastResult:null };

  function text(value){ return String(value == null ? "" : value).trim(); }
  function outbox(){ return window.BDLSyncOutbox || null; }
  function orchestrator(){ return window.BDLSyncOrchestrator || null; }

  function basePath(){
    var script = document.currentScript;
    var src = script && script.getAttribute ? text(script.getAttribute("src")) : "";
    if(!src){ return "sync/"; }
    return src.slice(0, src.lastIndexOf("/") + 1);
  }

  function loadOnce(src){
    if(!src || document.querySelector('script[data-bdl-sync-extra="' + src + '"]')){ return; }
    var script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.bdlSyncExtra = src;
    document.body.appendChild(script);
  }

  function loadExtraTargets(){
    if(window.BDLSyncTargetFirebase){ return; }
    loadOnce(basePath() + "targets/bdl.sync.target.firebase.js");
  }

  function setPaused(reason){ state.pausedReason = text(reason || ""); return state.pausedReason; }
  function isPaused(){ return !!state.pausedReason; }

  function status(){
    loadExtraTargets();
    var base = {
      version: VERSION,
      running: !!state.running,
      paused: isPaused(),
      pausedReason: state.pausedReason,
      lastRunAt: state.lastRunAt,
      lastResult: state.lastResult,
      targets: window.BDLSyncTargets && typeof window.BDLSyncTargets.list === "function" ? window.BDLSyncTargets.list() : [],
      outboxReady: !!outbox(),
      orchestratorReady: !!orchestrator()
    };
    if(orchestrator() && typeof orchestrator().status === "function"){
      return orchestrator().status().then(function(detail){ return Object.assign(base, { detail:detail }); });
    }
    if(outbox() && typeof outbox().counts === "function"){
      return outbox().counts({}).then(function(counts){ return Object.assign(base, { counts:counts }); });
    }
    return Promise.resolve(base);
  }

  function request(options){
    options = options || {};
    loadExtraTargets();
    if(isPaused()){
      state.lastResult = { ok:false, paused:true, message:"Sincronización pausada: " + state.pausedReason };
      return Promise.resolve(state.lastResult);
    }
    state.lastRunAt = new Date().toISOString();
    if(orchestrator() && typeof orchestrator().syncQueue === "function"){
      state.running = true;
      return orchestrator().syncQueue(options).then(function(result){ state.running = false; state.lastResult = result; return result; }).catch(function(error){ state.running = false; state.lastResult = { ok:false, message:error.message || String(error) }; return state.lastResult; });
    }
    state.lastResult = { ok:true, mode:"prepared_only", message:"BDLSyncV2 preparado, pero el orquestador todavía no está cargado.", options:options };
    return Promise.resolve(state.lastResult);
  }

  window.BDLSyncV2 = { version:VERSION, status:status, request:request, syncQueue:request, setPaused:setPaused, isPaused:isPaused, loadExtraTargets:loadExtraTargets };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", loadExtraTargets);
  }else{
    loadExtraTargets();
  }
})(window, document);
