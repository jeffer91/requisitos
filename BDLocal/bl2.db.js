/* =========================================================
Archivo: bl2.db.js
Ruta: /BDLocal/bl2.db.js
Función:
- Crear y administrar IndexedDB de BL2.
- Manejar tablas principales: periodos, estudiantes, requisitos,
  contactos, notas, cambios, logs, resumen, errores, sync_meta y backups.
- Entregar funciones simples para leer, guardar, listar, contar y consultar.
========================================================= */
(function(window){
  "use strict";

  var config = window.BL2Config || {};
  var stores = config.stores || {};
  var utils = config.utils || {};

  var DB_NAME = config.dbName || "REQUISITOS_BL2";
  var DB_VERSION = config.dbVersion || 1;

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
      if(!store.indexNames.contains(name)){
        store.createIndex(name, keyPath, options || {});
      }
    }catch(error){
      console.warn("[BL2DB] No se pudo crear índice:", name, error);
    }
  }

  function createStoreSafe(db, name, options){
    if(db.objectStoreNames.contains(name)){
      return null;
    }
    return db.createObjectStore(name, options || { keyPath: "id" });
  }

  function ensureStores(db){
    var settings = createStoreSafe(db, stores.settings || "settings", { keyPath: "key" });
    if(settings){
      createIndexSafe(settings, "updatedAt", "updatedAt", { unique: false });
    }

    var periodos = createStoreSafe(db, stores.periodos || "periodos", { keyPath: "id" });
    if(periodos){
      createIndexSafe(periodos, "label", "label", { unique: false });
      createIndexSafe(periodos, "updatedAt", "updatedAt", { unique: false });
    }

    var estudiantes = createStoreSafe(db, stores.estudiantes || "estudiantes", { keyPath: "id" });
    if(estudiantes){
      createIndexSafe(estudiantes, "cedula", "cedula", { unique: false });
      createIndexSafe(estudiantes, "periodoId", "periodoId", { unique: false });
      createIndexSafe(estudiantes, "periodo_cedula", ["periodoId", "cedula"], { unique: true });
      createIndexSafe(estudiantes, "periodo_carrera", ["periodoId", "NombreCarrera"], { unique: false });
      createIndexSafe(estudiantes, "periodo_division", ["periodoId", "division"], { unique: false });
      createIndexSafe(estudiantes, "estadoMatricula", "estadoMatricula", { unique: false });
      createIndexSafe(estudiantes, "updatedAt", "updatedAt", { unique: false });
    }

    var requisitos = createStoreSafe(db, stores.requisitos || "requisitos", { keyPath: "id" });
    if(requisitos){
      createIndexSafe(requisitos, "studentId", "studentId", { unique: false });
      createIndexSafe(requisitos, "periodoId", "periodoId", { unique: false });
      createIndexSafe(requisitos, "cedula", "cedula", { unique: false });
      createIndexSafe(requisitos, "nombre", "nombre", { unique: false });
      createIndexSafe(requisitos, "valor", "valor", { unique: false });
      createIndexSafe(requisitos, "periodo_nombre", ["periodoId", "nombre"], { unique: false });
      createIndexSafe(requisitos, "updatedAt", "updatedAt", { unique: false });
    }

    var contactos = createStoreSafe(db, stores.contactos || "contactos", { keyPath: "id" });
    if(contactos){
      createIndexSafe(contactos, "studentId", "studentId", { unique: false });
      createIndexSafe(contactos, "periodoId", "periodoId", { unique: false });
      createIndexSafe(contactos, "cedula", "cedula", { unique: false });
      createIndexSafe(contactos, "updatedAt", "updatedAt", { unique: false });
    }

    var notas = createStoreSafe(db, stores.notas || "notas", { keyPath: "id" });
    if(notas){
      createIndexSafe(notas, "studentId", "studentId", { unique: false });
      createIndexSafe(notas, "periodoId", "periodoId", { unique: false });
      createIndexSafe(notas, "cedula", "cedula", { unique: false });
      createIndexSafe(notas, "updatedAt", "updatedAt", { unique: false });
    }

    var cambios = createStoreSafe(db, stores.cambios || "cambios", { keyPath: "id" });
    if(cambios){
      createIndexSafe(cambios, "periodoId", "periodoId", { unique: false });
      createIndexSafe(cambios, "cedula", "cedula", { unique: false });
      createIndexSafe(cambios, "tipo", "tipo", { unique: false });
      createIndexSafe(cambios, "statusGoogle", "statusGoogle", { unique: false });
      createIndexSafe(cambios, "statusFirebase", "statusFirebase", { unique: false });
      createIndexSafe(cambios, "createdAt", "createdAt", { unique: false });
    }

    var logs = createStoreSafe(db, stores.logs || "logs", { keyPath: "id" });
    if(logs){
      createIndexSafe(logs, "level", "level", { unique: false });
      createIndexSafe(logs, "createdAt", "createdAt", { unique: false });
    }

    var resumen = createStoreSafe(db, stores.resumen || "resumen", { keyPath: "id" });
    if(resumen){
      createIndexSafe(resumen, "periodoId", "periodoId", { unique: false });
      createIndexSafe(resumen, "updatedAt", "updatedAt", { unique: false });
    }

    var errores = createStoreSafe(db, stores.errores || "errores", { keyPath: "id" });
    if(errores){
      createIndexSafe(errores, "periodoId", "periodoId", { unique: false });
      createIndexSafe(errores, "level", "level", { unique: false });
      createIndexSafe(errores, "createdAt", "createdAt", { unique: false });
    }

    var syncMeta = createStoreSafe(db, stores.syncMeta || "sync_meta", { keyPath: "key" });
    if(syncMeta){
      createIndexSafe(syncMeta, "updatedAt", "updatedAt", { unique: false });
    }

    var backups = createStoreSafe(db, stores.backups || "backups", { keyPath: "id" });
    if(backups){
      createIndexSafe(backups, "type", "type", { unique: false });
      createIndexSafe(backups, "periodoId", "periodoId", { unique: false });
      createIndexSafe(backups, "createdAt", "createdAt", { unique: false });
    }
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
        ensureStores(db);
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
        rejectFn(new Error("BL2 está bloqueada por otra pestaña o ventana."));
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

  function exportAll(){
    var names = Object.keys(stores).map(function(k){ return stores[k]; }).filter(Boolean);

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
          return clear(name).then(function(){
            return bulkPut(name, rows);
          }).then(function(saved){
            imported += saved.length;
          });
        }

        return bulkPut(name, rows).then(function(saved){
          imported += saved.length;
        });
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
    var names = Object.keys(stores).map(function(k){ return stores[k]; }).filter(Boolean);
    var chain = Promise.resolve();

    names.forEach(function(name){
      chain = chain.then(function(){
        return clear(name);
      });
    });

    return chain.then(function(){
      return true;
    });
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

  window.BL2DB = {
    open: open,
    close: close,

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