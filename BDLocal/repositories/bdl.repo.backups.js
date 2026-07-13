/* =========================================================
Archivo: bdl.repo.backups.js
Ruta: /BDLocal/repositories/bdl.repo.backups.js
Función:
- Repositorio de respaldos locales.
- Usar la tabla actual backups.
- Preparar consultas por período, scope y tipo.
- Garantizar id compatible con IndexedDB.
Con qué se conecta:
- BDLocal/repositories/bdl.repo.index.js
- BDLocal/bl2.backup.js
========================================================= */
(function(window){
  "use strict";

  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }
  function store(){ return Repos.storeName("backups", "backups"); }

  function make(options){
    options = options || {};
    var id = text(options.id || options.backupId) || "backup_" + Date.now() + "_" + Math.random().toString(16).slice(2);
    return {
      id: id,
      backupId: id,
      scope: text(options.scope || "bdlocal"),
      periodoId: text(options.periodoId || ""),
      tipo: text(options.tipo || options.type || "manual"),
      type: text(options.type || options.tipo || "manual"),
      payload: options.payload || null,
      schemaVersion: text(options.schemaVersion || "1"),
      totalRegistros: Number(options.totalRegistros || options.total || 0),
      origen: text(options.origen || options.source || "local"),
      createdAt: text(options.createdAt || "") || new Date().toISOString(),
      updatedAt: text(options.updatedAt || "") || new Date().toISOString()
    };
  }

  function list(options){
    options = options || {};
    return Repos.safeGetAll(store()).then(function(rows){
      rows = Repos.byPeriodo(rows, options.periodoId);
      if(text(options.scope)){ rows = rows.filter(function(row){ return text(row.scope) === text(options.scope); }); }
      if(text(options.tipo)){ rows = rows.filter(function(row){ return text(row.tipo || row.type) === text(options.tipo); }); }
      return rows.sort(function(a, b){ return text(b.createdAt).localeCompare(text(a.createdAt)); });
    });
  }

  function save(options){
    return Repos.safePut(store(), make(options || {}));
  }

  var api = { make: make, list: list, save: save };
  Repos.register("backups", api);
  window.BDLRepoBackups = api;
})(window);
