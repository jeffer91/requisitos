/* =========================================================
Archivo: bdl.repo.notas.js
Ruta: /BDLocal/repositories/bdl.repo.notas.js
Función:
- Repositorio de notas de titulación/defensas.
- Usar la tabla actual notas mientras se prepara notas_titulacion.
- Consultar y guardar notas por periodoId + cedula.
Con qué se conecta:
- BDLocal/repositories/bdl.repo.index.js
- BDLocal/rules/bdl.rules.notas.js
========================================================= */
(function(window){
  "use strict";

  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }
  function store(){ return Repos.storeName("notas", "notas"); }

  function list(options){
    options = options || {};
    return Repos.safeGetAll(store()).then(function(rows){
      rows = Repos.byPeriodo(rows, options.periodoId);
      if(text(options.cedula)){ rows = Repos.byCedula(rows, options.cedula); }
      if(text(options.idEstudiantePeriodo)){
        rows = rows.filter(function(row){ return text(row.idEstudiantePeriodo || row.studentId) === text(options.idEstudiantePeriodo); });
      }
      return rows;
    });
  }

  function getByPeriodoCedula(periodoId, cedula){
    return list({ periodoId: periodoId, cedula: cedula }).then(function(rows){ return rows[0] || null; });
  }

  function normalize(row){
    if(window.BDLRulesNotas && typeof window.BDLRulesNotas.build === "function"){
      return window.BDLRulesNotas.build(row || {}, { periodoId: row && row.periodoId });
    }
    row = Object.assign({}, row || {});
    row.updatedAt = row.updatedAt || new Date().toISOString();
    return row;
  }

  function save(row){
    var normalized = normalize(row || {});
    normalized.updatedAt = normalized.updatedAt || new Date().toISOString();
    return Repos.safePut(store(), normalized);
  }

  function saveMany(rows){
    rows = Array.isArray(rows) ? rows : [];
    return Repos.bulkPut(store(), rows.map(normalize));
  }

  var api = { list: list, getByPeriodoCedula: getByPeriodoCedula, save: save, saveMany: saveMany, normalize: normalize };
  Repos.register("notas", api);
  window.BDLRepoNotas = api;
})(window);
