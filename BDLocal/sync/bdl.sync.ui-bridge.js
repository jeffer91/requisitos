/* =========================================================
Archivo: bdl.sync.ui-bridge.js
Ruta: /BDLocal/sync/bdl.sync.ui-bridge.js
Función:
- Conectar un botón visual de BL2 con BDLSyncV2.
- Ejecutar sincronización de cola desde BDLocal/cambios.
- Actualizar mensajes básicos en la pantalla sin tocar bl2.app.js.
Con qué se conecta:
- BDLocal/sync/bdl.sync.index.js
- BDLocal/sync/bdl.sync.orchestrator.js
- BDLocal/sync/bdl.sync.outbox.js
- BDLocal/bl2.html
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "0.1.0-block9";

  function byId(id){ return document.getElementById(id); }
  function text(value){ return String(value == null ? "" : value).trim(); }

  function setText(id, value){
    var el = byId(id);
    if(el){ el.textContent = value; }
  }

  function log(message){
    var box = byId("bl2-log");
    if(!box){ return; }
    var item = document.createElement("div");
    item.className = "bl2-log-item";
    item.innerHTML = "<strong>Sync V2</strong><span>" + text(message) + "</span>";
    box.insertBefore(item, box.firstChild);
  }

  function refreshCounts(){
    if(!window.BDLSyncV2 || typeof window.BDLSyncV2.status !== "function"){ return; }
    Promise.resolve(window.BDLSyncV2.status()).then(function(status){
      var counts = status && status.detail && status.detail.counts ? status.detail.counts : status && status.counts;
      if(!counts){ return; }
      setText("bl2-kpi-google", String(counts.google || 0));
      setText("bl2-kpi-firebase", String(counts.firebase || 0));
      setText("bl2-google-status", "Cola Google pendiente: " + (counts.google || 0));
      setText("bl2-firebase-status", "Cola Firebase pendiente: " + (counts.firebase || 0) + " · Supabase: " + (counts.supabase || 0));
    }).catch(function(){});
  }

  function runQueue(){
    var button = byId("bl2-btn-sync-queue");
    if(!window.BDLSyncV2 || typeof window.BDLSyncV2.request !== "function"){
      log("BDLSyncV2 no disponible.");
      return;
    }

    if(button){ button.disabled = true; }
    log("Procesando cola de cambios pendientes...");

    Promise.resolve(window.BDLSyncV2.request({ source:"BL2SyncQueueButton" })).then(function(result){
      if(result && result.ok){
        log("Cola procesada correctamente.");
      }else{
        log("Cola procesada con alertas: " + (result && result.message ? result.message : "sin detalle"));
      }
      refreshCounts();
    }).catch(function(error){
      log("Error procesando cola: " + (error.message || String(error)));
    }).finally(function(){
      if(button){ button.disabled = false; }
    });
  }

  function bind(){
    var button = byId("bl2-btn-sync-queue");
    if(button && !button.__bdlSyncQueueBound){
      button.__bdlSyncQueueBound = true;
      button.addEventListener("click", runQueue);
    }
    refreshCounts();
  }

  window.BDLSyncUIBridge = {
    version: VERSION,
    bind: bind,
    refreshCounts: refreshCounts,
    runQueue: runQueue
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bind);
  }else{
    bind();
  }
})(window, document);
