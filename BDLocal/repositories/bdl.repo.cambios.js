/* =========================================================
Archivo: bdl.repo.cambios.js
Ruta: /BDLocal/repositories/bdl.repo.cambios.js
Función:
- Repositorio real de cambios_pendientes.
- Lee primero cambios_pendientes y usa cambios legacy solo como fallback.
- Guarda siempre en cambios_pendientes.
========================================================= */
(function(window){
  "use strict";
  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(v){ return String(v == null ? "" : v).trim(); }
  function store(){ return Repos.storeName("cambiosPendientes", "cambios_pendientes"); }
  function legacyStore(){ return Repos.storeName("cambios", "cambios"); }
  function fallbackId(row){
    row = row || {};
    return [text(row.tabla || row.tipo || "registro"), text(row.accion || row.action || "UPSERT"), text(row.periodoId || "global"), text(row.cedula || row.registroId || row.idEstudiantePeriodo || "sin_id"), Date.now(), Math.random().toString(16).slice(2)].join("__");
  }

  function normalize(row, options){
    row = Object.assign({}, row || {});
    options = options || {};
    if(window.BDLRulesSync && typeof window.BDLRulesSync.build === "function"){
      row = window.BDLRulesSync.build(row, options);
    }
    row.id = text(row.id || row.cambioId || fallbackId(row));
    row.cambioId = row.cambioId || row.id;
    row.updatedAt = text(row.updatedAt) || new Date().toISOString();
    row.createdAt = text(row.createdAt) || row.updatedAt;
    return row;
  }

  function applyFilters(rows, options){
    options = options || {};
    rows = Repos.byPeriodo(rows || [], options.periodoId);
    if(text(options.cedula)){ rows = Repos.byCedula(rows, options.cedula); }
    if(text(options.tabla)){ rows = rows.filter(function(row){ return text(row.tabla || row.tipo) === text(options.tabla); }); }
    return rows;
  }

  function list(options){
    options = options || {};
    return Repos.safeGetAll(store()).then(function(rows){
      rows = applyFilters(rows, options);
      if(rows.length){ return rows; }
      return Repos.safeGetAll(legacyStore()).then(function(legacyRows){ return applyFilters(legacyRows, options); });
    });
  }

  function pending(target, options){
    target = text(target || "").toLowerCase();
    return list(options || {}).then(function(rows){
      return rows.filter(function(row){
        if(target === "firebase"){ return text(row.estadoFirebase || row.statusFirebase || "PENDIENTE") !== "SINCRONIZADO"; }
        if(target === "supabase"){ return text(row.estadoSupabase || row.statusSupabase || "PENDIENTE") !== "SINCRONIZADO"; }
        if(target === "sheets" || target === "google"){ return text(row.estadoSheets || row.statusGoogle || "PENDIENTE") !== "SINCRONIZADO"; }
        return true;
      });
    });
  }

  function save(row, options){ var item = normalize(row || {}, options || {}); if(!item.id){ return Promise.reject(new Error("Cambio sin id.")); } return Repos.safePut(store(), item); }
  function saveMany(rows, options){ return Repos.bulkPut(store(), (rows || []).map(function(row){ return normalize(row, options || {}); }).filter(function(row){ return !!row.id; })); }

  var api = { list:list, pending:pending, save:save, saveMany:saveMany, normalize:normalize };
  Repos.register("cambios", api);
  Repos.register("cambios_pendientes", api);
  window.BDLRepoCambios = api;
})(window);
