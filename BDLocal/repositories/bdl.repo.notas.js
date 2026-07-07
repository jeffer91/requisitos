/* =========================================================
Archivo: bdl.repo.notas.js
Ruta: /BDLocal/repositories/bdl.repo.notas.js
Función:
- Repositorio real de notas_titulacion.
- Lee primero notas_titulacion y usa notas legacy solo como fallback.
- Guarda en la tabla nueva por idEstudiantePeriodo.
========================================================= */
(function(window){
  "use strict";
  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(v){ return String(v == null ? "" : v).trim(); }
  function store(){ return Repos.storeName("notasTitulacion", "notas_titulacion"); }
  function legacyStore(){ return Repos.storeName("notas", "notas"); }
  function makeId(periodoId, cedula){ periodoId = text(periodoId); cedula = text(cedula); return periodoId && cedula ? periodoId + "__" + cedula : ""; }

  function applyFilters(rows, options){
    options = options || {};
    rows = Repos.byPeriodo(rows || [], options.periodoId);
    if(text(options.cedula)){ rows = Repos.byCedula(rows, options.cedula); }
    if(text(options.idEstudiantePeriodo)){ rows = rows.filter(function(row){ return text(row.idEstudiantePeriodo || row.studentId) === text(options.idEstudiantePeriodo); }); }
    return rows;
  }

  function normalize(row){
    row = Object.assign({}, row || {});
    row.periodoId = text(row.periodoId || "");
    row.cedula = text(row.cedula || "");
    row.idEstudiantePeriodo = text(row.idEstudiantePeriodo || row.studentId || row.id || makeId(row.periodoId, row.cedula));
    if(window.BDLRulesNotas && typeof window.BDLRulesNotas.build === "function"){
      var built = window.BDLRulesNotas.build(row, { periodoId: row.periodoId, cedula: row.cedula });
      row = Object.assign({}, built, { idEstudiantePeriodo: built.idEstudiantePeriodo || row.idEstudiantePeriodo });
    }
    row.idEstudiantePeriodo = text(row.idEstudiantePeriodo || row.studentId || makeId(row.periodoId, row.cedula));
    row.updatedAt = text(row.updatedAt) || new Date().toISOString();
    return row;
  }

  function list(options){
    options = options || {};
    return Repos.safeGetAll(store()).then(function(rows){
      rows = applyFilters(rows, options);
      if(rows.length){ return rows; }
      return Repos.safeGetAll(legacyStore()).then(function(legacyRows){ return applyFilters(legacyRows, options); });
    });
  }

  function getByPeriodoCedula(periodoId, cedula){ return list({ periodoId:periodoId, cedula:cedula }).then(function(rows){ return rows[0] || null; }); }
  function save(row){ var item = normalize(row); if(!item.idEstudiantePeriodo){ return Promise.reject(new Error("Nota sin idEstudiantePeriodo.")); } return Repos.safePut(store(), item); }
  function saveMany(rows){ return Repos.bulkPut(store(), (rows || []).map(normalize).filter(function(row){ return !!row.idEstudiantePeriodo; })); }

  var api = { list:list, getByPeriodoCedula:getByPeriodoCedula, save:save, saveMany:saveMany, normalize:normalize };
  Repos.register("notas", api);
  Repos.register("notas_titulacion", api);
  window.BDLRepoNotas = api;
})(window);
