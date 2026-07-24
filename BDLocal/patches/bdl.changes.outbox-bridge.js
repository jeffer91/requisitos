/* =========================================================
Nombre completo: bdl.changes.outbox-bridge.js
Ruta: /BDLocal/patches/bdl.changes.outbox-bridge.js
Función:
- Mantener una sola cola real: cambios_pendientes.
- Instalar inmediatamente el filtro de eliminados.
- Aplicar Firebase como destino operativo predeterminado.
- Cargar repositorios y controles compartidos en orden determinista.
- Exponer BDLSharedArchitectureReady sin ejecutar sincronizaciones automáticas.
========================================================= */
(function(window){
  "use strict";

  var VERSION="3.2.0-deterministic-startup";
  var FLAG="__bdlOutboxBridgeInstalled";
  var document=window.document||null;
  var scriptBase=document&&document.currentScript&&document.currentScript.src?document.currentScript.src:window.location.href;
  if(window[FLAG]){return;}
  window[FLAG]=true;

  function text(value){return String(value==null?"":value).trim();}
  function nowISO(){return new Date().toISOString();}
  function scriptUrl(relative){try{return new URL(relative,scriptBase).href;}catch(error){return relative;}}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}

  function installActiveFilterInline(){
    var U=window.BDLocalConUtils;
    if(!U){return false;}
    if(U.__activeFilterInstalled){return true;}

    function deleted(row){
      row=row||{};
      return row.eliminado===true||row._firebaseDeleted===true||
        text(row.estadoRegistro).toUpperCase()==="ELIMINADO";
    }
    function list(value){return Array.isArray(value)?value:[];}
    function sanitize(cache){
      cache=cache&&typeof cache==="object"?cache:{};
      var result=Object.assign({},cache,{
        meta:Object.assign({},cache.meta||{}),
        periods:list(cache.periods||cache.periodos).filter(function(row){return !deleted(row);}),
        students:list(cache.students||cache.estudiantes||cache.rows).filter(function(row){return !deleted(row);}),
        requirements:list(cache.requirements||cache.requisitos).filter(function(row){return !deleted(row);}),
        summaries:Object.assign({},cache.summaries||cache.resumenes||{}),
        diagnostics:list(cache.diagnostics||cache.diagnosticos).slice()
      });
      result.meta.totalPeriods=result.periods.length;
      result.meta.totalStudents=result.students.length;
      result.meta.totalRequirements=result.requirements.length;
      result.meta.activeFilterVersion="inline-"+VERSION;
      return result;
    }

    var originalRead=typeof U.readCache==="function"?U.readCache.bind(U):null;
    var originalNormalize=typeof U.normalizeCache==="function"?U.normalizeCache.bind(U):null;
    var originalWrite=typeof U.writeCache==="function"?U.writeCache.bind(U):null;
    var originalFilter=typeof U.filterStudents==="function"?U.filterStudents.bind(U):null;

    if(originalRead){U.readCache=function(force){return sanitize(originalRead(force));};}
    if(originalNormalize){U.normalizeCache=function(cache){return sanitize(originalNormalize(cache));};}
    if(originalWrite){U.writeCache=function(cache,options){return sanitize(originalWrite(sanitize(cache),options||{}));};}
    if(originalFilter){U.filterStudents=function(rows,options){return originalFilter(list(rows).filter(function(row){return !deleted(row);}),options||{});};}

    U.isDeleted=deleted;
    U.activeOnly=function(rows){return list(rows).filter(function(row){return !deleted(row);});};
    U.sanitizeActiveCache=sanitize;
    U.__activeFilterInstalled=true;
    U.activeFilterVersion="inline-"+VERSION;
    window.BDLocalActiveFilter=window.BDLocalActiveFilter||{
      version:"inline-"+VERSION,
      sanitize:sanitize,
      isDeleted:deleted,
      install:function(){return true;}
    };
    return true;
  }

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
      script.src=url;
      script.async=false;
      script.defer=false;
      script.setAttribute("data-bdl-shared-src",url);
      script.onload=function(){resolve(window[globalName]||null);};
      script.onerror=function(){
        try{console.warn("[BDLOutboxBridge] No se pudo cargar "+relative);}catch(error){}
        resolve(null);
      };
      (document.head||document.documentElement).appendChild(script);
    });
  }

  function loadSharedArchitecture(){
    installActiveFilterInline();
    var files=[
      ["../conexiones/cone.active-filter.js","BDLocalActiveFilter"],
      ["bdl.changes.firebase-policy.js","BDLFirebaseOutboxPolicy"],
      ["../repositories/bdl.repo.importaciones.js","BDLRepoImportaciones"],
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
      if(window.BDLFirebaseOutboxPolicy&&typeof window.BDLFirebaseOutboxPolicy.install==="function"){
        return window.BDLFirebaseOutboxPolicy.install();
      }
      return null;
    }).then(function(){
      var detail={
        activeCacheFilter:!!window.BDLocalActiveFilter,
        firebaseOutboxPolicy:!!window.BDLFirebaseOutboxPolicy,
        importacionesRepository:!!window.BDLRepoImportaciones,
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
        automatic:false,
        version:VERSION,
        at:nowISO()
      };
      var required=[
        "activeCacheFilter","firebaseOutboxPolicy","firebaseSchema","firebaseIdentity",
        "firebaseValidator","firebaseMapper","firebaseReverseMapper","firebaseRepository",
        "firebaseConflicts","firebaseSyncState","firebaseSyncEngine","periodoGlobal"
      ];
      detail.ok=required.every(function(name){return detail[name]===true;});
      if(!detail.ok){throw new Error("La arquitectura compartida no terminó de cargar correctamente.");}
      try{window.dispatchEvent(new CustomEvent("requisitos:arquitectura-compartida-lista",{detail:clone(detail)}));}catch(error){}
      return detail;
    });
  }

  function cfgStores(){
    var cfg=window.BL2Config||{};
    var stores=cfg.stores||{};
    return {
      legacy:text(stores.cambios||"cambios"),
      outbox:text(stores.cambiosPendientes||"cambios_pendientes")
    };
  }
  function repository(){
    if(window.BDLRepoCambios){return window.BDLRepoCambios;}
    if(window.BDLRepositories&&typeof window.BDLRepositories.get==="function"){
      return window.BDLRepositories.get("cambios_pendientes")||window.BDLRepositories.get("cambios");
    }
    return null;
  }
  function mirrorOne(row,mode){
    var current=repository();
    if(!current||typeof current.save!=="function"){return Promise.resolve(null);}
    return current.save(row||{},{source:"outbox_bridge",mode:mode||"put"}).then(function(saved){
      if(saved){
        try{window.dispatchEvent(new CustomEvent("bdlocal:outbox-bridged",{detail:{
          id:saved.id,
          logicalKey:saved.logicalKey||"",
          changedAt:saved.lastContentChangedAt||saved.updatedAt||nowISO(),
          store:cfgStores().outbox,
          at:nowISO()
        }}));}catch(error){}
      }
      return saved;
    }).catch(function(error){
      try{console.warn("[BDLOutboxBridge] No se pudo consolidar el cambio",error);}catch(innerError){}
      return null;
    });
  }
  function mirrorMany(rows,mode){
    var current=repository();
    rows=Array.isArray(rows)?rows:[];
    if(!rows.length){return Promise.resolve([]);}
    if(current&&typeof current.saveMany==="function"){
      return current.saveMany(rows,{source:"outbox_bridge",mode:mode||"bulkPut"}).catch(function(){return [];});
    }
    var result=[];
    var chain=Promise.resolve();
    rows.forEach(function(row){
      chain=chain.then(function(){
        return mirrorOne(row,mode).then(function(saved){if(saved){result.push(saved);}});
      });
    });
    return chain.then(function(){return result;});
  }
  function install(){
    installActiveFilterInline();
    var db=window.BL2DB||null;
    if(!db||typeof db.put!=="function"||typeof db.bulkPut!=="function"){return false;}
    if(db.__outboxBridgeInstalled){return true;}
    var originalPut=db.put.bind(db);
    var originalBulkPut=db.bulkPut.bind(db);
    db.put=function(storeName,value){
      var stores=cfgStores();
      if(text(storeName)!==stores.legacy){return originalPut(storeName,value);}
      return originalPut(storeName,value).then(function(saved){
        return mirrorOne(saved||value,"put").then(function(){return saved;});
      });
    };
    db.bulkPut=function(storeName,rows){
      var stores=cfgStores();
      rows=Array.isArray(rows)?rows:[];
      if(text(storeName)!==stores.legacy||!rows.length){return originalBulkPut(storeName,rows);}
      return originalBulkPut(storeName,rows).then(function(saved){
        var sourceRows=Array.isArray(saved)&&saved.length?saved:rows;
        return mirrorMany(sourceRows,"bulkPut").then(function(){return saved;});
      });
    };
    db.__outboxBridgeInstalled=true;
    db.outboxBridgeVersion=VERSION;
    try{window.dispatchEvent(new CustomEvent("bdlocal:outbox-bridge-ready",{detail:{
      version:VERSION,
      legacy:cfgStores().legacy,
      outbox:cfgStores().outbox,
      idempotent:true,
      sharedArchitecture:true,
      deterministicReady:true,
      activeCacheFilter:true,
      firebaseOutboxPolicy:true,
      firebaseV2:true,
      firebaseSyncEngine:true,
      firebaseConflicts:true,
      firebaseControlCenter:true,
      firebasePushControl:true,
      automatic:false,
      at:nowISO()
    }}));}catch(error){}
    return true;
  }

  window.BDLOutboxBridge={
    version:VERSION,
    install:install,
    mirrorOne:mirrorOne,
    mirrorMany:mirrorMany,
    installActiveFilterInline:installActiveFilterInline,
    loadSharedArchitecture:loadSharedArchitecture,
    ready:function(){return window.BDLSharedArchitectureReady;}
  };

  installActiveFilterInline();
  window.BDLSharedArchitectureReady=loadSharedArchitecture();
  window.BDLSharedArchitectureReady.catch(function(error){
    try{console.warn("[BDLOutboxBridge] Arquitectura compartida incompleta",error);}catch(innerError){}
  });
  install();
})(window);
