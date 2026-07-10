/* =========================================================
Nombre completo: bdlocal-sync-fixups.js
Ruta o ubicación: /js/bdlocal-config/bdlocal-sync-fixups.js
Función o funciones:
- Mantener compatibilidad con llamadas antiguas de sincronización.
- Redirigir Google, Firebase y Supabase únicamente a BDLSyncV2.
- Impedir cargas completas paralelas fuera de cambios_pendientes.
- Reemplazar la ejecución individual de la interfaz por la puerta segura.
- Vincular el campo de acceso de Apps Script con la acción guardar actual.
- Instalarse después de que todas las guardias hayan terminado de cargar.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION = "3.1.0-single-sync-gate";
  var MAX_BATCH_SIZE = 25;
  var installed = false;
  var formBound = false;

  function text(value){ return String(value == null ? "" : value).trim(); }
  function now(){ return new Date().toISOString(); }
  function safeBatch(value){ value = Math.floor(Number(value || MAX_BATCH_SIZE)); return Math.min(MAX_BATCH_SIZE,Math.max(1,value || MAX_BATCH_SIZE)); }
  function outbox(){ return window.BDLSyncOutbox || null; }

  function selectedPeriod(){
    try{
      if(window.BL2App && typeof window.BL2App.getSelectedPeriod === "function"){
        var selected = window.BL2App.getSelectedPeriod();
        if(selected && text(selected.id)){ return Promise.resolve({ id:text(selected.id),label:text(selected.label || selected.id) }); }
      }
      if(window.BL2App && typeof window.BL2App.getState === "function"){
        var state = window.BL2App.getState() || {};
        if(state.activePeriod && text(state.activePeriod.id)){ return Promise.resolve({ id:text(state.activePeriod.id),label:text(state.activePeriod.label || state.activePeriod.id) }); }
      }
    }catch(error){}
    if(window.BL2Core && typeof window.BL2Core.getActivePeriod === "function"){
      return window.BL2Core.getActivePeriod().then(function(period){
        return period && text(period.id) ? { id:text(period.id),label:text(period.label || period.periodoLabel || period.id) } : null;
      });
    }
    return Promise.resolve(null);
  }

  function blocked(target,message,extra){
    return Promise.resolve(Object.assign({ ok:false,blocked:true,target:target,message:message,at:now() },extra || {}));
  }

  function requestTarget(target,options){
    target = text(target).toLowerCase();
    options = Object.assign({},options || {});
    if(options.manual !== true){ return blocked(target,"Solicitud automática bloqueada. La sincronización es exclusivamente manual."); }
    if(!window.BDLSyncV2 || typeof window.BDLSyncV2.request !== "function"){ return Promise.reject(new Error("BDLSyncV2 no está disponible.")); }

    var periodPromise = text(options.periodoId)
      ? Promise.resolve({ id:text(options.periodoId),label:text(options.periodoLabel || options.periodoId) })
      : selectedPeriod();

    return periodPromise.then(function(period){
      if(!period || !period.id){ throw new Error("Seleccione un período antes de sincronizar."); }
      var limit = safeBatch(options.limit || options.batchSize);
      return window.BDLSyncV2.request({
        manual:true,
        automatic:false,
        source:text(options.source || "BDLocalSyncFixups.manual." + target),
        targets:[target],
        periodoId:period.id,
        periodoLabel:period.label,
        cedula:text(options.cedula),
        tabla:text(options.tabla),
        forceRetry:options.forceRetry === true,
        ignoreRetry:options.ignoreRetry === true || options.forceRetry === true,
        limit:limit,
        batchSize:limit
      });
    });
  }

  function openCount(target,periodoId){
    if(!outbox() || typeof outbox().counts !== "function"){ return Promise.resolve(0); }
    return outbox().counts({ periodoId:periodoId }).then(function(counts){
      var detail = counts && counts.detail && counts.detail[target] || {};
      return Number(detail.pending || 0) + Number(detail.error || 0) + Number(detail.blocked || 0) + Number(detail.waitingRetry || 0);
    }).catch(function(){ return 0; });
  }

  function confirmedTarget(target,options){
    options = Object.assign({},options || {});
    return selectedPeriod().then(function(period){
      if(!period){ throw new Error("Seleccione un período antes de sincronizar."); }
      return openCount(target,period.id).then(function(total){
        if(!total && options.forceRetry !== true){ return { ok:true,skipped:true,target:target,message:"No existen pendientes para " + target + " en el período activo." }; }
        var limit = safeBatch(options.limit || options.batchSize);
        if(options.confirm !== false){
          var approved = window.confirm(
            "Sincronización manual\n\nDestino: " + target +
            "\nPeríodo: " + period.label +
            "\nPendientes abiertos: " + total +
            "\nMáximo en esta ejecución: " + Math.min(limit,total || limit) +
            (total > limit ? "\nLos restantes seguirán en la cola local." : "") +
            "\n\n¿Continuar?"
          );
          if(!approved){ return { ok:true,cancelled:true,target:target }; }
        }
        return requestTarget(target,Object.assign({},options,{ manual:true,periodoId:period.id,periodoLabel:period.label,limit:limit,batchSize:limit }));
      });
    }).then(function(result){
      if(window.BDLSyncUIBridge && typeof window.BDLSyncUIBridge.refreshAll === "function"){
        return window.BDLSyncUIBridge.refreshAll().catch(function(){ return null; }).then(function(){ return result; });
      }
      return result;
    });
  }

  function patchManager(){
    var manager = window.BDLocalSyncManager;
    if(!manager){ return false; }
    manager.pushLocalToSheets = function(options){ return requestTarget("google",Object.assign({},options || {},{ source:"BDLocalSyncManager.manual.google" })); };
    manager.pushLocalToFirebase = function(options){ return requestTarget("firebase",Object.assign({},options || {},{ source:"BDLocalSyncManager.manual.firebase" })); };
    manager.pushLocalToSupabase = function(options){ return requestTarget("supabase",Object.assign({},options || {},{ source:"BDLocalSyncManager.manual.supabase" })); };
    manager.syncQueue = function(options){
      options = Object.assign({},options || {});
      if(options.manual !== true){ return blocked("all","Cola automática bloqueada."); }
      if(!window.BDLSyncV2 || typeof window.BDLSyncV2.request !== "function"){ return Promise.reject(new Error("BDLSyncV2 no está disponible.")); }
      return selectedPeriod().then(function(period){
        if(!period){ throw new Error("Seleccione un período."); }
        var limit = safeBatch(options.limit || options.batchSize);
        return window.BDLSyncV2.request({ manual:true,automatic:false,source:"BDLocalSyncManager.manual.queue",targets:options.targets || ["google","firebase","supabase"],periodoId:period.id,periodoLabel:period.label,limit:limit,batchSize:limit });
      });
    };
    manager.syncAll = manager.syncQueue;
    manager.__singleSyncGateInstalled = true;
    return true;
  }

  function patchLegacySync(){
    var sync = window.BL2Sync;
    if(!sync){ return false; }
    var firebasePull = sync.syncFirebase;
    sync.syncGoogle = function(options){ return requestTarget("google",Object.assign({},options || {},{ source:"BL2Sync.manual.google" })); };
    sync.syncFirebase = function(options){
      options = options || {};
      var action = text(options.action || "upload").toLowerCase();
      if(action === "compare" || action === "download"){
        return typeof firebasePull === "function" ? firebasePull.call(sync,options) : Promise.reject(new Error("La descarga Firebase no está disponible."));
      }
      return requestTarget("firebase",Object.assign({},options,{ source:"BL2Sync.manual.firebase" }));
    };
    sync.maybeSyncGoogleIdle = function(){ return blocked("google","Sincronización por inactividad desactivada."); };
    sync.maybeSyncFirebaseDaily = function(){ return blocked("firebase","Sincronización diaria desactivada."); };
    sync.syncBeforeClose = function(){ return Promise.resolve({ ok:true,skipped:true,manualOnly:true,message:"No se sincronizó al cerrar; la cola permanece guardada." }); };
    sync.__singleSyncGateInstalled = true;
    return true;
  }

  function patchUI(){
    var ui = window.BDLSyncUIBridge;
    if(!ui){ return false; }
    ui.runTarget = function(target,options){ return confirmedTarget(text(target).toLowerCase(),options || {}); };
    ui.__singleSyncGateInstalled = true;
    return true;
  }

  function saveSheetsAccess(){
    var field = document.getElementById("bdlc-sheets-token");
    var store = window.BDLocalConfigStore;
    if(!field || !store || typeof store.getSheetsConfig !== "function" || typeof store.setSheetsConfig !== "function"){ return false; }
    var current = store.getSheetsConfig({ includeSecret:true }) || {};
    store.setSheetsConfig({
      enabled:current.enabled,
      appsScriptUrl:current.appsScriptUrl,
      token:text(field.value),
      spreadsheetId:current.spreadsheetId,
      sheetName:current.sheetName,
      batchSize:current.batchSize
    });
    return true;
  }

  function bindCurrentForm(){
    if(formBound){ return; }
    formBound = true;
    document.addEventListener("click",function(event){
      var button = event.target && event.target.closest ? event.target.closest("[data-bdlc-action]") : null;
      if(button && button.getAttribute("data-bdlc-action") === "save-sheets"){ saveSheetsAccess(); }
    },true);
  }

  function install(){
    var managerReady = patchManager();
    var syncReady = patchLegacySync();
    var uiReady = patchUI();
    bindCurrentForm();
    installed = managerReady || syncReady || uiReady || installed;
    return { ok:installed,manager:managerReady,legacy:syncReady,ui:uiReady,formBound:formBound };
  }

  window.BDLocalSyncFixups = {
    version:VERSION,
    compatibilityOnly:true,
    manualOnly:true,
    maxBatchSize:MAX_BATCH_SIZE,
    install:install,
    requestTarget:requestTarget,
    confirmedTarget:confirmedTarget,
    saveSheetsAccess:saveSheetsAccess,
    status:function(){ return { version:VERSION,installed:installed,manager:!!(window.BDLocalSyncManager && window.BDLocalSyncManager.__singleSyncGateInstalled),legacy:!!(window.BL2Sync && window.BL2Sync.__singleSyncGateInstalled),ui:!!(window.BDLSyncUIBridge && window.BDLSyncUIBridge.__singleSyncGateInstalled),formBound:formBound }; }
  };

  window.addEventListener("bdlocal:bl2-html-scripts-loaded",install);
})(window,document);
