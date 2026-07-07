/* =========================================================
Archivo: bdl.sync.orchestrator.js
Ruta: /BDLocal/sync/bdl.sync.orchestrator.js
Función:
- Orquestar sincronización desde la nueva cola BDLocal/cambios.
- Delegar en BDLocalSyncManager cuando el destino ya tiene implementación.
- Marcar cambios por destino solo si el destino responde correctamente.
- Evitar sincronizaciones simultáneas.
Con qué se conecta:
- BDLocal/sync/bdl.sync.outbox.js
- BDLocal/sync/targets/bdl.sync.targets.index.js
- js/bdlocal-config/bdlocal-sync.manager.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.1.0-block9";
  var state = {
    running: false,
    lastRunAt: "",
    lastResult: null,
    lastError: ""
  };

  function text(value){ return String(value == null ? "" : value).trim(); }

  function outbox(){ return window.BDLSyncOutbox || null; }
  function manager(){ return window.BDLocalSyncManager || null; }
  function targets(){ return window.BDLSyncTargets || null; }

  function callManagerTarget(target, options){
    var m = manager();
    target = text(target).toLowerCase();
    options = options || {};

    if(!m){ return Promise.resolve({ ok:false, skipped:true, message:"BDLocalSyncManager no disponible." }); }

    if((target === "google" || target === "sheets") && typeof m.pushLocalToSheets === "function"){
      return m.pushLocalToSheets(Object.assign({}, options, { source:"BDLSyncOrchestrator" }));
    }
    if(target === "firebase" && typeof m.pushLocalToFirebase === "function"){
      return m.pushLocalToFirebase(Object.assign({}, options, { source:"BDLSyncOrchestrator" }));
    }
    if(target === "supabase" && typeof m.pushLocalToSupabase === "function"){
      return m.pushLocalToSupabase(Object.assign({}, options, { source:"BDLSyncOrchestrator" }));
    }

    return Promise.resolve({ ok:false, skipped:true, message:"Destino sin implementación: " + target });
  }

  function callRegisteredTarget(target, pendingRows, options){
    var registry = targets();
    var adapter = registry && typeof registry.get === "function" ? registry.get(target) : null;

    if(adapter && typeof adapter.push === "function"){
      return Promise.resolve(adapter.push(pendingRows || [], options || {}));
    }

    return callManagerTarget(target, options || {});
  }

  function syncTarget(target, options){
    target = text(target || "google").toLowerCase();
    options = options || {};

    var ob = outbox();
    if(!ob || typeof ob.pending !== "function"){
      return Promise.resolve({ ok:false, target:target, message:"BDLSyncOutbox no disponible." });
    }

    return ob.pending(target, options).then(function(pendingRows){
      if(!pendingRows.length){
        return { ok:true, target:target, pending:0, message:"No hay pendientes para " + target + "." };
      }

      return callRegisteredTarget(target, pendingRows, options).then(function(result){
        result = result || {};
        if(result.ok === false){
          return ob.markError(pendingRows, target, result).then(function(markResult){
            return Object.assign({}, result, { target:target, pending:pendingRows.length, marked:markResult.updated || 0 });
          });
        }

        return ob.markSynced(pendingRows, target, result).then(function(markResult){
          return Object.assign({}, result, {
            ok: true,
            target: target,
            pending: pendingRows.length,
            marked: markResult.updated || 0,
            message: result.message || ("Pendientes sincronizados en " + target + ".")
          });
        });
      }).catch(function(error){
        var detail = { ok:false, error:error.message || String(error) };
        return ob.markError(pendingRows, target, detail).then(function(markResult){
          return { ok:false, target:target, pending:pendingRows.length, marked:markResult.updated || 0, message:error.message || String(error) };
        });
      });
    });
  }

  function syncQueue(options){
    options = options || {};
    if(state.running){
      return Promise.resolve({ ok:false, running:true, message:"Ya existe una sincronización en curso." });
    }

    state.running = true;
    state.lastRunAt = new Date().toISOString();
    state.lastError = "";

    var enabledTargets = Array.isArray(options.targets) && options.targets.length ? options.targets : ["google", "firebase", "supabase"];
    var results = [];
    var chain = Promise.resolve();

    enabledTargets.forEach(function(target){
      chain = chain.then(function(){
        return syncTarget(target, options).then(function(result){
          results.push(result);
          return result;
        });
      });
    });

    return chain.then(function(){
      var failed = results.filter(function(item){ return item && item.ok === false && !item.skipped; });
      state.running = false;
      state.lastResult = {
        ok: failed.length === 0,
        results: results,
        finishedAt: new Date().toISOString()
      };
      try{ window.dispatchEvent(new CustomEvent("bdlocal:sync-v2-finished", { detail: state.lastResult })); }catch(error){}
      return state.lastResult;
    }).catch(function(error){
      state.running = false;
      state.lastError = error.message || String(error);
      state.lastResult = { ok:false, message:state.lastError, results:results };
      return state.lastResult;
    });
  }

  function status(){
    var ob = outbox();
    var base = {
      version: VERSION,
      running: state.running,
      lastRunAt: state.lastRunAt,
      lastResult: state.lastResult,
      lastError: state.lastError
    };
    if(!ob || typeof ob.counts !== "function"){
      return Promise.resolve(Object.assign(base, { outbox:false }));
    }
    return ob.counts({}).then(function(counts){
      return Object.assign(base, { outbox:true, counts:counts });
    });
  }

  window.BDLSyncOrchestrator = {
    version: VERSION,
    syncTarget: syncTarget,
    syncQueue: syncQueue,
    status: status
  };
})(window);
