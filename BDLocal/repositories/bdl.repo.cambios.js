/* =========================================================
Archivo: bdl.repo.cambios.js
Ruta: /BDLocal/repositories/bdl.repo.cambios.js
Funcion:
- Repositorio real de cambios_pendientes.
- Lee cambios_pendientes y cambios legacy, unificando sin duplicar.
- Guarda siempre en cambios_pendientes.
- Evita que cambios antiguos queden invisibles para la sincronizacion nueva.
========================================================= */
(function(window){
  "use strict";
  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(v){ return String(v == null ? "" : v).trim(); }
  function nowISO(){ return new Date().toISOString(); }
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
    row.updatedAt = text(row.updatedAt) || nowISO();
    row.createdAt = text(row.createdAt) || row.updatedAt;
    return row;
  }

  function keyOf(row){
    row = row || {};
    return text(row.id || row.cambioId || [
      row.tabla || row.tipo || "registro",
      row.accion || row.action || "UPSERT",
      row.periodoId || "global",
      row.cedula || row.registroId || row.idEstudiantePeriodo || row.studentId || "sin_id",
      row.createdAt || ""
    ].join("__"));
  }

  function mergeRows(outboxRows, legacyRows){
    var map = Object.create(null);
    var merged = [];

    function push(row, source){
      row = Object.assign({}, row || {});
      var key = keyOf(row);
      if(!key){ return; }
      if(map[key]){ return; }
      row._repoCambiosSource = row._repoCambiosSource || source;
      map[key] = true;
      merged.push(row);
    }

    (Array.isArray(outboxRows) ? outboxRows : []).forEach(function(row){ push(row, "cambios_pendientes"); });
    (Array.isArray(legacyRows) ? legacyRows : []).forEach(function(row){ push(row, "cambios_legacy"); });

    merged.sort(function(a, b){ return text(a.createdAt).localeCompare(text(b.createdAt)); });
    return merged;
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
    return Promise.all([
      Repos.safeGetAll(store()).catch(function(){ return []; }),
      Repos.safeGetAll(legacyStore()).catch(function(){ return []; })
    ]).then(function(values){
      return applyFilters(mergeRows(values[0], values[1]), options);
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

  var api = { list:list, pending:pending, save:save, saveMany:saveMany, normalize:normalize, mergeRows:mergeRows };
  Repos.register("cambios", api);
  Repos.register("cambios_pendientes", api);
  window.BDLRepoCambios = api;
})(window);
