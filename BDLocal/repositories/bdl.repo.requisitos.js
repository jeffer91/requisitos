/* =========================================================
Archivo: bdl.repo.requisitos.js
Ruta: /BDLocal/repositories/bdl.repo.requisitos.js
Función:
- Repositorio real de requisitos_estudiante.
- Lee primero requisitos_estudiante y usa requisitos legacy solo como fallback.
========================================================= */
(function(window){
  "use strict";
  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(v){ return String(v == null ? "" : v).trim(); }
  function store(){ return Repos.storeName("requisitosEstudiante", "requisitos_estudiante"); }
  function legacyStore(){ return Repos.storeName("requisitos", "requisitos"); }

  function applyFilters(rows, options){
    options = options || {};
    rows = Repos.byPeriodo(rows || [], options.periodoId);
    if(text(options.cedula)){ rows = Repos.byCedula(rows, options.cedula); }
    if(text(options.idEstudiantePeriodo)){ rows = rows.filter(function(row){ return text(row.idEstudiantePeriodo || row.studentId) === text(options.idEstudiantePeriodo); }); }
    if(text(options.requisitoKey)){ rows = rows.filter(function(row){ return text(row.requisitoKey || row.key || row.nombre) === text(options.requisitoKey); }); }
    return rows;
  }

  function normalize(row){
    row = Object.assign({}, row || {});
    row.id = text(row.id || ((row.idEstudiantePeriodo || row.studentId || "") + "__" + (row.requisitoKey || row.key || row.nombre || "requisito")));
    row.idEstudiantePeriodo = text(row.idEstudiantePeriodo || row.studentId || "");
    row.requisitoKey = text(row.requisitoKey || row.key || row.nombre || "requisito");
    row.estado = text(row.estado || row.valor || row.value || "");
    row.valor = text(row.valor || row.value || row.estado || "");
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

  function save(row){ var item = normalize(row); if(!item.id){ return Promise.reject(new Error("Requisito sin id.")); } return Repos.safePut(store(), item); }
  function saveMany(rows){ return Repos.bulkPut(store(), (rows || []).map(normalize).filter(function(row){ return !!row.id; })); }

  var api = { list:list, save:save, saveMany:saveMany, normalize:normalize };
  Repos.register("requisitos", api);
  Repos.register("requisitos_estudiante", api);
  window.BDLRepoRequisitos = api;
})(window);
