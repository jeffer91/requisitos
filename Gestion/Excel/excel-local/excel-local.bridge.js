/* =========================================================
Nombre completo: excel-local.bridge.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-local/excel-local.bridge.js
Función o funciones:
- Crear puente local compatible con otras pantallas.
- Exponer getDb(), getSnapshot(), status(), invalidate() y un shim de sincronización seguro.
- Leer la Base Local sin reescribir el snapshot durante pantallas de consulta.
- Preferir BL2DataEngine para consultas rápidas cuando esté disponible.
Con qué se conecta:
- excel-local.config.js
- excel-local.storage.js
- excel-local.repo.js
- BaseLocal2/core/bl2-data-engine.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.2.0-bl2";
  function storage(){if(!window.ExcelLocalStorage){throw new Error("ExcelLocalStorage no disponible.");}return window.ExcelLocalStorage;}
  function engine(){return window.BL2DataEngine || null;}
  function now(){return new Date().toISOString();}

  function ensureReady(options){
    options = options || {};
    if(engine() && typeof engine().build === "function"){engine().build({force:options.force === true});}
    else{storage().readSnapshot({session:options.session !== false});}
    return true;
  }

  function getSnapshot(options){
    options = options || {};
    if(options.fast === true && engine() && typeof engine().snapshot === "function"){return engine().snapshot({clone:options.clone !== false, force:options.force === true});}
    return storage().readSnapshot({session:options.session !== false});
  }

  function getDb(options){
    var snap = getSnapshot(options || {});
    return {type:"localStorage", name:"ExcelLocal", snapshot:snap, updatedAt:now(), readOnly:true, engineReady:!!engine(), totalStudents:Array.isArray(snap.students) ? snap.students.length : 0, totalPeriods:Array.isArray(snap.periods) ? snap.periods.length : 0};
  }

  function invalidate(){
    try{if(storage().invalidate){storage().invalidate();}}catch(error){}
    try{if(engine() && typeof engine().invalidate === "function"){engine().invalidate();}}catch(error){}
    try{if(window.BL2CacheResumen && typeof window.BL2CacheResumen.invalidate === "function"){window.BL2CacheResumen.invalidate();}}catch(error){}
    return true;
  }

  function status(){
    var storageStatus = storage().status ? storage().status() : {ok:true, mode:"excel_storage"};
    var engineStatus = engine() && engine().status ? engine().status({force:false}) : {ok:false, mode:"sin_bl2_engine"};
    return {ok:storageStatus.ok !== false, mode:"excel_local_bridge", version:VERSION, storage:storageStatus, engine:engineStatus, updatedAt:now()};
  }

  function getSyncShim(){
    return {
      async push(){return {ok:false, skipped:true, message:"Firebase se activa en el bloque de sincronización."};},
      async pull(){return {ok:false, skipped:true, message:"Firebase se activa en el bloque de sincronización."};},
      async compare(){return {ok:true, mode:"local-only", local:getSnapshot({fast:true}), remote:null};}
    };
  }

  window.ExcelLocalBridge = {version:VERSION, ensureReady:ensureReady, getSnapshot:getSnapshot, getDb:getDb, getSyncShim:getSyncShim, invalidate:invalidate, status:status};
})(window);
