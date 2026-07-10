/* =========================================================
Nombre completo: bdl.repo.requisitos.js
Ruta o ubicación: /BDLocal/repositories/bdl.repo.requisitos.js
Función o funciones:
- Administrar requisitos_estudiante como fuente principal.
- Usar requisitos legacy solo como fallback.
- Aplicar la regla central de identificación validada.
- Forzar IDs derivados de cedula__periodoId.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.1.0-canonical-local-id";
  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }
  function normalizeKey(value){
    var utils = window.BL2Config && window.BL2Config.utils;
    return utils && typeof utils.normalizeKey === "function"
      ? utils.normalizeKey(value)
      : text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  }
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
  function studentId(periodoId,cedula){
    periodoId = canonicalPeriodId(periodoId);
    cedula = normalizeCedula(cedula);
    return periodoId && cedula ? cedula + "__" + periodoId : "";
  }
  function requirementId(periodoId,cedula,requisitoKey){
    var base = studentId(periodoId,cedula);
    var key = normalizeKey(requisitoKey || "requisito");
    return base && key ? base + "__" + key : "";
  }
  function store(){ return Repos.storeName("requisitosEstudiante","requisitos_estudiante"); }
  function legacyStore(){ return Repos.storeName("requisitos","requisitos"); }

  function normalize(row){
    row = Object.assign({},row || {});
    var periodoId = canonicalPeriodId(row.periodoId || row.periodId || "");
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || "");
    var requisitoKey = normalizeKey(row.requisitoKey || row.key || row.nombre || row.requisitoLabel || "requisito");
    var baseId = studentId(periodoId,cedula);
    var id = requirementId(periodoId,cedula,requisitoKey) || text(row.id || "");
    return Object.assign({},row,{
      id:id,
      idEstudiantePeriodo:baseId,
      studentId:baseId,
      periodoId:periodoId,
      periodId:periodoId,
      cedula:cedula,
      numeroIdentificacion:cedula,
      requisitoKey:requisitoKey,
      estado:text(row.estado || row.valor || row.value || ""),
      valor:text(row.valor || row.value || row.estado || ""),
      updatedAt:text(row.updatedAt) || new Date().toISOString()
    });
  }

  function applyFilters(rows,options){
    options = options || {};
    rows = (rows || []).map(normalize);
    var periodoId = canonicalPeriodId(options.periodoId || "");
    var cedula = normalizeCedula(options.cedula || "");
    var idEstudiantePeriodo = text(options.idEstudiantePeriodo || "");
    var requisitoKey = normalizeKey(options.requisitoKey || "");
    if(periodoId){ rows = rows.filter(function(row){ return row.periodoId === periodoId; }); }
    if(cedula){ rows = rows.filter(function(row){ return row.cedula === cedula; }); }
    if(idEstudiantePeriodo){ rows = rows.filter(function(row){ return row.idEstudiantePeriodo === idEstudiantePeriodo; }); }
    if(requisitoKey){ rows = rows.filter(function(row){ return row.requisitoKey === requisitoKey; }); }
    return rows;
  }

  function list(options){
    options = options || {};
    return Repos.safeGetAll(store()).then(function(rows){
      rows = applyFilters(rows,options);
      if(rows.length){ return rows; }
      return Repos.safeGetAll(legacyStore()).then(function(legacyRows){ return applyFilters(legacyRows,options); });
    });
  }
  function save(row){
    var item = normalize(row);
    if(!item.id){ return Promise.reject(new Error("Requisito sin identificación, período o clave.")); }
    return Repos.safePut(store(),item);
  }
  function saveMany(rows){
    var items = (Array.isArray(rows) ? rows : []).map(normalize).filter(function(row){ return !!row.id; });
    return items.length ? Repos.bulkPut(store(),items) : Promise.resolve([]);
  }

  var api = {version:VERSION,list:list,save:save,saveMany:saveMany,normalize:normalize,studentId:studentId,requirementId:requirementId};
  Repos.register("requisitos",api);
  Repos.register("requisitos_estudiante",api);
  window.BDLRepoRequisitos = api;
})(window);
