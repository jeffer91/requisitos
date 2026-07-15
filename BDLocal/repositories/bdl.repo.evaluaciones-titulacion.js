/* =========================================================
Nombre completo: bdl.repo.evaluaciones-titulacion.js
Ruta: /BDLocal/repositories/bdl.repo.evaluaciones-titulacion.js
Función:
- Administrar evaluaciones_titulacion como fuente local de Ncomplex.
- Normalizar cada registro mediante BDLRulesEvaluacionesTitulacion.
- Consultar por período, cédula, modalidad y estado.
- Usar idEstudiantePeriodo = cedula__periodoId.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-ncomplex";
  var Repos=window.BDLRepositories;
  if(!Repos){return;}

  function text(value){return String(value==null?"":value).trim();}
  function rules(){return window.BDLRulesEvaluacionesTitulacion||null;}
  function store(){return Repos.storeName("evaluacionesTitulacion","evaluaciones_titulacion");}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}

  function normalize(row,context){
    var current=Object.assign({},row||{});
    var helper=rules();
    if(helper&&typeof helper.build==="function"){
      current=helper.build(current,context||{});
    }
    return current;
  }

  function makeId(periodoId,cedula){
    var helper=rules();
    if(helper&&typeof helper.makeId==="function"){
      return helper.makeId(periodoId,cedula);
    }
    return text(cedula)+"__"+text(periodoId);
  }

  function query(options){
    options=options||{};
    var periodoId=text(options.periodoId||options.periodId);
    if(periodoId&&typeof Repos.safeQueryByIndex==="function"){
      return Repos.safeQueryByIndex(store(),"periodoId",periodoId).then(function(rows){
        return rows.length?rows:Repos.safeGetAll(store());
      });
    }
    return Repos.safeGetAll(store());
  }

  function applyFilters(rows,options){
    options=options||{};
    var helper=rules();
    var periodoId=helper&&helper.canonicalPeriodId?helper.canonicalPeriodId(options.periodoId||options.periodId||""):text(options.periodoId||options.periodId);
    var cedula=helper&&helper.normalizeCedula?helper.normalizeCedula(options.cedula||options.numeroIdentificacion||""):text(options.cedula||options.numeroIdentificacion);
    var modalidad=options.modalidadTitulacion||options.modalidad;
    modalidad=modalidad&&helper&&helper.modality?helper.modality(modalidad):text(modalidad);
    var estado=text(options.estadoEvaluacion||options.estado).toUpperCase();
    var importacionId=text(options.importacionId);

    return (Array.isArray(rows)?rows:[]).map(function(row){return normalize(row);}).filter(function(row){
      if(periodoId&&text(row.periodoId)!==periodoId){return false;}
      if(cedula&&text(row.cedula)!==cedula){return false;}
      if(modalidad&&text(row.modalidadTitulacion)!==modalidad){return false;}
      if(estado&&text(row.estadoEvaluacion).toUpperCase()!==estado){return false;}
      if(importacionId&&text(row.importacionId)!==importacionId){return false;}
      return true;
    });
  }

  function list(options){
    options=options||{};
    return query(options).then(function(rows){return applyFilters(rows,options);});
  }

  function getByPeriodoCedula(periodoId,cedula){
    var id=makeId(periodoId,cedula);
    if(!id){return Promise.resolve(null);}
    return Repos.requireDB().then(function(db){
      return db&&typeof db.get==="function"?db.get(store(),id):null;
    }).then(function(row){return row?normalize(row):null;}).catch(function(){
      return list({periodoId:periodoId,cedula:cedula}).then(function(rows){return rows[0]||null;});
    });
  }

  function save(row,context){
    var initial=normalize(row,context||{});
    if(!initial.idEstudiantePeriodo){
      return Promise.reject(new Error(initial._bdlEvaluacionError||"Evaluación sin período o cédula."));
    }
    return getByPeriodoCedula(initial.periodoId,initial.cedula).then(function(existing){
      var merged=normalize(Object.assign({},existing||{},row||{}, {
        createdAt:text(existing&&existing.createdAt)||text(row&&row.createdAt)||new Date().toISOString(),
        updatedAt:new Date().toISOString()
      }),context||{});
      return Repos.safePut(store(),merged).then(function(saved){
        if(!saved){throw new Error("No se pudo guardar la evaluación en Base Local.");}
        try{
          window.dispatchEvent(new CustomEvent("bdlocal:evaluaciones-titulacion-updated",{
            detail:{periodoId:saved.periodoId,cedula:saved.cedula,id:saved.idEstudiantePeriodo,source:"repository"}
          }));
        }catch(error){}
        return clone(saved);
      });
    });
  }

  function saveMany(rows,context){
    rows=Array.isArray(rows)?rows:[];
    if(!rows.length){return Promise.resolve([]);}
    var saved=[];
    var chain=Promise.resolve();
    rows.forEach(function(row){
      chain=chain.then(function(){
        return save(row,context||{}).then(function(item){saved.push(item);});
      });
    });
    return chain.then(function(){return saved;});
  }

  var api={
    version:VERSION,
    storeName:store,
    list:list,
    getByPeriodoCedula:getByPeriodoCedula,
    save:save,
    saveMany:saveMany,
    normalize:normalize,
    makeId:makeId,
    applyFilters:applyFilters
  };

  Repos.register("evaluaciones_titulacion",api);
  Repos.register("evaluacionesTitulacion",api);
  Repos.register("ncomplex",api);
  window.BDLRepoEvaluacionesTitulacion=api;
})(window);
