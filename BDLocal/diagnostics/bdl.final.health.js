/* =========================================================
Archivo: bdl.final.health.js
Ruta: /BDLocal/diagnostics/bdl.final.health.js
Función:
- Diagnóstico rápido de los bloques de optimización BDLocal.
- Verificar DB_VERSION 2, stores oficiales, conectores, outbox y espejo V2.
- Detectar si la base necesita recarga segura para crear stores nuevos.
- No modifica datos por sí solo.
- Permite preparar recarga segura cuando el usuario la ejecute manualmente.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.2.0-safe-health";
  var RELOAD_GUARD_KEY = "REQ_BDLOCAL_V2_RELOAD_GUARD";

  function text(value){ return String(value == null ? "" : value).trim(); }
  function bool(value){ return !!value; }
  function nowISO(){ return new Date().toISOString(); }

  function readSession(key){
    try{ return window.sessionStorage.getItem(key) || ""; }
    catch(error){ return ""; }
  }

  function writeSession(key, value){
    try{ window.sessionStorage.setItem(key, value); return true; }
    catch(error){ return false; }
  }

  function config(){ return window.BL2Config || {}; }
  function cfgStores(){
    var cfg = config();
    var s = cfg.stores || {};

    return {
      periodos: s.periodos || "periodos",
      estudiantes: s.estudiantes || "estudiantes",
      requisitos: s.requisitos || "requisitos",
      cambios: s.cambios || "cambios",
      personas: s.personas || "personas",
      matriculas: s.matriculasPeriodo || "matriculas_periodo",
      requisitosV2: s.requisitosEstudiante || "requisitos_estudiante",
      contactosV2: s.contactosEstudiante || "contactos_estudiante",
      notasV2: s.notasTitulacion || "notas_titulacion",
      divisionesV2: s.divisionesEstudiante || "divisiones_estudiante",
      cambiosPendientes: s.cambiosPendientes || "cambios_pendientes",
      syncEstado: s.syncEstado || "sync_estado",
      cacheViews: s.cacheViews || "cache_views"
    };
  }

  function requiredStores(){
    var s = cfgStores();
    var fromConfig = config().dbV2 && Array.isArray(config().dbV2.requiredStores) ? config().dbV2.requiredStores : [];
    var fallback = [
      s.personas,
      s.matriculas,
      s.requisitosV2,
      s.contactosV2,
      s.notasV2,
      s.divisionesV2,
      s.cambiosPendientes,
      s.syncEstado,
      s.cacheViews
    ];
    return (fromConfig.length ? fromConfig : fallback).filter(Boolean);
  }

  function dbMeta(){
    try{
      if(window.BL2DB && typeof window.BL2DB.meta === "function"){
        return window.BL2DB.meta() || null;
      }
    }catch(error){}
    return null;
  }

  function storeList(meta){
    meta = meta || dbMeta() || {};
    if(Array.isArray(meta.stores)){ return meta.stores.slice(); }
    if(meta.storeNames && Array.isArray(meta.storeNames)){ return meta.storeNames.slice(); }
    return [];
  }

  function hasStore(name, meta){
    name = text(name);
    if(!name){ return false; }
    return storeList(meta).indexOf(name) >= 0;
  }

  function missingStores(meta){
    return requiredStores().filter(function(name){ return !hasStore(name, meta); });
  }

  function safeStatus(fn){
    try{ return typeof fn === "function" ? fn() : null; }
    catch(error){ return { ok:false, error:error && error.message ? error.message : String(error) }; }
  }

  function conexionesStatus(){
    return safeStatus(function(){
      return window.BDLocalConexiones && typeof window.BDLocalConexiones.status === "function" ? window.BDLocalConexiones.status() : null;
    });
  }

  function syncStatus(){
    return safeStatus(function(){
      if(window.BDLSyncOrchestrator && typeof window.BDLSyncOrchestrator.status === "function"){
        return window.BDLSyncOrchestrator.status();
      }
      if(window.BL2Sync && typeof window.BL2Sync.status === "function"){
        return window.BL2Sync.status();
      }
      return null;
    });
  }

  function cacheStatus(){
    return safeStatus(function(){
      if(window.BDLocalConUtils && typeof window.BDLocalConUtils.readCache === "function"){
        var cache = window.BDLocalConUtils.readCache();
        return {
          ok: true,
          periods: cache.periods ? cache.periods.length : 0,
          students: cache.students ? cache.students.length : 0,
          mode: cache.meta && cache.meta.refreshMode || ""
        };
      }
      return null;
    });
  }

  function run(){
    var meta = dbMeta();
    var stores = cfgStores();
    var missingStoreNames = missingStores(meta);
    var dbVersion = Number(meta && meta.version || config().dbVersion || 0);
    var configReady = !!(config().dbV2 && config().dbV2.enabled && Number(config().dbVersion || 0) >= 2);

    var checks = {
      bl2Config: bool(window.BL2Config),
      configV2: configReady,
      bl2db: bool(window.BL2DB),
      dbVersion: dbVersion,
      dbOpen: bool(meta && meta.open),
      outboxBridge: bool(window.BDLOutboxBridge),
      v2Mirror: bool(window.BDLV2Mirror),
      repositories: bool(window.BDLRepositories),
      services: bool(window.BDLServices),
      screenDeps: bool(window.BDLocalScreenDeps),
      conexiones: bool(window.BDLocalConexiones),
      syncOrchestrator: bool(window.BDLSyncOrchestrator),
      allRequiredStores: missingStoreNames.length === 0,
      reloadGuard: !!readSession(RELOAD_GUARD_KEY)
    };

    var missing = [];
    if(!checks.bl2Config){ missing.push("bl2Config"); }
    if(!checks.configV2){ missing.push("configV2"); }
    if(!checks.bl2db){ missing.push("bl2db"); }
    if(!checks.outboxBridge){ missing.push("outboxBridge"); }
    if(!checks.v2Mirror){ missing.push("v2Mirror"); }
    if(!checks.repositories){ missing.push("repositories"); }
    if(!checks.services){ missing.push("services"); }
    if(!checks.conexiones){ missing.push("conexiones"); }
    if(missingStoreNames.length){ missing.push("storesV2"); }

    var reloadNeeded = Number(dbVersion || 0) < 2 || missingStoreNames.length > 0;
    var ok = missing.length === 0 && !reloadNeeded;

    return {
      ok: ok,
      version: VERSION,
      generatedAt: nowISO(),
      missing: missing,
      reloadNeeded: reloadNeeded,
      reloadAlreadyPrepared: !!readSession(RELOAD_GUARD_KEY),
      missingStores: missingStoreNames,
      requiredStores: requiredStores(),
      checks: checks,
      stores: stores,
      dbMeta: meta,
      conexiones: conexionesStatus(),
      syncStatus: syncStatus(),
      cacheStatus: cacheStatus(),
      message: ok
        ? "BDLocal optimizada: configuración, DB_VERSION 2, stores y conectores principales cargados."
        : (reloadNeeded
          ? "La base necesita una recarga segura para completar DB_VERSION 2 o crear stores faltantes."
          : "Faltan componentes por cargar o revisar.")
    };
  }

  function closeDB(){
    try{
      if(window.BL2DB && typeof window.BL2DB.close === "function"){
        window.BL2DB.close();
        return true;
      }
    }catch(error){}
    return false;
  }

  function prepareReload(options){
    options = options || {};
    var status = run();
    var closed = closeDB();

    writeSession(RELOAD_GUARD_KEY, JSON.stringify({
      at: nowISO(),
      reason: options.reason || "Completar DB_VERSION 2",
      status: {
        missing: status.missing,
        missingStores: status.missingStores,
        dbVersion: status.checks && status.checks.dbVersion
      }
    }));

    try{
      window.dispatchEvent(new CustomEvent("bdlocal:v2-reload-prepared", {
        detail: Object.assign({}, status, { closed: closed })
      }));
    }catch(error2){}

    if(options.reload === true){
      window.setTimeout(function(){
        try{ window.location.reload(); }catch(error3){}
      }, Number(options.delay || 300));
    }

    return Object.assign({}, status, {
      prepared: true,
      closed: closed,
      reloadScheduled: options.reload === true
    });
  }

  function clearReloadGuard(){
    try{ window.sessionStorage.removeItem(RELOAD_GUARD_KEY); }catch(error){}
    return true;
  }

  function reportToConsole(){
    var status = run();
    try{
      if(status.ok){ console.info("[BDLFinalHealth]", status.message, status); }
      else{ console.warn("[BDLFinalHealth]", status.message, status); }
    }catch(error){}
    return status;
  }

  window.BDLFinalHealth = {
    version: VERSION,
    run: run,
    status: run,
    reportToConsole: reportToConsole,
    prepareReload: prepareReload,
    clearReloadGuard: clearReloadGuard
  };

  try{
    window.dispatchEvent(new CustomEvent("bdlocal:final-health-ready", { detail: run() }));
  }catch(error4){}
})(window);