/* =========================================================
Nombre completo: bdl.repo.conflictos.js
Ruta: /BDLocal/repositories/bdl.repo.conflictos.js
Función:
- Registrar conflictos de sincronización de forma determinista.
- Reutilizar errores_validacion como almacenamiento físico compatible.
- Mantener el cambio pendiente hasta resolución explícita.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-conflict-registry";
  var Repos=window.BDLRepositories;
  if(!Repos){return;}

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function part(value){
    return text(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[^a-z0-9_-]+/g,"_").replace(/^_+|_+$/g,"")||"sin_valor";
  }
  function stable(value){
    if(value==null){return "";}
    if(typeof value!=="object"){return String(value);}
    if(Array.isArray(value)){return "["+value.map(stable).join(",")+"]";}
    return "{"+Object.keys(value).sort().map(function(key){return JSON.stringify(key)+":"+stable(value[key]);}).join(",")+"}";
  }
  function hash(value){
    var source=stable(value);var result=2166136261;
    for(var i=0;i<source.length;i+=1){result^=source.charCodeAt(i);result+=(result<<1)+(result<<4)+(result<<7)+(result<<8)+(result<<24);}
    return (result>>>0).toString(16);
  }
  function store(){return Repos.storeName("conflictosSync",Repos.storeName("erroresValidacion","errores_validacion"));}
  function makeId(row){
    row=row||{};
    var entity=text(row.entidad||row.entity||"registro");
    var documentId=text(row.documentoId||row.documentId||row.entidadId||"");
    var localHash=text(row.localHash||row.local&&row.local.dataHash||"");
    var remoteHash=text(row.remoteHash||row.remote&&row.remote.dataHash||"");
    return "conflicto__"+part(entity)+"__"+part(documentId)+"__"+hash(localHash+"|"+remoteHash);
  }
  function normalize(row){
    row=Object.assign({},row||{});var stamp=now();
    var entity=text(row.entidad||row.entity||"registro").toLowerCase();
    var documentId=text(row.documentoId||row.documentId||row.entidadId||"");
    return Object.assign({},row,{
      id:text(row.id)||makeId(row),
      tipo:"CONFLICTO_SYNC",
      entidad:entity,
      entity:entity,
      documentoId:documentId,
      documentId:documentId,
      periodoId:text(row.periodoId),
      cedula:text(row.cedula),
      estado:text(row.estado||"ABIERTO").toUpperCase(),
      motivo:text(row.motivo||"VERSION_REMOTA_CAMBIO"),
      local:clone(row.local||null),
      remote:clone(row.remote||null),
      expected:clone(row.expected||null),
      changeIds:Array.isArray(row.changeIds)?row.changeIds.slice():[],
      localHash:text(row.localHash||row.local&&row.local.dataHash),
      remoteHash:text(row.remoteHash||row.remote&&row.remote.dataHash),
      createdAt:text(row.createdAt)||stamp,
      updatedAt:stamp,
      resolvedAt:text(row.resolvedAt),
      resolution:text(row.resolution),
      version:VERSION
    });
  }
  function save(row){
    var item=normalize(row);
    return Repos.put(store(),item).then(function(saved){
      try{window.dispatchEvent(new CustomEvent("bdlocal:sync-conflict",{detail:clone(saved)}));}catch(error){}
      return saved;
    });
  }
  function list(options){
    options=options||{};
    return Repos.getAll(store()).then(function(rows){
      return (rows||[]).filter(function(row){
        if(text(row.tipo)!=="CONFLICTO_SYNC"){return false;}
        if(text(options.estado)&&text(row.estado).toUpperCase()!==text(options.estado).toUpperCase()){return false;}
        if(text(options.entidad)&&text(row.entidad)!==text(options.entidad).toLowerCase()){return false;}
        if(text(options.periodoId)&&text(row.periodoId)!==text(options.periodoId)){return false;}
        if(text(options.cedula)&&text(row.cedula)!==text(options.cedula)){return false;}
        return true;
      }).map(normalize);
    });
  }
  function resolve(id,resolution){
    id=text(id);if(!id){return Promise.reject(new Error("Conflicto sin ID."));}
    return Repos.requireDB().then(function(db){return db.get(store(),id);}).then(function(row){
      if(!row){throw new Error("Conflicto no encontrado.");}
      return Repos.put(store(),normalize(Object.assign({},row,{
        estado:"RESUELTO",resolution:text(resolution||"RESUELTO_MANUALMENTE"),resolvedAt:now()
      })));
    });
  }

  var api={version:VERSION,storeName:store,makeId:makeId,normalize:normalize,save:save,list:list,resolve:resolve};
  Repos.register("conflictos_sync",api);
  Repos.register("conflictos",api);
  window.BDLRepoConflictos=api;
})(window);
