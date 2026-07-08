/* =========================================================
Archivo: bdl.sync.orchestrator.js
Ruta: /BDLocal/sync/bdl.sync.orchestrator.js
Función:
- Procesar manualmente cambios_pendientes por destino.
- Permitir syncTarget("firebase"), syncTarget("supabase") y syncTarget("google").
- Evitar sincronización automática desde Carga.
- Marcar solo el destino procesado como SINCRONIZADO o ERROR.
Con qué se conecta:
- BDLocal/sync/bdl.sync.outbox.js
- BDLocal/sync/targets/bdl.sync.targets.index.js
- BDLocal/sync/bdl.sync.index.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.4.0-manual-targets";
  var DEFAULT_BATCH_SIZE = 25;
  var MAX_BATCH_SIZE = 100;
  var DEFAULT_TARGETS = ["google", "firebase", "supabase"];

  var state = {
    running:false,
    currentTarget:"",
    lastRunAt:"",
    lastResult:null,
    lastError:null
  };

  function text(value){ return String(value == null ? "" : value).trim(); }
  function nowISO(){ return new Date().toISOString(); }
  function outbox(){ return window.BDLSyncOutbox || null; }
  function registry(){ return window.BDLSyncTargets || null; }

  function emit(name, detail){
    try{ window.dispatchEvent(new CustomEvent(name, { detail:detail || {} })); }catch(error){}
  }

  function normalizeTarget(target){
    target = text(target).toLowerCase();
    if(target === "sheets" || target === "sheet" || target === "google_sheets"){ return "google"; }
    if(target === "firestore"){ return "firebase"; }
    return target;
  }

  function safeLimit(value){
    var limit = Number(value || DEFAULT_BATCH_SIZE);
    if(!Number.isFinite(limit) || limit <= 0){ limit = DEFAULT_BATCH_SIZE; }
    return Math.max(1, Math.min(MAX_BATCH_SIZE, Math.floor(limit)));
  }

  function getAdapter(target){
    target = normalizeTarget(target);
    var r = registry();
    if(r && typeof r.get === "function"){
      var adapter = r.get(target);
      if(adapter){ return adapter; }
    }
    if(target === "firebase" && window.BDLSyncTargetFirebase){ return window.BDLSyncTargetFirebase; }
    return null;
  }

  function supportedTarget(target){ return DEFAULT_TARGETS.indexOf(normalizeTarget(target)) >= 0; }

  function normalizeOptions(options){
    options = Object.assign({}, options || {});
    options.limit = safeLimit(options.limit || options.batchSize || DEFAULT_BATCH_SIZE);
    options.batchSize = safeLimit(options.batchSize || options.limit || DEFAULT_BATCH_SIZE);
    options.manual = options.manual !== false;
    options.source = text(options.source || "BDLSyncOrchestrator.manual");
    return options;
  }

  function rowId(row){
    if(outbox() && typeof outbox().rowId === "function"){ return outbox().rowId(row); }
    return text(row && (row.id || row.cambioId));
  }

  function idsFromPushResult(result, pendingRows){
    result = result || {};
    var ids = [];
    if(Array.isArray(result.processedIds)){ ids = ids.concat(result.processedIds); }
    if(Array.isArray(result.ids)){ ids = ids.concat(result.ids); }
    if(Array.isArray(result.syncedIds)){ ids = ids.concat(result.syncedIds); }
    if(Array.isArray(result.confirmedIds)){ ids = ids.concat(result.confirmedIds); }
    if(result.ok && !ids.length){ ids = (pendingRows || []).map(rowId).filter(Boolean); }
    var map = {};
    ids.forEach(function(id){ if(text(id)){ map[text(id)] = true; } });
    return Object.keys(map);
  }

  function rowsByIds(rows, ids){
    var map = {};
    (Array.isArray(ids) ? ids : []).forEach(function(id){ if(text(id)){ map[text(id)] = true; } });
    return (Array.isArray(rows) ? rows : []).filter(function(row){ return !!map[rowId(row)]; });
  }

  function callAdapter(adapter, target, pendingRows, options){
    if(!adapter){
      return Promise.resolve({ ok:false, skipped:true, target:target, message:"No hay adaptador real para " + target + ".", processedIds:[] });
    }

    if(typeof adapter.push === "function"){
      return Promise.resolve(adapter.push(pendingRows, Object.assign({}, options, { target:target })));
    }

    if(typeof adapter.sync === "function"){
      return Promise.resolve(adapter.sync(pendingRows, Object.assign({}, options, { target:target })));
    }

    if(typeof adapter.upload === "function"){
      return Promise.resolve(adapter.upload(pendingRows, Object.assign({}, options, { target:target })));
    }

    return Promise.resolve({ ok:false, skipped:true, target:target, message:"El adaptador de " + target + " no tiene método push/sync/upload.", processedIds:[] });
  }

  function syncTarget(target, options){
    target = normalizeTarget(target || "");
    options = normalizeOptions(options || {});

    if(!supportedTarget(target)){
      return Promise.resolve({ ok:false, target:target, message:"Destino no soportado: " + target });
    }

    if(state.running && !options.allowParallel){
      return Promise.resolve({ ok:false, target:target, busy:true, message:"Ya hay una sincronización en curso." });
    }

    var ob = outbox();
    if(!ob || typeof ob.pending !== "function"){
      return Promise.resolve({ ok:false, target:target, outbox:false, message:"BDLSyncOutbox no disponible." });
    }

    state.running = true;
    state.currentTarget = target;
    state.lastRunAt = nowISO();
    state.lastError = null;

    emit("bdlocal:sync-v2-started", {
      target:target,
      manual:options.manual,
      source:options.source,
      at:state.lastRunAt
    });

    return ob.pending(target, options).then(function(pendingRows){
      pendingRows = Array.isArray(pendingRows) ? pendingRows.slice(0, options.limit) : [];

      if(!pendingRows.length){
        return { ok:true, target:target, pending:0, processedIds:[], marked:0, message:target + ": no hay pendientes para subir." };
      }

      var adapter = getAdapter(target);
      if(!adapter){
        return {
          ok:false,
          skipped:true,
          target:target,
          pending:pendingRows.length,
          processedIds:[],
          marked:0,
          message:"No hay adaptador configurado para " + target + ". Los cambios siguen pendientes."
        };
      }

      return callAdapter(adapter, target, pendingRows, options).then(function(pushResult){
        pushResult = pushResult || {};
        pushResult.target = pushResult.target || target;
        pushResult.pending = pendingRows.length;

        if(pushResult.ok === false){
          return ob.markError(pendingRows, target, {
            error:pushResult.message || pushResult.error || "Error de subida.",
            maxAttempts:options.maxAttempts
          }).then(function(markResult){
            return Object.assign({}, pushResult, {
              ok:false,
              target:target,
              marked:markResult.updated || 0,
              processedIds:[],
              message:pushResult.message || "No se pudo subir " + target + "."
            });
          });
        }

        var ids = idsFromPushResult(pushResult, pendingRows);
        var confirmedRows = rowsByIds(pendingRows, ids);

        if(!confirmedRows.length && pushResult.ok){ confirmedRows = pendingRows; }

        return ob.markSynced(confirmedRows, target, {
          syncedAt:nowISO(),
          response:pushResult
        }).then(function(markResult){
          return Object.assign({}, pushResult, {
            ok:true,
            target:target,
            pending:pendingRows.length,
            confirmed:confirmedRows.length,
            processedIds:confirmedRows.map(rowId).filter(Boolean),
            marked:markResult.updated || 0,
            message:pushResult.message || (target + ": " + confirmedRows.length + " cambio(s) sincronizado(s).")
          });
        });
      });
    }).then(function(result){
      state.lastResult = result;
      emit("bdlocal:sync-target-finished", Object.assign({}, result, { target:target, at:nowISO() }));
      return result;
    }).catch(function(error){
      var result = { ok:false, target:target, error:error && error.message ? error.message : String(error), message:error && error.message ? error.message : String(error) };
      state.lastError = result.error;
      state.lastResult = result;
      emit("bdlocal:sync-target-error", Object.assign({}, result, { at:nowISO() }));
      return result;
    }).finally(function(){
      state.running = false;
      state.currentTarget = "";
    });
  }

  function targetsFromOptions(options){
    options = options || {};
    var targets = Array.isArray(options.targets) && options.targets.length ? options.targets : [];
    if(!targets.length && text(options.target)){ targets = [options.target]; }
    if(!targets.length){ targets = DEFAULT_TARGETS.slice(); }
    var map = {};
    targets.forEach(function(target){
      target = normalizeTarget(target);
      if(supportedTarget(target)){ map[target] = true; }
    });
    return Object.keys(map);
  }

  function syncQueue(options){
    options = normalizeOptions(options || {});
    var targets = targetsFromOptions(options);
    var results = [];
    var chain = Promise.resolve();

    emit("bdlocal:sync-v2-queue-started", {
      targets:targets,
      manual:options.manual,
      source:options.source,
      at:nowISO()
    });

    targets.forEach(function(target){
      chain = chain.then(function(){
        return syncTarget(target, Object.assign({}, options, { target:target, allowParallel:false })).then(function(result){
          results.push(result);
          return result;
        });
      });
    });

    return chain.then(function(){
      var ok = results.every(function(item){ return item && item.ok !== false; });
      state.lastResult = { ok:ok, targets:targets, results:results, at:nowISO() };
      emit("bdlocal:sync-v2-finished", state.lastResult);
      return state.lastResult;
    }).catch(function(error){
      state.lastError = error && error.message ? error.message : String(error);
      state.lastResult = { ok:false, targets:targets, results:results, error:state.lastError, at:nowISO() };
      emit("bdlocal:sync-v2-error", state.lastResult);
      return state.lastResult;
    });
  }

  function status(){
    var base = {
      version:VERSION,
      running:state.running,
      currentTarget:state.currentTarget,
      lastRunAt:state.lastRunAt,
      lastResult:state.lastResult,
      lastError:state.lastError,
      defaultBatchSize:DEFAULT_BATCH_SIZE,
      maxBatchSize:MAX_BATCH_SIZE,
      targets:DEFAULT_TARGETS.slice()
    };

    var ob = outbox();
    if(!ob || typeof ob.counts !== "function"){
      return Promise.resolve(Object.assign(base, { outbox:false }));
    }
    return ob.counts({}).then(function(counts){
      return Object.assign(base, { outbox:true, counts:counts });
    });
  }

  window.BDLSyncOrchestrator = {
    version:VERSION,
    syncTarget:syncTarget,
    syncQueue:syncQueue,
    request:syncQueue,
    status:status,
    safeLimit:safeLimit,
    normalizeTarget:normalizeTarget,
    supportedTarget:supportedTarget
  };
})(window);