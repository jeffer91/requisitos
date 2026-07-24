/* =========================================================
Nombre completo: bdl.repo.sync-estado.js
Ruta: /BDLocal/repositories/bdl.repo.sync-estado.js
Función:
- Guardar estado por destino, entidad y período.
- Recordar cursor compuesto updatedAt + documentId.
- Fallar de forma visible si el cursor no puede persistirse.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.1.0-composite-cursor-strict";
  var Repos=window.BDLRepositories;
  if(!Repos){return;}

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function store(){return Repos.storeName("syncEstado","sync_estado");}
  function part(value){
    return text(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[^a-z0-9_-]+/g,"_").replace(/^_+|_+$/g,"")||"global";
  }
  function makeId(target,entity,periodoId){return ["sync",part(target||"firebase"),part(entity||"general"),part(periodoId||"global")].join("__");}
  function cursorOf(row){
    row=row||{};var raw=row.lastCursor;
    if(raw&&typeof raw==="object"){
      return {updatedAt:text(raw.updatedAt),documentId:text(raw.documentId)};
    }
    return {
      updatedAt:text(row.lastCursorUpdatedAt||row.cursorUpdatedAt||raw||""),
      documentId:text(row.lastCursorDocumentId||row.cursorDocumentId||row.lastDocumentId||"")
    };
  }
  function normalize(row,context){
    row=Object.assign({},row||{});context=context||{};var stamp=now();
    var target=text(row.target||context.target||"firebase").toLowerCase();
    var entity=text(row.entity||context.entity||"general").toLowerCase();
    var periodoId=text(row.periodoId||context.periodoId||"");
    var cursor=cursorOf(row);
    return Object.assign({},row,{
      id:makeId(target,entity,periodoId),target:target,entity:entity,periodoId:periodoId,
      target_periodo:target+"__"+(periodoId||"global"),
      status:text(row.status||"IDLE").toUpperCase(),mode:text(row.mode||"incremental").toLowerCase(),
      lastCursor:{updatedAt:cursor.updatedAt,documentId:cursor.documentId},
      lastCursorUpdatedAt:cursor.updatedAt,lastCursorDocumentId:cursor.documentId,
      lastDocumentId:text(row.lastDocumentId||cursor.documentId),
      lastStartedAt:text(row.lastStartedAt),lastFinishedAt:text(row.lastFinishedAt),
      lastPulledAt:text(row.lastPulledAt),lastPushedAt:text(row.lastPushedAt),lastError:text(row.lastError),
      readCount:Number(row.readCount||0),writeCount:Number(row.writeCount||0),queryCount:Number(row.queryCount||0),
      batchCount:Number(row.batchCount||0),conflictCount:Number(row.conflictCount||0),
      createdAt:text(row.createdAt)||stamp,updatedAt:text(row.updatedAt)||stamp,version:VERSION
    });
  }
  function directGet(id){
    return Repos.requireDB().then(function(db){return db&&typeof db.get==="function"?db.get(store(),id):null;});
  }
  function get(target,entity,periodoId){
    return directGet(makeId(target,entity,periodoId)).then(function(row){return row?normalize(row):null;});
  }
  function list(options){
    options=options||{};
    return Repos.getAll(store()).then(function(rows){
      return (rows||[]).map(normalize).filter(function(row){
        if(text(options.target)&&row.target!==text(options.target).toLowerCase()){return false;}
        if(text(options.entity)&&row.entity!==text(options.entity).toLowerCase()){return false;}
        if(text(options.periodoId)&&row.periodoId!==text(options.periodoId)){return false;}
        return true;
      });
    });
  }
  function save(row,context){
    var incoming=normalize(row,context||{});
    return directGet(incoming.id).then(function(existing){
      var merged=normalize(Object.assign({},existing||{},incoming,{
        id:incoming.id,createdAt:text(existing&&existing.createdAt)||incoming.createdAt,updatedAt:now()
      }));
      return Repos.put(store(),merged).then(function(saved){
        if(!saved){throw new Error("No se pudo persistir sync_estado.");}
        return saved;
      });
    });
  }
  function patch(target,entity,periodoId,changes){
    return get(target,entity,periodoId).then(function(existing){
      return save(Object.assign({},existing||{},changes||{}),{target:target,entity:entity,periodoId:periodoId});
    });
  }
  function begin(target,entity,periodoId,mode){
    return patch(target,entity,periodoId,{status:"RUNNING",mode:mode||"incremental",lastStartedAt:now(),lastFinishedAt:"",lastError:""});
  }
  function pullSuccess(entity,periodoId,details){
    details=details||{};var cursor=details.cursor||{};
    return patch("firebase",entity,periodoId,{
      status:"OK",mode:details.mode||"incremental",
      lastCursor:{updatedAt:text(cursor.updatedAt||details.lastCursorUpdatedAt),documentId:text(cursor.documentId||details.lastDocumentId)},
      lastDocumentId:text(cursor.documentId||details.lastDocumentId),
      lastPulledAt:details.at||now(),lastFinishedAt:details.at||now(),lastError:"",
      readCount:Number(details.readCount||details.total||0),queryCount:Number(details.queryCount||details.batchCount||1),
      batchCount:Number(details.batchCount||1),conflictCount:Number(details.conflictCount||0)
    });
  }
  function pushSuccess(entity,periodoId,details){
    details=details||{};
    return patch("firebase",entity,periodoId,{
      status:details.conflictCount>0?"CONFLICT":"OK",mode:"push",
      lastPushedAt:details.at||now(),lastFinishedAt:details.at||now(),lastError:"",
      writeCount:Number(details.writeCount||details.total||0),batchCount:Number(details.batchCount||1),
      conflictCount:Number(details.conflictCount||0)
    });
  }
  function fail(target,entity,periodoId,error,details){
    details=details||{};
    return patch(target,entity,periodoId,{
      status:"ERROR",mode:details.mode||"incremental",lastFinishedAt:now(),
      lastError:text(error&&error.message||error||details.message||"Error de sincronización.")
    });
  }
  function cursor(entity,periodoId){
    return get("firebase",entity,periodoId).then(function(row){return row?cursorOf(row):{updatedAt:"",documentId:""};});
  }
  function reset(entity,periodoId){
    return patch("firebase",entity,periodoId,{
      status:"IDLE",mode:"full",lastCursor:{updatedAt:"",documentId:""},lastDocumentId:"",lastError:"",
      readCount:0,queryCount:0,batchCount:0,conflictCount:0
    });
  }

  var api={version:VERSION,storeName:store,makeId:makeId,normalize:normalize,cursorOf:cursorOf,get:get,list:list,
    save:save,patch:patch,begin:begin,pullSuccess:pullSuccess,pushSuccess:pushSuccess,fail:fail,cursor:cursor,reset:reset};
  Repos.register("sync_estado",api);Repos.register("syncEstado",api);window.BDLRepoSyncEstado=api;
})(window);
