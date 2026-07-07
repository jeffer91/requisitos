/* =========================================================
Archivo: bdl.repo.contactos.js
Ruta: /BDLocal/repositories/bdl.repo.contactos.js
Función:
- Repositorio de contactos de estudiantes.
- Usar la tabla actual contactos.
- Preparar contactos_estudiante para la migración futura.
Con qué se conecta:
- BDLocal/repositories/bdl.repo.index.js
========================================================= */
(function(window){
  "use strict";

  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }
  function store(){ return Repos.storeName("contactos", "contactos"); }

  function list(options){
    options = options || {};
    return Repos.safeGetAll(store()).then(function(rows){
      rows = Repos.byPeriodo(rows, options.periodoId);
      if(text(options.cedula)){ rows = Repos.byCedula(rows, options.cedula); }
      return rows;
    });
  }

  function getByCedula(cedula, periodoId){
    return list({ cedula: cedula, periodoId: periodoId }).then(function(rows){ return rows[0] || null; });
  }

  function save(row){
    row = Object.assign({}, row || {});
    row.updatedAt = row.updatedAt || new Date().toISOString();
    return Repos.safePut(store(), row);
  }

  var api = { list: list, getByCedula: getByCedula, save: save };
  Repos.register("contactos", api);
  window.BDLRepoContactos = api;
})(window);
