/* =========================================================
Nombre completo: bdl.repo.importaciones.js
Ruta: /BDLocal/repositories/bdl.repo.importaciones.js
Función:
- Administrar la tabla importaciones.
- Registrar cada pegado o carga procesada por Ncomplex.
- Consultar historial por período y fuente.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-ncomplex";
  var Repos=window.BDLRepositories;
  if(!Repos){return;}

  function text(value){return String(value==null?"":value).trim();}
  function store(){return Repos.storeName("importaciones","importaciones");}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function now(){return new Date().toISOString();}
  function uniqueId(){
    if(window.crypto&&typeof window.crypto.randomUUID==="function"){
      return "importacion__"+window.crypto.randomUUID();
    }
    return "importacion__"+Date.now()+"__"+Math.random().toString(36).slice(2,10);
  }

  function normalize(row){
    row=Object.assign({},row||{});
    var source=text(row.source||row.origen||"NCOMPLEX_TEXTO_PEGADO").toUpperCase();
    var createdAt=text(row.createdAt)||now();
    return Object.assign({},row,{
      id:text(row.id||row.importacionId)||uniqueId(),
      importacionId:text(row.importacionId||row.id)||text(row.id)||"",
      periodoId:text(row.periodoId||row.periodId),
      source:source,
      tipo:text(row.tipo||"TEXTO_PEGADO").toUpperCase(),
      rawTextHash:text(row.rawTextHash||row.hash),
      totalDetectados:Number(row.totalDetectados||0),
      totalEncontrados:Number(row.totalEncontrados||0),
      totalNoEncontrados:Number(row.totalNoEncontrados||0),
      totalDuplicados:Number(row.totalDuplicados||0),
      totalConflictos:Number(row.totalConflictos||0),
      totalGuardados:Number(row.totalGuardados||0),
      estado:text(row.estado||"PROCESADA").toUpperCase(),
      createdAt:createdAt,
      updatedAt:text(row.updatedAt)||createdAt
    });
  }

  function list(options){
    options=options||{};
    var periodoId=text(options.periodoId||options.periodId);
    var source=text(options.source).toUpperCase();
    var read=periodoId&&typeof Repos.safeQueryByIndex==="function"
      ? Repos.safeQueryByIndex(store(),"periodoId",periodoId).then(function(rows){return rows.length?rows:Repos.safeGetAll(store());})
      : Repos.safeGetAll(store());

    return read.then(function(rows){
      return (Array.isArray(rows)?rows:[]).map(normalize).filter(function(row){
        if(periodoId&&row.periodoId!==periodoId){return false;}
        if(source&&row.source!==source){return false;}
        return true;
      }).sort(function(a,b){return String(b.updatedAt).localeCompare(String(a.updatedAt));});
    });
  }

  function get(id){
    id=text(id);
    if(!id){return Promise.resolve(null);}
    return Repos.requireDB().then(function(db){return db.get(store(),id);}).then(function(row){return row?normalize(row):null;}).catch(function(){return null;});
  }

  function save(row){
    var item=normalize(row);
    item.importacionId=item.id;
    item.updatedAt=now();
    return Repos.safePut(store(),item).then(function(saved){
      if(!saved){throw new Error("No se pudo registrar la importación.");}
      try{
        window.dispatchEvent(new CustomEvent("bdlocal:importaciones-updated",{
          detail:{id:saved.id,periodoId:saved.periodoId,source:saved.source}
        }));
      }catch(error){}
      return clone(saved);
    });
  }

  function saveMany(rows){
    rows=Array.isArray(rows)?rows:[];
    var result=[];
    var chain=Promise.resolve();
    rows.forEach(function(row){chain=chain.then(function(){return save(row).then(function(saved){result.push(saved);});});});
    return chain.then(function(){return result;});
  }

  var api={version:VERSION,storeName:store,list:list,get:get,save:save,saveMany:saveMany,normalize:normalize};
  Repos.register("importaciones",api);
  window.BDLRepoImportaciones=api;
})(window);
