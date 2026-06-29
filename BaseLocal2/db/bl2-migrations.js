/* =========================================================
Nombre completo: bl2-migrations.js
Ruta o ubicación: /Requisitos/BaseLocal2/db/bl2-migrations.js
Función o funciones:
- Crear almacenes e índices de IndexedDB para Base Local 2.0.
- Preparar sentencias base para SQLite en Electron.
- Mantener migraciones ordenadas por versión.
Con qué se conecta:
- bl2-schema.js
- bl2-indexeddb-adapter.js
- bl2-sqlite-adapter.js
========================================================= */
(function(window){
  "use strict";

  function schema(){if(!window.BL2Schema){throw new Error("BL2Schema no disponible.");}return window.BL2Schema;}
  function now(){return new Date().toISOString();}

  function ensureIndex(store, index){
    try{
      if(!store.indexNames.contains(index.name)){
        store.createIndex(index.name, index.keyPath, index.options || {unique:false});
      }
    }catch(error){console.warn("[BL2Migrations] No se pudo crear índice", index && index.name, error);}
  }

  function ensureStore(db, storeDef){
    var store;
    if(!db.objectStoreNames.contains(storeDef.name)){
      store = db.createObjectStore(storeDef.name, {keyPath:storeDef.keyPath});
    }else{
      try{store = db.transaction.objectStore(storeDef.name);}catch(error){store = null;}
    }
    return store;
  }

  function applyIndexedDBUpgrade(event){
    var db = event.target.result;
    var s = schema();
    Object.keys(s.stores).forEach(function(key){
      var storeDef = s.stores[key];
      var store = ensureStore(db, storeDef);
      if(store && s.indexes[storeDef.name]){
        s.indexes[storeDef.name].forEach(function(index){ensureIndex(store, index);});
      }
    });
    try{
      var metaStore = db.objectStoreNames.contains("metadata") ? event.target.transaction.objectStore("metadata") : null;
      if(metaStore){metaStore.put({key:"schema", version:s.version, migratedAt:now(), dbName:s.dbName});}
    }catch(error){}
  }

  function sqliteCreateStatements(){
    return [
      "CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT, updatedAt TEXT)",
      "CREATE TABLE IF NOT EXISTS periodos (id TEXT PRIMARY KEY, periodoId TEXT, label TEXT, periodoLabel TEXT, labelKey TEXT, updatedAt TEXT, data TEXT)",
      "CREATE TABLE IF NOT EXISTS estudiantes (cedula TEXT PRIMARY KEY, numeroIdentificacion TEXT, nombres TEXT, nombreCarrera TEXT, nombreCarreraKey TEXT, periodoId TEXT, periodoLabel TEXT, estadoMatricula TEXT, searchText TEXT, updatedAt TEXT, data TEXT)",
      "CREATE TABLE IF NOT EXISTS requisitos_estado (id TEXT PRIMARY KEY, cedula TEXT, periodoId TEXT, requisito TEXT, estado TEXT, valor TEXT, updatedAt TEXT, data TEXT)",
      "CREATE TABLE IF NOT EXISTS matricula_historial (id TEXT PRIMARY KEY, cedula TEXT, periodoId TEXT, estadoMatricula TEXT, createdAt TEXT, data TEXT)",
      "CREATE TABLE IF NOT EXISTS divisiones (id TEXT PRIMARY KEY, periodoId TEXT, nombre TEXT, nombreKey TEXT, updatedAt TEXT, data TEXT)",
      "CREATE TABLE IF NOT EXISTS estudiante_division (id TEXT PRIMARY KEY, cedula TEXT, periodoId TEXT, divisionId TEXT, updatedAt TEXT, data TEXT)",
      "CREATE TABLE IF NOT EXISTS cargas_excel (id TEXT PRIMARY KEY, periodoId TEXT, fileName TEXT, totalRows INTEGER, createdAt TEXT, data TEXT)",
      "CREATE TABLE IF NOT EXISTS sync_queue (id TEXT PRIMARY KEY, entidad TEXT, entidadId TEXT, accion TEXT, estado TEXT, updatedAt TEXT, data TEXT)",
      "CREATE TABLE IF NOT EXISTS sync_state (key TEXT PRIMARY KEY, value TEXT, updatedAt TEXT)",
      "CREATE TABLE IF NOT EXISTS auditoria_local (id TEXT PRIMARY KEY, entidad TEXT, entidadId TEXT, accion TEXT, createdAt TEXT, data TEXT)",
      "CREATE TABLE IF NOT EXISTS cache_resumen (key TEXT PRIMARY KEY, periodoId TEXT, tipo TEXT, updatedAt TEXT, data TEXT)",
      "CREATE INDEX IF NOT EXISTS idx_estudiantes_periodo_estado ON estudiantes(periodoId, estadoMatricula)",
      "CREATE INDEX IF NOT EXISTS idx_estudiantes_periodo_carrera ON estudiantes(periodoId, nombreCarreraKey)",
      "CREATE INDEX IF NOT EXISTS idx_estudiantes_estado ON estudiantes(estadoMatricula)",
      "CREATE INDEX IF NOT EXISTS idx_estudiantes_updated ON estudiantes(updatedAt)",
      "CREATE INDEX IF NOT EXISTS idx_requisitos_cedula ON requisitos_estado(cedula)",
      "CREATE INDEX IF NOT EXISTS idx_requisitos_estado ON requisitos_estado(estado)",
      "CREATE INDEX IF NOT EXISTS idx_sync_queue_estado ON sync_queue(estado)",
      "CREATE INDEX IF NOT EXISTS idx_cache_resumen_periodo ON cache_resumen(periodoId)"
    ];
  }

  window.BL2Migrations = {
    version:"2.0.0-alpha.1",
    applyIndexedDBUpgrade:applyIndexedDBUpgrade,
    sqliteCreateStatements:sqliteCreateStatements
  };
})(window);
