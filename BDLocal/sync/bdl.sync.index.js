/* =========================================================
Archivo: bdl.sync.index.js
Ruta: /BDLocal/sync/bdl.sync.index.js
Función:
- Crear el punto de entrada de sincronización nueva de BDLocal.
- Preparar orquestador futuro basado en cambios_pendientes.
- Mantener compatibilidad inicial con BL2Sync y bdlocal-sync.manager.js.
Con qué se conecta:
- BDLocal/sync/targets/bdl.sync.targets.index.js
- js/bdlocal-config/bdlocal-sync.manager.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.1.0-block1";
  var state = {
    running: false,
    pausedReason: "",
    lastRunAt: "",
    lastResult: null
  };

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function setPaused(reason){
    state.pausedReason = text(reason || "");
    return state.pausedReason;
  }

  function isPaused(){
    return !!state.pausedReason;
  }

  function status(){
    return {
      version: VERSION,
      running: !!state.running,
      paused: isPaused(),
      pausedReason: state.pausedReason,
      lastRunAt: state.lastRunAt,
      lastResult: state.lastResult,
      targets: window.BDLSyncTargets && typeof window.BDLSyncTargets.list === "function" ? window.BDLSyncTargets.list() : []
    };
  }

  function request(options){
    options = options || {};
    state.lastRunAt = new Date().toISOString();
    state.lastResult = {
      ok: true,
      mode: "prepared_only",
      message: "BDLSyncV2 preparado. La sincronización real sigue en el manager actual hasta el bloque de sync.",
      options: options
    };
    return Promise.resolve(state.lastResult);
  }

  window.BDLSyncV2 = {
    version: VERSION,
    status: status,
    request: request,
    setPaused: setPaused,
    isPaused: isPaused
  };
})(window);
