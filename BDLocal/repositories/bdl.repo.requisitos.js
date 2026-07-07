/* =========================================================
Archivo: bdl.repo.requisitos.js
Ruta: /BDLocal/repositories/bdl.repo.requisitos.js
Función:
- Repositorio de requisitos.
- Usar la tabla actual requisitos mientras se prepara requisitos_estudiante.
- Consultar por período, cédula e idEstudiantePeriodo.
Con qué se conecta:
- BDLocal/repositories/bdl.repo.index.js
- BDLocal/rules/bdl.rules.requisitos.js
========================================================= */
(function(window){
  "use strict";

  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }
  function store(){ return Repos.storeName("requisitos", "requisitos"); }

  function list(options){
    options = options || {};
    return Repos.safeGetAll(store()).then(function(rows){
      rows = Repos.byPeriodo(rows, options.periodoId);
      if(text(options.cedula)){ rows = Repos.byCedula(rows, options.cedula); }
      if(text(options.idEstudiantePeriodo)){
        rows = rows.filter(function(row){ return text(row.idEstudiantePeriodo || row.studentId) === text(options.idEstudiantePeriodo); });
      }
      if(text(options.requisitoKey)){
        rows = rows.filter(function(row){ return text(row.requisitoKey || row.key || row.nombre) === text(options.requisitoKey); });
      }
      return rows;
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

  var api = { list: list, save: save, saveMany: saveMany };
  Repos.register("requisitos", api);
  window.BDLRepoRequisitos = api;
})(window);
