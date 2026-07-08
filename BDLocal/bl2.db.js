/* =========================================================
Archivo: bl2.db.js
Ruta: /BDLocal/bl2.db.js
Función:
- Crear y administrar IndexedDB de BL2.
- Manejar tablas principales actuales y tablas nuevas DB_VERSION 2.
- Crear stores e índices sin borrar datos existentes.
- Reparar apertura si la base quedó con stores V2 incompletos.
- Entregar funciones simples para leer, guardar, listar, contar y consultar.
========================================================= */
(function(window){
  "use strict";

  var config = window.BL2Config || {};
  var stores = config.stores || {};
  var utils = config.utils || {};

  var DB_NAME = config.dbName || "REQUISITOS_BL2";
  var BASE_VERSION = Math.max(Number(config.dbVersion || 2), 2);

  var state = {
    db: null,
    opening: null,
    version: BASE_VERSION
  };

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function nowISO(){
    return utils && typeof utils.nowISO === "function" ? utils.nowISO() : new Date().toISOString();
  }

  function clone(value){
    if(value === undefined){ return undefined; }
    try{ return JSON.parse(JSON.stringify(value)); }
    catch(error){ return value; }
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

  function hasIndexedDB(){
    return !!(window.indexedDB);
  }

  function storeName(key, fallback){
    return text(stores[key]) || text(fallback || key);
  }

  function unique(list){
    var map = Object.create(null);
    var out = [];

    (Array.isArray(list) ? list : []).forEach(function(item){
      item = text(item);
      if(item && !map[item]){
        map[item] = true;
        out.push(item);
      }
    });

    return out;
  }

  function createIndexSafe(store, name, keyPath, options){
    try{
      if(store && name && !store.indexNames.contains(name)){
        store.createIndex(name, keyPath, options || {});
      }
    }catch(error){
      try{ console.warn("[BL2DB] No se pudo crear índice:", name, error); }catch(innerError){}
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
      try{ console.warn("[BL2DB] No se pudo preparar store:", name, error); }catch(innerError){}
      return null;
    }
  }

  function storeDefinitions(){
    return [
      {
        name: storeName("settings", "settings"),
        options: { keyPath: "key" },
        indexes: [
          ["updatedAt", "updatedAt"]
        ]
      },
      {
        name: storeName("periodos", "periodos"),
        options: { keyPath: "id" },
        indexes: [
          ["periodoId", "periodoId"],
          ["label", "label"],
          ["nombre", "nombre"],
          ["updatedAt", "updatedAt"]
        ]
      },
      {
        name: storeName("estudiantes", "estudiantes"),
        options: { keyPath: "id" },
        indexes: [
          ["cedula", "cedula"],
          ["numeroIdentificacion", "numeroIdentificacion"],
          ["periodoId", "periodoId"],
          ["periodId", "periodId"],
          ["periodo_cedula", ["periodoId", "cedula"]],
          ["estadoMatricula", "estadoMatricula"],
          ["division", "division"],
          ["carrera", "NombreCarrera"],
          ["updatedAt", "updatedAt"]
        ]
      },
      {
        name: storeName("requisitos", "requisitos"),
        options: { keyPath: "id" },
        indexes: [
          ["periodoId", "periodoId"],
          ["cedula", "cedula"],
          ["periodo_cedula", ["periodoId", "cedula"]],
          ["requisitoKey", "requisitoKey"],
          ["estado", "estado"],
          ["updatedAt", "updatedAt"]
        ]
      },
      {
        name: storeName("contactos", "contactos"),
        options: { keyPath: "id" },
        indexes: [
          ["periodoId", "periodoId"],
          ["cedula", "cedula"],
          ["periodo_cedula", ["periodoId", "cedula"]],
          ["updatedAt", "updatedAt"]
        ]
      },
      {
        name: storeName("notas", "notas"),
        options: { keyPath: "id" },
        indexes: [
          ["periodoId", "periodoId"],
          ["cedula", "cedula"],
          ["periodo_cedula", ["periodoId", "cedula"]],
          ["updatedAt", "updatedAt"]
        ]
      },
      {
        name: storeName("cambios", "cambios"),
        options: { keyPath: "id" },
        indexes: [
          ["status", "status"],
          ["target", "target"],
          ["periodoId", "periodoId"],
          ["cedula", "cedula"],
          ["createdAt", "createdAt"],
          ["updatedAt", "updatedAt"]
        ]
      },
      {
        name: storeName("logs", "logs"),
        options: { keyPath: "id" },
        indexes: [
          ["scope", "scope"],
          ["level", "level"],
          ["createdAt", "createdAt"],
          ["updatedAt", "updatedAt"]
        ]
      },
      {
        name: storeName("backups", "backups"),
        options: { keyPath: "id" },
        indexes: [
          ["periodoId", "periodoId"],
          ["type", "type"],
          ["createdAt", "createdAt"],
          ["updatedAt", "updatedAt"]
        ]
      },
      {
        name: storeName("periodosCarreras", "periodos_carreras"),
        options: { keyPath: "id" },
        indexes: [
          ["periodoId", "periodoId"],
          ["carreraKey", "carreraKey"],
          ["updatedAt", "updatedAt"]
        ]
      },
      {
        name: storeName("periodosDivisiones", "periodos_divisiones"),
        options: { keyPath: "id" },
        indexes: [
          ["periodoId", "periodoId"],
          ["divisionKey", "divisionKey"],
          ["updatedAt", "updatedAt"]
        ]
      },
      {
        name: storeName("personas", "personas"),
        options: { keyPath: "cedula" },
        indexes: [
          ["nombreKey", "nombreKey"],
          ["nombreCompleto", "nombreCompleto"],
          ["updatedAt", "updatedAt"]
        ]
      },
      {
        name: storeName("matriculasPeriodo", "matriculas_periodo"),
        options: { keyPath: "idEstudiantePeriodo" },
        indexes: [
          ["periodoId", "periodoId"],
          ["cedula", "cedula"],
          ["periodo_cedula", ["periodoId", "cedula"]],
          ["estadoMatricula", "estadoMatricula"],
          ["carreraKey", "carreraKey"],
          ["divisionKey", "divisionKey"],
          ["carrera", "carrera"],
          ["division", "division"],
          ["updatedAt", "updatedAt"]
        ]
      },
      {
        name: storeName("requisitosEstudiante", "requisitos_estudiante"),
        options: { keyPath: "id" },
        indexes: [
          ["idEstudiantePeriodo", "idEstudiantePeriodo"],
          ["periodoId", "periodoId"],
          ["cedula", "cedula"],
          ["periodo_cedula", ["periodoId", "cedula"]],
          ["requisitoKey", "requisitoKey"],
          ["estadoKey", "estadoKey"],
          ["estado", "estado"],
          ["updatedAt", "updatedAt"]
        ]
      },
      {
        name: storeName("notasTitulacion", "notas_titulacion"),
        options: { keyPath: "idEstudiantePeriodo" },
        indexes: [
          ["periodoId", "periodoId"],
          ["cedula", "cedula"],
          ["periodo_cedula", ["periodoId", "cedula"]],
          ["estadoDefensaKey", "estadoDefensaKey"],
          ["updatedAt", "updatedAt"]
        ]
      },
      {
        name: storeName("contactosEstudiante", "contactos_estudiante"),
        options: { keyPath: "id" },
        indexes: [
          ["idEstudiantePeriodo", "idEstudiantePeriodo"],
          ["periodoId", "periodoId"],
          ["cedula", "cedula"],
          ["periodo_cedula", ["periodoId", "cedula"]],
          ["tipoKey", "tipoKey"],
          ["updatedAt", "updatedAt"]
        ]
      },
      {
        name: storeName("divisionesEstudiante", "divisiones_estudiante"),
        options: { keyPath: "id" },
        indexes: [
          ["idEstudiantePeriodo", "idEstudiantePeriodo"],
          ["periodoId", "periodoId"],
          ["cedula", "cedula"],
          ["periodo_cedula", ["periodoId", "cedula"]],
          ["divisionKey", "divisionKey"],
          ["updatedAt", "updatedAt"]
        ]
      },
      {
        name: storeName("importaciones", "importaciones"),
        options: { keyPath: "id" },
        indexes: [
          ["periodoId", "periodoId"],
          ["source", "source"],
          ["createdAt", "createdAt"],
          ["updatedAt", "updatedAt"]
        ]
      },
      {
        name: storeName("cambiosPendientes", "cambios_pendientes"),
        options: { keyPath: "id" },
        indexes: [
          ["status", "status"],
          ["target", "target"],
          ["status_target", ["status", "target"]],
          ["periodoId", "periodoId"],
          ["cedula", "cedula"],
          ["tabla", "tabla"],
          ["createdAt", "createdAt"],
          ["updatedAt", "updatedAt"]
        ]
      },
      {
        name: storeName("syncEstado", "sync_estado"),
        options: { keyPath: "id" },
        indexes: [
          ["target", "target"],
          ["periodoId", "periodoId"],
          ["target_periodo", ["target", "periodoId"]],
          ["updatedAt", "updatedAt"]
        ]
      },
      {
        name: storeName("erroresValidacion", "errores_validacion"),
        options: { keyPath: "id" },
        indexes: [
          ["periodoId", "periodoId"],
          ["cedula", "cedula"],
          ["tipo", "tipo"],
          ["createdAt", "createdAt"],
          ["updatedAt", "updatedAt"]
        ]
      },
      {
        name: storeName("cacheViews", "cache_views"),
        options: { keyPath: "id" },
        indexes: [
          ["viewKey", "viewKey"],
          ["periodoId", "periodoId"],
          ["updatedAt", "updatedAt"]
        ]
      }
    ];
  }

  function ensureStores(db, transaction){
    storeDefinitions().forEach(function(def){
      var objectStore = upgradeStore(db, transaction, def.name, def.options);
      (def.indexes || []).forEach(function(indexDef){
        createIndexSafe(objectStore, indexDef[0], indexDef[1], indexDef[2] || { unique: false });
      });
    });
  }

  function requiredStoreNames(){
    var fromConfig = config.dbV2 && Array.isArray(config.dbV2.requiredStores) ? config.dbV2.requiredStores : [];
    var fallback = [
      storeName("personas", "personas"),
      storeName("matriculasPeriodo", "matriculas_periodo"),
      storeName("requisitosEstudiante", "requisitos_estudiante"),
      storeName("notasTitulacion", "notas_titulacion"),
      storeName("contactosEstudiante", "contactos_estudiante"),
      storeName("divisionesEstudiante", "divisiones_estudiante"),
      storeName("cambiosPendientes", "cambios_pendientes"),
      storeName("syncEstado", "sync_estado"),
      storeName("cacheViews", "cache_views")
    ];

    return unique(fromConfig.length ? fromConfig : fallback);
  }

  function objectStoreNames(db){
    if(!db){ return []; }
    return Array.prototype.slice.call(db.objectStoreNames || []);
  }

  function missingRequiredStores(db){
    var existing = Object.create(null);
    objectStoreNames(db).forEach(function(name){ existing[name] = true; });

    return requiredStoreNames().filter(function(name){
      return !existing[name];
    });
  }

  function openWithVersion(version){
    if(!hasIndexedDB()){
      return reject("IndexedDB no está disponible en este entorno.");
    }

    return new Promise(function(resolve, rejectFn){
      var request;

      try{
        request = version ? window.indexedDB.open(DB_NAME, version) : window.indexedDB.open(DB_NAME);
      }catch(error){
        rejectFn(error);
        return;
      }

      request.onupgradeneeded = function(event){
        var db = event.target.result;
        ensureStores(db, event.target.transaction);
      };

      request.onsuccess = function(event){
        var db = event.target.result;

        db.onversionchange = function(){
          try{ db.close(); }catch(error){}
          if(state.db === db){ state.db = null; }
        };

        resolve(db);
      };

      request.onerror = function(){
        rejectFn(request.error || new Error("No se pudo abrir BL2."));
      };

      request.onblocked = function(){
        rejectFn(new Error("BL2 está bloqueada por otra pestaña o ventana. Cierre otras pestañas o ventanas de la app y vuelva a abrir."));
      };
    });
  }

  function open(options){
    options = options || {};

    if(state.db && !options.force){
      return Promise.resolve(state.db);
    }

    if(state.opening && !options.force){
      return state.opening;
    }

    var firstOpen = openWithVersion(state.version).catch(function(error){
      if(error && error.name === "VersionError"){
        return openWithVersion(null);
      }
      throw error;
    });

    state.opening = firstOpen.then(function(db){
      var missing = missingRequiredStores(db);

      if(missing.length && !options.skipRepair){
        var nextVersion = Math.max(Number(db.version || state.version) + 1, state.version + 1);

        try{ db.close(); }catch(error){}
        if(state.db === db){ state.db = null; }

        state.version = nextVersion;

        return openWithVersion(nextVersion).then(function(repairedDb){
          state.db = repairedDb;
          return repairedDb;
        });
      }

      state.version = Math.max(Number(db.version || state.version), state.version);
      state.db = db;
      return db;
    }).then(function(db){
      state.opening = null;
      return db;
    }).catch(function(error){
      state.opening = null;
      throw error;
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
      list = list.map(text).filter(Boolean);

      if(!list.length){
        throw new Error("No hay tablas para abrir transacción.");
      }

      list.forEach(function(name){
        if(!db.objectStoreNames.contains(name)){
          throw new Error("No existe la tabla " + name + ". Ejecute diagnóstico/migración de BDLocal.");
        }
      });

      return db.transaction(list, mode || "readonly");
    });
  }

  function store(name, mode){
    name = text(name);
    if(!name){ return reject("Tabla no especificada."); }

    return tx(name, mode).then(function(transaction){
      return transaction.objectStore(name);
    });
  }

  function get(storeNameValue, key){
    storeNameValue = text(storeNameValue);
    if(!storeNameValue){ return reject("Tabla no especificada."); }
    if(key === undefined || key === null || key === ""){ return Promise.resolve(null); }

    return store(storeNameValue, "readonly").then(function(objectStore){
      return requestToPromise(objectStore.get(key)).then(function(result){
        return result == null ? null : clone(result);
      });
    });
  }

  function getAll(storeNameValue){
    storeNameValue = text(storeNameValue);
    if(!storeNameValue){ return reject("Tabla no especificada."); }

    return store(storeNameValue, "readonly").then(function(objectStore){
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
          rejectFn(request.error || new Error("Error leyendo " + storeNameValue));
        };
      });
    });
  }

  function put(storeNameValue, row){
    storeNameValue = text(storeNameValue);
    if(!storeNameValue){ return reject("Tabla no especificada."); }

    row = clone(row || {});
    if(row && typeof row === "object" && !row.updatedAt){
      row.updatedAt = nowISO();
    }

    return store(storeNameValue, "readwrite").then(function(objectStore){
      return requestToPromise(objectStore.put(row)).then(function(){
        return clone(row);
      });
    });
  }

  function add(storeNameValue, row){
    storeNameValue = text(storeNameValue);
    if(!storeNameValue){ return reject("Tabla no especificada."); }

    row = clone(row || {});
    if(row && typeof row === "object" && !row.createdAt){
      row.createdAt = nowISO();
    }
    if(row && typeof row === "object" && !row.updatedAt){
      row.updatedAt = row.createdAt || nowISO();
    }

    return store(storeNameValue, "readwrite").then(function(objectStore){
      return requestToPromise(objectStore.add(row)).then(function(){
        return clone(row);
      });
    });
  }

  function remove(storeNameValue, key){
    storeNameValue = text(storeNameValue);
    if(!storeNameValue){ return reject("Tabla no especificada."); }
    if(key === undefined || key === null || key === ""){ return Promise.resolve(false); }

    return store(storeNameValue, "readwrite").then(function(objectStore){
      return requestToPromise(objectStore.delete(key)).then(function(){
        return true;
      });
    });
  }

  function clear(storeNameValue){
    storeNameValue = text(storeNameValue);
    if(!storeNameValue){ return reject("Tabla no especificada."); }

    return store(storeNameValue, "readwrite").then(function(objectStore){
      return requestToPromise(objectStore.clear()).then(function(){
        return true;
      });
    });
  }

  function count(storeNameValue){
    storeNameValue = text(storeNameValue);
    if(!storeNameValue){ return reject("Tabla no especificada."); }

    return store(storeNameValue, "readonly").then(function(objectStore){
      return requestToPromise(objectStore.count()).then(function(result){
        return Number(result || 0);
      });
    });
  }

  function bulkPut(storeNameValue, rows){
    storeNameValue = text(storeNameValue);
    rows = Array.isArray(rows) ? rows : [];

    if(!storeNameValue){ return reject("Tabla no especificada."); }
    if(!rows.length){ return Promise.resolve([]); }

    return open().then(function(db){
      return new Promise(function(resolve, rejectFn){
        if(!db.objectStoreNames.contains(storeNameValue)){
          rejectFn(new Error("No existe la tabla " + storeNameValue + "."));
          return;
        }

        var transaction = db.transaction([storeNameValue], "readwrite");
        var objectStore = transaction.objectStore(storeNameValue);
        var saved = [];
        var now = nowISO();

        transaction.oncomplete = function(){
          resolve(clone(saved));
        };

        transaction.onerror = function(){
          rejectFn(transaction.error || new Error("No se pudo guardar lote en " + storeNameValue));
        };

        rows.forEach(function(row){
          var item = clone(row || {});
          if(item && typeof item === "object" && !item.updatedAt){
            item.updatedAt = now;
          }
          saved.push(item);
          objectStore.put(item);
        });
      });
    });
  }

  function queryByIndex(storeNameValue, indexName, value){
    storeNameValue = text(storeNameValue);
    indexName = text(indexName);

    if(!storeNameValue){ return reject("Tabla no especificada."); }
    if(!indexName){ return reject("Índice no especificado."); }

    return store(storeNameValue, "readonly").then(function(objectStore){
      return new Promise(function(resolve, rejectFn){
        if(!objectStore.indexNames.contains(indexName)){
          rejectFn(new Error("No existe el índice " + indexName + " en " + storeNameValue));
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

  function queryByRange(storeNameValue, indexName, range){
    storeNameValue = text(storeNameValue);
    indexName = text(indexName);

    if(!storeNameValue){ return reject("Tabla no especificada."); }
    if(!indexName){ return reject("Índice no especificado."); }

    return store(storeNameValue, "readonly").then(function(objectStore){
      return new Promise(function(resolve, rejectFn){
        if(!objectStore.indexNames.contains(indexName)){
          rejectFn(new Error("No existe el índice " + indexName + " en " + storeNameValue));
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

    return put(storeName("settings", "settings"), {
      key: key,
      value: clone(value),
      updatedAt: nowISO()
    });
  }

  function getSetting(key, fallback){
    key = text(key);
    if(!key){ return Promise.resolve(fallback); }

    return get(storeName("settings", "settings"), key).then(function(row){
      return row ? clone(row.value) : fallback;
    }).catch(function(){
      return fallback;
    });
  }

  function allStoreNames(){
    return unique(storeDefinitions().map(function(def){ return def.name; }).concat(Object.keys(stores).map(function(key){
      return stores[key];
    })));
  }

  function exportAll(){
    var names = allStoreNames();
    var result = {
      name: DB_NAME,
      version: state.version,
      schemaVersion: config.schemaVersion || String(state.version),
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
          result.tables[name + "__error"] = error && error.message ? error.message : String(error);
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
    var names = allStoreNames();
    var chain = Promise.resolve();

    names.forEach(function(name){
      chain = chain.then(function(){
        return clear(name).catch(function(){ return true; });
      });
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
    var db = state.db || null;
    var names = db ? objectStoreNames(db) : allStoreNames();

    return {
      name: DB_NAME,
      version: db ? db.version : state.version,
      configuredVersion: BASE_VERSION,
      open: !!db,
      stores: names,
      requiredStores: requiredStoreNames(),
      missingStores: db ? missingRequiredStores(db) : [],
      schemaVersion: config.schemaVersion || String(BASE_VERSION)
    };
  }

  window.BL2DB = {
    version: "2.1.0-safe-indexeddb",
    open: open,
    close: close,
    tx: tx,
    transaction: tx,
    meta: meta,

    get: get,
    getAll: getAll,
    put: put,
    add: add,
    remove: remove,
    delete: remove,
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

  try{
    window.dispatchEvent(new CustomEvent("bdlocal:db-ready", {
      detail: {
        ok: true,
        name: DB_NAME,
        version: BASE_VERSION
      }
    }));
  }catch(error){}
})(window);