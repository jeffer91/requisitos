/* =========================================================
Archivo: bdl.sync.ui-bridge.js
Ruta: /BDLocal/sync/bdl.sync.ui-bridge.js
Función:
- Conectar botones visuales de BL2 con BDLSyncV2 / BDLSyncOrchestrator.
- Ejecutar sincronización manual por destino: Google Sheets, Firebase y Supabase.
- Mostrar pendientes, errores, bloqueados y espera de reintento por base.
- Pintar botones en rojo cuando hay pendientes y en verde cuando están al día.
- Mantener Carga separada: Carga solo guarda local; BDLocal sube a nubes bajo demanda.
Con qué se conecta:
- BDLocal/sync/bdl.sync.index.js
- BDLocal/sync/bdl.sync.orchestrator.js
- BDLocal/sync/bdl.sync.outbox.js
- BDLocal/bl2.html
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "0.4.0-manual-target-buttons";

  var TARGETS = {
    google: {
      id:"google",
      label:"Google Sheets",
      shortLabel:"Google",
      buttonId:"bl2-btn-push-google",
      legacyButtonId:"bl2-btn-sync-google",
      kpiId:"bl2-kpi-google",
      statusId:"bl2-google-status",
      dotId:"bl2-dot-google"
    },
    firebase: {
      id:"firebase",
      label:"Firebase",
      shortLabel:"Firebase",
      buttonId:"bl2-btn-push-firebase",
      legacyButtonId:"bl2-btn-sync-firebase",
      kpiId:"bl2-kpi-firebase",
      statusId:"bl2-firebase-status",
      dotId:"bl2-dot-firebase"
    },
    supabase: {
      id:"supabase",
      label:"Supabase",
      shortLabel:"Supabase",
      buttonId:"bl2-btn-push-supabase",
      legacyButtonId:"",
      kpiId:"bl2-kpi-supabase",
      statusId:"bl2-supabase-status",
      dotId:"bl2-dot-supabase"
    }
  };

  function byId(id){ return id ? document.getElementById(id) : null; }
  function text(value){ return String(value == null ? "" : value).trim(); }
  function n(value){ value = Number(value || 0); return Number.isFinite(value) ? value : 0; }

  function setText(id, value){
    var el = byId(id);
    if(el){ el.textContent = value; }
  }

  function log(message){
    var box = byId("bl2-log");
    if(!box){ return; }
    var item = document.createElement("div");
    item.className = "bl2-log-item";
    item.innerHTML = "<strong>Sync manual</strong><span>" + text(message) + "</span>";
    box.insertBefore(item, box.firstChild);
  }

  function countsFrom(status){
    if(!status){ return null; }
    if(status.detail && status.detail.counts){ return status.detail.counts; }
    if(status.counts){ return status.counts; }
    if(status.detail && status.detail.detail){ return status.detail.detail; }
    return null;
  }

  function detailFor(counts, target){
    counts = counts || {};
    if(counts.detail && counts.detail[target]){ return counts.detail[target]; }
    if(counts[target] && typeof counts[target] === "object"){ return counts[target]; }
    if(target === "google"){
      return { pending:counts.google, synced:counts.syncedGoogle, error:counts.errorsGoogle, blocked:counts.blockedGoogle, waitingRetry:counts.waitingRetryGoogle };
    }
    if(target === "firebase"){
      return { pending:counts.firebase, synced:counts.syncedFirebase, error:counts.errorsFirebase, blocked:counts.blockedFirebase, waitingRetry:counts.waitingRetryFirebase };
    }
    if(target === "supabase"){
      return { pending:counts.supabase, synced:counts.syncedSupabase, error:counts.errorsSupabase, blocked:counts.blockedSupabase, waitingRetry:counts.waitingRetrySupabase };
    }
    return { pending:0, synced:0, error:0, blocked:0, waitingRetry:0 };
  }

  function line(label, detail){
    detail = detail || {};
    return label + ": " +
      n(detail.pending) + " pendiente(s), " +
      n(detail.waitingRetry) + " esperando, " +
      n(detail.blocked) + " bloqueado(s), " +
      n(detail.error) + " error(es).";
  }

  function setDot(target, detail){
    var cfg = TARGETS[target];
    var dot = cfg ? byId(cfg.dotId) : null;
    if(!dot){ return; }

    dot.className = "bl2-dot " + (
      n(detail.error) || n(detail.blocked) ? "bl2-dot-bad" :
      n(detail.pending) || n(detail.waitingRetry) ? "bl2-dot-warn" :
      "bl2-dot-ok"
    );
  }

  function buttonFor(target){
    var cfg = TARGETS[target] || {};
    return byId(cfg.buttonId) || byId(cfg.legacyButtonId);
  }

  function styleButton(target, detail, running){
    var cfg = TARGETS[target];
    var button = buttonFor(target);
    if(!cfg || !button){ return; }

    var pending = n(detail.pending) + n(detail.waitingRetry) + n(detail.error) + n(detail.blocked);
    button.disabled = !!running;
    button.style.borderColor = "";
    button.style.background = "";
    button.style.color = "";
    button.style.boxShadow = "";

    if(running){
      button.textContent = "Subiendo " + cfg.shortLabel + "...";
      button.style.borderColor = "#f59e0b";
      button.style.background = "#fffbeb";
      button.style.color = "#92400e";
      return;
    }

    if(pending > 0){
      button.textContent = "Subir " + cfg.shortLabel + " (" + pending + ")";
      button.style.borderColor = "#fecaca";
      button.style.background = "#fee2e2";
      button.style.color = "#991b1b";
      button.style.boxShadow = "0 0 0 3px rgba(239, 68, 68, 0.08)";
      return;
    }

    button.textContent = cfg.shortLabel + " actualizado";
    button.style.borderColor = "#bbf7d0";
    button.style.background = "#dcfce7";
    button.style.color = "#166534";
  }

  function updateTarget(target, detail){
    var cfg = TARGETS[target];
    if(!cfg){ return; }
    detail = detail || {};

    setText(cfg.kpiId, String(n(detail.pending)));
    setText(cfg.statusId, line("Cola " + cfg.label, detail));
    setDot(target, detail);
    styleButton(target, detail, false);
  }

  function refreshCounts(){
    if(!window.BDLSyncV2 || typeof window.BDLSyncV2.status !== "function"){
      log("BDLSyncV2 no disponible para leer pendientes.");
      return Promise.resolve(null);
    }

    return Promise.resolve(window.BDLSyncV2.status()).then(function(status){
      var counts = countsFrom(status);
      if(!counts){ return null; }

      updateTarget("google", detailFor(counts, "google"));
      updateTarget("firebase", detailFor(counts, "firebase"));
      updateTarget("supabase", detailFor(counts, "supabase"));

      return counts;
    }).catch(function(error){
      log("No se pudieron actualizar conteos de cola: " + (error.message || String(error)));
      return null;
    });
  }

  function summarizeTarget(item){
    item = item || {};
    var target = text(item.target || "destino");
    if(item.pending === 0){ return target + ": sin pendientes."; }
    if(item.skipped){ return target + ": omitido, " + n(item.pending) + " siguen pendientes. " + text(item.message); }
    if(item.ok === false){ return target + ": error, " + n(item.marked) + " marcado(s) con error. " + text(item.message); }
    return target + ": " + n(item.marked || item.confirmed) + " sincronizado(s).";
  }

  function summarizeResult(result){
    result = result || {};
    var results = Array.isArray(result.results) ? result.results : [];
    if(results.length){ return results.map(summarizeTarget).join(" | "); }
    if(result.target){ return summarizeTarget(result); }
    if(result.ok){ return "Cola procesada correctamente."; }
    return "Cola procesada con alertas: " + (result.message || "revisar diagnóstico");
  }

  function selectedPeriod(){
    var select = byId("bl2-period-select");
    var id = select ? text(select.value) : "";
    var label = "";
    if(select && select.selectedOptions && select.selectedOptions[0]){ label = text(select.selectedOptions[0].textContent); }
    return { id:id, label:label || id };
  }

  function runTarget(target){
    target = text(target || "").toLowerCase();
    var cfg = TARGETS[target];
    if(!cfg){ return; }

    var button = buttonFor(target);
    var period = selectedPeriod();
    var options = {
      source:"BDLSyncUIBridge.manual." + target,
      manual:true,
      targets:[target],
      periodoId:period.id,
      periodoLabel:period.label,
      limit:25,
      batchSize:25
    };

    styleButton(target, { pending:1 }, true);
    log("Subida manual a " + cfg.label + " solicitada desde BDLocal...");

    var runner = null;
    if(window.BDLSyncOrchestrator && typeof window.BDLSyncOrchestrator.syncTarget === "function"){
      runner = window.BDLSyncOrchestrator.syncTarget(target, options);
    }else if(window.BDLSyncV2 && typeof window.BDLSyncV2.request === "function"){
      runner = window.BDLSyncV2.request(options);
    }else{
      log("No hay motor de sincronización disponible para " + cfg.label + ".");
      if(button){ button.disabled = false; }
      return;
    }

    Promise.resolve(runner).then(function(result){
      log(summarizeResult(result));
      return refreshCounts();
    }).catch(function(error){
      log("Error subiendo " + cfg.label + ": " + (error.message || String(error)));
      return refreshCounts();
    }).finally(function(){
      if(button){ button.disabled = false; }
    });
  }

  function runQueue(){
    var button = byId("bl2-btn-sync-queue");
    if(!window.BDLSyncV2 || typeof window.BDLSyncV2.request !== "function"){
      log("BDLSyncV2 no disponible.");
      return;
    }

    if(button){ button.disabled = true; }
    Object.keys(TARGETS).forEach(function(target){ styleButton(target, { pending:1 }, true); });
    log("Procesando pendientes de Google Sheets, Firebase y Supabase por solicitud manual...");

    Promise.resolve(window.BDLSyncV2.request({ source:"BL2ManualAllButton", manual:true, targets:["google", "firebase", "supabase"], limit:25, batchSize:25 })).then(function(result){
      log(summarizeResult(result));
      return refreshCounts();
    }).catch(function(error){
      log("Error procesando cola: " + (error.message || String(error)));
      return refreshCounts();
    }).finally(function(){
      if(button){ button.disabled = false; }
    });
  }

  function bindButton(id, handler, flag){
    var button = byId(id);
    if(button && !button[flag]){
      button[flag] = true;
      button.addEventListener("click", handler);
    }
  }

  function bind(){
    bindButton("bl2-btn-push-google", function(){ runTarget("google"); }, "__bdlSyncGoogleBound");
    bindButton("bl2-btn-push-firebase", function(){ runTarget("firebase"); }, "__bdlSyncFirebaseBound");
    bindButton("bl2-btn-push-supabase", function(){ runTarget("supabase"); }, "__bdlSyncSupabaseBound");
    bindButton("bl2-btn-sync-queue", runQueue, "__bdlSyncQueueBound");

    window.addEventListener("bdlocal:changes-created", refreshCounts);
    window.addEventListener("bdlocal:sync-v2-finished", refreshCounts);
    refreshCounts();
  }

  window.BDLSyncUIBridge = {
    version:VERSION,
    bind:bind,
    refreshCounts:refreshCounts,
    runTarget:runTarget,
    runQueue:runQueue,
    summarizeResult:summarizeResult
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bind);
  }else{
    bind();
  }
})(window, document);