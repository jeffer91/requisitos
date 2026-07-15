/* =========================================================
Nombre completo: bdl.migration.v3.ncomplex.js
Ruta: /BDLocal/migrations/bdl.migration.v3.ncomplex.js
Función:
- Crear evaluaciones_titulacion de forma no destructiva.
- Añadir sus índices sin modificar las tablas existentes.
- Registrar la migración DB_VERSION 3 para Ncomplex.
========================================================= */
(function(window){
  "use strict";

  var VERSION="3.0.0-ncomplex-schema";
  var config=window.BL2Config||{};
  var DB_NAME=config.dbName||"REQUISITOS_BL2";
  var STORE=(config.stores&&config.stores.evaluacionesTitulacion)||"evaluaciones_titulacion";
  var running=null;

  function hasStore(db){return !!(db&&db.objectStoreNames&&db.objectStoreNames.contains(STORE));}
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

  function inspect(){
    return new Promise(function(resolve,reject){
      var request=window.indexedDB.open(DB_NAME);
      request.onsuccess=function(){
        var db=request.result;
        var result={exists:hasStore(db),version:Number(db.version||1),stores:Array.prototype.slice.call(db.objectStoreNames||[])};
        db.close();
        resolve(result);
      };
      request.onerror=function(){reject(request.error||new Error("No se pudo inspeccionar Base Local."));};
      request.onblocked=function(){reject(new Error("Base Local está bloqueada por otra ventana."));};
    });
  }

  function upgrade(version){
    return new Promise(function(resolve,reject){
      var request=window.indexedDB.open(DB_NAME,version);
      request.onupgradeneeded=function(event){
        var db=event.target.result;
        var tx=event.target.transaction;
        var store=hasStore(db)?tx.objectStore(STORE):db.createObjectStore(STORE,{keyPath:"idEstudiantePeriodo"});
        prepare(store);
      };
      request.onsuccess=function(){
        var db=request.result;
        var result={ok:hasStore(db),version:Number(db.version||version),store:STORE,stores:Array.prototype.slice.call(db.objectStoreNames||[])};
        db.close();
        resolve(result);
      };
      request.onerror=function(){reject(request.error||new Error("No se pudo crear evaluaciones_titulacion."));};
      request.onblocked=function(){reject(new Error("Cierre otras ventanas para actualizar Base Local."));};
    });
  }

  function reopenBL2(){
    var db=window.BL2DB;
    if(!db||typeof db.open!=="function"){return Promise.resolve(null);}
    return db.open({force:true,skipRepair:true}).catch(function(){return null;});
  }

  function run(){
    if(running){return running;}
    if(!window.indexedDB){return Promise.reject(new Error("IndexedDB no está disponible."));}
    if(window.BL2DB&&typeof window.BL2DB.close==="function"){window.BL2DB.close();}

    running=inspect().then(function(current){
      if(current.exists){
        return {ok:true,created:false,version:current.version,store:STORE,stores:current.stores};
      }
      return upgrade(Math.max(current.version+1,Number(config.dbVersion||3),3)).then(function(result){
        result.created=true;
        return result;
      });
    }).then(function(result){
      return reopenBL2().then(function(){
        try{window.dispatchEvent(new CustomEvent("bdlocal:ncomplex-schema-ready",{detail:result}));}catch(error){}
        return result;
      });
    }).finally(function(){running=null;});

    return running;
  }

  function status(){
    var meta=window.BL2DB&&typeof window.BL2DB.meta==="function"?window.BL2DB.meta():null;
    var stores=meta&&Array.isArray(meta.stores)?meta.stores:[];
    return {version:VERSION,store:STORE,ready:stores.indexOf(STORE)>=0,destructive:false,dbMeta:meta};
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

  window.BDLMigrationV3Ncomplex={version:VERSION,store:STORE,status:status,run:run,ensure:run};
})(window);
