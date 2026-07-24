/* =========================================================
Nombre completo: bdl.firebase.sync-engine.v2.js
Ruta: /BDLocal/firebase/bdl.firebase.sync-engine.v2.js
Función:
- Ejecutar descargas manuales completas o incrementales.
- Guardar documentos convertidos en IndexedDB sin crear outbox.
- Recordar el cursor updatedAt por colección en sync_estado.
- Reutilizar BDLSyncV2 para subir cambios pendientes.
- No iniciar procesos automáticamente.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-manual-differential-sync";
  var ENTITIES=["periodos","carreras","estudiantes","matriculas","requisitos","notas","historial","importaciones"];
  var DEFAULT_LIMIT=1000;
  var MAX_PAGES=20;
  var state={running:false,operation:"",startedAt:"",lastResult:null,lastError:""};

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function repository(){return window.RequisitosFirebaseRepository||null;}
  function syncState(){return window.BDLRepoSyncEstado||null;}
  function repositories(){return window.BDLRepositories||null;}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(error){}}
  function ensureManual(options){
    if(!options||options.manual!==true){throw new Error("La sincronización Firebase V2 solo puede iniciarse manualmente.");}
    if(state.running){throw new Error("Ya existe una sincronización Firebase V2 en curso.");}
  }
  function maxUpdatedAt(documents,fallback){
    var values=(documents||[]).map(function(item){return text(item&&item.data&&item.data.updatedAt);}).filter(Boolean).sort();
    return values.length?values[values.length-1]:text(fallback);
  }
  function maxDocumentId(documents){
    var values=(documents||[]).map(function(item){return text(item&&item.documentId);}).filter(Boolean).sort();
    return values.length?values[values.length-1]:"";
  }
  function writeStores(stores){
    stores=stores||{};var registry=repositories();
    if(!registry||typeof registry.bulkPut!=="function"){return Promise.reject(new Error("BDLRepositories no está disponible."));}
    var names=Object.keys(stores);var written={};var chain=Promise.resolve();
    names.forEach(function(storeName){
      var rows=Array.isArray(stores[storeName])?stores[storeName]:[];
      chain=chain.then(function(){
        if(!rows.length){written[storeName]=0;return null;}
        return registry.bulkPut(storeName,rows).then(function(result){
          written[storeName]=Array.isArray(result)?result.length:Number(result||rows.length);return result;
        });
      });
    });
    return chain.then(function(){return written;});
  }
  function stateCursor(entity,periodoId,full){
    var store=syncState();
    if(full||!store||typeof store.cursor!=="function"){return Promise.resolve("");}
    return store.cursor(entity,periodoId);
  }
  function beginState(entity,periodoId,mode){
    var store=syncState();
    return store&&typeof store.begin==="function"?store.begin("firebase",entity,periodoId,mode):Promise.resolve(null);
  }
  function successState(entity,periodoId,detail){
    var store=syncState();
    return store&&typeof store.pullSuccess==="function"?store.pullSuccess(entity,periodoId,detail):Promise.resolve(null);
  }
  function errorState(entity,periodoId,error,mode){
    var store=syncState();
    return store&&typeof store.fail==="function"?store.fail("firebase",entity,periodoId,error,{mode:mode}):Promise.resolve(null);
  }
  function pullPage(entity,options,cursor,page){
    var central=repository();
    if(!central||typeof central.pull!=="function"){return Promise.reject(new Error("Repositorio Firebase V2 no disponible."));}
    var limit=Math.max(1,Math.min(1000,Number(options.limit||DEFAULT_LIMIT)));
    return central.pull(entity,{
      updatedAfter:cursor,
      includeDeleted:true,
      limit:limit,
      allowInvalid:options.allowInvalid===true
    }).then(function(result){
      var local=result.local||{stores:{},rejected:0};
      return writeStores(local.stores||{}).then(function(written){
        var nextCursor=maxUpdatedAt(result.documents,cursor);
        var hasMore=Number(result.total||0)>=limit&&nextCursor&&nextCursor!==cursor;
        return {
          ok:true,entity:entity,page:page,mode:cursor?"incremental":"full",cursorBefore:cursor,
          cursorAfter:nextCursor,lastDocumentId:maxDocumentId(result.documents),downloaded:Number(result.total||0),
          converted:Number(local.converted||0),rejected:Number(local.rejected||0),written:written,
          hasMore:hasMore,readAt:result.readAt||now()
        };
      });
    });
  }
  function pullEntityInternal(entity,options){
    options=Object.assign({},options||{});entity=text(entity).toLowerCase();
    if(ENTITIES.indexOf(entity)<0){return Promise.reject(new Error("Entidad Firebase no soportada: "+entity+"."));}
    var periodoId=text(options.periodoId||"");
    var mode=options.full===true?"full":"incremental";
    var maxPages=Math.max(1,Math.min(MAX_PAGES,Number(options.maxPages||MAX_PAGES)));
    return stateCursor(entity,periodoId,options.full===true).then(function(initialCursor){
      return beginState(entity,periodoId,mode).then(function(){return initialCursor;});
    }).then(function(initialCursor){
      var cursor=initialCursor;var pages=[];var total=0;var converted=0;var rejected=0;var written={};
      function next(page){
        return pullPage(entity,options,cursor,page).then(function(result){
          pages.push(result);total+=result.downloaded;converted+=result.converted;rejected+=result.rejected;
          Object.keys(result.written||{}).forEach(function(store){written[store]=(written[store]||0)+Number(result.written[store]||0);});
          var previous=cursor;cursor=result.cursorAfter||cursor;
          if(result.hasMore&&page<maxPages&&cursor!==previous){return next(page+1);}
          return result;
        });
      }
      return next(1).then(function(last){
        var detail={
          ok:true,entity:entity,mode:mode,periodoId:periodoId,cursorBefore:initialCursor,cursorAfter:cursor,
          lastDocumentId:last.lastDocumentId,total:total,converted:converted,rejected:rejected,written:written,
          pages:pages.length,hasMore:last.hasMore===true&&pages.length>=maxPages,finishedAt:now()
        };
        return successState(entity,periodoId,{
          mode:mode,cursor:cursor,lastDocumentId:last.lastDocumentId,readCount:total,batchCount:pages.length,at:detail.finishedAt
        }).then(function(){return detail;});
      });
    }).catch(function(error){
      return errorState(entity,text(options.periodoId),error,mode).then(function(){throw error;});
    });
  }
  function withLock(operation,options,work){
    try{ensureManual(options);}catch(error){return Promise.resolve({ok:false,blocked:true,message:error.message,operation:operation});}
    state.running=true;state.operation=operation;state.startedAt=now();state.lastError="";
    emit("requisitos:firebase-sync-started",{operation:operation,manual:true,at:state.startedAt});
    return Promise.resolve().then(work).then(function(result){
      state.lastResult=result;emit("requisitos:firebase-sync-finished",{operation:operation,result:clone(result),at:now()});return result;
    }).catch(function(error){
      state.lastError=error&&error.message?error.message:String(error);
      state.lastResult={ok:false,operation:operation,message:state.lastError,at:now()};
      emit("requisitos:firebase-sync-error",state.lastResult);return state.lastResult;
    }).finally(function(){state.running=false;state.operation="";state.startedAt="";});
  }
  function pullEntity(entity,options){
    options=Object.assign({},options||{});
    return withLock("pull:"+text(entity).toLowerCase(),options,function(){return pullEntityInternal(entity,options);});
  }
  function pullAll(options){
    options=Object.assign({},options||{});
    return withLock("pull:all",options,function(){
      var selected=Array.isArray(options.entities)&&options.entities.length?options.entities.slice():ENTITIES.slice();
      var results=[];var chain=Promise.resolve();
      selected.forEach(function(entity){
        chain=chain.then(function(){return pullEntityInternal(entity,options).then(function(result){results.push(result);});});
      });
      return chain.then(function(){
        return {ok:results.every(function(item){return item&&item.ok!==false;}),operation:"pull:all",entities:selected,results:results,finishedAt:now()};
      });
    });
  }
  function pushPending(options){
    options=Object.assign({},options||{});
    return withLock("push:pending",options,function(){
      var sync=window.BDLSyncV2;
      if(!sync||typeof sync.request!=="function"){throw new Error("BDLSyncV2 no está disponible.");}
      return sync.request(Object.assign({},options,{manual:true,targets:["firebase"],target:"firebase"}));
    });
  }
  function status(){
    var store=syncState();
    var detail=store&&typeof store.list==="function"?store.list({target:"firebase"}):Promise.resolve([]);
    return Promise.resolve(detail).then(function(rows){
      return {ok:!state.lastError,version:VERSION,manualOnly:true,automatic:false,running:state.running,operation:state.operation,
        startedAt:state.startedAt,lastResult:clone(state.lastResult),lastError:state.lastError,entities:ENTITIES.slice(),syncStates:rows};
    });
  }

  window.RequisitosFirebaseSyncEngine={
    version:VERSION,manualOnly:true,automatic:false,entities:ENTITIES.slice(),pullEntity:pullEntity,pullAll:pullAll,
    pushPending:pushPending,status:status,isRunning:function(){return state.running;},writeStores:writeStores
  };
})(window);