/* =========================================================
Archivo: bdl.sync.orchestrator.js
Ruta: /BDLocal/sync/bdl.sync.orchestrator.js
Funcion:
- Orquestar sincronizacion desde cambios_pendientes.
- Procesar destinos solo con adaptadores que confirmen cola nueva.
- Evitar falsos SINCRONIZADO cuando se usa manager legacy.
- Marcar cambios por destino solo si el destino confirma procesamiento real.
- Evitar sincronizaciones simultaneas.
- Bloque 3: limitar lotes para no saturar Google, Firebase ni Supabase.
Con que se conecta:
- BDLocal/sync/bdl.sync.outbox.js
- BDLocal/sync/targets/bdl.sync.targets.index.js
- js/bdlocal-config/bdlocal-sync.manager.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.3.0-block3-batch-safe";
  var DEFAULT_BATCH_SIZE = 25;
  var MAX_BATCH_SIZE = 50;
  var state = { running:false, lastRunAt:"", lastResult:null, lastError:"" };

  function text(value){ return String(value == null ? "" : value).trim(); }
  function outbox(){ return window.BDLSyncOutbox || null; }
  function manager(){ return window.BDLocalSyncManager || null; }
  function targets(){ return window.BDLSyncTargets || null; }

  function safeLimit(options){
    options = options || {};
    var n = Number(options.limit || options.batchSize || options.batch || DEFAULT_BATCH_SIZE);
    if(!Number.isFinite(n) || n <= 0){ n = DEFAULT_BATCH_SIZE; }
    return Math.max(1, Math.min(MAX_BATCH_SIZE, Math.floor(n)));
  }

  function callLegacyManager(target, options){
    var m = manager();
    target = text(target).toLowerCase();
    options = options || {};

    if(!m){ return Promise.resolve({ ok:false, skipped:true, safe:true, message:"BDLocalSyncManager no disponible." }); }
    if(!options.allowLegacyManager){
      return Promise.resolve({
        ok:false,
        skipped:true,
        safe:true,
        target:target,
        message:"No se marco la cola como sincronizada: falta adaptador real para cambios_pendientes en " + target + "."
      });
    }

    if((target === "google" || target === "sheets") && typeof m.pushLocalToSheets === "function"){
      return m.pushLocalToSheets(Object.assign({}, options, { source:"BDLSyncOrchestrator", legacyManager:true })).then(function(result){
        result = result || {};
        result.legacyManager = true;
        result.outboxProcessed = result.outboxProcessed === true;
        return result;
      });
    }
    if(target === "firebase" && typeof m.pushLocalToFirebase === "function"){
      return m.pushLocalToFirebase(Object.assign({}, options, { source:"BDLSyncOrchestrator", legacyManager:true })).then(function(result){
        result = result || {};
        result.legacyManager = true;
        result.outboxProcessed = result.outboxProcessed === true;
        return result;
      });
    }
    if(target === "supabase" && typeof m.pushLocalToSupabase === "function"){
      return m.pushLocalToSupabase(Object.assign({}, options, { source:"BDLSyncOrchestrator", legacyManager:true })).then(function(result){
        result = result || {};
        result.legacyManager = true;
        result.outboxProcessed = result.outboxProcessed === true;
        return result;
      });
    }
    return Promise.resolve({ ok:false, skipped:true, safe:true, message:"Destino sin implementacion: " + target });
  }

  function callRegisteredTarget(target, pendingRows, options){
    var registry = targets();
    var adapter = registry && typeof registry.get === "function" ? registry.get(target) : null;
    if(adapter && typeof adapter.push === "function"){
      return Promise.resolve(adapter.push(pendingRows || [], options || {})).then(function(result){
        result = result || {};
        if(result.outboxProcessed !== false){ result.outboxProcessed = true; }
        return result;
      });
    }
    return callLegacyManager(target, options || {});
  }

  function rowId(row){ return text(row && (row.id || row.cambioId)); }

  function rowsConfirmed(pendingRows, result){
    pendingRows = Array.isArray(pendingRows) ? pendingRows : [];
    result = result || {};
    if(result.syncedAll === true || result.outboxProcessed === true){ return pendingRows; }
    var ids = Array.isArray(result.syncedIds) ? result.syncedIds : (Array.isArray(result.processedIds) ? result.processedIds : []);
    if(!ids.length){ return []; }
    var map = Object.create(null);
    ids.forEach(function(id){ map[text(id)] = true; });
    return pendingRows.filter(function(row){ return !!map[rowId(row)]; });
  }

  function syncTarget(target, options){
    target = text(target || "google").toLowerCase();
    options = options || {};
    var ob = outbox();
    if(!ob || typeof ob.pending !== "function"){
      return Promise.resolve({ ok:false, target:target, message:"BDLSyncOutbox no disponible." });
    }

    var limit = safeLimit(options);
    var pendingOptions = Object.assign({}, options, { limit:limit });

    return ob.pending(target, pendingOptions).then(function(pendingRows){
      if(!pendingRows.length){ return { ok:true, target:target, pending:0, limit:limit, message:"No hay pendientes para " + target + "." }; }

      return callRegisteredTarget(target, pendingRows, Object.assign({}, options, { limit:limit, batchSize:limit })).then(function(result){
        result = result || {};

        if(result.skipped){
          return Object.assign({}, result, {
            ok:false,
            skipped:true,
            target:target,
            pending:pendingRows.length,
            limit:limit,
            marked:0,
            message:result.message || "Destino omitido sin marcar pendientes."
          });
        }

        if(result.ok === false){
          return ob.markError(pendingRows, target, result).then(function(markResult){
            return Object.assign({}, result, { target:target, pending:pendingRows.length, limit:limit, marked:markResult.updated || 0 });
          });
        }

        var confirmedRows = rowsConfirmed(pendingRows, result);
        if(!confirmedRows.length){
          return {
            ok:false,
            skipped:true,
            safe:true,
            target:target,
            pending:pendingRows.length,
            limit:limit,
            marked:0,
            message:"El destino respondio, pero no confirmo procesamiento de cambios_pendientes. No se marco como SINCRONIZADO."
          };
        }

        return ob.markSynced(confirmedRows, target, result).then(function(markResult){
          return Object.assign({}, result, {
            ok:true,
            target:target,
            pending:pendingRows.length,
            limit:limit,
            confirmed:confirmedRows.length,
            marked:markResult.updated || 0,
            message:result.message || (confirmedRows.length + " pendiente(s) sincronizados en " + target + ".")
          });
        });
      }).catch(function(error){
        var detail = { ok:false, error:error.message || String(error) };
        return ob.markError(pendingRows, target, detail).then(function(markResult){
          return { ok:false, target:target, pending:pendingRows.length, limit:limit, marked:markResult.updated || 0, message:error.message || String(error) };
        });
      });
    });
  }

  function syncQueue(options){
    options = options || {};
    if(state.running){ return Promise.resolve({ ok:false, running:true, message:"Ya existe una sincronizacion en curso." }); }
    state.running = true;
    state.lastRunAt = new Date().toISOString();
    state.lastError = "";

    var enabledTargets = Array.isArray(options.targets) && options.targets.length ? options.targets : ["google", "firebase", "supabase"];
    var limit = safeLimit(options);
    var results = [];
    var chain = Promise.resolve();

    enabledTargets.forEach(function(target){
      chain = chain.then(function(){
        return syncTarget(target, Object.assign({}, options, { limit:limit, batchSize:limit })).then(function(result){ results.push(result); return result; });
      });
    });

    return chain.then(function(){
      var failed = results.filter(function(item){ return item && item.ok === false && !item.skipped; });
      var skipped = results.filter(function(item){ return item && item.skipped; });
      state.running = false;
      state.lastResult = { ok:failed.length === 0, safe:skipped.length > 0, limit:limit, results:results, finishedAt:new Date().toISOString() };
      try{ window.dispatchEvent(new CustomEvent("bdlocal:sync-v2-finished", { detail:state.lastResult })); }catch(error){}
      return state.lastResult;
    }).catch(function(error){
      state.running = false;
      state.lastError = error.message || String(error);
      state.lastResult = { ok:false, message:state.lastError, limit:limit, results:results };
      return state.lastResult;
    });
  }

  function status(){
    var ob = outbox();
    var base = { version:VERSION, running:state.running, lastRunAt:state.lastRunAt, lastResult:state.lastResult, lastError:state.lastError, safeMode:true, defaultBatchSize:DEFAULT_BATCH_SIZE, maxBatchSize:MAX_BATCH_SIZE };
    if(!ob || typeof ob.counts !== "function"){ return Promise.resolve(Object.assign(base, { outbox:false })); }
    return ob.counts({}).then(function(counts){ return Object.assign(base, { outbox:true, counts:counts }); });
  }

  window.BDLSyncOrchestrator = { version:VERSION, syncTarget:syncTarget, syncQueue:syncQueue, status:status, safeLimit:safeLimit };
})(window);
