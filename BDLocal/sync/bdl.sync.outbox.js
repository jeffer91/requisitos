/* =========================================================
Archivo: bdl.sync.outbox.js
Ruta: /BDLocal/sync/bdl.sync.outbox.js
Función:
- Leer la cola cambios_pendientes desde BDLocal.
- Separar estados por destino: Google Sheets, Firebase y Supabase.
- Marcar cambios como sincronizados o con error por destino sin borrar registros.
- Controlar reintentos, espera y bloqueo por destino.
Con qué se conecta:
- BDLocal/repositories/bdl.repo.cambios.js
- BDLocal/sync/bdl.sync.index.js
- BDLocal/sync/bdl.sync.orchestrator.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.3.0-manual-targets";
  var DEFAULT_MAX_ATTEMPTS = 3;
  var DEFAULT_RETRY_MINUTES = [2, 5, 15, 30, 60];
  var TARGETS = ["google", "firebase", "supabase"];

  function text(value){ return String(value == null ? "" : value).trim(); }
  function upper(value){ return text(value).toUpperCase(); }
  function nowISO(){ return new Date().toISOString(); }
  function nowMs(){ return Date.now(); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(error){ return value; } }

  function repo(){
    if(window.BDLRepositories && typeof window.BDLRepositories.get === "function"){
      return window.BDLRepositories.get("cambios") || window.BDLRepositories.get("cambios_pendientes");
    }
    return window.BDLRepoCambios || null;
  }

  function targetKey(target){
    target = text(target).toLowerCase();
    if(target === "sheets" || target === "sheet" || target === "google_sheets"){ return "google"; }
    if(target === "firestore"){ return "firebase"; }
    return target;
  }

  function fields(target){
    target = targetKey(target);
    if(target === "google"){
      return {
        target:"google",
        status:"estadoSheets",
        legacyStatus:"statusGoogle",
        syncedAt:"sincronizadoEnSheets",
        error:"ultimoErrorSheets",
        attempts:"intentosSheets",
        nextRetryAt:"nextRetryAtSheets",
        blocked:"bloqueadoSheets"
      };
    }
    if(target === "firebase"){
      return {
        target:"firebase",
        status:"estadoFirebase",
        legacyStatus:"statusFirebase",
        syncedAt:"sincronizadoEnFirebase",
        error:"ultimoErrorFirebase",
        attempts:"intentosFirebase",
        nextRetryAt:"nextRetryAtFirebase",
        blocked:"bloqueadoFirebase"
      };
    }
    if(target === "supabase"){
      return {
        target:"supabase",
        status:"estadoSupabase",
        legacyStatus:"statusSupabase",
        syncedAt:"sincronizadoEnSupabase",
        error:"ultimoErrorSupabase",
        attempts:"intentosSupabase",
        nextRetryAt:"nextRetryAtSupabase",
        blocked:"bloqueadoSupabase"
      };
    }
    return {
      target:target,
      status:"estado" + target,
      legacyStatus:"status" + target,
      syncedAt:"sincronizadoEn" + target,
      error:"ultimoError" + target,
      attempts:"intentos" + target,
      nextRetryAt:"nextRetryAt" + target,
      blocked:"bloqueado" + target
    };
  }

  function statusOf(row, target){
    var f = fields(target);
    var value = upper((row || {})[f.status] || (row || {})[f.legacyStatus] || "PENDIENTE");
    if(!value){ value = "PENDIENTE"; }
    if(value === "OK" || value === "DONE" || value === "SYNCED"){ value = "SINCRONIZADO"; }
    if(value === "PENDING"){ value = "PENDIENTE"; }
    return value;
  }

  function attemptsOf(row, target){
    var f = fields(target);
    var value = Number((row || {})[f.attempts] || 0);
    return Number.isFinite(value) ? value : 0;
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

  function retryTime(row, target){
    var f = fields(target);
    var raw = text((row || {})[f.nextRetryAt]);
    if(!raw){ return 0; }
    var ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : 0;
  }

  function retryDue(row, target, options){
    options = options || {};
    if(options.forceRetry || options.ignoreRetry){ return true; }
    var next = retryTime(row, target);
    return !next || next <= nowMs();
  }

  function allowedForTarget(row, target, options){
    if(isDone(row, target)){ return false; }
    if(isBlocked(row, target, options)){ return false; }
    if(!retryDue(row, target, options)){ return false; }
    return true;
  }

  function list(options){
    options = options || {};
    var cambios = repo();
    if(!cambios || typeof cambios.list !== "function"){
      return Promise.resolve([]);
    }
    return cambios.list(options).then(function(rows){
      rows = Array.isArray(rows) ? rows : [];
      if(text(options.periodoId)){
        rows = rows.filter(function(row){ return !text(row.periodoId) || text(row.periodoId) === text(options.periodoId); });
      }
      if(text(options.cedula)){
        rows = rows.filter(function(row){ return text(row.cedula || row.numeroIdentificacion) === text(options.cedula); });
      }
      return rows;
    });
  }

  function pending(target, options){
    target = targetKey(target || "google");
    options = options || {};
    var limit = Number(options.limit || options.batchSize || 0);
    return list(options).then(function(rows){
      var out = rows.filter(function(row){ return allowedForTarget(row, target, options); });
      if(limit > 0){ out = out.slice(0, limit); }
      return out;
    });
  }

  function detailFor(rows, target, options){
    options = options || {};
    var detail = { target:targetKey(target), pending:0, synced:0, error:0, blocked:0, waitingRetry:0, total:0 };
    (Array.isArray(rows) ? rows : []).forEach(function(row){
      detail.total += 1;
      if(isDone(row, target)){ detail.synced += 1; return; }
      if(isBlocked(row, target, options)){ detail.blocked += 1; return; }
      if(!retryDue(row, target, options)){ detail.waitingRetry += 1; return; }
      if(isError(row, target)){ detail.error += 1; return; }
      detail.pending += 1;
    });
    return detail;
  }

  function counts(options){
    options = options || {};
    return list(options).then(function(rows){
      var detail = {};
      TARGETS.forEach(function(target){ detail[target] = detailFor(rows, target, options); });
      return {
        total:rows.length,
        google:detail.google.pending,
        firebase:detail.firebase.pending,
        supabase:detail.supabase.pending,
        errorsGoogle:detail.google.error,
        errorsFirebase:detail.firebase.error,
        errorsSupabase:detail.supabase.error,
        blockedGoogle:detail.google.blocked,
        blockedFirebase:detail.firebase.blocked,
        blockedSupabase:detail.supabase.blocked,
        waitingRetryGoogle:detail.google.waitingRetry,
        waitingRetryFirebase:detail.firebase.waitingRetry,
        waitingRetrySupabase:detail.supabase.waitingRetry,
        syncedGoogle:detail.google.synced,
        syncedFirebase:detail.firebase.synced,
        syncedSupabase:detail.supabase.synced,
        detail:detail,
        at:nowISO()
      };
    });
  }

  function nextRetryISO(attempts){
    attempts = Math.max(1, Number(attempts || 1));
    var idx = Math.min(attempts - 1, DEFAULT_RETRY_MINUTES.length - 1);
    return new Date(nowMs() + DEFAULT_RETRY_MINUTES[idx] * 60000).toISOString();
  }

  function rowId(row){ return text(row && (row.id || row.cambioId)); }

  function patchForTarget(row, target, status, details){
    target = targetKey(target || "google");
    status = upper(status || "SINCRONIZADO");
    details = details || {};
    var f = fields(target);
    row = Object.assign({}, row || {});
    var attempts = attemptsOf(row, target);

    row[f.status] = status;
    row[f.legacyStatus] = status;
    row.updatedAt = nowISO();

    if(status === "SINCRONIZADO"){
      row[f.syncedAt] = details.syncedAt || nowISO();
      row[f.error] = "";
      row[f.nextRetryAt] = "";
      row[f.blocked] = false;
      row[f.attempts] = attempts;
    }else if(status === "ERROR"){
      attempts += 1;
      row[f.attempts] = attempts;
      row[f.error] = text(details.error || details.message || "Error de sincronización.");
      row[f.nextRetryAt] = details.nextRetryAt || nextRetryISO(attempts);
      row[f.blocked] = attempts >= Number(details.maxAttempts || DEFAULT_MAX_ATTEMPTS);
    }else if(status === "PENDIENTE"){
      row[f.error] = "";
      row[f.nextRetryAt] = "";
      row[f.blocked] = false;
    }else{
      row[f.error] = text(details.error || details.message || "");
    }

    return row;
  }

  function saveRows(rows){
    rows = Array.isArray(rows) ? rows : [];
    var cambios = repo();
    if(!cambios || typeof cambios.saveMany !== "function"){
      return Promise.resolve({ ok:false, updated:0, message:"Repositorio cambios no disponible." });
    }
    if(!rows.length){ return Promise.resolve({ ok:true, updated:0 }); }
    return cambios.saveMany(rows).then(function(){ return { ok:true, updated:rows.length }; });
  }

  function mark(rows, target, status, details){
    rows = Array.isArray(rows) ? rows : [];
    var patched = rows.map(function(row){ return patchForTarget(row, target, status, details || {}); });
    return saveRows(patched).then(function(result){
      return Object.assign({}, result, { target:targetKey(target), status:upper(status || "SINCRONIZADO"), ids:patched.map(rowId).filter(Boolean) });
    });
  }

  function markByIds(ids, target, status, details){
    var map = {};
    (Array.isArray(ids) ? ids : []).forEach(function(id){ if(text(id)){ map[text(id)] = true; } });
    return list({}).then(function(rows){
      rows = rows.filter(function(row){ return !!map[rowId(row)]; });
      return mark(rows, target, status, details || {});
    });
  }

  function resetRetries(rows, target){
    rows = Array.isArray(rows) ? rows : [];
    var f = fields(target || "google");
    var patched = rows.map(function(row){
      row = Object.assign({}, row || {});
      row[f.blocked] = false;
      row[f.nextRetryAt] = "";
      row[f.status] = row[f.status] === "SINCRONIZADO" ? "SINCRONIZADO" : "PENDIENTE";
      row[f.legacyStatus] = row[f.status];
      row.updatedAt = nowISO();
      return row;
    });
    return saveRows(patched).then(function(result){ return Object.assign({}, result, { target:targetKey(target), action:"resetRetries" }); });
  }

  function makeAllPending(rows){
    rows = Array.isArray(rows) ? rows : [];
    var patched = rows.map(function(row){
      row = clone(row || {});
      TARGETS.forEach(function(target){
        var f = fields(target);
        if(!text(row[f.status]) && !text(row[f.legacyStatus])){
          row[f.status] = "PENDIENTE";
          row[f.legacyStatus] = "PENDIENTE";
        }
      });
      row.updatedAt = row.updatedAt || nowISO();
      return row;
    });
    return saveRows(patched).then(function(result){ return Object.assign({}, result, { action:"makeAllPending" }); });
  }

  var api = {
    version:VERSION,
    targets:TARGETS.slice(),
    fields:fields,
    list:list,
    pending:pending,
    counts:counts,
    mark:mark,
    markByIds:markByIds,
    markSynced:function(rows, target, details){ return mark(rows, target, "SINCRONIZADO", details || {}); },
    markError:function(rows, target, details){ return mark(rows, target, "ERROR", details || {}); },
    resetRetries:resetRetries,
    makeAllPending:makeAllPending,
    isDone:isDone,
    isError:isError,
    isBlocked:isBlocked,
    retryDue:retryDue,
    rowId:rowId
  };

  window.BDLSyncOutbox = api;
})(window);