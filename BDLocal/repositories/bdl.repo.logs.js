/* =========================================================
Archivo: bdl.repo.logs.js
Ruta: /BDLocal/repositories/bdl.repo.logs.js
Función:
- Repositorio de logs técnicos de BDLocal.
- Usar la tabla actual logs.
- Registrar eventos de reglas, servicios, repositorios, sync y migraciones.
- Garantizar id compatible con IndexedDB.
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
    var id = "log_" + Date.now() + "_" + Math.random().toString(16).slice(2);
    return {
      id: id,
      logId: id,
      scope: text(scope || "BDLocal"),
      level: text(level || "INFO").toUpperCase(),
      message: text(message),
      data: data || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function normalize(row){
    row = Object.assign({}, row || {});
    row.id = text(row.id || row.logId) || "log_" + Date.now() + "_" + Math.random().toString(16).slice(2);
    row.logId = row.logId || row.id;
    row.scope = text(row.scope || "BDLocal");
    row.level = text(row.level || "INFO").toUpperCase();
    row.message = text(row.message || "");
    row.createdAt = text(row.createdAt || "") || new Date().toISOString();
    row.updatedAt = text(row.updatedAt || "") || row.createdAt;
    return row;
  }

  function list(options){
    options = options || {};
    return Repos.safeGetAll(store()).then(function(rows){
      if(text(options.scope)){ rows = rows.filter(function(row){ return text(row.scope) === text(options.scope); }); }
      if(text(options.level)){ rows = rows.filter(function(row){ return text(row.level) === text(options.level).toUpperCase(); }); }
      return rows.sort(function(a, b){ return text(b.createdAt).localeCompare(text(a.createdAt)); });
    });
  }

  function save(row){
    return Repos.safePut(store(), normalize(row || {}));
  }

  function add(scope, level, message, data){
    var row = make(scope, level, message, data);
    if(window.BDLDiagnostics && typeof window.BDLDiagnostics.add === "function"){
      window.BDLDiagnostics.add(row.scope, row.level, row.message, row.data);
    }
    return save(row).then(function(){ return row; });
  }

  var api = { make: make, normalize: normalize, list: list, save: save, add: add };
  Repos.register("logs", api);
  window.BDLRepoLogs = api;
})(window);
