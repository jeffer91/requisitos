/* =========================================================
Nombre completo: bdl.repo.notas.js
Ruta o ubicación: /BDLocal/repositories/bdl.repo.notas.js
Función o funciones:
- Administrar notas_titulacion como fuente principal.
- Usar notas legacy solo como fallback.
- Aplicar la regla central de identificación validada.
- Forzar idEstudiantePeriodo = cedula__periodoId.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.1.0-canonical-local-id";
  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }
  function normalizeCedula(value){
    var rules = window.BDLRulesPersona;
    if(rules && typeof rules.normalizeCedula === "function"){ return rules.normalizeCedula(value); }
    var utils = window.BL2Config && window.BL2Config.utils;
    return utils && typeof utils.normalizeCedula === "function" ? utils.normalizeCedula(value) : text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
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
    if(text(options.idEstudiantePeriodo)){ rows = rows.filter(function(row){ return text(row.idEstudiantePeriodo || row.studentId) === text(options.idEstudiantePeriodo); }); }
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

  function list(options){
    options = options || {};
    return Repos.safeGetAll(store()).then(function(rows){
      rows = applyFilters(rows,options).map(normalize);
      if(rows.length){ return rows; }
      return Repos.safeGetAll(legacyStore()).then(function(legacyRows){ return applyFilters(legacyRows,options).map(normalize); });
    });
  }
  function getByPeriodoCedula(periodoId,cedula){ return list({periodoId:periodoId,cedula:cedula}).then(function(rows){ return rows[0] || null; }); }
  function save(row){
    var item = normalize(row);
    if(!item.idEstudiantePeriodo){ return Promise.reject(new Error("Nota sin identificación y período.")); }
    return Repos.safePut(store(),item);
  }
  function saveMany(rows){
    var items = (Array.isArray(rows) ? rows : []).map(normalize).filter(function(row){ return !!row.idEstudiantePeriodo; });
    return items.length ? Repos.bulkPut(store(),items) : Promise.resolve([]);
  }

  var api = {version:VERSION,list:list,getByPeriodoCedula:getByPeriodoCedula,save:save,saveMany:saveMany,normalize:normalize,makeId:makeId};
  Repos.register("notas",api);
  Repos.register("notas_titulacion",api);
  window.BDLRepoNotas = api;
})(window);
