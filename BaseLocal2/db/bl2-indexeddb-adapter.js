/* =========================================================
Nombre completo: bl2-indexeddb-adapter.js
Ruta o ubicación: /Requisitos/BaseLocal2/db/bl2-indexeddb-adapter.js
Función o funciones:
- Crear y abrir IndexedDB para Base Local 2.0 en navegador/Live Server.
- Guardar datos por lotes sin bloquear la pantalla con un JSON gigante.
- Preparar consultas asíncronas para migración y pruebas.
- No reemplazar todavía las consultas síncronas de las pantallas actuales.
Con qué se conecta:
- bl2-schema.js
- bl2-migrations.js
- bl2-storage.js
========================================================= */
(function(window){
  "use strict";

  var state = {db:null, opening:null, ready:false, lastError:"", openedAt:""};

  function schema(){if(!window.BL2Schema){throw new Error("BL2Schema no disponible.");}return window.BL2Schema;}
  function migrations(){if(!window.BL2Migrations){throw new Error("BL2Migrations no disponible.");}return window.BL2Migrations;}
  function now(){return new Date().toISOString();}
  function available(){return !!window.indexedDB;}

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
          state.db.onversionchange = function(){try{state.db.close();}catch(error){}state.db=null;state.ready=false;};
          resolve(state.db);
        };
        request.onerror = function(){
          state.lastError = request.error && request.error.message ? request.error.message : "No se pudo abrir IndexedDB.";
          state.opening = null;
          reject(request.error || new Error(state.lastError));
        };
        request.onblocked = function(){console.warn("[BL2IndexedDB] Apertura bloqueada por otra pestaña.");};
      }catch(error){state.opening = null;state.lastError = error.message || String(error);reject(error);}
    });
    return state.opening;
  }

  function tx(storeName, mode){
    return open().then(function(db){return db.transaction(storeName, mode || "readonly").objectStore(storeName);});
  }

  function requestToPromise(request){
    return new Promise(function(resolve, reject){
      request.onsuccess = function(){resolve(request.result);};
      request.onerror = function(){reject(request.error || new Error("Operación IndexedDB fallida."));};
    });
  }

  function put(storeName, value){return tx(storeName, "readwrite").then(function(store){return requestToPromise(store.put(value));});}

  function putMany(storeName, rows, options){
    options = options || {};
    rows = Array.isArray(rows) ? rows : [];
    return open().then(function(db){
      return new Promise(function(resolve, reject){
        try{
          var transaction = db.transaction(storeName, "readwrite");
          var store = transaction.objectStore(storeName);
          var count = 0;
          transaction.oncomplete = function(){resolve({ok:true, store:storeName, count:count});};
          transaction.onerror = function(){reject(transaction.error || new Error("No se pudo guardar lote en " + storeName));};
          rows.forEach(function(row){store.put(row);count += 1;});
          if(options.touchMetadata !== false && storeName !== "metadata"){
            try{db.transaction("metadata", "readwrite").objectStore("metadata").put({key:"lastWrite:" + storeName, store:storeName, count:rows.length, updatedAt:now()});}catch(error){}
          }
        }catch(error){reject(error);}
      });
    });
  }

  function get(storeName, key){return tx(storeName, "readonly").then(function(store){return requestToPromise(store.get(key));});}
  function getAll(storeName){return tx(storeName, "readonly").then(function(store){return requestToPromise(store.getAll());});}
  function count(storeName){return tx(storeName, "readonly").then(function(store){return requestToPromise(store.count());});}
  function clear(storeName){return tx(storeName, "readwrite").then(function(store){return requestToPromise(store.clear());});}

  function bulkFromSnapshot(snapshot){
    var s = schema();
    snapshot = snapshot || {};
    var periods = (Array.isArray(snapshot.periods) ? snapshot.periods : []).map(s.helpers.normalizePeriod);
    var students = (Array.isArray(snapshot.students) ? snapshot.students : []).map(s.helpers.normalizeStudent);
    return open().then(function(){
      return Promise.all([
        putMany(s.stores.periodos.name, periods),
        putMany(s.stores.estudiantes.name, students),
        put(s.stores.metadata.name, {key:"lastSnapshotImport", periods:periods.length, students:students.length, updatedAt:now(), source:"snapshot"})
      ]).then(function(){return {ok:true, periods:periods.length, students:students.length};});
    });
  }

  function status(){
    return {ok:available() && !state.lastError, mode:"indexeddb", available:available(), ready:state.ready, canServeSync:false, openedAt:state.openedAt, lastError:state.lastError, updatedAt:now()};
  }

  window.BL2IndexedDBAdapter = {
    version:"2.0.0-alpha.1",
    isAvailable:available,
    canServeSync:function(){return false;},
    open:open,
    put:put,
    putMany:putMany,
    get:get,
    getAll:getAll,
    count:count,
    clear:clear,
    bulkFromSnapshot:bulkFromSnapshot,
    status:status
  };
})(window);
