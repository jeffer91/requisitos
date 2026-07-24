/* =========================================================
Nombre completo: bdl.changes.outbox-bridge.js
Ruta: /BDLocal/patches/bdl.changes.outbox-bridge.js
Función:
- Mantener una sola cola real: cambios_pendientes.
- Espejar cambios legacy mediante el repositorio idempotente.
- Cargar contrato, mapeadores, repositorio, conflictos, estado, motor y controles Firebase V2.
- No ejecutar sincronizaciones automáticamente.
========================================================= */
(function(window){
  "use strict";

  var VERSION="2.9.0-control-center-push-v2";
  var FLAG="__bdlOutboxBridgeInstalled";
  var document=window.document||null;
  var scriptBase=document&&document.currentScript&&document.currentScript.src?document.currentScript.src:window.location.href;
  if(window[FLAG]){return;}
  window[FLAG]=true;

  function text(value){return String(value==null?"":value).trim();}
  function nowISO(){return new Date().toISOString();}
  function scriptUrl(relative){try{return new URL(relative,scriptBase).href;}catch(error){return relative;}}
  function loadSharedScript(relative,globalName){
    if(!document||window[globalName]){return Promise.resolve(window[globalName]||null);}
    var url=scriptUrl(relative);
    var existing=Array.prototype.slice.call(document.scripts||[]).find(function(script){
      return script.src===url||script.getAttribute("data-bdl-shared-src")===url;
    });
    if(existing){
      return new Promise(function(resolve){
        if(window[globalName]){resolve(window[globalName]);return;}
        existing.addEventListener("load",function(){resolve(window[globalName]||null);},{once:true});
        window.setTimeout(function(){resolve(window[globalName]||null);},1800);
      });
    }
    return new Promise(function(resolve){
      var script=document.createElement("script");
      script.src=url;script.async=false;script.defer=false;script.setAttribute("data-bdl-shared-src",url);
      script.onload=function(){resolve(window[globalName]||null);};
      script.onerror=function(){try{console.warn("[BDLOutboxBridge] No se pudo cargar "+relative);}catch(error){}resolve(null);};
      (document.head||document.documentElement).appendChild(script);
    });
  }
  function loadSharedArchitecture(){
    var files=[
      ["../firebase/bdl.firebase.schema.v2.js","RequisitosFirebaseSchema"],
      ["../firebase/bdl.firebase.identity.js","RequisitosFirebaseIdentity"],
      ["../firebase/bdl.firebase.validator.v2.js","RequisitosFirebaseValidator"],
      ["../firebase/bdl.firebase.mapper.v2.js","RequisitosFirebaseMapper"],
      ["../firebase/bdl.firebase.reverse-mapper.v2.js","RequisitosFirebaseReverseMapper"],
      ["../firebase/bdl.firebase.repository.v2.js","RequisitosFirebaseRepository"],
      ["../repositories/bdl.repo.conflictos.js","BDLRepoConflictos"],
      ["../repositories/bdl.repo.sync-estado.js","BDLRepoSyncEstado"],
      ["../firebase/bdl.firebase.sync-engine.v2.js","RequisitosFirebaseSyncEngine"],
      ["../shared/bdl.periodo-global.js","RequisitosPeriodoGlobal"],
      ["../firebase/bdl.firebase.control-center.js","RequisitosFirebaseControlCenter"],
      ["../firebase/bdl.firebase.push-control.js","RequisitosFirebasePushControl"]
    ];
    var chain=Promise.resolve();
    files.forEach(function(item){chain=chain.then(function(){return loadSharedScript(item[0],item[1]);});});
    return chain.then(function(){
      var detail={
        firebaseSchema:!!window.RequisitosFirebaseSchema,
        firebaseIdentity:!!window.RequisitosFirebaseIdentity,
        firebaseValidator:!!window.RequisitosFirebaseValidator,
        firebaseMapper:!!window.RequisitosFirebaseMapper,
        firebaseReverseMapper:!!window.RequisitosFirebaseReverseMapper,
        firebaseRepository:!!window.RequisitosFirebaseRepository,
        firebaseConflicts:!!window.BDLRepoConflictos,
        firebaseSyncState:!!window.BDLRepoSyncEstado,
        firebaseSyncEngine:!!window.RequisitosFirebaseSyncEngine,
        firebaseControlCenter:!!window.RequisitosFirebaseControlCenter,
        firebasePushControl:!!window.RequisitosFirebasePushControl,
        periodoGlobal:!!window.RequisitosPeriodoGlobal,
        automatic:false,version:VERSION,at:nowISO()
      };
      try{window.dispatchEvent(new CustomEvent("requisitos:arquitectura-compartida-lista",{detail:detail}));}catch(error){}
      return detail;
    });
  }
  function cfgStores(){
    var cfg=window.BL2Config||{};var stores=cfg.stores||{};
    return {legacy:text(stores.cambios||"cambios"),outbox:text(stores.cambiosPendientes||"cambios_pendientes")};
  }
  function repository(){
    if(window.BDLRepoCambios){return window.BDLRepoCambios;}
    if(window.BDLRepositories&&typeof window.BDLRepositories.get==="function"){
      return window.BDLRepositories.get("cambios_pendientes")||window.BDLRepositories.get("cambios");
    }
    return null;
  }
  function mirrorOne(row,mode){
    var repo=repository();
    if(!repo||typeof repo.save!=="function"){return Promise.resolve(null);}
    return repo.save(row||{},{source:"outbox_bridge",mode:mode||"put"}).then(function(saved){
      if(saved){try{window.dispatchEvent(new CustomEvent("bdlocal:outbox-bridged",{detail:{
        id:saved.id,logicalKey:saved.logicalKey||"",changedAt:saved.lastContentChangedAt||saved.updatedAt||nowISO(),
        store:cfgStores().outbox,at:nowISO()
      }}));}catch(error){}}
      return saved;
    }).catch(function(error){try{console.warn("[BDLOutboxBridge] No se pudo consolidar el cambio",error);}catch(innerError){}return null;});
  }
  function mirrorMany(rows,mode){
    var repo=repository();rows=Array.isArray(rows)?rows:[];
    if(!rows.length){return Promise.resolve([]);}
    if(repo&&typeof repo.saveMany==="function"){
      return repo.saveMany(rows,{source:"outbox_bridge",mode:mode||"bulkPut"}).catch(function(){return [];});
    }
    var result=[];var chain=Promise.resolve();
    rows.forEach(function(row){chain=chain.then(function(){return mirrorOne(row,mode).then(function(saved){if(saved){result.push(saved);}});});});
    return chain.then(function(){return result;});
  }
  function install(){
    var db=window.BL2DB||null;
    if(!db||typeof db.put!=="function"||typeof db.bulkPut!=="function"){return false;}
    if(db.__outboxBridgeInstalled){return true;}
    var originalPut=db.put.bind(db);var originalBulkPut=db.bulkPut.bind(db);
    db.put=function(storeName,value){
      var stores=cfgStores();
      if(text(storeName)!==stores.legacy){return originalPut(storeName,value);}
      return originalPut(storeName,value).then(function(saved){return mirrorOne(saved||value,"put").then(function(){return saved;});});
    };
    db.bulkPut=function(storeName,rows){
      var stores=cfgStores();rows=Array.isArray(rows)?rows:[];
      if(text(storeName)!==stores.legacy||!rows.length){return originalBulkPut(storeName,rows);}
      return originalBulkPut(storeName,rows).then(function(saved){
        var sourceRows=Array.isArray(saved)&&saved.length?saved:rows;
        return mirrorMany(sourceRows,"bulkPut").then(function(){return saved;});
      });
    };
    db.__outboxBridgeInstalled=true;db.outboxBridgeVersion=VERSION;
    try{window.dispatchEvent(new CustomEvent("bdlocal:outbox-bridge-ready",{detail:{
      version:VERSION,legacy:cfgStores().legacy,outbox:cfgStores().outbox,idempotent:true,
      sharedArchitecture:true,firebaseV2:true,firebaseSyncEngine:true,firebaseConflicts:true,
      firebaseControlCenter:true,firebasePushControl:true,automatic:false,at:nowISO()
    }}));}catch(error){}
    return true;
  }

  window.BDLOutboxBridge={version:VERSION,install:install,mirrorOne:mirrorOne,mirrorMany:mirrorMany,loadSharedArchitecture:loadSharedArchitecture};
  loadSharedArchitecture().catch(function(){});
  install();
})(window);
