/* =========================================================
Archivo: bdl.repo.cambios.js
Ruta: /BDLocal/repositories/bdl.repo.cambios.js
Función:
- Repositorio de cambios pendientes.
- Usar la tabla actual cambios mientras se prepara cambios_pendientes.
- Consultar pendientes por destino: Firebase, Supabase y Google Sheets.
Con qué se conecta:
- BDLocal/repositories/bdl.repo.index.js
- BDLocal/rules/bdl.rules.sync.js
========================================================= */
(function(window){
  "use strict";

  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }
  function store(){ return Repos.storeName("cambios", "cambios"); }

  function normalize(row, options){
    if(window.BDLRulesSync && typeof window.BDLRulesSync.build === "function"){
      return window.BDLRulesSync.build(row || {}, options || {});
    }
    row = Object.assign({}, row || {});
    row.updatedAt = row.updatedAt || new Date().toISOString();
    row.createdAt = row.createdAt || row.updatedAt;
    return row;
  }

  function list(options){
    options = options || {};
    return Repos.safeGetAll(store()).then(function(rows){
      rows = Repos.byPeriodo(rows, options.periodoId);
      if(text(options.cedula)){ rows = Repos.byCedula(rows, options.cedula); }
      if(text(options.tabla)){ rows = rows.filter(function(row){ return text(row.tabla || row.tipo) === text(options.tabla); }); }
      return rows;
    });
  }

  function pending(target, options){
    target = text(target || "").toLowerCase();
    options = options || {};

    return list(options).then(function(rows){
      return rows.filter(function(row){
        if(target === "firebase"){
          return text(row.estadoFirebase || row.statusFirebase || "PENDIENTE") !== "SINCRONIZADO";
        }
        if(target === "supabase"){
          return text(row.estadoSupabase || row.statusSupabase || "PENDIENTE") !== "SINCRONIZADO";
        }
        if(target === "sheets" || target === "google"){
          return text(row.estadoSheets || row.statusGoogle || "PENDIENTE") !== "SINCRONIZADO";
        }
        return true;
      });
    });
  }

  function save(row, options){
    var normalized = normalize(row || {}, options || {});
    return Repos.safePut(store(), normalized);
  }

  function saveMany(rows, options){
    rows = Array.isArray(rows) ? rows : [];
    return Repos.bulkPut(store(), rows.map(function(row){ return normalize(row, options || {}); }));
  }

  var api = { list: list, pending: pending, save: save, saveMany: saveMany, normalize: normalize };
  Repos.register("cambios", api);
  Repos.register("cambios_pendientes", api);
  window.BDLRepoCambios = api;
})(window);
