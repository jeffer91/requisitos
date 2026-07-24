/* =========================================================
Nombre completo: bdl.migration.v3.ncomplex.js
Ruta: /BDLocal/migrations/bdl.migration.v3.ncomplex.js
Función:
- Verificar evaluaciones_titulacion sin cerrar una conexión válida.
- Crear la tabla únicamente cuando realmente falte.
- Añadir sus índices sin modificar las tablas existentes.
- Evitar carreras entre el arranque de BL2 y una actualización de versión.
========================================================= */
(function(window){
  "use strict";

  var VERSION="3.2.0-no-forced-close";
  var config=window.BL2Config||{};
  var DB_NAME=config.dbName||"REQUISITOS_BL2";
  var STORE=(config.stores&&config.stores.evaluacionesTitulacion)||"evaluaciones_titulacion";
  var running=null;

  function hasStore(db){
    return !!(db&&db.objectStoreNames&&db.objectStoreNames.contains(STORE));
  }
  function index(store,name,keyPath){
    if(store&&!store.indexNames.contains(name)){store.createIndex(name,keyPath,{unique:false});}
  }
  function prepare(store){
    index(store,"periodoId","periodoId");
    index(store,"cedula","cedula");
    index(store,"periodo_cedula",["periodoId","cedula"]);
    index(store,"modalidadTitulacion","modalidadTitulacion");
    index(store,"estadoEvaluacion","estadoEvaluacion");
    index(store,"periodo_modalidad",["periodoId","modalidadTitulacion"]);
    index(store,"importacionId","importacionId");
    index(store,"updatedAt","updatedAt");
  }
  function api(){return window.BL2DB||null;}

  function currentMeta(openedDb){
    return {
      ok:hasStore(openedDb),
      created:false,
      version:Number(openedDb&&openedDb.version||1),
      store:STORE,
      stores:Array.prototype.slice.call(openedDb&&openedDb.objectStoreNames||[])
    };
  }

  function upgrade(version){
    return new Promise(function(resolve,reject){
      var request=window.indexedDB.open(DB_NAME,version);
      request.onupgradeneeded=function(event){
        try{
          var openedDb=event.target.result;
          var transaction=event.target.transaction;
          var objectStore=hasStore(openedDb)
            ? transaction.objectStore(STORE)
            : openedDb.createObjectStore(STORE,{keyPath:"idEstudiantePeriodo"});
          prepare(objectStore);
        }catch(error){
          try{event.target.transaction.abort();}catch(innerError){}
          reject(error);
        }
      };
      request.onsuccess=function(){
        var openedDb=request.result;
        var result=currentMeta(openedDb);
        result.created=true;
        try{openedDb.close();}catch(error){}
        resolve(result);
      };
      request.onerror=function(){reject(request.error||new Error("No se pudo crear evaluaciones_titulacion."));};
      request.onblocked=function(){reject(new Error("Cierre otras ventanas para actualizar Base Local."));};
    });
  }

  function ensureStore(){
    var database=api();
    if(!database||typeof database.open!=="function"){
      return Promise.reject(new Error("BL2DB debe cargarse antes de ejecutar la migración de Ncomplex."));
    }

    return database.open().then(function(openedDb){
      if(hasStore(openedDb)){
        return currentMeta(openedDb);
      }

      var nextVersion=Math.max(
        Number(openedDb.version||1)+1,
        Number(config.dbVersion||3),
        3
      );

      if(typeof database.close==="function"){
        database.close();
      }else{
        try{openedDb.close();}catch(error){}
      }

      return upgrade(nextVersion).then(function(result){
        return database.open({skipRepair:true}).then(function(){return result;});
      });
    });
  }

  function run(){
    if(running){return running;}
    if(!window.indexedDB){return Promise.reject(new Error("IndexedDB no está disponible."));}

    running=ensureStore()
      .then(function(result){
        try{
          window.dispatchEvent(new CustomEvent("bdlocal:ncomplex-schema-ready",{detail:result}));
        }catch(error){}
        return result;
      })
      .finally(function(){running=null;});

    return running;
  }

  function status(){
    var meta=api()&&typeof api().meta==="function"?api().meta():null;
    var stores=meta&&Array.isArray(meta.stores)?meta.stores:[];
    return {
      version:VERSION,
      store:STORE,
      ready:stores.indexOf(STORE)>=0,
      destructive:false,
      forcedClose:false,
      dbMeta:meta
    };
  }

  if(window.BDLMigrations&&typeof window.BDLMigrations.register==="function"){
    window.BDLMigrations.register(VERSION,{
      title:"DB_VERSION 3 - evaluaciones de titulación para Ncomplex",
      destructive:false,
      tables:[STORE],
      status:status,
      run:run
    });
  }

  window.BDLMigrationV3Ncomplex={
    version:VERSION,
    store:STORE,
    status:status,
    run:run,
    ensure:run
  };
})(window);
