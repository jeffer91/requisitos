/* =========================================================
Nombre completo: excel-local.bridge.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-local.bridge.js
Función o funciones:
- Archivo de compatibilidad para pantallas antiguas que todavía cargan ../Gestion/Excel/excel-local.bridge.js.
- Mantener BaseLocal funcional sin reescribir su HTML largo.
- Leer la Base Local sin reescribir el snapshot en cada arranque.
- Evitar cuelgues por JSON.stringify/localStorage cuando solo se está consultando información.
- Exponer el mismo puente local que /excel-local/excel-local.bridge.js.
Con qué se conecta:
- excel-local/excel-local.config.js
- excel-local/excel-local.storage.js
- excel-local.repo.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.2.1-fast-compat";

  function storage(){
    if(!window.ExcelLocalStorage){throw new Error("ExcelLocalStorage no disponible.");}
    return window.ExcelLocalStorage;
  }

  function engine(){return window.BL2DataEngine || null;}

  function ensureReady(options){
    options = options || {};
    try{
      if(engine() && typeof engine().build === "function"){
        engine().build({force:options.force === true});
        return true;
      }
    }catch(error){console.warn("[ExcelLocalBridge compat] BL2 no disponible, se usa storage local", error);}

    /*
      Antes este archivo hacía:
      readSnapshot() + writeSnapshot(s)
      Eso reescribía todo el snapshot cada vez que abría BaseLocal y podía congelar la app.
      Ahora solo lee/verifica que el storage exista.
    */
    storage().readSnapshot({session:options.session !== false, clone:false});
    return true;
  }

  function getSnapshot(options){
    options = options || {};
    ensureReady(options);
    if(options.fast === true && engine() && typeof engine().snapshot === "function"){
      return engine().snapshot({clone:options.clone !== false, force:options.force === true});
    }
    return storage().readSnapshot({session:options.session !== false, clone:options.clone !== false});
  }

  function getDb(options){
    var snap = getSnapshot(options || {});
    return {
      type:"localStorage",
      name:"ExcelLocal",
      snapshot:snap,
      updatedAt:new Date().toISOString(),
      readOnly:true,
      engineReady:!!engine(),
      totalStudents:Array.isArray(snap.students) ? snap.students.length : 0,
      totalPeriods:Array.isArray(snap.periods) ? snap.periods.length : 0
    };
  }

  function getSyncShim(){
    return {
      async push(){return {ok:false, skipped:true, message:"Firebase se activa en el bloque de sincronización."};},
      async pull(){return {ok:false, skipped:true, message:"Firebase se activa en el bloque de sincronización."};},
      async compare(){return {ok:true, mode:"local-only", local:getSnapshot({fast:true, clone:false}), remote:null};}
    };
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
    return {ok:storageStatus.ok !== false, mode:"excel_local_bridge_compat", version:VERSION, storage:storageStatus, engine:engineStatus, updatedAt:new Date().toISOString()};
  }

  window.ExcelLocalBridge = {version:VERSION, ensureReady:ensureReady, getSnapshot:getSnapshot, getDb:getDb, getSyncShim:getSyncShim, invalidate:invalidate, status:status};
})(window);