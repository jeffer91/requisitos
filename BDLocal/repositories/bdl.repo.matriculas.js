/* =========================================================
Archivo: bdl.repo.matriculas.js
Ruta: /BDLocal/repositories/bdl.repo.matriculas.js
Función:
- Repositorio real de matriculas_periodo.
- Lee primero matriculas_periodo y usa estudiantes solo como fallback.
- Mantiene idEstudiantePeriodo como llave central.
========================================================= */
(function(window){
  "use strict";
  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(v){ return String(v == null ? "" : v).trim(); }
  function store(){ return Repos.storeName("matriculasPeriodo", "matriculas_periodo"); }
  function legacy(){ return Repos.get("estudiantes") || window.BDLRepoEstudiantesV2 || null; }
  function makeId(periodoId, cedula){ periodoId = text(periodoId); cedula = text(cedula); return periodoId && cedula ? periodoId + "__" + cedula : ""; }

  function normalize(row, context){
    row = row || {}; context = context || {};
    if(window.BDLRulesMatricula && typeof window.BDLRulesMatricula.buildMatricula === "function"){
      return window.BDLRulesMatricula.buildMatricula(row, context);
    }
    var periodoId = text(row.periodoId || row.periodId || context.periodoId);
    var cedula = text(row.cedula || row._cedula || row.numeroIdentificacion || row.NumeroIdentificacion);
    return {
      idEstudiantePeriodo: text(row.idEstudiantePeriodo || row.studentId || makeId(periodoId, cedula)),
      periodoId: periodoId,
      cedula: cedula,
      carrera: text(row.carrera || row.NombreCarrera || row.nombreCarrera),
      nombreCarrera: text(row.nombreCarrera || row.NombreCarrera || row.carrera),
      sede: text(row.sede || row.Sede),
      division: text(row.division || row._division),
      estadoMatricula: text(row.estadoMatricula || "ACTIVO"),
      updatedAt: text(row.updatedAt) || new Date().toISOString(),
      origen: text(row.origen || "matriculas_periodo")
    };
  }

  function applyFilters(rows, options){
    options = options || {};
    rows = Repos.byPeriodo(rows || [], options.periodoId);
    if(text(options.cedula)){ rows = Repos.byCedula(rows, options.cedula); }
    if(text(options.idEstudiantePeriodo)){ rows = rows.filter(function(row){ return text(row.idEstudiantePeriodo) === text(options.idEstudiantePeriodo); }); }
    if(text(options.division)){ rows = rows.filter(function(row){ return text(row.division) === text(options.division); }); }
    if(text(options.carrera)){ rows = rows.filter(function(row){ return text(row.carrera || row.nombreCarrera) === text(options.carrera); }); }
    return rows;
  }

  function legacyList(options){
    var repo = legacy();
    if(!repo){ return Promise.resolve([]); }
    return repo.list(options || {}).then(function(rows){ return (rows || []).map(function(row){ return normalize(row, options); }).filter(function(row){ return !!row.idEstudiantePeriodo; }); });
  }

  function list(options){
    options = options || {};
    return Repos.safeGetAll(store()).then(function(rows){
      rows = applyFilters(Array.isArray(rows) ? rows : [], options);
      return rows.length ? rows : legacyList(options);
    });
  }

  function page(options){ return list(options || {}).then(function(rows){ return Repos.paginate(rows, options || {}); }); }
  function getById(id){ return list({ idEstudiantePeriodo:id }).then(function(rows){ return rows[0] || null; }); }
  function getByPeriodoCedula(periodoId, cedula){ return getById(makeId(periodoId, cedula)); }
  function save(row){ var item = normalize(row); if(!item.idEstudiantePeriodo){ return Promise.reject(new Error("Matricula sin idEstudiantePeriodo.")); } return Repos.safePut(store(), item); }
  function saveMany(rows){ return Repos.bulkPut(store(), (rows || []).map(normalize).filter(function(row){ return !!row.idEstudiantePeriodo; })); }

  var api = { list:list, page:page, getById:getById, getByPeriodoCedula:getByPeriodoCedula, save:save, saveMany:saveMany, normalize:normalize, legacyList:legacyList };
  Repos.register("matriculas", api);
  Repos.register("matriculas_periodo", api);
  window.BDLRepoMatriculas = api;
})(window);
