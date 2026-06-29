/* =========================================================
Nombre completo: bl2-config.js
Ruta o ubicación: /Requisitos/BaseLocal2/bl2-config.js
Función o funciones:
- Definir configuración central de Base Local 2.0.
- Mantener BL2 apagado de forma segura si falta algún adaptador.
- Guardar banderas de rendimiento sin tocar datos académicos.
- Preparar nombres de tablas/almacenes para SQLite e IndexedDB.
Con qué se conecta:
- bl2-detect-runtime.js
- bl2-legacy-adapter.js
- bl2-api.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-alpha.1";
  var PREFIX = "REQ_BL2_";

  var KEYS = {
    enabled:PREFIX + "ENABLED",
    status:PREFIX + "STATUS",
    runtime:PREFIX + "RUNTIME",
    storageMode:PREFIX + "STORAGE_MODE",
    migrationStatus:PREFIX + "MIGRATION_STATUS",
    lastDiagnostic:PREFIX + "LAST_DIAGNOSTIC",
    cacheStatus:PREFIX + "CACHE_STATUS"
  };

  var TABLES = {
    periodos:"periodos",
    estudiantes:"estudiantes",
    requisitosEstado:"requisitos_estado",
    matriculaHistorial:"matricula_historial",
    divisiones:"divisiones",
    estudianteDivision:"estudiante_division",
    cargasExcel:"cargas_excel",
    syncQueue:"sync_queue",
    syncState:"sync_state",
    auditoriaLocal:"auditoria_local",
    cacheResumen:"cache_resumen"
  };

  var DEFAULTS = {
    pageSize:100,
    searchLimit:100,
    fichaLimit:100,
    tablaLimit:100,
    maxPreviewRows:400,
    debounceMs:260,
    preferSQLite:true,
    fallbackIndexedDB:true,
    fallbackLegacy:true
  };

  function text(value){return String(value == null ? "" : value).trim();}
  function bool(value, fallback){if(value === true || value === "true"){return true;}if(value === false || value === "false"){return false;}return !!fallback;}
  function read(key, fallback){try{var value = window.localStorage.getItem(key);return value == null ? fallback : value;}catch(error){return fallback;}}
  function write(key, value){try{window.localStorage.setItem(key, String(value));}catch(error){}return value;}
  function readJson(key, fallback){try{var raw = window.localStorage.getItem(key);return raw ? JSON.parse(raw) : fallback;}catch(error){return fallback;}}
  function writeJson(key, value){try{window.localStorage.setItem(key, JSON.stringify(value));}catch(error){}return value;}

  function isEnabled(){
    var stored = read(KEYS.enabled, "true");
    return bool(stored, true);
  }

  function setEnabled(value){
    return write(KEYS.enabled, value === false ? "false" : "true");
  }

  function getStorageMode(){
    return text(read(KEYS.storageMode, "auto")) || "auto";
  }

  function setStorageMode(mode){
    var clean = text(mode || "auto");
    if(["auto","sqlite","indexeddb","legacy"].indexOf(clean) < 0){clean = "auto";}
    return write(KEYS.storageMode, clean);
  }

  function saveStatus(status){
    var payload = Object.assign({version:VERSION, updatedAt:new Date().toISOString()}, status || {});
    return writeJson(KEYS.status, payload);
  }

  function getStatus(){
    return readJson(KEYS.status, {version:VERSION, enabled:isEnabled(), mode:"sin_estado"});
  }

  window.BL2Config = {
    version:VERSION,
    prefix:PREFIX,
    keys:KEYS,
    tables:Object.assign({}, TABLES),
    defaults:Object.assign({}, DEFAULTS),
    isEnabled:isEnabled,
    setEnabled:setEnabled,
    getStorageMode:getStorageMode,
    setStorageMode:setStorageMode,
    saveStatus:saveStatus,
    getStatus:getStatus,
    readJson:readJson,
    writeJson:writeJson
  };
})(window);
