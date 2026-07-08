/* =========================================================
Archivo: bdl.sync.outbox.js
Ruta: /BDLocal/sync/bdl.sync.outbox.js
Función:
- Leer la cola de cambios pendientes desde BDLocal/cambios_pendientes.
- Separar pendientes por destino: Google Sheets, Firebase y Supabase.
- Marcar cambios como sincronizados o con error por destino sin borrar registros.
- Controlar reintentos, espera antes de reintentar y bloqueo por demasiados errores.
- Servir de base para el orquestador de sincronización nueva.
Con qué se conecta:
- BDLocal/repositories/bdl.repo.cambios.js
- BDLocal/sync/bdl.sync.index.js
- BDLocal/sync/bdl.sync.orchestrator.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.2.0-block25";
  var DEFAULT_MAX_ATTEMPTS = 3;
  var DEFAULT_RETRY_MINUTES = [2, 5, 15, 30, 60];

  function text(value){ return String(value == null ? "" : value).trim(); }
  function upper(value){ return text(value).toUpperCase(); }
  function nowISO(){ return new Date().toISOString(); }
  function nowMs(){ return Date.now(); }

  function repo(){
    if(window.BDLRepositories && typeof window.BDLRepositories.get === "function"){
      return window.BDLRepositories.get("cambios") || window.BDLRepositories.get("cambios_pendientes");
    }
    return window.BDLRepoCambios || null;
  }

  function fields(target){
    target = text(target).toLowerCase();
    if(target === "google" || target === "sheets"){
      return { status:"estadoSheets", legacyStatus:"statusGoogle", syncedAt:"sincronizadoEnSheets", error:"ultimoErrorSheets", attempts:"intentosSheets", nextRetryAt:"nextRetryAtSheets", blocked:"bloqueadoSheets" };
    }
    if(target === "firebase"){
      return { status:"estadoFirebase", legacyStatus:"statusFirebase", syncedAt:"sincronizadoEnFirebase", error:"ultimoErrorFirebase", attempts:"intentosFirebase", nextRetryAt:"nextRetryAtFirebase", blocked:"bloqueadoFirebase" };
    }
    if(target === "supabase"){
      return { status:"estadoSupabase", legacyStatus:"statusSupabase", syncedAt:"sincronizadoEnSupabase", error:"ultimoErrorSupabase", attempts:"intentosSupabase", nextRetryAt:"nextRetryAtSupabase", blocked:"bloqueadoSupabase" };
    }
    return { status:"estado" + target, legacyStatus:"status" + target, syncedAt:"sincronizadoEn" + target, error:"ultimoError" + target, attempts:"intentos" + target, nextRetryAt:"nextRetryAt" + target, blocked:"bloqueado" + target };
  }

  function statusOf(row, target){
    var f = fields(target);
    return upper((row || {})[f.status] || (row || {})[f.legacyStatus]);
  }

  function attemptsOf(row, target){
    var f = fields(target);
    return Number((row || {})[f.attempts] || 0);
  }

  function isDone(row, target){ return statusOf(row, target) === "SINCRONIZADO"; }
  function isError(row, target){ return statusOf(row, target) === "ERROR"; }
  function isBlocked(row, target, options){
    options = options || {};
    if(options.forceRetry || options.includeBlocked){ return false; }
    var f = fields(target);
    var maxAttempts = Number(options.maxAttempts || DEFAULT_MAX_ATTEMPTS);
    if((row || {})[f.blocked] === true){ return true; }
    return isError(row, target) && attemptsOf(row, target) >= maxAttempts;
  }

  function retryDue(row, target, options){
    options = options || {};
    if(options.forceRetry){ return true; }
    var f = fields(target);
    var next = text((row || {})[f.nextRetryAt]);
    if(!next){ return true; }
    var t = new Date(next).getTime();
    if(!Number.isFinite(t)){ return true; }
    return t <= nowMs();
  }

  function retryMinutes(attempts){
    attempts = Math.max(1, Number(attempts || 1));
    return DEFAULT_RETRY_MINUTES[Math.min(DEFAULT_RETRY_MINUTES.length - 1, attempts - 1)] || 60;
  }

  function list(options){
    options = options || {};
    var cambios = repo();
    if(!cambios || typeof cambios.list !== "function"){
      return Promise.resolve([]);
    }
    return cambios.list(options).then(function(rows){ return Array.isArray(rows) ? rows : []; });
  }

  function pending(target, options){
    target = text(target || "google").toLowerCase();
    options = options || {};
    var limit = Number(options.limit || 0);

    return list(options).then(function(rows){
      rows = rows.filter(function(row){
        if(isDone(row, target)){ return false; }
        if(isBlocked(row, target, options)){ return false; }
        if(!retryDue(row, target, options)){ return false; }
        return true;
      });
      rows.sort(function(a, b){
        var pa = Number(a.prioridad || 5);
        var pb = Number(b.prioridad || 5);
        if(pa !== pb){ return pa - pb; }
        return text(a.createdAt).localeCompare(text(b.createdAt));
      });
      return limit > 0 ? rows.slice(0, limit) : rows;
    });
  }

  function targetCounts(rows, target){
    var result = { pending:0, synced:0, error:0, blocked:0, waitingRetry:0 };
    rows.forEach(function(row){
      if(isDone(row, target)){ result.synced++; return; }
      if(isBlocked(row, target, {})){ result.blocked++; return; }
      if(!retryDue(row, target, {})){ result.waitingRetry++; return; }
      if(isError(row, target)){ result.error++; }
      result.pending++;
    });
    return result;
  }

  function counts(options){
    options = options || {};
    return list(options).then(function(rows){
      var google = targetCounts(rows, "google");
      var firebase = targetCounts(rows, "firebase");
      var supabase = targetCounts(rows, "supabase");
      return {
        total: rows.length,
        google: google.pending,
        firebase: firebase.pending,
        supabase: supabase.pending,
        syncedGoogle: google.synced,
        syncedFirebase: firebase.synced,
        syncedSupabase: supabase.synced,
        errorsGoogle: google.error,
        errorsFirebase: firebase.error,
        errorsSupabase: supabase.error,
        blockedGoogle: google.blocked,
        blockedFirebase: firebase.blocked,
        blockedSupabase: supabase.blocked,
        waitingRetryGoogle: google.waitingRetry,
        waitingRetryFirebase: firebase.waitingRetry,
        waitingRetrySupabase: supabase.waitingRetry,
        detail: { google:google, firebase:firebase, supabase:supabase }
      };
    });
  }

  function patchForTarget(row, target, status, details){
    row = Object.assign({}, row || {});
    target = text(target).toLowerCase();
    status = upper(status || "SINCRONIZADO");
    details = details || {};

    var f = fields(target);
    var updatedAt = nowISO();
    var attempts = Number(row[f.attempts] || 0);
    var maxAttempts = Number(details.maxAttempts || DEFAULT_MAX_ATTEMPTS);

    row.updatedAt = updatedAt;
    row[f.status] = status;
    row[f.legacyStatus] = status;

    if(status === "SINCRONIZADO"){
      row[f.syncedAt] = updatedAt;
      row[f.error] = "";
      row[f.nextRetryAt] = "";
      row[f.blocked] = false;
      row[target + "Response"] = details || {};
      return row;
    }

    if(status === "ERROR"){
      attempts += 1;
      row[f.attempts] = attempts;
      row[f.error] = text(details.error || details.message || ("Error " + target));
      row[f.blocked] = attempts >= maxAttempts;
      row[f.nextRetryAt] = row[f.blocked] ? "" : new Date(nowMs() + retryMinutes(attempts) * 60000).toISOString();
      row[target + "ErrorAt"] = updatedAt;
      row[target + "Response"] = details || {};
      return row;
    }

    row[f.error] = text(details.error || details.message || "");
    return row;
  }

  function mark(rows, target, status, details){
    rows = Array.isArray(rows) ? rows : [];
    var cambios = repo();
    if(!cambios || typeof cambios.saveMany !== "function"){
      return Promise.resolve({ ok:false, updated:0, message:"Repositorio cambios no disponible." });
    }
    var patched = rows.map(function(row){ return patchForTarget(row, target, status, details || {}); });
    return cambios.saveMany(patched).then(function(){ return { ok:true, updated:patched.length, target:target, status:upper(status || "SINCRONIZADO") }; });
  }

  function resetRetries(rows, target){
    rows = Array.isArray(rows) ? rows : [];
    var cambios = repo();
    if(!cambios || typeof cambios.saveMany !== "function"){
      return Promise.resolve({ ok:false, updated:0, message:"Repositorio cambios no disponible." });
    }
    var f = fields(target || "google");
    var patched = rows.map(function(row){
      row = Object.assign({}, row || {});
      row[f.blocked] = false;
      row[f.nextRetryAt] = "";
      row.updatedAt = nowISO();
      return row;
    });
    return cambios.saveMany(patched).then(function(){ return { ok:true, updated:patched.length, target:target || "google", action:"resetRetries" }; });
  }

  var api = {
    version: VERSION,
    list: list,
    pending: pending,
    counts: counts,
    mark: mark,
    markSynced: function(rows, target, details){ return mark(rows, target, "SINCRONIZADO", details || {}); },
    markError: function(rows, target, details){ return mark(rows, target, "ERROR", details || {}); },
    resetRetries: resetRetries,
    isDone: isDone,
    isError: isError,
    isBlocked: isBlocked,
    retryDue: retryDue
  };

  window.BDLSyncOutbox = api;
})(window);
