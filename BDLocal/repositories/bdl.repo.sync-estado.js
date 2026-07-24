/* =========================================================
Nombre completo: bdl.repo.sync-estado.js
Ruta: /BDLocal/repositories/bdl.repo.sync-estado.js
Función:
- Guardar el estado de sincronización por destino, entidad y período.
- Recordar el cursor updatedAt de la última descarga confirmada.
- Registrar inicios, éxitos y errores sin borrar estados anteriores.
- Evitar depender de localStorage para una operación crítica.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-firebase-v2-state";
  var Repos=window.BDLRepositories;
  if(!Repos){return;}

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function store(){return Repos.storeName("syncEstado","sync_estado");}
  function part(value){
    return text(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[^a-z0-9_-]+/g,"_").replace(/^_+|_+$/g,"")||"global";
  }
  function makeId(target,entity,periodoId){
    return ["sync",part(target||"firebase"),part(entity||"general"),part(periodoId||"global")].join("__");
  }
  function normalize(row,context){
    row=Object.assign({},row||{});context=context||{};
    var target=text(row.target||context.target||"firebase").toLowerCase();
    var entity=text(row.entity||context.entity||"general").toLowerCase();
    var periodoId=text(row.periodoId||context.periodoId||"");
    var stamp=now();
    var createdAt=text(row.createdAt)||stamp;
    return Object.assign({},row,{
      id:makeId(target,entity,periodoId),
      target:target,
      entity:entity,
      periodoId:periodoId,
      target_periodo:target+"__"+(periodoId||"global"),
      status:text(row.status||"IDLE").toUpperCase(),
      mode:text(row.mode||"incremental").toLowerCase(),
      lastCursor:text(row.lastCursor||row.cursor||""),
      lastDocumentId:text(row.lastDocumentId||""),
      lastStartedAt:text(row.lastStartedAt||""),
      lastFinishedAt:text(row.lastFinishedAt||""),
      lastPulledAt:text(row.lastPulledAt||""),
      lastPushedAt:text(row.lastPushedAt||""),
      lastError:text(row.lastError||""),
      readCount:Number(row.readCount||0),
      writeCount:Number(row.writeCount||0),
      batchCount:Number(row.batchCount||0),
      createdAt:createdAt,
      updatedAt:text(row.updatedAt)||stamp,
      version:VERSION
    });
  }
  function directGet(id){
    return Repos.requireDB().then(function(db){
      return db&&typeof db.get==="function"?db.get(store(),id):null;
    }).catch(function(){return null;});
  }
  function get(target,entity,periodoId){
    var id=makeId(target,entity,periodoId);
    return directGet(id).then(function(row){return row?normalize(row):null;});
  }
  function list(options){
    options=options||{};
    return Repos.safeGetAll(store()).then(function(rows){
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
        id:incoming.id,
        createdAt:text(existing&&existing.createdAt)||incoming.createdAt,
        updatedAt:now()
      }));
      return Repos.safePut(store(),merged);
    });
  }
  function patch(target,entity,periodoId,changes){
    return get(target,entity,periodoId).then(function(existing){
      return save(Object.assign({},existing||{},changes||{}),{target:target,entity:entity,periodoId:periodoId});
    });
  }
  function begin(target,entity,periodoId,mode){
    return patch(target,entity,periodoId,{
      status:"RUNNING",mode:mode||"incremental",lastStartedAt:now(),lastFinishedAt:"",lastError:""
    });
  }
  function pullSuccess(entity,periodoId,details){
    details=details||{};
    return patch("firebase",entity,periodoId,{
      status:"OK",mode:details.mode||"incremental",lastCursor:text(details.cursor||details.lastCursor),
      lastDocumentId:text(details.lastDocumentId),lastPulledAt:details.at||now(),lastFinishedAt:details.at||now(),
      lastError:"",readCount:Number(details.readCount||details.total||0),batchCount:Number(details.batchCount||1)
    });
  }
  function pushSuccess(entity,periodoId,details){
    details=details||{};
    return patch("firebase",entity,periodoId,{
      status:"OK",mode:"push",lastPushedAt:details.at||now(),lastFinishedAt:details.at||now(),lastError:"",
      writeCount:Number(details.writeCount||details.total||0),batchCount:Number(details.batchCount||1)
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
    return get("firebase",entity,periodoId).then(function(row){return text(row&&row.lastCursor);});
  }
  function reset(entity,periodoId){
    return patch("firebase",entity,periodoId,{
      status:"IDLE",mode:"full",lastCursor:"",lastDocumentId:"",lastError:"",readCount:0,batchCount:0
    });
  }

  var api={
    version:VERSION,storeName:store,makeId:makeId,normalize:normalize,get:get,list:list,save:save,patch:patch,
    begin:begin,pullSuccess:pullSuccess,pushSuccess:pushSuccess,fail:fail,cursor:cursor,reset:reset
  };
  Repos.register("sync_estado",api);
  Repos.register("syncEstado",api);
  window.BDLRepoSyncEstado=api;
})(window);