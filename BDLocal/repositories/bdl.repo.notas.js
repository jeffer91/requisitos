/* =========================================================
Nombre completo: bdl.repo.notas.js
Ruta o ubicación: /BDLocal/repositories/bdl.repo.notas.js
Función o funciones:
- Administrar notas_titulacion como fuente principal.
- Usar notas legacy solo como fallback.
- Aplicar la regla central de identificación validada.
- Forzar idEstudiantePeriodo = cedula__periodoId.
- Consultar por clave e índices antes de recorrer tablas completas.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.2.0-indexed-read";
  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }
  function normalizeCedula(value){
    var rules = window.BDLRulesPersona;
    if(rules && typeof rules.normalizeCedula === "function"){ return rules.normalizeCedula(value); }
    var utils = window.BL2Config && window.BL2Config.utils;
    return utils && typeof utils.normalizeCedula === "function"
      ? utils.normalizeCedula(value)
      : text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
  }
  function canonicalPeriodId(value){
    value = text(value);
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match ? match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4] : value.replace(/_+/g,"__");
  }
  function makeId(periodoId,cedula){
    periodoId = canonicalPeriodId(periodoId);
    cedula = normalizeCedula(cedula);
    return periodoId && cedula ? cedula + "__" + periodoId : "";
  }
  function store(){ return Repos.storeName("notasTitulacion","notas_titulacion"); }
  function legacyStore(){ return Repos.storeName("notas","notas"); }

  function applyFilters(rows,options){
    options = options || {};
    rows = Repos.byPeriodo(rows || [],canonicalPeriodId(options.periodoId));
    if(text(options.cedula)){ rows = Repos.byCedula(rows,normalizeCedula(options.cedula)); }
    if(text(options.idEstudiantePeriodo)){
      rows = rows.filter(function(row){
        return text(row.idEstudiantePeriodo || row.studentId || row.id) === text(options.idEstudiantePeriodo);
      });
    }
    return rows;
  }

  function normalize(row){
    row = Object.assign({},row || {});
    var periodoId = canonicalPeriodId(row.periodoId || row.periodId || "");
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || "");
    var canonicalId = makeId(periodoId,cedula);
    if(window.BDLRulesNotas && typeof window.BDLRulesNotas.build === "function"){
      row = Object.assign({},row,window.BDLRulesNotas.build(row,{periodoId:periodoId,cedula:cedula}) || {});
    }
    canonicalId = makeId(row.periodoId || periodoId,row.cedula || cedula) || canonicalId;
    return Object.assign({},row,{
      id:canonicalId,
      notaId:canonicalId,
      studentId:canonicalId,
      idEstudiantePeriodo:canonicalId,
      periodoId:canonicalPeriodId(row.periodoId || periodoId),
      periodId:canonicalPeriodId(row.periodoId || periodoId),
      cedula:normalizeCedula(row.cedula || cedula),
      numeroIdentificacion:normalizeCedula(row.cedula || cedula),
      updatedAt:text(row.updatedAt) || new Date().toISOString()
    });
  }

  function directGet(storeNameValue,key){
    var db = Repos.db && Repos.db();
    if(!db || typeof db.get !== "function" || !text(key)){
      return Promise.resolve(null);
    }
    return Promise.resolve(db.get(storeNameValue,key)).catch(function(error){
      try{ console.warn("[BDLRepoNotas] Lectura directa falló",storeNameValue,error); }catch(innerError){}
      return null;
    });
  }

  function indexedPair(storeNameValue,periodoId,cedula){
    if(!Repos.safeQueryByIndex || !periodoId || !cedula){ return Promise.resolve([]); }
    return Repos.safeQueryByIndex(storeNameValue,"periodo_cedula",[periodoId,cedula]);
  }

  function readStoreRows(storeNameValue,options){
    options = options || {};
    var periodoId = canonicalPeriodId(options.periodoId || options.periodId || "");
    if(periodoId && typeof Repos.safeQueryByIndex === "function"){
      return Repos.safeQueryByIndex(storeNameValue,"periodoId",periodoId).then(function(rows){
        rows = Array.isArray(rows) ? rows : [];
        return rows.length ? rows : Repos.safeGetAll(storeNameValue);
      });
    }
    return Repos.safeGetAll(storeNameValue);
  }

  function list(options){
    options = options || {};
    return readStoreRows(store(),options).then(function(rows){
      rows = applyFilters(rows,options).map(normalize);
      if(rows.length){ return rows; }
      return readStoreRows(legacyStore(),options).then(function(legacyRows){
        return applyFilters(legacyRows,options).map(normalize);
      });
    });
  }

  function getByPeriodoCedula(periodoId,cedula){
    periodoId = canonicalPeriodId(periodoId);
    cedula = normalizeCedula(cedula);
    var id = makeId(periodoId,cedula);
    if(!id){ return Promise.resolve(null); }

    return directGet(store(),id).then(function(row){
      if(row){ return normalize(row); }
      return indexedPair(store(),periodoId,cedula).then(function(rows){
        return rows && rows.length ? normalize(rows[0]) : null;
      });
    }).then(function(row){
      if(row){ return row; }
      return directGet(legacyStore(),id).then(function(legacyRow){
        if(legacyRow){ return normalize(legacyRow); }
        return indexedPair(legacyStore(),periodoId,cedula).then(function(rows){
          return rows && rows.length ? normalize(rows[0]) : null;
        });
      });
    }).then(function(row){
      return row || list({periodoId:periodoId,cedula:cedula}).then(function(rows){ return rows[0] || null; });
    });
  }

  function save(row){
    var item = normalize(row);
    if(!item.idEstudiantePeriodo){ return Promise.reject(new Error("Nota sin identificación y período.")); }
    return Repos.safePut(store(),item);
  }
  function saveMany(rows){
    var items = (Array.isArray(rows) ? rows : []).map(normalize).filter(function(row){ return !!row.idEstudiantePeriodo; });
    return items.length ? Repos.bulkPut(store(),items) : Promise.resolve([]);
  }

  var api = {
    version:VERSION,
    list:list,
    getByPeriodoCedula:getByPeriodoCedula,
    save:save,
    saveMany:saveMany,
    normalize:normalize,
    makeId:makeId
  };
  Repos.register("notas",api);
  Repos.register("notas_titulacion",api);
  window.BDLRepoNotas = api;
})(window);