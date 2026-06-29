/* =========================================================
Nombre completo: bl2-storage.js
Ruta o ubicación: /Requisitos/BaseLocal2/db/bl2-storage.js
Función o funciones:
- Orquestar IndexedDB como motor principal de Base Local 2.
- Usar SQLite solo si existe puente real; legacy solo como respaldo.
- Migrar snapshot/localStorage a IndexedDB una sola vez por firma de datos.
- Exponer consultas asíncronas de períodos, estudiantes y cédula.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.1-indexeddb-first";
  var state = {started:false, ready:false, mode:"legacy", lastError:"", initializedAt:"", lastCopy:null, warmStarted:false, warmFinished:false};

  function now(){return new Date().toISOString();}
  function cfg(){return window.BL2Config || null;}
  function rt(){return window.BL2Runtime || null;}
  function legacy(){return window.BL2LegacyAdapter || null;}
  function indexed(){return window.BL2IndexedDBAdapter || null;}
  function sqlite(){return window.BL2SQLiteAdapter || null;}
  function readJsonSafe(key, fallback){try{if(cfg() && typeof cfg().readJson === "function"){return cfg().readJson(key, fallback);}var raw = window.localStorage ? window.localStorage.getItem(key) : null;return raw ? JSON.parse(raw) : fallback;}catch(error){return fallback;}}
  function writeJsonSafe(key, value){try{if(cfg() && typeof cfg().writeJson === "function"){cfg().writeJson(key, value);return;}if(window.localStorage){window.localStorage.setItem(key, JSON.stringify(value));}}catch(error){}}
  function statusKey(){return cfg() && cfg().keys ? cfg().keys.cacheStatus : "BL2_STORAGE_STATUS";}
  function warmKey(){return "BL2_STORAGE_WARM_LEGACY_AT";}
  function migrationKey(){return "BL2_STORAGE_MIGRATION_SIGNATURE";}

  function saveStatus(extra){var status = Object.assign({ok:!state.lastError,version:VERSION,started:state.started,ready:state.ready,mode:state.mode,lastError:state.lastError,initializedAt:state.initializedAt,lastCopy:state.lastCopy,warmStarted:state.warmStarted,warmFinished:state.warmFinished,updatedAt:now()}, extra || {});writeJsonSafe(statusKey(), status);return status;}
  function detectRuntime(){try{if(rt() && typeof rt().detect === "function"){return rt().detect(true) || {};}}catch(error){}return {preferredStorage:"indexeddb"};}

  function chooseMode(){
    var runtime = detectRuntime();
    var preferred = runtime.preferredStorage || "indexeddb";
    if(preferred === "sqlite" && sqlite() && sqlite().isAvailable && sqlite().isAvailable()){return "sqlite";}
    if(indexed() && indexed().isAvailable && indexed().isAvailable()){return "indexeddb";}
    if(sqlite() && sqlite().isAvailable && sqlite().isAvailable()){return "sqlite";}
    return "legacy";
  }
  function adapterForMode(mode){if(mode === "sqlite"){return sqlite();}if(mode === "indexeddb"){return indexed();}return legacy();}

  function initialize(options){
    options = options || {};
    if(state.started && options.force !== true){return Promise.resolve(saveStatus({skipped:true}));}
    state.started = true;
    state.mode = chooseMode();
    var adapter = adapterForMode(state.mode);
    if(!adapter){state.ready = false;state.lastError = "No hay adaptador BL2 disponible.";return Promise.resolve(saveStatus({ok:false}));}
    var action;
    if(state.mode === "sqlite" && typeof adapter.initialize === "function"){action = adapter.initialize(options);}
    else if(state.mode === "indexeddb" && typeof adapter.open === "function"){action = adapter.open().then(function(){return {ok:true, mode:"indexeddb"};});}
    else{action = Promise.resolve({ok:true, mode:"legacy", skipped:true});}
    return action.then(function(result){state.ready = !!(result && result.ok !== false);state.initializedAt = now();state.lastError = result && result.ok === false ? (result.message || result.errorMessage || "Inicialización BL2 incompleta") : "";return saveStatus({result:result});}).catch(function(error){state.ready = false;state.lastError = error && error.message ? error.message : String(error);return saveStatus({ok:false});});
  }

  function snapshotSignature(snapshot){snapshot = snapshot || {};var students = Array.isArray(snapshot.students) ? snapshot.students : [];var periods = Array.isArray(snapshot.periods) ? snapshot.periods : [];var meta = snapshot.meta || {};var first = students[0] || {};var last = students[students.length - 1] || {};return [meta.updatedAt || meta.pulledAt || meta.createdAt || "", periods.length, students.length, first.cedula || first.numeroIdentificacion || first._docId || "", last.cedula || last.numeroIdentificacion || last._docId || ""].join("|");}
  function legacySnapshot(options){options = options || {};if(!legacy() || typeof legacy().readSnapshot !== "function"){return null;}return legacy().readSnapshot({clone:false, force:options.force === true});}

  function copySnapshot(snapshot, options){
    options = options || {};
    state.mode = chooseMode();
    var adapter = adapterForMode(state.mode);
    if(!adapter || typeof adapter.bulkFromSnapshot !== "function"){state.lastError = "El adaptador BL2 seleccionado no puede recibir snapshots.";return Promise.resolve(saveStatus({ok:false, copySkipped:true}));}
    return initialize().then(function(){return adapter.bulkFromSnapshot(snapshot || {}, Object.assign({source:"BL2Storage.copySnapshot"}, options));}).then(function(result){state.lastCopy = Object.assign({at:now(), mode:state.mode}, result || {});state.lastError = result && result.ok === false ? (result.message || result.errorMessage || "Copia BL2 incompleta") : "";return saveStatus({lastCopy:state.lastCopy});}).catch(function(error){state.lastError = error && error.message ? error.message : String(error);return saveStatus({ok:false});});
  }

  function copyFromLegacy(options){options = options || {};var snapshot = legacySnapshot(options);if(!snapshot){return Promise.resolve(saveStatus({ok:false, message:"Adaptador legado no disponible."}));}return copySnapshot(snapshot, options);}
  function shouldWarm(options){options = options || {};if(options.force === true){return true;}if(state.mode === "legacy"){return false;}var snapshot = legacySnapshot({force:false});if(!snapshot){return false;}var sig = snapshotSignature(snapshot);var previous = readJsonSafe(migrationKey(), null);if(!previous || previous.signature !== sig || previous.schemaVersion !== (window.BL2Schema && window.BL2Schema.version)){return true;}var lastWarm = readJsonSafe(warmKey(), null);if(!lastWarm || !lastWarm.at){return true;}return false;}

  function warmFromLegacy(options){
    options = options || {};
    if(state.warmStarted && options.force !== true){return Promise.resolve(saveStatus({warmSkipped:true}));}
    state.mode = chooseMode();
    if(!shouldWarm(options)){return Promise.resolve(saveStatus({warmSkipped:true, reason:"migracion_vigente"}));}
    var snapshot = legacySnapshot({force:options.force === true});
    var sig = snapshotSignature(snapshot);
    state.warmStarted = true;state.warmFinished = false;
    return copySnapshot(snapshot, Object.assign({chunkSize:500, pauseMs:0, source:"BL2Storage.warmFromLegacy"}, options)).then(function(result){state.warmFinished = true;writeJsonSafe(warmKey(), {at:now(), result:result});writeJsonSafe(migrationKey(), {signature:sig, schemaVersion:window.BL2Schema && window.BL2Schema.version, migratedAt:now(), result:result});return saveStatus({warmResult:result});});
  }

  function currentAdapter(){state.mode = chooseMode();return adapterForMode(state.mode);}
  function listPeriods(options){options = options || {};var adapter = currentAdapter();if(adapter && typeof adapter.listPeriods === "function" && state.mode !== "legacy"){return initialize().then(function(){return adapter.listPeriods(options);});}var snap = legacySnapshot(options) || {periods:[]};return Promise.resolve(Array.isArray(snap.periods) ? snap.periods : []);}
  function listStudents(options){options = options || {};var adapter = currentAdapter();if(adapter && typeof adapter.listStudents === "function" && state.mode !== "legacy"){return initialize().then(function(){return adapter.listStudents(options);});}var snap = legacySnapshot(options) || {students:[]};var rows = Array.isArray(snap.students) ? snap.students : [];var offset = Math.max(0, Number(options.offset || 0) || 0);var limit = Math.max(0, Number(options.limit || 100) || 100);return Promise.resolve({rows:rows.slice(offset, offset + limit), total:rows.length, offset:offset, limit:limit, source:"legacy_snapshot"});}
  function getStudentById(cedula, options){options = options || {};var adapter = currentAdapter();if(adapter && typeof adapter.getStudentById === "function" && state.mode !== "legacy"){return initialize().then(function(){return adapter.getStudentById(cedula, options);});}return listStudents(Object.assign({}, options, {search:cedula, limit:20, matricula:""})).then(function(result){return (result.rows || []).filter(function(row){return String(row.cedula || row.numeroIdentificacion || row._bl2Id || "").trim() === String(cedula || "").trim();})[0] || null;});}
  function status(options){options = options || {};var mode = chooseMode();var adapter = adapterForMode(mode);var adapterStatus = adapter && typeof adapter.status === "function" ? adapter.status({deep:options.deep === true}) : {ok:false, mode:"sin_adapter"};return saveStatus({mode:mode, adapterStatus:adapterStatus, migration:readJsonSafe(migrationKey(), null)});}

  window.BL2Storage = {version:VERSION,initialize:initialize,copySnapshot:copySnapshot,copyFromLegacy:copyFromLegacy,warmFromLegacy:warmFromLegacy,listPeriods:listPeriods,listStudents:listStudents,getStudentById:getStudentById,status:status,chooseMode:chooseMode,adapter:currentAdapter};
  setTimeout(function(){initialize().then(function(){state.mode = chooseMode();if(state.mode !== "legacy"){warmFromLegacy({force:false});}});}, 250);
})(window);
