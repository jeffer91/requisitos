/* =========================================================
Archivo: bdl.repo.notas.js
Ruta: /BDLocal/repositories/bdl.repo.notas.js
Función:
- Repositorio de notas de titulación/defensas.
- Usar la tabla actual notas mientras se prepara notas_titulacion.
- Consultar y guardar notas por periodoId + cedula.
- Garantizar id compatible con IndexedDB.
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
  function makeId(periodoId, cedula){
    periodoId = text(periodoId);
    cedula = text(cedula);
    return periodoId && cedula ? periodoId + "__" + cedula : "";
  }

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
    row = Object.assign({}, row || {});
    row.periodoId = text(row.periodoId || "");
    row.cedula = text(row.cedula || "");
    row.idEstudiantePeriodo = text(row.idEstudiantePeriodo || row.studentId || makeId(row.periodoId, row.cedula));
    row.id = text(row.id || row.notaId || row.idEstudiantePeriodo);

    if(window.BDLRulesNotas && typeof window.BDLRulesNotas.build === "function"){
      row = window.BDLRulesNotas.build(row, { periodoId: row.periodoId, cedula: row.cedula });
    }

    row.id = text(row.id || row.notaId || row.idEstudiantePeriodo || makeId(row.periodoId, row.cedula));
    row.notaId = row.notaId || row.id;
    row.studentId = row.studentId || row.idEstudiantePeriodo || row.id;
    row.updatedAt = row.updatedAt || new Date().toISOString();
    return row;
  }

  function save(row){
    var normalized = normalize(row || {});
    if(!normalized.id){ return Promise.reject(new Error("No se pudo guardar nota sin id.")); }
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
