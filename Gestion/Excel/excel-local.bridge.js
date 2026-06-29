/* =========================================================
Nombre completo: excel-local.bridge.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-local.bridge.js
Función o funciones:
- Compatibilidad para pantallas antiguas que cargan ../Gestion/Excel/excel-local.bridge.js.
- Inicializar BL2Storage/IndexedDB sin reconstruir BL2DataEngine.
- Leer snapshot de Excel solo cuando una pantalla antigua lo pida.
- Evitar reescrituras de localStorage al arrancar.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.3.0-bl2-storage-compat";
  function storage(){if(!window.ExcelLocalStorage){throw new Error("ExcelLocalStorage no disponible.");}return window.ExcelLocalStorage;}
  function bl2Storage(){return window.BL2Storage || null;}
  function engine(){return window.BL2DataEngine || null;}

  function ensureReady(options){
    options = options || {};
    try{if(bl2Storage() && typeof bl2Storage().initialize === "function"){bl2Storage().initialize({force:options.force === true});}}catch(error){console.warn("[ExcelLocalBridge compat] BL2Storage no disponible todavía", error);}
    storage().readSnapshot({session:options.session !== false, clone:false});
    return true;
  }

  function getSnapshot(options){options = options || {};ensureReady(options);return storage().readSnapshot({session:options.session !== false, clone:options.clone !== false});}
  function getDb(options){var snap = getSnapshot(options || {});var bl2Status = null;try{bl2Status = bl2Storage() && bl2Storage().status ? bl2Storage().status({deep:false}) : null;}catch(error){}return {type:bl2Status && bl2Status.mode ? bl2Status.mode : "excel-local-compat", name:"ExcelLocal", snapshot:snap, updatedAt:new Date().toISOString(), readOnly:true, engineReady:!!engine(), bl2Ready:!!bl2Storage(), bl2Status:bl2Status, totalStudents:Array.isArray(snap.students) ? snap.students.length : 0, totalPeriods:Array.isArray(snap.periods) ? snap.periods.length : 0};}
  function getSyncShim(){return {async push(){return {ok:false, skipped:true, message:"Firebase se maneja por BaseLocalFirebase y cola BL2."};},async pull(){return {ok:false, skipped:true, message:"Firebase se maneja por BaseLocalFirebase y cola BL2."};},async compare(){return {ok:true, mode:"local-only", local:getSnapshot({clone:false}), remote:null};}};}
  function invalidate(){try{if(storage().invalidate){storage().invalidate();}}catch(error){}try{if(window.BL2 && typeof window.BL2.invalidate === "function"){window.BL2.invalidate({emit:false, source:"ExcelLocalBridge"});}}catch(error){}try{if(engine() && typeof engine().invalidate === "function"){engine().invalidate();}}catch(error){}try{if(window.BL2CacheResumen && typeof window.BL2CacheResumen.invalidate === "function"){window.BL2CacheResumen.invalidate();}}catch(error){}return true;}
  function status(){var storageStatus = storage().status ? storage().status() : {ok:true, mode:"excel_storage"};var bl2Status = null;try{bl2Status = bl2Storage() && bl2Storage().status ? bl2Storage().status({deep:false}) : {ok:false, mode:"sin_bl2_storage"};}catch(error){bl2Status = {ok:false, errorMessage:error && error.message ? error.message : String(error)};}return {ok:storageStatus.ok !== false, mode:"excel_local_bridge_bl2_storage", version:VERSION, storage:storageStatus, bl2:bl2Status, engine:{ready:!!engine(), mode:"no_reconstruido"}, updatedAt:new Date().toISOString()};}

  window.ExcelLocalBridge = {version:VERSION, ensureReady:ensureReady, getSnapshot:getSnapshot, getDb:getDb, getSyncShim:getSyncShim, invalidate:invalidate, status:status};
})(window);
