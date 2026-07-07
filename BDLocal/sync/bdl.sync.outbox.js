/* =========================================================
Archivo: bdl.sync.outbox.js
Ruta: /BDLocal/sync/bdl.sync.outbox.js
Función:
- Leer la cola de cambios pendientes desde BDLocal/cambios.
- Separar pendientes por destino: Google Sheets, Firebase y Supabase.
- Marcar cambios como sincronizados o con error por destino sin borrar registros.
- Servir de base para el orquestador de sincronización nueva.
Con qué se conecta:
- BDLocal/repositories/bdl.repo.cambios.js
- BDLocal/sync/bdl.sync.index.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.1.0-block9";

  function text(value){ return String(value == null ? "" : value).trim(); }
  function upper(value){ return text(value).toUpperCase(); }

  function repo(){
    if(window.BDLRepositories && typeof window.BDLRepositories.get === "function"){
      return window.BDLRepositories.get("cambios") || window.BDLRepositories.get("cambios_pendientes");
    }
    return window.BDLRepoCambios || null;
  }

  function isDone(row, target){
    row = row || {};
    target = text(target).toLowerCase();

    if(target === "google" || target === "sheets"){
      return upper(row.estadoSheets || row.statusGoogle) === "SINCRONIZADO";
    }
    if(target === "firebase"){
      return upper(row.estadoFirebase || row.statusFirebase) === "SINCRONIZADO";
    }
    if(target === "supabase"){
      return upper(row.estadoSupabase || row.statusSupabase) === "SINCRONIZADO";
    }
    return false;
  }

  function list(options){
    options = options || {};
    var cambios = repo();
    if(!cambios || typeof cambios.list !== "function"){
      return Promise.resolve([]);
    }
    return cambios.list(options).then(function(rows){
      return Array.isArray(rows) ? rows : [];
    });
  }

  function pending(target, options){
    target = text(target || "google").toLowerCase();
    options = options || {};
    var limit = Number(options.limit || 0);

    return list(options).then(function(rows){
      rows = rows.filter(function(row){ return !isDone(row, target); });
      rows.sort(function(a, b){
        var pa = Number(a.prioridad || 5);
        var pb = Number(b.prioridad || 5);
        if(pa !== pb){ return pa - pb; }
        return text(a.createdAt).localeCompare(text(b.createdAt));
      });
      return limit > 0 ? rows.slice(0, limit) : rows;
    });
  }

  function counts(options){
    options = options || {};
    return list(options).then(function(rows){
      var result = {
        total: rows.length,
        google: 0,
        firebase: 0,
        supabase: 0,
        syncedGoogle: 0,
        syncedFirebase: 0,
        syncedSupabase: 0
      };

      rows.forEach(function(row){
        if(isDone(row, "google")){ result.syncedGoogle++; } else { result.google++; }
        if(isDone(row, "firebase")){ result.syncedFirebase++; } else { result.firebase++; }
        if(isDone(row, "supabase")){ result.syncedSupabase++; } else { result.supabase++; }
      });

      return result;
    });
  }

  function patchForTarget(row, target, status, details){
    row = Object.assign({}, row || {});
    target = text(target).toLowerCase();
    status = upper(status || "SINCRONIZADO");
    details = details || {};

    row.updatedAt = new Date().toISOString();

    if(target === "google" || target === "sheets"){
      row.estadoSheets = status;
      row.statusGoogle = status;
      row.sincronizadoEnSheets = status === "SINCRONIZADO" ? row.updatedAt : text(row.sincronizadoEnSheets || "");
      row.ultimoErrorSheets = status === "ERROR" ? text(details.error || details.message || "Error Google Sheets") : "";
      row.intentosSheets = Number(row.intentosSheets || 0) + (status === "ERROR" ? 1 : 0);
    }

    if(target === "firebase"){
      row.estadoFirebase = status;
      row.statusFirebase = status;
      row.sincronizadoEnFirebase = status === "SINCRONIZADO" ? row.updatedAt : text(row.sincronizadoEnFirebase || "");
      row.ultimoErrorFirebase = status === "ERROR" ? text(details.error || details.message || "Error Firebase") : "";
      row.intentosFirebase = Number(row.intentosFirebase || 0) + (status === "ERROR" ? 1 : 0);
    }

    if(target === "supabase"){
      row.estadoSupabase = status;
      row.sincronizadoEnSupabase = status === "SINCRONIZADO" ? row.updatedAt : text(row.sincronizadoEnSupabase || "");
      row.ultimoErrorSupabase = status === "ERROR" ? text(details.error || details.message || "Error Supabase") : "";
      row.intentosSupabase = Number(row.intentosSupabase || 0) + (status === "ERROR" ? 1 : 0);
    }

    return row;
  }

  function mark(rows, target, status, details){
    rows = Array.isArray(rows) ? rows : [];
    var cambios = repo();
    if(!cambios || typeof cambios.saveMany !== "function"){
      return Promise.resolve({ ok:false, updated:0, message:"Repositorio cambios no disponible." });
    }

    var patched = rows.map(function(row){ return patchForTarget(row, target, status, details || {}); });
    return cambios.saveMany(patched).then(function(){
      return { ok:true, updated:patched.length, target:target, status:upper(status || "SINCRONIZADO") };
    });
  }

  var api = {
    version: VERSION,
    list: list,
    pending: pending,
    counts: counts,
    mark: mark,
    markSynced: function(rows, target, details){ return mark(rows, target, "SINCRONIZADO", details || {}); },
    markError: function(rows, target, details){ return mark(rows, target, "ERROR", details || {}); }
  };

  window.BDLSyncOutbox = api;
})(window);
