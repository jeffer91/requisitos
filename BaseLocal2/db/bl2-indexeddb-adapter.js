/* =========================================================
Nombre completo: bl2-indexeddb-adapter.js
Ruta o ubicación: /Requisitos/BaseLocal2/db/bl2-indexeddb-adapter.js
Función o funciones:
- Crear y abrir IndexedDB para Base Local 2.0 en navegador/Live Server.
- Guardar datos por lotes controlados para no congelar la pantalla.
- Consultar estudiantes por período, cédula, filtros y paginación.
- Evitar lecturas completas innecesarias de Firebase o localStorage.
Con qué se conecta:
- bl2-schema.js
- bl2-migrations.js
- bl2-storage.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-db-fast.1";
  var DEFAULT_PAGE_LIMIT = 100;
  var DEFAULT_BULK_CHUNK = 500;
  var state = {db:null, opening:null, ready:false, lastError:"", openedAt:""};

  function schema(){if(!window.BL2Schema){throw new Error("BL2Schema no disponible.");}return window.BL2Schema;}
  function migrations(){if(!window.BL2Migrations){throw new Error("BL2Migrations no disponible.");}return window.BL2Migrations;}
  function now(){return new Date().toISOString();}
  function available(){return !!window.indexedDB;}
  function text(value){return schema().helpers.text(value);}
  function sleep(ms){return new Promise(function(resolve){setTimeout(resolve, ms || 0);});}

  function open(){
    if(!available()){return Promise.reject(new Error("IndexedDB no está disponible."));}
    if(state.db){return Promise.resolve(state.db);}
    if(state.opening){return state.opening;}

    state.opening = new Promise(function(resolve, reject){
      try{
        var s = schema();
        var request = window.indexedDB.open(s.dbName, s.version);

        request.onupgradeneeded = function(event){migrations().applyIndexedDBUpgrade(event);};

        request.onsuccess = function(event){
          state.db = event.target.result;
          state.ready = true;
          state.openedAt = now();
          state.lastError = "";
          state.opening = null;
          state.db.onversionchange = function(){
            try{state.db.close();}catch(error){}
            state.db = null;
            state.ready = false;
            state.opening = null;
          };
          resolve(state.db);
        };

        request.onerror = function(){
          state.lastError = request.error && request.error.message ? request.error.message : "No se pudo abrir IndexedDB.";
          state.opening = null;
          reject(request.error || new Error(state.lastError));
        };

        request.onblocked = function(){console.warn("[BL2IndexedDB] Apertura bloqueada por otra pestaña.");};
      }catch(error){
        state.opening = null;
        state.lastError = error && error.message ? error.message : String(error);
        reject(error);
      }
    });

    return state.opening;
  }

  function requestToPromise(request){
    return new Promise(function(resolve, reject){
      request.onsuccess = function(){resolve(request.result);};
      request.onerror = function(){reject(request.error || new Error("Operación IndexedDB fallida."));};
    });
  }

  function transaction(storeNames, mode){
    return open().then(function(db){
      var names = Array.isArray(storeNames) ? storeNames : [storeNames];
      return db.transaction(names, mode || "readonly");
    });
  }

  function txStore(storeName, mode){return transaction(storeName, mode).then(function(tx){return tx.objectStore(storeName);});}

  function put(storeName, value){return txStore(storeName, "readwrite").then(function(store){return requestToPromise(store.put(value));});}
  function remove(storeName, value){return txStore(storeName, "readwrite").then(function(store){return requestToPromise(store.delete(value));});}
  function get(storeName, value){return txStore(storeName, "readonly").then(function(store){return requestToPromise(store.get(value));});}
  function count(storeName){return txStore(storeName, "readonly").then(function(store){return requestToPromise(store.count());});}
  function clear(storeName){return txStore(storeName, "readwrite").then(function(store){return requestToPromise(store.clear());});}

  function keyRange(value){return value == null || value === "" ? null : window.IDBKeyRange.only(value);}

  function cursorCollect(storeName, indexName, range, options){
    options = options || {};
    var limit = Math.max(0, Number(options.limit == null ? DEFAULT_PAGE_LIMIT : options.limit) || 0);
    var offset = Math.max(0, Number(options.offset || 0) || 0);
    var filter = typeof options.filter === "function" ? options.filter : null;

    return open().then(function(db){
      return new Promise(function(resolve, reject){
        try{
          var tx = db.transaction(storeName, "readonly");
          var store = tx.objectStore(storeName);
          var source = indexName ? store.index(indexName) : store;
          var rows = [];
          var total = 0;
          var skipped = 0;
          var request = source.openCursor(range || null);

          request.onsuccess = function(event){
            var cursor = event.target.result;
            if(!cursor){resolve({rows:rows, total:total, offset:offset, limit:limit, source:"indexeddb"});return;}
            var row = cursor.value;
            if(!filter || filter(row)){
              total += 1;
              if(skipped < offset){skipped += 1;}
              else if(!limit || rows.length < limit){rows.push(row);}
            }
            cursor.continue();
          };

          request.onerror = function(){reject(request.error || new Error("No se pudo leer cursor IndexedDB."));};
          tx.onerror = function(){reject(tx.error || new Error("Transacción IndexedDB fallida."));};
        }catch(error){reject(error);}
      });
    });
  }

  function getAll(storeName, options){
    options = options || {};
    var limit = Math.max(0, Number(options.limit || 0) || 0);
    var offset = Math.max(0, Number(options.offset || 0) || 0);
    if(!limit && !offset){return txStore(storeName, "readonly").then(function(store){return requestToPromise(store.getAll());});}
    return cursorCollect(storeName, null, null, {limit:limit, offset:offset}).then(function(result){return result.rows;});
  }

  function getByIndex(storeName, indexName, value){return txStore(storeName, "readonly").then(function(store){return requestToPromise(store.index(indexName).get(value));});}
  function getAllByIndex(storeName, indexName, value, options){return cursorCollect(storeName, indexName, keyRange(value), options || {}).then(function(result){return result.rows;});}

  function putMany(storeName, rows, options){
    options = options || {};
    rows = Array.isArray(rows) ? rows : [];
    var chunkSize = Math.max(50, Number(options.chunkSize || DEFAULT_BULK_CHUNK) || DEFAULT_BULK_CHUNK);
    var total = rows.length;
    var saved = 0;

    function saveChunk(start){
      var chunk = rows.slice(start, start + chunkSize);
      if(!chunk.length){return Promise.resolve({ok:true, store:storeName, count:saved, total:total});}

      return open().then(function(db){
        return new Promise(function(resolve, reject){
          try{
            var storeNames = storeName === "metadata" ? [storeName] : [storeName, "metadata"];
            var tx = db.transaction(storeNames, "readwrite");
            var store = tx.objectStore(storeName);
            var metaStore = storeNames.indexOf("metadata") >= 0 ? tx.objectStore("metadata") : null;

            chunk.forEach(function(row){store.put(row);saved += 1;});

            if(metaStore && options.touchMetadata !== false){metaStore.put({key:"lastWrite:" + storeName, store:storeName, count:saved, total:total, updatedAt:now()});}

            tx.oncomplete = function(){resolve({ok:true, count:saved});};
            tx.onerror = function(){reject(tx.error || new Error("No se pudo guardar lote en " + storeName));};
            tx.onabort = function(){reject(tx.error || new Error("Lote abortado en " + storeName));};
          }catch(error){reject(error);}
        });
      }).then(function(){
        if(typeof options.onProgress === "function"){
          try{options.onProgress({store:storeName, saved:saved, total:total});}catch(error){}
        }
        return sleep(options.pauseMs == null ? 0 : options.pauseMs).then(function(){return saveChunk(start + chunkSize);});
      });
    }

    return saveChunk(0);
  }

  function normalizeRows(rows, normalizer){return (Array.isArray(rows) ? rows : []).map(function(row){return normalizer(row);});}

  function bulkFromSnapshot(snapshot, options){
    options = options || {};
    var s = schema();
    snapshot = snapshot || {};
    var periods = normalizeRows(snapshot.periods, s.helpers.normalizePeriod);
    var students = normalizeRows(snapshot.students, s.helpers.normalizeStudent);

    return open().then(function(){
      return putMany(s.stores.periodos.name, periods, options)
        .then(function(){return putMany(s.stores.estudiantes.name, students, options);})
        .then(function(){return put(s.stores.metadata.name, {key:"lastSnapshotImport", periods:periods.length, students:students.length, updatedAt:now(), source:options.source || "snapshot"});})
        .then(function(){return {ok:true, periods:periods.length, students:students.length, mode:"indexeddb"};});
    });
  }

  function filterStudentFactory(options){
    options = options || {};
    var s = schema();
    var search = s.helpers.searchKey(options.search || options.q || "");
    var career = s.helpers.key(options.career || options.carrera || "");
    var status = text(options.status || options.estadoMatricula || options.matricula || "").toUpperCase();
    var sede = s.helpers.key(options.sede || "");
    var jornada = s.helpers.key(options.jornada || "");
    var cumple = options.cumpleGeneral;

    return function(row){
      row = row || {};
      if(career && row.nombreCarreraKey !== career){return false;}
      if(status && status !== "TODOS" && status !== "ALL" && text(row.estadoMatricula).toUpperCase() !== status){return false;}
      if(sede && row.sedeKey !== sede){return false;}
      if(jornada && row.jornadaKey !== jornada){return false;}
      if(cumple === true && row.cumpleGeneral !== true){return false;}
      if(cumple === false && row.cumpleGeneral !== false){return false;}
      if(search && String(row.searchText || "").indexOf(search) < 0){return false;}
      return true;
    };
  }

  function queryStudents(options){
    options = options || {};
    var s = schema();
    var periodoId = text(options.periodoId || options.periodId || "");
    var limit = Math.max(0, Number(options.limit == null ? DEFAULT_PAGE_LIMIT : options.limit) || 0);
    var offset = Math.max(0, Number(options.offset || 0) || 0);
    var filter = filterStudentFactory(options);

    if(periodoId){
      return cursorCollect(s.stores.estudiantes.name, "by_periodoId", keyRange(periodoId), {limit:limit, offset:offset, filter:filter}).then(function(result){result.periodoId = periodoId;return result;});
    }

    return cursorCollect(s.stores.estudiantes.name, null, null, {limit:limit, offset:offset, filter:filter});
  }

  function listPeriods(options){
    options = options || {};
    var s = schema();
    return cursorCollect(s.stores.periodos.name, null, null, {limit:options.limit || 0, offset:0}).then(function(result){return result.rows;});
  }

  function getStudentById(cedula, options){
    options = options || {};
    var s = schema();
    cedula = text(cedula);
    if(!cedula){return Promise.resolve(null);}
    if(options.periodoId || options.periodId){
      return queryStudents({periodoId:options.periodoId || options.periodId, search:cedula, limit:10, matricula:""}).then(function(result){return (result.rows || []).filter(function(row){return text(row.numeroIdentificacion || row.cedula) === cedula;})[0] || null;});
    }
    return get(s.stores.estudiantes.name, cedula);
  }

  function status(){return {ok:available() && !state.lastError, mode:"indexeddb", version:VERSION, available:available(), ready:state.ready, canServeSync:false, openedAt:state.openedAt, lastError:state.lastError, updatedAt:now()};}

  window.BL2IndexedDBAdapter = {
    version:VERSION,
    isAvailable:available,
    canServeSync:function(){return false;},
    open:open,
    put:put,
    putMany:putMany,
    delete:remove,
    get:get,
    getAll:getAll,
    getByIndex:getByIndex,
    getAllByIndex:getAllByIndex,
    queryStudents:queryStudents,
    listStudents:queryStudents,
    listPeriods:listPeriods,
    getStudentById:getStudentById,
    count:count,
    clear:clear,
    bulkFromSnapshot:bulkFromSnapshot,
    status:status
  };
})(window);
