/* =========================================================
Nombre completo: bdl.sync.outbox.js
Ruta o ubicación: /BDLocal/sync/bdl.sync.outbox.js
Función o funciones:
- Leer la cola real cambios_pendientes por período.
- Reutilizar conteos recientes y evitar deduplicaciones repetidas.
- Exigir período para pendientes enviables y limitar lotes a 25.
- Exponer paginación para la interfaz sin cargar toda la cola visualmente.
- Controlar estados, errores, espera, bloqueo y reintentos por destino.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.5.0-cached-paginated";
  var DEFAULT_MAX_ATTEMPTS = 3;
  var DEFAULT_BATCH_LIMIT = 25;
  var MAX_BATCH_LIMIT = 25;
  var CACHE_TTL_MS = 1500;
  var DEFAULT_RETRY_MINUTES = [2,5,15,30,60];
  var TARGETS = ["google","firebase","supabase"];

  var countsCache = Object.create(null);
  var listCache = Object.create(null);

  function text(value){ return String(value == null ? "" : value).trim(); }
  function upper(value){ return text(value).toUpperCase(); }
  function nowISO(){ return new Date().toISOString(); }
  function nowMs(){ return Date.now(); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(error){ return value; } }
  function num(value,fallback){ value = Number(value); return Number.isFinite(value) ? value : (fallback || 0); }

  function repo(){
    if(window.BDLRepositories && typeof window.BDLRepositories.get === "function"){
      return window.BDLRepositories.get("cambios_pendientes") ||
        window.BDLRepositories.get("cambios");
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

  function statusOf(row,target){
    var f = fields(target);
    var value = upper((row || {})[f.status] || (row || {})[f.legacyStatus] || "PENDIENTE");
    if(value === "OK" || value === "DONE" || value === "SYNCED"){ return "SINCRONIZADO"; }
    if(value === "PENDING" || !value){ return "PENDIENTE"; }
    return value;
  }

  function attemptsOf(row,target){
    var value = Number((row || {})[fields(target).attempts] || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function isDone(row,target){ return statusOf(row,target) === "SINCRONIZADO"; }
  function isError(row,target){ return statusOf(row,target) === "ERROR"; }

  function isBlocked(row,target,options){
    options = options || {};
    if(options.forceRetry || options.includeBlocked){ return false; }
    var f = fields(target);
    var maxAttempts = Number(options.maxAttempts || DEFAULT_MAX_ATTEMPTS);
    return (row || {})[f.blocked] === true ||
      (isError(row,target) && attemptsOf(row,target) >= maxAttempts);
  }

  function retryTime(row,target){
    var raw = text((row || {})[fields(target).nextRetryAt]);
    var parsed = raw ? Date.parse(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function retryDue(row,target,options){
    options = options || {};
    if(options.forceRetry || options.ignoreRetry){ return true; }
    var next = retryTime(row,target);
    return !next || next <= nowMs();
  }

  function allowedForTarget(row,target,options){
    return !isDone(row,target) &&
      !isBlocked(row,target,options || {}) &&
      retryDue(row,target,options || {});
  }

  function logicalKey(row){
    var changes = repo();
    if(changes && typeof changes.logicalKey === "function"){
      try{ return text(changes.logicalKey(row)); }catch(error){}
    }
    return text((row || {}).logicalKey || (row || {}).id || (row || {}).cambioId);
  }

  function newer(a,b){
    var at = Date.parse(text(a && (a.updatedAt || a.createdAt))) || 0;
    var bt = Date.parse(text(b && (b.updatedAt || b.createdAt))) || 0;
    return bt >= at ? b : a;
  }

  function dedupe(rows){
    var map = Object.create(null);
    (Array.isArray(rows) ? rows : []).forEach(function(row){
      var key = logicalKey(row);
      if(!key){ return; }
      map[key] = map[key] ? newer(map[key],row) : row;
    });
    return Object.keys(map).map(function(key){ return map[key]; }).sort(function(a,b){
      return text(a.createdAt || a.updatedAt).localeCompare(text(b.createdAt || b.updatedAt));
    });
  }

  function cacheKey(options){
    options = options || {};
    return [
      text(options.periodoId) || "*",
      text(options.cedula) || "*",
      text(options.tabla) || "*",
      options.includeLegacy === false ? "outbox" : "both"
    ].join("|");
  }

  function invalidateCache(){
    countsCache = Object.create(null);
    listCache = Object.create(null);
    var changes = repo();
    if(changes && typeof changes.invalidateCache === "function"){
      try{ changes.invalidateCache(); }catch(error){}
    }
  }

  function readListCache(options){
    var key = cacheKey(options);
    var item = listCache[key];
    if(!item || (Date.now() - item.at) > CACHE_TTL_MS){ return null; }
    return clone(item.rows);
  }

  function writeListCache(options,rows){
    listCache[cacheKey(options)] = {
      at:Date.now(),
      rows:clone(rows || [])
    };
  }

  function list(options){
    options = options || {};
    var cached = !options.force ? readListCache(options) : null;
    if(cached){ return Promise.resolve(cached); }

    var changes = repo();
    if(!changes || typeof changes.list !== "function"){
      return Promise.resolve([]);
    }

    return changes.list(options).then(function(rows){
      rows = dedupe(rows);

      if(text(options.periodoId)){
        rows = rows.filter(function(row){
          return text(row.periodoId) === text(options.periodoId);
        });
      }
      if(text(options.cedula)){
        rows = rows.filter(function(row){
          return text(row.cedula || row.numeroIdentificacion) === text(options.cedula);
        });
      }
      if(text(options.tabla)){
        rows = rows.filter(function(row){
          return text(row.tabla || row.tipo) === text(options.tabla);
        });
      }

      writeListCache(options,rows);
      return clone(rows);
    });
  }

  function listPage(options){
    options = options || {};
    var changes = repo();

    if(changes && typeof changes.listPage === "function"){
      return changes.listPage(options).then(function(result){
        result = result || {};
        result.rows = dedupe(result.rows || []);
        return result;
      });
    }

    var page = Math.max(1,Number(options.page || 1));
    var pageSize = Math.max(1,Math.min(250,Number(options.pageSize || options.limit || 75)));

    return list(options).then(function(rows){
      var total = rows.length;
      var totalPages = Math.max(1,Math.ceil(total / pageSize));
      page = Math.min(page,totalPages);
      var start = (page - 1) * pageSize;

      return {
        rows:rows.slice(start,start + pageSize),
        page:page,
        pageSize:pageSize,
        total:total,
        totalPages:totalPages,
        hasPrev:page > 1,
        hasNext:page < totalPages
      };
    });
  }

  function safeLimit(options){
    options = options || {};
    var requested = num(options.limit || options.batchSize,DEFAULT_BATCH_LIMIT);
    if(requested <= 0){ requested = DEFAULT_BATCH_LIMIT; }
    return Math.min(MAX_BATCH_LIMIT,Math.max(1,requested));
  }

  function pending(target,options){
    target = targetKey(target || "google");
    options = options || {};

    if(!text(options.periodoId) && options.allowAllPeriods !== true){
      return Promise.resolve([]);
    }

    var limit = safeLimit(options);
    return list(options).then(function(rows){
      return rows.filter(function(row){
        return allowedForTarget(row,target,options);
      }).slice(0,limit);
    });
  }

  function detailFor(rows,target,options){
    options = options || {};
    var detail = {
      target:targetKey(target),
      pending:0,
      synced:0,
      error:0,
      blocked:0,
      waitingRetry:0,
      total:0
    };

    (Array.isArray(rows) ? rows : []).forEach(function(row){
      detail.total += 1;
      if(isDone(row,target)){ detail.synced += 1; return; }
      if(isBlocked(row,target,options)){ detail.blocked += 1; return; }
      if(!retryDue(row,target,options)){ detail.waitingRetry += 1; return; }
      if(isError(row,target)){ detail.error += 1; return; }
      detail.pending += 1;
    });

    return detail;
  }

  function counts(options){
    options = options || {};
    var key = cacheKey(options);
    var cached = countsCache[key];

    if(!options.force && cached && (Date.now() - cached.at) < CACHE_TTL_MS){
      return Promise.resolve(clone(cached.value));
    }

    return list(options).then(function(rows){
      var detail = {};
      TARGETS.forEach(function(target){
        detail[target] = detailFor(rows,target,options);
      });

      var result = {
        total:rows.length,
        uniqueLogicalChanges:rows.length,
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
        batchLimit:MAX_BATCH_LIMIT,
        at:nowISO()
      };

      countsCache[key] = {
        at:Date.now(),
        value:clone(result)
      };

      return result;
    });
  }

  function nextRetryISO(attempts){
    attempts = Math.max(1,Number(attempts || 1));
    var index = Math.min(attempts - 1,DEFAULT_RETRY_MINUTES.length - 1);
    return new Date(nowMs() + DEFAULT_RETRY_MINUTES[index] * 60000).toISOString();
  }

  function rowId(row){
    return text(row && (row.id || row.cambioId));
  }

  function patchForTarget(row,target,status,details){
    target = targetKey(target || "google");
    status = upper(status || "SINCRONIZADO");
    details = details || {};

    var f = fields(target);
    row = Object.assign({},row || {});
    var attempts = attemptsOf(row,target);

    row[f.status] = status;
    row[f.legacyStatus] = status;
    row.updatedAt = nowISO();

    if(status === "SINCRONIZADO"){
      row[f.syncedAt] = details.syncedAt || nowISO();
      row[f.error] = "";
      row[f.nextRetryAt] = "";
      row[f.blocked] = false;
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
    var changes = repo();

    if(!changes || typeof changes.saveMany !== "function"){
      return Promise.resolve({
        ok:false,
        updated:0,
        message:"Repositorio de cambios no disponible."
      });
    }

    if(!rows.length){
      return Promise.resolve({ ok:true,updated:0 });
    }

    return changes.saveMany(rows,{ source:"outbox_status_update" }).then(function(saved){
      invalidateCache();
      return {
        ok:true,
        updated:Array.isArray(saved) ? saved.length : rows.length
      };
    });
  }

  function mark(rows,target,status,details){
    rows = dedupe(rows);
    var patched = rows.map(function(row){
      return patchForTarget(row,target,status,details || {});
    });

    return saveRows(patched).then(function(result){
      return Object.assign({},result,{
        target:targetKey(target),
        status:upper(status || "SINCRONIZADO"),
        ids:patched.map(rowId).filter(Boolean)
      });
    });
  }

  function markByIds(ids,target,status,details){
    var wanted = Object.create(null);
    (Array.isArray(ids) ? ids : []).forEach(function(value){
      if(text(value)){ wanted[text(value)] = true; }
    });

    var changes = repo();
    var read = changes && typeof changes.getByIds === "function"
      ? changes.getByIds(Object.keys(wanted))
      : list({}).then(function(rows){
          return rows.filter(function(row){ return !!wanted[rowId(row)]; });
        });

    return read.then(function(rows){
      return mark(rows,target,status,details || {});
    });
  }

  function resetRetries(rows,target){
    var f = fields(target || "google");
    var patched = dedupe(rows).map(function(row){
      row = Object.assign({},row || {});
      row[f.blocked] = false;
      row[f.nextRetryAt] = "";
      row[f.error] = "";
      row[f.attempts] = 0;
      row[f.status] = isDone(row,target) ? "SINCRONIZADO" : "PENDIENTE";
      row[f.legacyStatus] = row[f.status];
      row.updatedAt = nowISO();
      return row;
    });

    return saveRows(patched).then(function(result){
      return Object.assign({},result,{
        target:targetKey(target),
        action:"resetRetries"
      });
    });
  }

  function makeAllPending(rows){
    var patched = dedupe(rows).map(function(row){
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

    return saveRows(patched).then(function(result){
      return Object.assign({},result,{ action:"makeAllPending" });
    });
  }

  window.BDLSyncOutbox = {
    version:VERSION,
    targets:TARGETS.slice(),
    maxBatchLimit:MAX_BATCH_LIMIT,
    fields:fields,
    list:list,
    listPage:listPage,
    pending:pending,
    counts:counts,
    mark:mark,
    markByIds:markByIds,
    markSynced:function(rows,target,details){
      return mark(rows,target,"SINCRONIZADO",details || {});
    },
    markError:function(rows,target,details){
      return mark(rows,target,"ERROR",details || {});
    },
    resetRetries:resetRetries,
    makeAllPending:makeAllPending,
    isDone:isDone,
    isError:isError,
    isBlocked:isBlocked,
    retryDue:retryDue,
    rowId:rowId,
    logicalKey:logicalKey,
    dedupe:dedupe,
    safeLimit:safeLimit,
    invalidateCache:invalidateCache
  };

  window.addEventListener("bdlocal:changes-repository-updated",invalidateCache);
})(window);
