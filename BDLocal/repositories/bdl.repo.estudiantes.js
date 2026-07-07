/* =========================================================
Archivo: bdl.repo.estudiantes.js
Ruta: /BDLocal/repositories/bdl.repo.estudiantes.js
Función:
- Repositorio compatible de estudiantes actuales.
- Seguir usando la tabla estudiantes mientras llega la migración a personas/matriculas_periodo.
- Proveer filtros básicos por período, cédula y paginación.
Con qué se conecta:
- BDLocal/repositories/bdl.repo.index.js
- BDLocal/bl2.db.js
========================================================= */
(function(window){
  "use strict";

  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }
  function store(){ return Repos.storeName("estudiantes", "estudiantes"); }

  function list(options){
    options = options || {};
    return Repos.safeGetAll(store()).then(function(rows){
      rows = Repos.byPeriodo(rows, options.periodoId);
      if(text(options.cedula)){ rows = Repos.byCedula(rows, options.cedula); }
      return rows;
    });
  }

  function page(options){
    return list(options || {}).then(function(rows){
      return Repos.paginate(rows, options || {});
    });
  }

  function getByPeriodoCedula(periodoId, cedula){
    return list({ periodoId: periodoId, cedula: cedula }).then(function(rows){
      return rows[0] || null;
    });
  }

  function save(row){
    row = Object.assign({}, row || {});
    row.updatedAt = row.updatedAt || new Date().toISOString();
    return Repos.safePut(store(), row);
  }

  function saveMany(rows){
    rows = Array.isArray(rows) ? rows : [];
    return Repos.bulkPut(store(), rows.map(function(row){
      row = Object.assign({}, row || {});
      row.updatedAt = row.updatedAt || new Date().toISOString();
      return row;
    }));
  }

  var api = {
    list: list,
    page: page,
    getByPeriodoCedula: getByPeriodoCedula,
    save: save,
    saveMany: saveMany
  };

  Repos.register("estudiantes", api);
  window.BDLRepoEstudiantesV2 = api;
})(window);
