/* =========================================================
Nombre completo: bdl.sync.ui-bridge.js
Ruta o ubicación: /BDLocal/sync/bdl.sync.ui-bridge.js
Función o funciones:
- Conectar el Centro de Control con BDLSyncV2 y BDLSyncOrchestrator.
- Leer la cola real cambios_pendientes.
- Sincronizar manualmente Google Sheets, Firebase o Supabase.
- Actualizar indicadores, estados y botones sin crear otra interfaz.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "0.5.0-control-center";
  var eventsBound = false;
  var lastCounts = null;

  var TARGETS = {
    google:{ label:"Google Sheets", shortLabel:"Google", buttonId:"bl2-btn-push-google", legacyButtonId:"bl2-btn-sync-google", kpiId:"bl2-kpi-google", statusId:"bl2-google-status", dotId:"bl2-dot-google" },
    firebase:{ label:"Firebase", shortLabel:"Firebase", buttonId:"bl2-btn-push-firebase", legacyButtonId:"bl2-btn-sync-firebase", kpiId:"bl2-kpi-firebase", statusId:"bl2-firebase-status", dotId:"bl2-dot-firebase" },
    supabase:{ label:"Supabase", shortLabel:"Supabase", buttonId:"bl2-btn-push-supabase", legacyButtonId:"", kpiId:"bl2-kpi-supabase", statusId:"bl2-supabase-status", dotId:"bl2-dot-supabase" }
  };

  function byId(id){ return id ? document.getElementById(id) : null; }
  function text(value){ return String(value == null ? "" : value).trim(); }
  function number(value){ value = Number(value || 0); return Number.isFinite(value) ? value : 0; }
  function esc(value){ return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
  function setText(id, value){ var el = byId(id); if(el){ el.textContent = value; } }

  function log(message, level){
    var box = byId("bl2-log");
    if(box){
      var item = document.createElement("div");
      item.className = "bl2-log-item " + (level ? "is-" + level : "");
      item.innerHTML = "<strong>Sincronización</strong><span>" + esc(message) + "</span>";
      box.insertBefore(item, box.firstChild);
    }
    try{
      if(window.BL2Core && typeof window.BL2Core.log === "function"){
        window.BL2Core.log(level === "error" ? "ERROR" : level === "warn" ? "WARN" : "INFO", message).catch(function(){});
      }
    }catch(error){}
  }

  function selectedPeriod(){
    if(window.BL2App && typeof window.BL2App.getSelectedPeriod === "function"){
      var period = window.BL2App.getSelectedPeriod();
      if(period && text(period.id)){ return { id:text(period.id), label:text(period.label || period.id) }; }
    }
    var select = byId("bl2-period-select");
    var id = text(select && select.value);
    var label = id;
    if(select && select.selectedOptions && select.selectedOptions[0]){ label = text(select.selectedOptions[0].textContent) || id; }
    return { id:id, label:label };
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

  function pendingTotal(detail){
    detail = detail || {};
    return number(detail.pending) + number(detail.waitingRetry) + number(detail.error) + number(detail.blocked);
  }

  function statusLine(label, detail){
    detail = detail || {};
    return label + ": " + number(detail.pending) + " pendiente(s), " + number(detail.waitingRetry) + " esperando, " + number(detail.blocked) + " bloqueado(s), " + number(detail.error) + " error(es).";
  }

  function buttonFor(target){
    var cfg = TARGETS[target] || {};
    return byId(cfg.buttonId) || byId(cfg.legacyButtonId);
  }

  function setDot(target, detail){
    var cfg = TARGETS[target];
    var dot = cfg ? byId(cfg.dotId) : null;
    if(!dot){ return; }
    dot.className = "bl2-dot " + (number(detail.error) || number(detail.blocked) ? "bl2-dot-bad" : number(detail.pending) || number(detail.waitingRetry) ? "bl2-dot-warn" : "bl2-dot-ok");
  }

  function styleButton(target, detail, running){
    var cfg = TARGETS[target];
    var button = buttonFor(target);
    if(!cfg || !button){ return; }
    var total = pendingTotal(detail);
    button.disabled = !!running;
    button.classList.remove("success","warning","danger");
    if(running){
      button.textContent = "Subiendo " + cfg.shortLabel + "...";
      button.classList.add("warning");
      return;
    }
    if(total > 0){
      button.textContent = "Subir " + cfg.shortLabel + " (" + total + ")";
      button.classList.add("danger");
      return;
    }
    button.textContent = cfg.shortLabel + " actualizado";
    button.classList.add("success");
  }

  function updateTarget(target, detail){
    var cfg = TARGETS[target];
    if(!cfg){ return; }
    detail = detail || {};
    setText(cfg.kpiId, String(pendingTotal(detail)));
    setText(cfg.statusId, statusLine("Cola " + cfg.label, detail));
    setDot(target, detail);
    styleButton(target, detail, false);
  }

  function emptyCounts(){
    return {
      detail:{
        google:{ pending:0, synced:0, error:0, blocked:0, waitingRetry:0 },
        firebase:{ pending:0, synced:0, error:0, blocked:0, waitingRetry:0 },
        supabase:{ pending:0, synced:0, error:0, blocked:0, waitingRetry:0 }
      }
    };
  }

  function publish(counts){
    lastCounts = counts || emptyCounts();
    try{ window.dispatchEvent(new CustomEvent("bdlocal:sync-ui-updated",{ detail:{ counts:lastCounts, at:new Date().toISOString() } })); }catch(error){}
    return lastCounts;
  }

  function refreshCounts(){
    if(!window.BDLSyncV2 || typeof window.BDLSyncV2.status !== "function"){
      var fallback = emptyCounts();
      Object.keys(TARGETS).forEach(function(target){ updateTarget(target, detailFor(fallback, target)); });
      return Promise.resolve(publish(fallback));
    }
    return Promise.resolve(window.BDLSyncV2.status()).then(function(status){
      var counts = countsFrom(status) || emptyCounts();
      Object.keys(TARGETS).forEach(function(target){ updateTarget(target, detailFor(counts, target)); });
      return publish(counts);
    }).catch(function(error){
      log("No se pudieron leer los pendientes: " + (error.message || String(error)), "warn");
      return publish(lastCounts || emptyCounts());
    });
  }

  function summarizeTarget(item){
    item = item || {};
    var target = text(item.target || "destino");
    if(number(item.pending) === 0){ return target + ": sin pendientes."; }
    if(item.skipped){ return target + ": omitido; " + number(item.pending) + " pendiente(s). " + text(item.message); }
    if(item.ok === false){ return target + ": error; " + number(item.marked) + " registro(s) con error. " + text(item.message); }
    return target + ": " + number(item.marked || item.confirmed) + " sincronizado(s).";
  }

  function summarizeResult(result){
    result = result || {};
    var results = Array.isArray(result.results) ? result.results : [];
    if(results.length){ return results.map(summarizeTarget).join(" | "); }
    if(result.target){ return summarizeTarget(result); }
    if(result.ok !== false){ return result.message || "Cola procesada correctamente."; }
    return result.message || "Cola procesada con alertas.";
  }

  function syncRunner(target, options){
    if(window.BDLSyncOrchestrator && typeof window.BDLSyncOrchestrator.syncTarget === "function"){
      return window.BDLSyncOrchestrator.syncTarget(target, options);
    }
    if(window.BDLSyncV2 && typeof window.BDLSyncV2.request === "function"){
      return window.BDLSyncV2.request(options);
    }
    return Promise.reject(new Error("No existe un motor de sincronización disponible."));
  }

  function runTarget(target, options){
    options = options || {};
    target = text(target).toLowerCase();
    var cfg = TARGETS[target];
    if(!cfg){ return Promise.reject(new Error("Destino no reconocido: " + target)); }
    var period = selectedPeriod();
    if(!period.id){ return Promise.reject(new Error("Seleccione un período antes de sincronizar.")); }
    if(options.confirm !== false && !window.confirm("Subir los cambios pendientes del período " + period.label + " a " + cfg.label + ". ¿Continuar?")){
      return Promise.resolve({ ok:true, cancelled:true, target:target, message:"Sincronización cancelada." });
    }

    var button = buttonFor(target);
    var request = {
      source:"BDLSyncUIBridge.manual." + target,
      manual:true,
      targets:[target],
      periodoId:period.id,
      periodoLabel:period.label,
      limit:number(options.limit || 25),
      batchSize:number(options.batchSize || 25)
    };

    styleButton(target, { pending:1 }, true);
    log("Subida manual a " + cfg.label + " solicitada para " + period.label + ".", "info");

    return Promise.resolve(syncRunner(target, request)).then(function(result){
      log(summarizeResult(result), result && result.ok === false ? "warn" : "ok");
      return refreshCounts().then(function(){ return result; });
    }).catch(function(error){
      log("Error subiendo " + cfg.label + ": " + (error.message || String(error)), "error");
      return refreshCounts().then(function(){ throw error; });
    }).finally(function(){ if(button){ button.disabled = false; } });
  }

  function runQueue(options){
    options = options || {};
    var period = selectedPeriod();
    if(!period.id){ return Promise.reject(new Error("Seleccione un período antes de procesar la cola.")); }
    if(options.confirm !== false && !window.confirm("Procesar todos los pendientes del período " + period.label + " para Google Sheets, Firebase y Supabase. ¿Continuar?")){
      return Promise.resolve({ ok:true, cancelled:true, message:"Sincronización cancelada." });
    }
    var button = byId("bl2-btn-sync-queue");
    if(button){ button.disabled = true; }
    Object.keys(TARGETS).forEach(function(target){ styleButton(target, { pending:1 }, true); });
    var request = {
      source:"BDLSyncUIBridge.manual.all",
      manual:true,
      targets:["google","firebase","supabase"],
      periodoId:period.id,
      periodoLabel:period.label,
      limit:number(options.limit || 25),
      batchSize:number(options.batchSize || 25)
    };
    log("Procesando todos los pendientes del período " + period.label + ".", "info");
    if(!window.BDLSyncV2 || typeof window.BDLSyncV2.request !== "function"){
      if(button){ button.disabled = false; }
      return Promise.reject(new Error("BDLSyncV2 no está disponible."));
    }
    return Promise.resolve(window.BDLSyncV2.request(request)).then(function(result){
      log(summarizeResult(result), result && result.ok === false ? "warn" : "ok");
      return refreshCounts().then(function(){ return result; });
    }).catch(function(error){
      log("Error procesando la cola: " + (error.message || String(error)), "error");
      return refreshCounts().then(function(){ throw error; });
    }).finally(function(){ if(button){ button.disabled = false; } });
  }

  function bindButton(id, handler, flag){
    var button = byId(id);
    if(!button || button.getAttribute("data-bdlc-owned") === "ui" || button[flag]){ return; }
    button[flag] = true;
    button.addEventListener("click", handler);
  }

  function bind(){
    bindButton("bl2-btn-push-google", function(){ runTarget("google",{ confirm:true }).catch(function(error){ log(error.message,"error"); }); }, "__bdlSyncGoogleBound");
    bindButton("bl2-btn-push-firebase", function(){ runTarget("firebase",{ confirm:true }).catch(function(error){ log(error.message,"error"); }); }, "__bdlSyncFirebaseBound");
    bindButton("bl2-btn-push-supabase", function(){ runTarget("supabase",{ confirm:true }).catch(function(error){ log(error.message,"error"); }); }, "__bdlSyncSupabaseBound");
    bindButton("bl2-btn-sync-queue", function(){ runQueue({ confirm:true }).catch(function(error){ log(error.message,"error"); }); }, "__bdlSyncQueueBound");

    if(!eventsBound){
      eventsBound = true;
      window.addEventListener("bdlocal:changes-created", refreshCounts);
      window.addEventListener("bdlocal:sync-v2-finished", refreshCounts);
      window.addEventListener("bl2:period-changed", refreshCounts);
      window.addEventListener("bl2:app-refreshed", refreshCounts);
    }
    return refreshCounts();
  }

  window.BDLSyncUIBridge = {
    version:VERSION,
    bind:bind,
    refreshCounts:refreshCounts,
    runTarget:runTarget,
    runQueue:runQueue,
    summarizeResult:summarizeResult,
    getSnapshot:function(){ return lastCounts || emptyCounts(); },
    getTargetState:function(target){ return detailFor(lastCounts || emptyCounts(), text(target).toLowerCase()); }
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bind);
  }else{
    bind();
  }
})(window, document);
