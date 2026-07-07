/* =========================================================
Archivo: bl2.google-push.guard.js
Ruta: /BDLocal/bl2.google-push.guard.js
Función:
- Evitar que Google Sheets suba tablas completas una y otra vez cuando no hay cambios.
- Controlar primera subida completa por período, no como bandera global única.
- Bloquear doble ejecución si ya existe una subida en curso.
- Respetar la pausa cuando se está ejecutando Traer Sheets → BL.
- Mantener disponible la subida manual cuando realmente hace falta una primera subida por período.
Con qué se conecta:
- ../js/bdlocal-config/bdlocal-sync.manager.js
- bl2.cloud-pull.safe.js
- BDLocalConfigStore
- BL2Sync
- BL2Core
========================================================= */
(function(window){
  "use strict";

  var PAUSE_KEY = "REQ_BDLOCAL_PAUSE_GOOGLE_PUSH";
  var running = false;

  function text(value){ return String(value === null || value === undefined ? "" : value).trim(); }
  function nowISO(){ return new Date().toISOString(); }

  function store(){ return window.BDLocalConfigStore || null; }
  function core(){ return window.BL2Core || null; }
  function sync(){ return window.BL2Sync || null; }
  function manager(){ return window.BDLocalSyncManager || null; }

  function log(message, level, data){
    level = text(level || "info");

    try{
      if(store() && typeof store().addLog === "function"){
        store().addLog("google_push_guard", message, level === "error" ? "error" : level === "warn" ? "warning" : "success", data || {});
      }
    }catch(error){}

    try{
      if(window.BDLocalModal && typeof window.BDLocalModal.add === "function"){
        window.BDLocalModal.add(level === "error" ? "error" : level === "warn" ? "warning" : "info", "Google Sheets", message, data || {});
      }
    }catch(error2){}
  }

  function progress(percent, detail){
    try{
      window.dispatchEvent(new CustomEvent("bl2:sync-progress", {
        detail:{ target:"google", percent:Math.max(0, Math.min(100, Number(percent || 0))), detail:detail || "", at:nowISO() }
      }));
    }catch(error){}

    try{
      if(window.BDLocalConfigUI && typeof window.BDLocalConfigUI.setProgress === "function"){
        window.BDLocalConfigUI.setProgress(percent > 0 && percent < 100, percent, detail || "");
      }
    }catch(error2){}
  }

  function readJson(name, fallback){
    try{
      var parsed = JSON.parse(window.localStorage.getItem(name) || "");
      return parsed === null || parsed === undefined ? fallback : parsed;
    }catch(error){ return fallback; }
  }

  function pausedByPull(){
    if(window.BL2_GOOGLE_PUSH_PAUSED){ return true; }
    var pause = readJson(PAUSE_KEY, null);
    return !!(pause && pause.paused);
  }

  function getActivePeriod(){
    try{
      if(window.BL2App && typeof window.BL2App.getState === "function"){
        var state = window.BL2App.getState() || {};
        if(state.activePeriod && text(state.activePeriod.id)){
          return Promise.resolve({ id:text(state.activePeriod.id), label:text(state.activePeriod.label || state.activePeriod.id) });
        }
      }
    }catch(error){}

    if(core() && typeof core().getActivePeriod === "function"){
      return core().getActivePeriod().then(function(period){
        if(!period || !text(period.id)){ return null; }
        return { id:text(period.id), label:text(period.label || period.periodoLabel || period.id) };
      });
    }

    return Promise.resolve(null);
  }

  function getPending(periodoId){
    if(sync() && typeof sync().getPendingChangesFor === "function"){
      return sync().getPendingChangesFor("google", periodoId).then(function(rows){ return Array.isArray(rows) ? rows : []; }).catch(function(){ return []; });
    }

    if(core() && typeof core().getPendingChanges === "function"){
      return core().getPendingChanges("google", periodoId).then(function(rows){ return Array.isArray(rows) ? rows : []; }).catch(function(){ return []; });
    }

    return Promise.resolve([]);
  }

  function loadConfig(){
    try{ return store() && typeof store().loadConfig === "function" ? (store().loadConfig() || {}) : {}; }
    catch(error){ return {}; }
  }

  function periodUploadMap(config){
    config = config || {};
    var sheets = config.sheets || {};
    var map = sheets.fullUploadByPeriod || sheets.fullUploadsByPeriod || sheets.periodFullUploads || {};
    return map && typeof map === "object" && !Array.isArray(map) ? map : {};
  }

  function periodHasFullUpload(periodoId){
    var config = loadConfig();
    var sheets = config.sheets || {};
    var map = periodUploadMap(config);
    if(map[periodoId]){ return true; }
    if(text(sheets.lastFullUploadPeriodId) === text(periodoId)){ return true; }
    return false;
  }

  function markPeriodFullUpload(periodoId, result){
    if(!store() || typeof store().patchConfig !== "function" || !periodoId){ return; }

    var config = loadConfig();
    var map = Object.assign({}, periodUploadMap(config));
    map[periodoId] = {
      ok:true,
      at:nowISO(),
      source:"GooglePushGuard",
      changes:Number(result && result.changes || 0)
    };

    store().patchConfig({
      sheets:{
        firstFullUploadDone:true,
        lastFullUploadAt:nowISO(),
        lastFullUploadPeriodId:periodoId,
        fullUploadByPeriod:map,
        connected:true,
        status:"ok",
        lastError:""
      }
    });
  }

  function skipped(message, data){
    log(message, "warn", data || {});
    progress(100, message);
    try{
      if(store() && typeof store().patchConfig === "function"){
        store().patchConfig({ sheets:{ connected:true, status:"ok", lastError:"", lastSkippedAt:nowISO(), lastSkippedReason:message } });
      }
    }catch(error){}
    return Promise.resolve({ ok:true, skipped:true, target:"google", message:message, data:data || {} });
  }

  function shouldForceFull(options){
    options = options || {};
    return options.fullPeriod === true || options.mode === "full_period" || options.forceFull === true;
  }

  function install(){
    var m = manager();
    if(!m || m.__googlePushGuardInstalled){ return false; }
    if(typeof m.pushLocalToSheets !== "function"){ return false; }

    var originalPush = m.pushLocalToSheets;
    var originalSyncQueue = typeof m.syncQueue === "function" ? m.syncQueue : null;
    var originalSyncAll = typeof m.syncAll === "function" ? m.syncAll : null;

    m.pushLocalToSheets = function(options){
      options = options || {};

      if(pausedByPull()){
        return skipped("Subida a Google Sheets pausada: se está trayendo información desde Sheets hacia Base Local.", { reason:"pull_in_progress" });
      }

      if(running){
        return skipped("Ya hay una subida a Google Sheets en curso. Se evita una segunda ejecución.", { reason:"already_running" });
      }

      return getActivePeriod().then(function(period){
        if(!period || !period.id){ throw new Error("Seleccione un período activo antes de sincronizar Google Sheets."); }

        return getPending(period.id).then(function(changes){
          var pendingCount = Array.isArray(changes) ? changes.length : 0;
          var forcedFull = shouldForceFull(options);
          var hasPeriodFull = periodHasFullUpload(period.id);

          if(!forcedFull && pendingCount === 0 && hasPeriodFull){
            return skipped("Google Sheets no se subió porque no hay cambios pendientes para este período.", {
              periodoId:period.id,
              periodoLabel:period.label,
              changes:0,
              fullUploadDone:true
            });
          }

          var finalOptions = Object.assign({}, options);
          if(!forcedFull){
            finalOptions.fullPeriod = !hasPeriodFull;
            finalOptions.mode = !hasPeriodFull ? "full_period" : "changes";
          }

          running = true;
          progress(8, finalOptions.fullPeriod ? "Primera subida controlada del período..." : "Subiendo cambios reales a Google Sheets...");

          return originalPush.call(m, finalOptions).then(function(result){
            if(result && result.ok !== false && (finalOptions.fullPeriod || result.message && result.message.indexOf("Primera subida") >= 0)){
              markPeriodFullUpload(period.id, result);
            }
            return result;
          }).finally(function(){
            running = false;
          });
        });
      }).catch(function(error){
        running = false;
        throw error;
      });
    };

    if(originalSyncQueue){
      m.syncQueue = function(){
        if(pausedByPull()){
          return skipped("Cola de Google Sheets pausada por Traer Sheets → BL.", { reason:"pull_in_progress" });
        }
        return originalSyncQueue.apply(m, arguments);
      };
    }

    if(originalSyncAll){
      m.syncAll = function(){
        if(pausedByPull()){
          return skipped("Sincronización total pausada por Traer Sheets → BL.", { reason:"pull_in_progress" });
        }
        return originalSyncAll.apply(m, arguments);
      };
    }

    m.__googlePushGuardInstalled = true;
    log("Guardia anti-subida eterna instalado para Google Sheets.", "info", {});
    return true;
  }

  function boot(){
    var attempts = 0;
    var timer = window.setInterval(function(){
      attempts += 1;
      if(install() || attempts >= 50){ window.clearInterval(timer); }
    }, 150);
  }

  window.BL2GooglePushGuard = {
    install:install,
    pausedByPull:pausedByPull,
    periodHasFullUpload:periodHasFullUpload,
    markPeriodFullUpload:markPeriodFullUpload
  };

  if(document.readyState === "loading"){ document.addEventListener("DOMContentLoaded", boot); }
  else{ boot(); }
})(window);
