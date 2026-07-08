/* =========================================================
Archivo: bdl.final.health.js
Ruta: /BDLocal/diagnostics/bdl.final.health.js
Funcion:
- Diagnostico rapido de los bloques de optimizacion BDLocal.
- Verifica puente outbox, espejo V2, conectores, cache y sincronizacion.
- Detecta si la base necesita recarga segura para crear DB_VERSION 2.
- No modifica datos.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.1.0";

  function text(value){ return String(value == null ? "" : value).trim(); }
  function bool(value){ return !!value; }
  function cfgStores(){
    var cfg = window.BL2Config || {};
    var s = cfg.stores || {};
    return {
      cambios:s.cambios || "cambios",
      cambiosPendientes:s.cambiosPendientes || "cambios_pendientes",
      personas:s.personas || "personas",
      matriculas:s.matriculasPeriodo || "matriculas_periodo",
      requisitos:s.requisitosEstudiante || "requisitos_estudiante",
      contactos:s.contactosEstudiante || "contactos_estudiante",
      notas:s.notasTitulacion || "notas_titulacion"
    };
  }
  function dbMeta(){
    try{ return window.BL2DB && typeof window.BL2DB.meta === "function" ? window.BL2DB.meta() : null; }
    catch(error){ return null; }
  }
  function hasStore(name, meta){
    meta = meta || dbMeta() || {};
    return Array.isArray(meta.stores) && meta.stores.indexOf(name) >= 0;
  }
  function run(){
    var stores = cfgStores();
    var meta = dbMeta();
    var connectorsStatus = null;
    try{
      connectorsStatus = window.BDLocalConexiones && typeof window.BDLocalConexiones.status === "function" ? window.BDLocalConexiones.status() : null;
    }catch(error){}
    var syncStatus = null;
    try{
      syncStatus = window.BDLSyncOrchestrator && typeof window.BDLSyncOrchestrator.status === "function" ? "async" : null;
    }catch(error2){}
    var checks = {
      bl2db:bool(window.BL2DB),
      dbVersion:meta ? meta.version : 0,
      outboxBridge:bool(window.BDLOutboxBridge),
      v2Mirror:bool(window.BDLV2Mirror),
      screenDeps:bool(window.BDLocalScreenDeps),
      conexiones:bool(window.BDLocalConexiones),
      syncOrchestrator:bool(window.BDLSyncOrchestrator),
      cambiosPendientesStore:hasStore(stores.cambiosPendientes, meta),
      personasStore:hasStore(stores.personas, meta),
      matriculasStore:hasStore(stores.matriculas, meta),
      requisitosV2Store:hasStore(stores.requisitos, meta),
      contactosV2Store:hasStore(stores.contactos, meta),
      notasV2Store:hasStore(stores.notas, meta)
    };
    var required = ["bl2db","outboxBridge","v2Mirror","conexiones","cambiosPendientesStore","personasStore","matriculasStore","requisitosV2Store","contactosV2Store","notasV2Store"];
    var missing = required.filter(function(key){ return !checks[key]; });
    var reloadNeeded = missing.some(function(key){ return /Store$/.test(key); }) || Number(checks.dbVersion || 0) < 2;
    return {
      ok:missing.length === 0,
      version:VERSION,
      missing:missing,
      reloadNeeded:reloadNeeded,
      checks:checks,
      stores:stores,
      dbMeta:meta,
      conexiones:connectorsStatus,
      syncStatus:syncStatus,
      message:missing.length ? (reloadNeeded ? "La base necesita una recarga segura para completar DB_VERSION 2." : "Faltan componentes por cargar.") : "BDLocal optimizada: bloques principales cargados."
    };
  }
  function prepareReload(options){
    options = options || {};
    var status = run();
    if(window.BL2DB && typeof window.BL2DB.close === "function"){
      try{ window.BL2DB.close(); }catch(error){}
    }
    try{ window.dispatchEvent(new CustomEvent("bdlocal:v2-reload-prepared", { detail:status })); }catch(error2){}
    if(options.reload === true){
      window.setTimeout(function(){ try{ window.location.reload(); }catch(error3){} }, Number(options.delay || 300));
    }
    return Object.assign({}, status, { prepared:true, reloadScheduled:options.reload === true });
  }
  window.BDLFinalHealth = { version:VERSION, run:run, prepareReload:prepareReload };
})(window);