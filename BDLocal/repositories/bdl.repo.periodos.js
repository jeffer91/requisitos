/* =========================================================
Archivo: bdl.repo.periodos.js
Ruta: /BDLocal/repositories/bdl.repo.periodos.js
Función:
- Repositorio de períodos.
- Leer y guardar períodos desde la tabla actual periodos.
- Mantener una API simple para servicios futuros.
Con qué se conecta:
- BDLocal/repositories/bdl.repo.index.js
- BDLocal/bl2.db.js
========================================================= */
(function(window){
  "use strict";

  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function store(){ return Repos.storeName("periodos", "periodos"); }

  function list(){
    return Repos.safeGetAll(store());
  }

  function getById(periodoId){
    return list().then(function(rows){
      return rows.find(function(row){ return String(row.id || row.periodoId || "") === String(periodoId || ""); }) || null;
    });
  }

  function save(periodo){
    periodo = Object.assign({}, periodo || {});
    if(!periodo.id && periodo.periodoId){ periodo.id = periodo.periodoId; }
    if(!periodo.periodoId && periodo.id){ periodo.periodoId = periodo.id; }
    periodo.updatedAt = periodo.updatedAt || new Date().toISOString();
    return Repos.safePut(store(), periodo);
  }

  var api = { list: list, getById: getById, save: save };
  Repos.register("periodos", api);
  window.BDLRepoPeriodos = api;
})(window);
