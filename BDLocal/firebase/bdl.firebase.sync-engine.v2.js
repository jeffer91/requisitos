/* =========================================================
Nombre completo: bdl.firebase.sync-engine.v2.js
Ruta: /BDLocal/firebase/bdl.firebase.sync-engine.v2.js
Función:
- Descargar manualmente con cursor compuesto.
- Filtrar colecciones académicas por período.
- Proteger cambios locales pendientes antes de aplicar descargas.
- Registrar conflictos y reconciliar borrados/requisitos retirados.
- No iniciar procesos automáticamente.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.1.0-protected-reconciled-pull";
  var ALL_ENTITIES=["periodos","carreras","estudiantes","matriculas","requisitos","notas","historial","importaciones"];
  var DEFAULT_ENTITIES_GLOBAL=["periodos","carreras","estudiantes"];
  var DEFAULT_ENTITIES_PERIOD=["matriculas","requisitos","notas"];
  var PERIOD_SCOPED={matriculas:true,requisitos:true,notas:true};
  var DEFAULT_LIMIT=500;
  var MAX_PAGES=50;
  var state={running:false,operation:"",startedAt:"",lastResult:null,lastError:""};

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function repository(){return window.RequisitosFirebaseRepository||null;}
  function reverseMapper(){return window.RequisitosFirebaseReverseMapper||null;}
  function syncState(){return window.BDLRepoSyncEstado||null;}
  function conflicts(){return window.BDLRepoConflictos||null;}
  function repositories(){return window.BDLRepositories||null;}
  function outboxRepo(){return window.BDLRepoCambios||(window.BDLRepositories&&window.BDLRepositories.get&&window.BDLRepositories.get("cambios_pendientes"))||null;}
  function db(){return window.BL2DB||null;}
  function identity(){return window.RequisitosFirebaseIdentity||null;}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(error){}}
  function ensureManual(options){
    if(!options||options.manual!==true){throw new Error("La sincronización Firebase V2 solo puede iniciarse manualmente.");}
    if(state.running){throw new Error("Ya existe una sincronización Firebase V2 en curso.");}
  }
  function periodScoped(entity){return PERIOD_SCOPED[text(entity).toLowerCase()]===true;}
  function statePeriod(entity,options){return periodScoped(entity)?text(options&&options.periodoId):"";}
  function normalizeCursor(value){
    if(value&&typeof value==="object"){return {updatedAt:text(value.updatedAt),documentId:text(value.documentId)};}
    return {updatedAt:text(value),documentId:""};
  }
  function entityForChange(row){
    var table=text(row&&(row.tabla||row.table||row.tipo||row.type)).toLowerCase();
    if(/requisit/.test(table)){return "requisitos";}
    if(/nota|evaluacion|defensa|complex/.test(table)){return "notas";}
    if(/persona|contact/.test(table)){return "estudiantes";}
    if(/matricula|division/.test(table)){return "matriculas";}
    if(/periodo/.test(table)){return "periodos";}
    if(/carrera/.test(table)){return "carreras";}
    if(/historial|log/.test(table)){return "historial";}
    if(/importacion/.test(table)){return "importaciones";}
    return "academico_completo";
  }
  function documentIdentity(entity,data){
    data=data||{};var helper=identity();
    var cedula=helper&&typeof helper.cedulaOf==="function"?helper.cedulaOf(data):text(data.cedula);
    var periodoId=helper&&typeof helper.periodOf==="function"?helper.periodOf(data):text(data.periodoId);
    var localId=helper&&typeof helper.makeLocalStudentPeriodId==="function"?helper.makeLocalStudentPeriodId(cedula,periodoId):cedula+"__"+periodoId;
    return {entity:entity,cedula:cedula,periodoId:periodoId,localId:localId};
  }
  function pendingRows(entity,data){
    var current=outboxRepo();if(!current||typeof current.pending!=="function"){return Promise.resolve([]);}
    var id=documentIdentity(entity,data);var options={includeLegacy:false};
    if(id.cedula){options.cedula=id.cedula;}
    if(id.periodoId){options.periodoId=id.periodoId;}
    return current.pending("firebase",options).then(function(rows){
      return (rows||[]).filter(function(row){
        var currentEntity=entityForChange(row);
        return currentEntity===entity||currentEntity==="academico_completo";
      });
    }).catch(function(){return [];});
  }
  function directGet(store,key){
    var current=db();if(!current||typeof current.get!=="function"||!text(key)){return Promise.resolve(null);}
    return current.get(store,key).catch(function(){return null;});
  }
  function localExisting(entity,data){
    var id=documentIdentity(entity,data);var registry=repositories();
    if(entity==="estudiantes"){return directGet("personas",id.cedula);}
    if(entity==="matriculas"){return directGet("matriculas_periodo",id.localId);}
    if(entity==="notas"){return directGet("notas_titulacion",id.localId);}
    if(entity==="requisitos"){
      var repo=registry&&registry.get&&registry.get("requisitos");
      return repo&&typeof repo.list==="function"?repo.list({periodoId:id.periodoId,cedula:id.cedula}).then(function(rows){return rows&&rows[0]||null;}):Promise.resolve(null);
    }
    if(entity==="periodos"){return directGet("periodos",text(data.periodoId||data.id));}
    if(entity==="carreras"){return directGet("cache_views","catalogo_carrera__"+text(data.codigoCarrera||data.id));}
    return Promise.resolve(null);
  }
  function baseMatchesRemote(base,remote){
    if(!base){return false;}
    var hash=text(base._firebaseDataHash);var version=Number(base._firebaseVersion||0);var updatedAt=text(base._firebaseUpdatedAt);
    if(hash&&hash!==text(remote.dataHash)){return false;}
    if(version>0&&version!==Number(remote.version||0)){return false;}
    if(updatedAt&&updatedAt!==text(remote.updatedAt)){return false;}
    return !!(hash||version||updatedAt);
  }
  function saveConflict(entity,item,pending,base,reason){
    var repo=conflicts();if(!repo||typeof repo.save!=="function"){return Promise.resolve(null);}
    var data=item.data||{};var id=documentIdentity(entity,data);
    return repo.save({
      entidad:entity,documentoId:text(item.documentId),periodoId:id.periodoId,cedula:id.cedula,
      motivo:reason||"REMOTE_CHANGED_WITH_LOCAL_PENDING",local:clone(base),remote:clone(data),
      expected:base?{hash:text(base._firebaseDataHash),version:Number(base._firebaseVersion||0),updatedAt:text(base._firebaseUpdatedAt)}:null,
      changeIds:(pending||[]).map(function(row){return text(row.id||row.cambioId);}).filter(Boolean)
    });
  }
  function removeOne(store,key){
    var current=db();if(!current||typeof current.remove!=="function"||!text(key)){return Promise.resolve(false);}
    return current.remove(store,key).catch(function(){return false;});
  }
  function removeRequirements(periodoId,cedula,keepKeys){
    var registry=repositories();var repo=registry&&registry.get&&registry.get("requisitos");
    if(!repo||typeof repo.list!=="function"){return Promise.resolve(0);}
    keepKeys=keepKeys||Object.create(null);
    return repo.list({periodoId:periodoId,cedula:cedula}).then(function(rows){
      var tasks=(rows||[]).filter(function(row){return !keepKeys[text(row.requisitoKey)];})
        .map(function(row){return removeOne("requisitos_estudiante",row.id);});
      return Promise.all(tasks).then(function(values){return values.filter(Boolean).length;});
    });
  }
  function applyConverted(entity,item,converted){
    var data=item.data||{};var id=documentIdentity(entity,data);var current=db();
    if(!current){return Promise.reject(new Error("BL2DB no está disponible."));}
    if(data.eliminado===true){
      if(entity==="estudiantes"){return removeOne("personas",id.cedula).then(function(){return {removed:1,written:0};});}
      if(entity==="matriculas"){return removeOne("matriculas_periodo",id.localId).then(function(){return {removed:1,written:0};});}
      if(entity==="notas"){return removeOne("notas_titulacion",id.localId).then(function(){return {removed:1,written:0};});}
      if(entity==="requisitos"){return removeRequirements(id.periodoId,id.cedula,{}).then(function(count){return {removed:count,written:0};});}
      if(entity==="periodos"){return removeOne("periodos",text(data.periodoId||data.id)).then(function(){return {removed:1,written:0};});}
      if(entity==="carreras"){return removeOne("cache_views","catalogo_carrera__"+text(data.codigoCarrera||data.id)).then(function(){return {removed:1,written:0};});}
    }
    var stores=converted&&converted.stores||{};var storeNames=Object.keys(stores);var written=0;var removed=0;var chain=Promise.resolve();
    if(entity==="requisitos"){
      var keep=Object.create(null);(stores.requisitos_estudiante||[]).forEach(function(row){keep[text(row.requisitoKey)]=true;});
      chain=chain.then(function(){return removeRequirements(id.periodoId,id.cedula,keep).then(function(count){removed+=count;});});
    }
    storeNames.forEach(function(storeName){
      var rows=Array.isArray(stores[storeName])?stores[storeName]:[];
      chain=chain.then(function(){
        if(!rows.length){return null;}
        return current.bulkPut(storeName,rows).then(function(saved){written+=Array.isArray(saved)?saved.length:rows.length;});
      });
    });
    return chain.then(function(){return {written:written,removed:removed};});
  }
  function processDocument(entity,item,options){
    var data=item&&item.data||{};var reverse=reverseMapper();
    if(!reverse||typeof reverse.toLocal!=="function"){return Promise.reject(new Error("Mapeador Firebase → local no disponible."));}
    return Promise.all([pendingRows(entity,data),localExisting(entity,data)]).then(function(values){
      var pending=values[0]||[];var base=values[1]||null;
      if(pending.length){
        if(baseMatchesRemote(base,data)){
          return {ok:true,protectedPending:true,conflict:false,written:0,removed:0};
        }
        return saveConflict(entity,item,pending,base,"REMOTE_CHANGED_WITH_LOCAL_PENDING").then(function(){
          return {ok:false,protectedPending:true,conflict:true,written:0,removed:0};
        });
      }
      var converted=reverse.toLocal(entity,data,{documentId:item.documentId,allowInvalid:options.allowInvalid===true});
      if(!converted.ok&&options.allowInvalid!==true){
        return {ok:false,rejected:true,errors:converted.errors||[],written:0,removed:0};
      }
      return applyConverted(entity,item,converted).then(function(result){
        return {ok:true,written:result.written||0,removed:result.removed||0,converted:converted.records&&converted.records.length||0};
      });
    });
  }
  function cursorFor(entity,periodoId,full){
    var store=syncState();
    if(full||!store||typeof store.cursor!=="function"){return Promise.resolve({updatedAt:"",documentId:""});}
    return store.cursor(entity,periodoId).then(normalizeCursor);
  }
  function beginState(entity,periodoId,mode){
    var store=syncState();return store&&typeof store.begin==="function"?store.begin("firebase",entity,periodoId,mode):Promise.resolve(null);
  }
  function successState(entity,periodoId,detail){
    var store=syncState();return store&&typeof store.pullSuccess==="function"?store.pullSuccess(entity,periodoId,detail):Promise.resolve(null);
  }
  function errorState(entity,periodoId,error,mode){
    var store=syncState();return store&&typeof store.fail==="function"?store.fail("firebase",entity,periodoId,error,{mode:mode}):Promise.resolve(null);
  }
  function pullPage(entity,options,cursor,page){
    var central=repository();if(!central||typeof central.list!=="function"){return Promise.reject(new Error("Repositorio Firebase V2 no disponible."));}
    var limit=Math.max(1,Math.min(1000,Number(options.limit||DEFAULT_LIMIT)));
    var queryOptions={cursor:cursor,includeDeleted:true,limit:limit};
    if(periodScoped(entity)){queryOptions.periodoId=text(options.periodoId);}
    return central.list(entity,queryOptions).then(function(result){
      var totals={downloaded:Number(result.total||0),written:0,removed:0,conflicts:0,protectedPending:0,rejected:0};
      var chain=Promise.resolve();
      (result.documents||[]).forEach(function(item){
        chain=chain.then(function(){return processDocument(entity,item,options).then(function(processed){
          totals.written+=Number(processed.written||0);totals.removed+=Number(processed.removed||0);
          if(processed.conflict){totals.conflicts+=1;}
          if(processed.protectedPending){totals.protectedPending+=1;}
          if(processed.rejected){totals.rejected+=1;}
        });});
      });
      return chain.then(function(){
        return {
          ok:true,entity:entity,page:page,mode:cursor.updatedAt?"incremental":"full",
          cursorBefore:clone(cursor),cursorAfter:normalizeCursor(result.cursorAfter),
          downloaded:totals.downloaded,written:totals.written,removed:totals.removed,
          conflicts:totals.conflicts,protectedPending:totals.protectedPending,rejected:totals.rejected,
          hasMore:result.hasMore===true,readAt:result.readAt||now()
        };
      });
    });
  }
  function pullEntityInternal(entity,options){
    options=Object.assign({},options||{});entity=text(entity).toLowerCase();
    if(ALL_ENTITIES.indexOf(entity)<0){return Promise.reject(new Error("Entidad Firebase no soportada: "+entity+"."));}
    if(periodScoped(entity)&&!text(options.periodoId)){return Promise.reject(new Error("La entidad "+entity+" requiere período."));}
    var periodoId=statePeriod(entity,options);var mode=options.full===true?"full":"incremental";
    var maxPages=Math.max(1,Math.min(MAX_PAGES,Number(options.maxPages||MAX_PAGES)));
    return cursorFor(entity,periodoId,options.full===true).then(function(initial){
      return beginState(entity,periodoId,mode).then(function(){return initial;});
    }).then(function(initialCursor){
      var cursor=normalizeCursor(initialCursor);var pages=[];
      var total={downloaded:0,written:0,removed:0,conflicts:0,protectedPending:0,rejected:0};
      function next(page){
        return pullPage(entity,options,cursor,page).then(function(result){
          pages.push(result);Object.keys(total).forEach(function(key){total[key]+=Number(result[key]||0);});
          var previous=cursor;cursor=normalizeCursor(result.cursorAfter);
          var advanced=cursor.updatedAt!==previous.updatedAt||cursor.documentId!==previous.documentId;
          if(result.hasMore&&page<maxPages&&advanced){return next(page+1);}return result;
        });
      }
      return next(1).then(function(last){
        var detail={ok:true,entity:entity,mode:mode,periodoId:periodoId,cursorBefore:initialCursor,cursorAfter:cursor,
          downloaded:total.downloaded,written:total.written,removed:total.removed,conflicts:total.conflicts,
          protectedPending:total.protectedPending,rejected:total.rejected,pages:pages.length,
          hasMore:last.hasMore===true&&pages.length>=maxPages,finishedAt:now()};
        return successState(entity,periodoId,{mode:mode,cursor:cursor,readCount:total.downloaded,queryCount:pages.length,
          batchCount:pages.length,conflictCount:total.conflicts,at:detail.finishedAt}).then(function(){return detail;});
      });
    }).catch(function(error){return errorState(entity,periodoId,error,mode).then(function(){throw error;});});
  }
  function withLock(operation,options,work){
    try{ensureManual(options);}catch(error){return Promise.resolve({ok:false,blocked:true,message:error.message,operation:operation});}
    state.running=true;state.operation=operation;state.startedAt=now();state.lastError="";
    emit("requisitos:firebase-sync-started",{operation:operation,manual:true,at:state.startedAt});
    return Promise.resolve().then(work).then(function(result){state.lastResult=result;emit("requisitos:firebase-sync-finished",{operation:operation,result:clone(result),at:now()});return result;})
      .catch(function(error){state.lastError=error&&error.message?error.message:String(error);state.lastResult={ok:false,operation:operation,message:state.lastError,at:now()};emit("requisitos:firebase-sync-error",state.lastResult);return state.lastResult;})
      .finally(function(){state.running=false;state.operation="";state.startedAt="";});
  }
  function pullEntity(entity,options){options=Object.assign({},options||{});return withLock("pull:"+text(entity).toLowerCase(),options,function(){return pullEntityInternal(entity,options);});}
  function defaultEntities(options){
    if(Array.isArray(options.entities)&&options.entities.length){return options.entities.slice();}
    var selected=DEFAULT_ENTITIES_GLOBAL.slice();
    if(text(options.periodoId)){selected=selected.concat(DEFAULT_ENTITIES_PERIOD);}
    return selected;
  }
  function pullAll(options){
    options=Object.assign({},options||{});
    return withLock("pull:all",options,function(){
      var selected=defaultEntities(options).filter(function(entity,index,list){return ALL_ENTITIES.indexOf(entity)>=0&&list.indexOf(entity)===index;});
      var results=[];var chain=Promise.resolve();
      selected.forEach(function(entity){chain=chain.then(function(){return pullEntityInternal(entity,options).then(function(result){results.push(result);});});});
      return chain.then(function(){return {ok:results.every(function(item){return item&&item.ok!==false;}),operation:"pull:all",entities:selected,results:results,finishedAt:now()};});
    });
  }
  function pushPending(options){
    options=Object.assign({},options||{});
    return withLock("push:pending",options,function(){
      var sync=window.BDLSyncV2;if(!sync||typeof sync.request!=="function"){throw new Error("BDLSyncV2 no está disponible.");}
      return sync.request(Object.assign({},options,{manual:true,targets:["firebase"],target:"firebase"}));
    });
  }
  function status(){
    var store=syncState();var detail=store&&typeof store.list==="function"?store.list({target:"firebase"}):Promise.resolve([]);
    var conflictRepo=conflicts();var conflictList=conflictRepo&&typeof conflictRepo.list==="function"?conflictRepo.list({estado:"ABIERTO"}):Promise.resolve([]);
    return Promise.all([detail,conflictList]).then(function(values){return {ok:!state.lastError,version:VERSION,manualOnly:true,automatic:false,
      running:state.running,operation:state.operation,startedAt:state.startedAt,lastResult:clone(state.lastResult),lastError:state.lastError,
      entities:ALL_ENTITIES.slice(),syncStates:values[0],openConflicts:values[1].length};});
  }

  window.RequisitosFirebaseSyncEngine={
    version:VERSION,manualOnly:true,automatic:false,entities:ALL_ENTITIES.slice(),periodScoped:periodScoped,
    pullEntity:pullEntity,pullAll:pullAll,pushPending:pushPending,status:status,isRunning:function(){return state.running;},
    processDocument:processDocument,entityForChange:entityForChange,defaultEntities:defaultEntities
  };
})(window);
