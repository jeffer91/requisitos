/* =========================================================
Archivo: bdl.sync.ui-bridge.js
Ruta: /BDLocal/sync/bdl.sync.ui-bridge.js
Función:
- Conectar el botón visual de BL2 con BDLSyncV2.
- Ejecutar sincronización desde cambios_pendientes.
- Mostrar pendientes, errores, bloqueados y espera de reintento.
- Mostrar modo seguro cuando falta adaptador real de destino.
- Actualizar conteos sin tocar bl2.app.js.
Con qué se conecta:
- BDLocal/sync/bdl.sync.index.js
- BDLocal/sync/bdl.sync.orchestrator.js
- BDLocal/sync/bdl.sync.outbox.js
- BDLocal/bl2.html
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "0.3.0-block25";

  function byId(id){ return document.getElementById(id); }
  function text(value){ return String(value == null ? "" : value).trim(); }
  function n(value){ return Number(value || 0); }

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

  function countsFrom(status){
    return status && status.detail && status.detail.counts ? status.detail.counts : status && status.counts;
  }

  function line(label, detail){
    detail = detail || {};
    return label + ": " +
      n(detail.pending) + " pendiente(s), " +
      n(detail.waitingRetry) + " esperando, " +
      n(detail.blocked) + " bloqueado(s), " +
      n(detail.error) + " error(es).";
  }

  function refreshCounts(){
    if(!window.BDLSyncV2 || typeof window.BDLSyncV2.status !== "function"){ return; }
    Promise.resolve(window.BDLSyncV2.status()).then(function(status){
      var counts = countsFrom(status);
      if(!counts){ return; }
      var detail = counts.detail || {};
      var google = detail.google || { pending:counts.google, error:counts.errorsGoogle, blocked:counts.blockedGoogle, waitingRetry:counts.waitingRetryGoogle };
      var firebase = detail.firebase || { pending:counts.firebase, error:counts.errorsFirebase, blocked:counts.blockedFirebase, waitingRetry:counts.waitingRetryFirebase };
      var supabase = detail.supabase || { pending:counts.supabase, error:counts.errorsSupabase, blocked:counts.blockedSupabase, waitingRetry:counts.waitingRetrySupabase };

      setText("bl2-kpi-google", String(n(google.pending)));
      setText("bl2-kpi-firebase", String(n(firebase.pending)));
      setText("bl2-google-status", line("Cola Google", google));
      setText("bl2-firebase-status", line("Cola Firebase", firebase) + " · " + line("Supabase", supabase));
    }).catch(function(error){
      log("No se pudieron actualizar conteos de cola: " + (error.message || String(error)));
    });
  }

  function summarizeTarget(item){
    item = item || {};
    if(item.skipped){ return item.target + ": omitido, " + n(item.pending) + " siguen pendientes."; }
    if(item.ok === false){ return item.target + ": error, " + n(item.marked) + " marcado(s) con error."; }
    return item.target + ": " + n(item.marked) + " sincronizado(s).";
  }

  function summarizeResult(result){
    result = result || {};
    var results = Array.isArray(result.results) ? result.results : [];
    if(results.length){ return results.map(summarizeTarget).join(" | "); }
    if(result.ok){ return "Cola procesada correctamente."; }
    return "Cola procesada con alertas: " + (result.message || "revisar diagnóstico");
  }

  function runQueue(){
    var button = byId("bl2-btn-sync-queue");
    if(!window.BDLSyncV2 || typeof window.BDLSyncV2.request !== "function"){
      log("BDLSyncV2 no disponible.");
      return;
    }
    if(button){ button.disabled = true; }
    log("Procesando cambios_pendientes con control de reintentos...");

    Promise.resolve(window.BDLSyncV2.request({ source:"BL2SyncQueueButton" })).then(function(result){
      log(summarizeResult(result));
      refreshCounts();
    }).catch(function(error){
      log("Error procesando cola: " + (error.message || String(error)));
      refreshCounts();
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
    version:VERSION,
    bind:bind,
    refreshCounts:refreshCounts,
    runQueue:runQueue,
    summarizeResult:summarizeResult
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bind);
  }else{
    bind();
  }
})(window, document);
