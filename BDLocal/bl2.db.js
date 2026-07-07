/* =========================================================
Archivo: bl2.db.js
Ruta: /BDLocal/bl2.db.js
Función:
- Crear y administrar IndexedDB de BL2.
- Manejar tablas principales actuales y tablas nuevas DB_VERSION 2.
- Crear tablas nuevas sin borrar ni renombrar datos existentes.
- Entregar funciones simples para leer, guardar, listar, contar y consultar.
========================================================= */
(function(window){
  "use strict";

  var config = window.BL2Config || {};
  var stores = config.stores || {};
  var utils = config.utils || {};

  var DB_NAME = config.dbName || "REQUISITOS_BL2";
  var DB_VERSION = Math.max(Number(config.dbVersion || 1), 1);

  var state = {
    db: null,
    opening: null
  };

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function nowISO(){
    return utils.nowISO ? utils.nowISO() : new Date().toISOString();
  }

  function clone(value){
    if(value === undefined){ return undefined; }
    return JSON.parse(JSON.stringify(value));
  }

  function reject(message){
    return Promise.reject(new Error(message));
  }

  function requestToPromise(request){
    return new Promise(function(resolve, rejectFn){
      request.onsuccess = function(){ resolve(request.result); };
      request.onerror = function(){ rejectFn(request.error || new Error("Error IndexedDB.")); };
    });
  }

  function createIndexSafe(store, name, keyPath, options){
    try{
      if(store && !store.indexNames.contains(name)){
        store.createIndex(name, keyPath, options || {});
      }
    }catch(error){
      console.warn("[BL2DB] No se pudo crear índice:", name, error);
    }
  }

  function upgradeStore(db, transaction, name, options){
    name = text(name);
    if(!name){ return null; }

    try{
      if(db.objectStoreNames.contains(name)){
        return transaction ? transaction.objectStore(name) : null;
      }
      return db.createObjectStore(name, options || { keyPath: "id" });
    }catch(error){
      console.warn("[BL2DB] No se pudo preparar store:", name, error);
      return null;
    }
  }

  function ensureStores(db, transaction){
    var settings = upgradeStore(db, transaction, stores.settings || "settings", { keyPath: "key" });
    createIndexSafe(settings, "updatedAt", "updatedAt", { unique: false });

    var periodos = upgradeStore(db, transaction, stores.periodos || "periodos", { keyPath: "id" });
    createIndexSafe(periodos, "label", "label", { unique: false });
    createIndexSafe(periodos, "updatedAt", "updatedAt", { unique: false });

    var estudiantes = upgradeStore(db, transaction, stores.estudiantes || "estudiantes", { keyPath: "id" });
    createIndexSafe(estudiantes, "cedula", "cedula", { unique: false });
    createIndexSafe(estudiantes, "periodoId", "periodoId", { unique: false });
    createIndexSafe(estudiantes, "periodo_cedula", ["periodoId", "cedula"], { unique: true });
    createIndexSafe(estudiantes, "periodo_carrera", ["periodoId", "NombreCarrera"], { unique: false });
    createIndexSafe(estudiantes, "periodo_division", ["periodoId", "division"], { unique: false });
    createIndexSafe(estudiantes, "estadoMatricula", "estadoMatricula", { unique: false });
    createIndexSafe(estudiantes, "updatedAt", "updatedAt", { unique: false });

    var requisitos = upgradeStore(db, transaction, stores.requisitos || "requisitos", { keyPath: "id" });
    createIndexSafe(requisitos, "studentId", "studentId", { unique: false });
    createIndexSafe(requisitos, "periodoId", "periodoId", { unique: false });
    createIndexSafe(requisitos, "cedula", "cedula", { unique: false });
    createIndexSafe(requisitos, "nombre", "nombre", { unique: false });
    createIndexSafe(requisitos, "valor", "valor", { unique: false });
    createIndexSafe(requisitos, "periodo_nombre", ["periodoId", "nombre"], { unique: false });
    createIndexSafe(requisitos, "updatedAt", "updatedAt", { unique: false });

    var contactos = upgradeStore(db, transaction, stores.contactos || "contactos", { keyPath: "id" });
    createIndexSafe(contactos, "studentId", "studentId", { unique: false });
    createIndexSafe(contactos, "periodoId", "periodoId", { unique: false });
    createIndexSafe(contactos, "cedula", "cedula", { unique: false });
    createIndexSafe(contactos, "updatedAt", "updatedAt", { unique: false });

    var notas = upgradeStore(db, transaction, stores.notas || "notas", { keyPath: "id" });
    createIndexSafe(notas, "studentId", "studentId", { unique: false });
    createIndexSafe(notas, "periodoId", "periodoId", { unique: false });
    createIndexSafe(notas, "cedula", "cedula", { unique: false });
    createIndexSafe(notas, "idEstudiantePeriodo", "idEstudiantePeriodo", { unique: false });
    createIndexSafe(notas, "updatedAt", "updatedAt", { unique: false });

    var cambios = upgradeStore(db, transaction, stores.cambios || "cambios", { keyPath: "id" });
    createIndexSafe(cambios, "periodoId", "periodoId", { unique: false });
    createIndexSafe(cambios, "cedula", "cedula", { unique: false });
    createIndexSafe(cambios, "tipo", "tipo", { unique: false });
    createIndexSafe(cambios, "tabla", "tabla", { unique: false });
    createIndexSafe(cambios, "accion", "accion", { unique: false });
    createIndexSafe(cambios, "statusGoogle", "statusGoogle", { unique: false });
    createIndexSafe(cambios, "statusFirebase", "statusFirebase", { unique: false });
    createIndexSafe(cambios, "estadoSheets", "estadoSheets", { unique: false });
    createIndexSafe(cambios, "estadoFirebase", "estadoFirebase", { unique: false });
    createIndexSafe(cambios, "estadoSupabase", "estadoSupabase", { unique: false });
    createIndexSafe(cambios, "createdAt", "createdAt", { unique: false });
    createIndexSafe(cambios, "updatedAt", "updatedAt", { unique: false });

    var logs = upgradeStore(db, transaction, stores.logs || "logs", { keyPath: "id" });
    createIndexSafe(logs, "level", "level", { unique: false });
    createIndexSafe(logs, "scope", "scope", { unique: false });
    createIndexSafe(logs, "createdAt", "createdAt", { unique: false });

    var resumen = upgradeStore(db, transaction, stores.resumen || "resumen", { keyPath: "id" });
    createIndexSafe(resumen, "periodoId", "periodoId", { unique: false });
    createIndexSafe(resumen, "updatedAt", "updatedAt", { unique: false });

    var errores = upgradeStore(db, transaction, stores.errores || "errores", { keyPath: "id" });
    createIndexSafe(errores, "periodoId", "periodoId", { unique: false });
    createIndexSafe(errores, "level", "level", { unique: false });
    createIndexSafe(errores, "createdAt", "createdAt", { unique: false });

    var syncMeta = upgradeStore(db, transaction, stores.syncMeta || "sync_meta", { keyPath: "key" });
    createIndexSafe(syncMeta, "updatedAt", "updatedAt", { unique: false });

    var backups = upgradeStore(db, transaction, stores.backups || "backups", { keyPath: "id" });
    createIndexSafe(backups, "type", "type", { unique: false });
    createIndexSafe(backups, "periodoId", "periodoId", { unique: false });
    createIndexSafe(backups, "createdAt", "createdAt", { unique: false });

    ensureStoresV2(db, transaction);
  }

  function ensureStoresV2(db, transaction){
    var periodosCarreras = upgradeStore(db, transaction, stores.periodosCarreras || "periodos_carreras", { keyPath: "id" });
    createIndexSafe(periodosCarreras, "periodoId", "periodoId", { unique: false });
    createIndexSafe(periodosCarreras, "carrera", "carrera", { unique: false });
    createIndexSafe(periodosCarreras, "updatedAt", "updatedAt", { unique: false });

    var periodosDivisiones = upgradeStore(db, transaction, stores.periodosDivisiones || "periodos_divisiones", { keyPath: "id" });
    createIndexSafe(periodosDivisiones, "periodoId", "periodoId", { unique: false });
    createIndexSafe(periodosDivisiones, "division", "division", { unique: false });
    createIndexSafe(periodosDivisiones, "updatedAt", "updatedAt", { unique: false });

    var personas = upgradeStore(db, transaction, stores.personas || "personas", { keyPath: "cedula" });
    createIndexSafe(personas, "nombreCompleto", "nombreCompleto", { unique: false });
    createIndexSafe(personas, "correoPersonal", "correoPersonal", { unique: false });
    createIndexSafe(personas, "updatedAt", "updatedAt", { unique: false });

    var matriculas = upgradeStore(db, transaction, stores.matriculasPeriodo || "matriculas_periodo", { keyPath: "idEstudiantePeriodo" });
    createIndexSafe(matriculas, "periodoId", "periodoId", { unique: false });
    createIndexSafe(matriculas, "cedula", "cedula", { unique: false });
    createIndexSafe(matriculas, "periodo_cedula", ["periodoId", "cedula"], { unique: true });
    createIndexSafe(matriculas, "periodo_carrera", ["periodoId", "carrera"], { unique: false });
    createIndexSafe(matriculas, "periodo_division", ["periodoId", "division"], { unique: false });
    createIndexSafe(matriculas, "estadoMatricula", "estadoMatricula", { unique: false });
    createIndexSafe(matriculas, "updatedAt", "updatedAt", { unique: false });

    var requisitosEstudiante = upgradeStore(db, transaction, stores.requisitosEstudiante || "requisitos_estudiante", { keyPath: "id" });
    createIndexSafe(requisitosEstudiante, "idEstudiantePeriodo", "idEstudiantePeriodo", { unique: false });
    createIndexSafe(requisitosEstudiante, "periodoId", "periodoId", { unique: false });
    createIndexSafe(requisitosEstudiante, "cedula", "cedula", { unique: false });
    createIndexSafe(requisitosEstudiante, "requisitoKey", "requisitoKey", { unique: false });
    createIndexSafe(requisitosEstudiante, "estado", "estado", { unique: false });
    createIndexSafe(requisitosEstudiante, "updatedAt", "updatedAt", { unique: false });

    var notasTitulacion = upgradeStore(db, transaction, stores.notasTitulacion || "notas_titulacion", { keyPath: "idEstudiantePeriodo" });
    createIndexSafe(notasTitulacion, "periodoId", "periodoId", { unique: false });
    createIndexSafe(notasTitulacion, "cedula", "cedula", { unique: false });
    createIndexSafe(notasTitulacion, "estadoNota", "estadoNota", { unique: false });
    createIndexSafe(notasTitulacion, "updatedAt", "updatedAt", { unique: false });

    var contactosEstudiante = upgradeStore(db, transaction, stores.contactosEstudiante || "contactos_estudiante", { keyPath: "id" });
    createIndexSafe(contactosEstudiante, "idEstudiantePeriodo", "idEstudiantePeriodo", { unique: false });
    createIndexSafe(contactosEstudiante, "periodoId", "periodoId", { unique: false });
    createIndexSafe(contactosEstudiante, "cedula", "cedula", { unique: false });
    createIndexSafe(contactosEstudiante, "updatedAt", "updatedAt", { unique: false });

    var divisionesEstudiante = upgradeStore(db, transaction, stores.divisionesEstudiante || "divisiones_estudiante", { keyPath: "id" });
    createIndexSafe(divisionesEstudiante, "periodoId", "periodoId", { unique: false });
    createIndexSafe(divisionesEstudiante, "cedula", "cedula", { unique: false });
    createIndexSafe(divisionesEstudiante, "division", "division", { unique: false });
    createIndexSafe(divisionesEstudiante, "updatedAt", "updatedAt", { unique: false });

    var importaciones = upgradeStore(db, transaction, stores.importaciones || "importaciones", { keyPath: "id" });
    createIndexSafe(importaciones, "periodoId", "periodoId", { unique: false });
    createIndexSafe(importaciones, "tipo", "tipo", { unique: false });
    createIndexSafe(importaciones, "createdAt", "createdAt", { unique: false });

    var cambiosPendientes = upgradeStore(db, transaction, stores.cambiosPendientes || "cambios_pendientes", { keyPath: "id" });
    createIndexSafe(cambiosPendientes, "periodoId", "periodoId", { unique: false });
    createIndexSafe(cambiosPendientes, "cedula", "cedula", { unique: false });
    createIndexSafe(cambiosPendientes, "tabla", "tabla", { unique: false });
    createIndexSafe(cambiosPendientes, "estadoSheets", "estadoSheets", { unique: false });
    createIndexSafe(cambiosPendientes, "estadoFirebase", "estadoFirebase", { unique: false });
    createIndexSafe(cambiosPendientes, "estadoSupabase", "estadoSupabase", { unique: false });
    createIndexSafe(cambiosPendientes, "createdAt", "createdAt", { unique: false });

    var syncEstado = upgradeStore(db, transaction, stores.syncEstado || "sync_estado", { keyPath: "id" });
    createIndexSafe(syncEstado, "target", "target", { unique: false });
    createIndexSafe(syncEstado, "periodoId", "periodoId", { unique: false });
    createIndexSafe(syncEstado, "updatedAt", "updatedAt", { unique: false });

    var erroresValidacion = upgradeStore(db, transaction, stores.erroresValidacion || "errores_validacion", { keyPath: "id" });
    createIndexSafe(erroresValidacion, "periodoId", "periodoId", { unique: false });
    createIndexSafe(erroresValidacion, "cedula", "cedula", { unique: false });
    createIndexSafe(erroresValidacion, "nivel", "nivel", { unique: false });
    createIndexSafe(erroresValidacion, "createdAt", "createdAt", { unique: false });

    var cacheViews = upgradeStore(db, transaction, stores.cacheViews || "cache_views", { keyPath: "id" });
    createIndexSafe(cacheViews, "view", "view", { unique: false });
    createIndexSafe(cacheViews, "periodoId", "periodoId", { unique: false });
    createIndexSafe(cacheViews, "updatedAt", "updatedAt", { unique: false });
  }

  function open(){
    if(state.db){
      return Promise.resolve(state.db);
    }

    if(state.opening){
      return state.opening;
    }

    state.opening = new Promise(function(resolve, rejectFn){
      if(!window.indexedDB){
        rejectFn(new Error("IndexedDB no está disponible en este navegador."));
        return;
      }

      var request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function(event){
        var db = event.target.result;
        ensureStores(db, event.target.transaction);
      };

      request.onsuccess = function(event){
        state.db = event.target.result;

        state.db.onversionchange = function(){
          try{ state.db.close(); }catch(error){}
          state.db = null;
        };

        resolve(state.db);
      };

      request.onerror = function(){
        rejectFn(request.error || new Error("No se pudo abrir BL2."));
      };

      request.onblocked = function(){
        rejectFn(new Error("BL2 está bloqueada por otra pestaña o ventana. Cierre otras pestañas o ventanas de la app y vuelva a abrir."));
      };
    }).finally(function(){
      state.opening = null;
    });

    return state.opening;
  }

  function close(){
    if(state.db){
      try{ state.db.close(); }catch(error){}
      state.db = null;
    }
  }

  function tx(storeNames, mode){
    return open().then(function(db){
      var list = Array.isArray(storeNames) ? storeNames : [storeNames];
      return db.transaction(list, mode || "readonly");
    });
  }

  function store(name, mode){
    return tx(name, mode).then(function(transaction){
      return transaction.objectStore(name);
    });
  }

  function get(storeName, key){
    if(!text(storeName)){ return reject("Tabla no especificada."); }
    if(key === undefined || key === null || key === ""){ return Promise.resolve(null); }

    return store(storeName, "readonly").then(function(objectStore){
      return requestToPromise(objectStore.get(key)).then(function(result){
        return result == null ? null : clone(result);
      });
    });
  }

  function getAll(storeName){
    if(!text(storeName)){ return reject("Tabla no especificada."); }

    return store(storeName, "readonly").then(function(objectStore){
      if(typeof objectStore.getAll === "function"){
        return requestToPromise(objectStore.getAll()).then(function(result){
          return clone(result || []);
        });
      }

      return new Promise(function(resolve, rejectFn){
        var rows = [];
        var request = objectStore.openCursor();

        request.onsuccess = function(event){
          var cursor = event.target.result;
          if(cursor){
            rows.push(clone(cursor.value));
            cursor.continue();
          }else{
            resolve(rows);
          }
        };

        request.onerror = function(){
          rejectFn(request.error || new Error("No se pudo listar tabla."));
        };
      });
    });
  }

  function put(storeName, value){
    if(!text(storeName)){ return reject("Tabla no especificada."); }
    if(!value){ return reject("Registro vacío."); }

    var item = clone(value);

    return store(storeName, "readwrite").then(function(objectStore){
      return requestToPromise(objectStore.put(item)).then(function(){
        return clone(item);
      });
    });
  }

  function add(storeName, value){
    if(!text(storeName)){ return reject("Tabla no especificada."); }
    if(!value){ return reject("Registro vacío."); }

    var item = clone(value);

    return store(storeName, "readwrite").then(function(objectStore){
      return requestToPromise(objectStore.add(item)).then(function(){
        return clone(item);
      });
    });
  }

  function remove(storeName, key){
    if(!text(storeName)){ return reject("Tabla no especificada."); }
    if(key === undefined || key === null || key === ""){ return Promise.resolve(false); }

    return store(storeName, "readwrite").then(function(objectStore){
      return requestToPromise(objectStore.delete(key)).then(function(){
        return true;
      });
    });
  }

  function clear(storeName){
    if(!text(storeName)){ return reject("Tabla no especificada."); }

    return store(storeName, "readwrite").then(function(objectStore){
      return requestToPromise(objectStore.clear()).then(function(){
        return true;
      });
    });
  }

  function count(storeName){
    if(!text(storeName)){ return reject("Tabla no especificada."); }

    return store(storeName, "readonly").then(function(objectStore){
      return requestToPromise(objectStore.count());
    });
  }

  function bulkPut(storeName, rows){
    rows = Array.isArray(rows) ? rows : [];

    if(!rows.length){
      return Promise.resolve([]);
    }

    return open().then(function(db){
      return new Promise(function(resolve, rejectFn){
        var transaction = db.transaction([storeName], "readwrite");
        var objectStore = transaction.objectStore(storeName);
        var saved = [];

        transaction.oncomplete = function(){
          resolve(clone(saved));
        };

        transaction.onerror = function(){
          rejectFn(transaction.error || new Error("No se pudo guardar lote en " + storeName));
        };

        rows.forEach(function(row){
          var item = clone(row);
          saved.push(item);
          objectStore.put(item);
        });
      });
    });
  }

  function queryByIndex(storeName, indexName, value){
    if(!text(storeName)){ return reject("Tabla no especificada."); }
    if(!text(indexName)){ return reject("Índice no especificado."); }

    return store(storeName, "readonly").then(function(objectStore){
      return new Promise(function(resolve, rejectFn){
        if(!objectStore.indexNames.contains(indexName)){
          rejectFn(new Error("No existe el índice " + indexName + " en " + storeName));
          return;
        }

        var rows = [];
        var index = objectStore.index(indexName);
        var request = index.openCursor(IDBKeyRange.only(value));

        request.onsuccess = function(event){
          var cursor = event.target.result;
          if(cursor){
            rows.push(clone(cursor.value));
            cursor.continue();
          }else{
            resolve(rows);
          }
        };

        request.onerror = function(){
          rejectFn(request.error || new Error("Error consultando índice."));
        };
      });
    });
  }

  function queryByRange(storeName, indexName, range){
    if(!text(storeName)){ return reject("Tabla no especificada."); }
    if(!text(indexName)){ return reject("Índice no especificado."); }

    return store(storeName, "readonly").then(function(objectStore){
      return new Promise(function(resolve, rejectFn){
        if(!objectStore.indexNames.contains(indexName)){
          rejectFn(new Error("No existe el índice " + indexName + " en " + storeName));
          return;
        }

        var rows = [];
        var index = objectStore.index(indexName);
        var request = index.openCursor(range || null);

        request.onsuccess = function(event){
          var cursor = event.target.result;
          if(cursor){
            rows.push(clone(cursor.value));
            cursor.continue();
          }else{
            resolve(rows);
          }
        };

        request.onerror = function(){
          rejectFn(request.error || new Error("Error consultando rango."));
        };
      });
    });
  }

  function setSetting(key, value){
    key = text(key);
    if(!key){ return reject("Clave de configuración vacía."); }

    return put(stores.settings, {
      key: key,
      value: clone(value),
      updatedAt: nowISO()
    });
  }

  function getSetting(key, fallback){
    key = text(key);
    if(!key){ return Promise.resolve(fallback); }

    return get(stores.settings, key).then(function(row){
      return row ? clone(row.value) : fallback;
    });
  }

  function allStoreNames(){
    var seen = Object.create(null);
    return Object.keys(stores).map(function(k){ return stores[k]; }).filter(function(name){
      name = text(name);
      if(!name || seen[name]){ return false; }
      seen[name] = true;
      return true;
    });
  }

  function exportAll(){
    var names = allStoreNames();
    var result = {
      name: DB_NAME,
      version: DB_VERSION,
      exportedAt: nowISO(),
      tables: {}
    };

    var chain = Promise.resolve();

    names.forEach(function(name){
      chain = chain.then(function(){
        return getAll(name).then(function(rows){
          result.tables[name] = rows;
        }).catch(function(error){
          result.tables[name] = [];
          result.tables[name + "__error"] = error.message || String(error);
        });
      });
    });

    return chain.then(function(){
      return result;
    });
  }

  function importAll(payload, options){
    payload = payload || {};
    options = options || {};

    var tables = payload.tables || {};
    var names = Object.keys(tables);

    if(!names.length){
      return Promise.resolve({
        ok: false,
        message: "El respaldo no contiene tablas.",
        imported: 0
      });
    }

    var imported = 0;
    var chain = Promise.resolve();

    names.forEach(function(name){
      chain = chain.then(function(){
        var rows = Array.isArray(tables[name]) ? tables[name] : [];
        if(options.clearBeforeImport){
          return clear(name).then(function(){ return bulkPut(name, rows); }).then(function(saved){ imported += saved.length; });
        }
        return bulkPut(name, rows).then(function(saved){ imported += saved.length; });
      });
    });

    return chain.then(function(){
      return {
        ok: true,
        imported: imported,
        tables: names.length,
        importedAt: nowISO()
      };
    });
  }

  function resetAll(){
    var names = allStoreNames();
    var chain = Promise.resolve();

    names.forEach(function(name){
      chain = chain.then(function(){ return clear(name); });
    });

    return chain.then(function(){ return true; });
  }

  function deleteDatabase(){
    close();

    return new Promise(function(resolve, rejectFn){
      var request = window.indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = function(){ resolve(true); };
      request.onerror = function(){ rejectFn(request.error || new Error("No se pudo eliminar BL2.")); };
      request.onblocked = function(){ rejectFn(new Error("No se pudo eliminar BL2 porque está abierta.")); };
    });
  }

  function meta(){
    return {
      name: DB_NAME,
      version: DB_VERSION,
      stores: allStoreNames(),
      schemaVersion: config.schemaVersion || String(DB_VERSION)
    };
  }

  window.BL2DB = {
    open: open,
    close: close,
    meta: meta,

    get: get,
    getAll: getAll,
    put: put,
    add: add,
    remove: remove,
    clear: clear,
    count: count,
    bulkPut: bulkPut,

    queryByIndex: queryByIndex,
    queryByRange: queryByRange,

    getSetting: getSetting,
    setSetting: setSetting,

    exportAll: exportAll,
    importAll: importAll,
    resetAll: resetAll,
    deleteDatabase: deleteDatabase
  };
})(window);
