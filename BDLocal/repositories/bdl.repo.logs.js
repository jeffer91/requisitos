/* =========================================================
Archivo: bdl.repo.logs.js
Ruta: /BDLocal/repositories/bdl.repo.logs.js
Función:
- Repositorio de logs técnicos de BDLocal.
- Usar la tabla actual logs.
- Registrar eventos de reglas, servicios, repositorios, sync y migraciones.
Con qué se conecta:
- BDLocal/repositories/bdl.repo.index.js
- BDLocal/diagnostics/bdl.diagnostics.index.js
========================================================= */
(function(window){
  "use strict";

  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }
  function store(){ return Repos.storeName("logs", "logs"); }

  function make(scope, level, message, data){
    return {
      logId: "log_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      scope: text(scope || "BDLocal"),
      level: text(level || "INFO").toUpperCase(),
      message: text(message),
      data: data || null,
      createdAt: new Date().toISOString()
    };
  }

  function list(options){
    options = options || {};
    return Repos.safeGetAll(store()).then(function(rows){
      if(text(options.scope)){ rows = rows.filter(function(row){ return text(row.scope) === text(options.scope); }); }
      if(text(options.level)){ rows = rows.filter(function(row){ return text(row.level) === text(options.level).toUpperCase(); }); }
      return rows.sort(function(a, b){ return text(b.createdAt).localeCompare(text(a.createdAt)); });
    });
  }

  function add(scope, level, message, data){
    var row = make(scope, level, message, data);
    if(window.BDLDiagnostics && typeof window.BDLDiagnostics.add === "function"){
      window.BDLDiagnostics.add(row.scope, row.level, row.message, row.data);
    }
    return Repos.safePut(store(), row).then(function(){ return row; });
  }

  var api = { make: make, list: list, add: add };
  Repos.register("logs", api);
  window.BDLRepoLogs = api;
})(window);
