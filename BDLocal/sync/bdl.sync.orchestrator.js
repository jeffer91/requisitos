/* =========================================================
Nombre completo: bdl.sync.orchestrator.js
Ruta o ubicación: /BDLocal/sync/bdl.sync.orchestrator.js
Función o funciones:
- Procesar cambios únicamente por solicitud manual.
- Exigir período activo.
- Bloquear sincronizaciones paralelas.
- Aplicar un máximo de 25 cambios por lote.
- Marcar solo los registros confirmados por el destino.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.5.0-manual-lock";
  var MAX_BATCH_SIZE = 25;
  var TARGETS = ["google","firebase","supabase"];
  var state = { running:false,queueRunning:false,currentTarget:"",lockId:"",startedAt:"",lastRunAt:"",lastResult:null,lastError:null,blockedRequests:0 };

  function text(value){ return String(value == null ? "" : value).trim(); }
  function now(){ return new Date().toISOString(); }
  function outbox(){ return window.BDLSyncOutbox || null; }
  function registry(){ return window.BDLSyncTargets || null; }
  function emit(name,detail){ try{ window.dispatchEvent(new CustomEvent(name,{ detail:detail || {} })); }catch(error){} }

  function targetKey(target){
    target = text(target).toLowerCase();
    if(target === "sheets" || target === "sheet" || target === "google_sheets"){ return "google"; }
    if(target === "firestore"){ return "firebase"; }
    return target;
  }

  function safeLimit(value){
    value = Number(value || MAX_BATCH_SIZE);
    if(!Number.isFinite(value) || value <= 0){ value = MAX_BATCH_SIZE; }
    return Math.min(MAX_BATCH_SIZE,Math.max(1,Math.floor(value)));
  }

  function optionsOf(options){
    options = Object.assign({},options || {});
    options.limit = safeLimit(options.limit || options.batchSize);
    options.batchSize = options.limit;
    options.manual = options.manual === true;
    options.periodoId = text(options.periodoId);
    options.source = text(options.source || "BDLSyncOrchestrator.manual");
    return options;
  }

  function rejectRequest(message,extra){
    state.blockedRequests += 1;
    return Promise.resolve(Object.assign({ ok:false,blocked:true,message:message,at:now() },extra || {}));
  }

  function validate(options){
    if(options.manual !== true){ return "Solicitud automática bloqueada."; }
    if(!options.periodoId && options.allowAllPeriods !== true){ return "Seleccione un período antes de sincronizar."; }
    return "";
  }

  function acquire(target){
    if(state.running || state.queueRunning){ return false; }
    state.running = true;
    state.currentTarget = targetKey(target || "queue");
    state.lockId = "sync__" + Date.now() + "__" + Math.random().toString(16).slice(2);
    state.startedAt = now();
    state.lastRunAt = state.startedAt;
    return true;
  }

  function releaseTarget(){ state.running = false; state.currentTarget = ""; if(!state.queueRunning){ state.lockId = ""; state.startedAt = ""; } }

  function adapter(target){
    target = targetKey(target);
    var current = registry();
    if(current && typeof current.get === "function"){
      var found = current.get(target);
      if(found){ return found; }
    }
    return target === "firebase" ? window.BDLSyncTargetFirebase || null : null;
  }

  function rowId(row){ return outbox() && outbox().rowId ? outbox().rowId(row) : text(row && (row.id || row.cambioId)); }

  function confirmedIds(result,pendingRows){
    result = result || {};
    var ids = [];
    ["processedIds","ids","syncedIds","confirmedIds"].forEach(function(key){ if(Array.isArray(result[key])){ ids = ids.concat(result[key]); } });
    if(result.ok && !ids.length){ ids = (pendingRows || []).map(rowId).filter(Boolean); }
    var map = Object.create(null);
    ids.forEach(function(value){ if(text(value)){ map[text(value)] = true; } });
    return Object.keys(map);
  }

  function rowsByIds(rows,ids){
    var map = Object.create(null);
    (ids || []).forEach(function(value){ map[text(value)] = true; });
    return (rows || []).filter(function(row){ return !!map[rowId(row)]; });
  }

  function push(adapterApi,target,rows,options){
    if(!adapterApi){ return Promise.resolve({ ok:false,skipped:true,message:"No hay adaptador configurado para " + target + ".",processedIds:[] }); }
    if(typeof adapterApi.push === "function"){ return Promise.resolve(adapterApi.push(rows,Object.assign({},options,{ target:target }))); }
    if(typeof adapterApi.sync === "function"){ return Promise.resolve(adapterApi.sync(rows,Object.assign({},options,{ target:target }))); }
    if(typeof adapterApi.upload === "function"){ return Promise.resolve(adapterApi.upload(rows,Object.assign({},options,{ target:target }))); }
    return Promise.resolve({ ok:false,skipped:true,message:"El adaptador de " + target + " no tiene método de subida.",processedIds:[] });
  }

  function processTarget(target,options){
    target = targetKey(target);
    var ob = outbox();
    if(TARGETS.indexOf(target) < 0){ return Promise.resolve({ ok:false,target:target,message:"Destino no soportado." }); }
    if(!ob || typeof ob.pending !== "function"){ return Promise.resolve({ ok:false,target:target,message:"BDLSyncOutbox no disponible." }); }

    state.currentTarget = target;
    emit("bdlocal:sync-v2-started",{ target:target,manual:true,periodoId:options.periodoId,batchSize:options.batchSize,lockId:state.lockId,at:now() });

    return ob.pending(target,options).then(function(pendingRows){
      pendingRows = Array.isArray(pendingRows) ? pendingRows.slice(0,MAX_BATCH_SIZE) : [];
      if(!pendingRows.length){ return { ok:true,target:target,pending:0,processedIds:[],marked:0,message:target + ": no hay pendientes." }; }
      return push(adapter(target),target,pendingRows,options).then(function(result){
        result = result || {};
        if(result.ok === false){
          return ob.markError(pendingRows,target,{ error:result.message || result.error || "Error de subida.",maxAttempts:options.maxAttempts }).then(function(marked){
            return Object.assign({},result,{ ok:false,target:target,pending:pendingRows.length,marked:marked.updated || 0,processedIds:[] });
          });
        }
        var rows = rowsByIds(pendingRows,confirmedIds(result,pendingRows));
        if(!rows.length && result.ok){ rows = pendingRows; }
        return ob.markSynced(rows,target,{ syncedAt:now(),response:result }).then(function(marked){
          return Object.assign({},result,{ ok:true,target:target,pending:pendingRows.length,confirmed:rows.length,processedIds:rows.map(rowId),marked:marked.updated || 0 });
        });
      });
    }).then(function(result){
      state.lastResult = result;
      emit("bdlocal:sync-target-finished",Object.assign({},result,{ lockId:state.lockId,at:now() }));
      return result;
    }).catch(function(error){
      state.lastError = error.message || String(error);
      state.lastResult = { ok:false,target:target,message:state.lastError };
      emit("bdlocal:sync-target-error",Object.assign({},state.lastResult,{ lockId:state.lockId,at:now() }));
      return state.lastResult;
    });
  }

  function syncTarget(target,options){
    options = optionsOf(options);
    var error = validate(options);
    if(error){ return rejectRequest(error,{ target:targetKey(target),automatic:options.manual !== true }); }
    if(!acquire(target)){
      return rejectRequest("Ya existe una sincronización en curso.",{ busy:true,lockId:state.lockId,startedAt:state.startedAt });
    }
    return processTarget(target,options).finally(releaseTarget);
  }

  function targetList(options){
    var list = Array.isArray(options.targets) && options.targets.length ? options.targets : text(options.target) ? [options.target] : TARGETS.slice();
    var map = Object.create(null);
    list.forEach(function(target){ target = targetKey(target); if(TARGETS.indexOf(target) >= 0){ map[target] = true; } });
    return Object.keys(map);
  }

  function syncQueue(options){
    options = optionsOf(options);
    var error = validate(options);
    if(error){ return rejectRequest(error,{ automatic:options.manual !== true }); }
    if(state.running || state.queueRunning){ return rejectRequest("Ya existe una sincronización en curso.",{ busy:true,lockId:state.lockId }); }

    state.queueRunning = true;
    state.lockId = "queue__" + Date.now() + "__" + Math.random().toString(16).slice(2);
    state.startedAt = now();
    state.lastRunAt = state.startedAt;

    var targets = targetList(options);
    var results = [];
    var chain = Promise.resolve();
    emit("bdlocal:sync-v2-queue-started",{ targets:targets,manual:true,periodoId:options.periodoId,batchSize:options.batchSize,lockId:state.lockId,at:now() });

    targets.forEach(function(target){
      chain = chain.then(function(){
        state.running = true;
        return processTarget(target,options).then(function(result){ results.push(result); }).finally(function(){ state.running = false; });
      });
    });

    return chain.then(function(){
      state.lastResult = { ok:results.every(function(item){ return item && item.ok !== false; }),targets:targets,results:results,at:now() };
      emit("bdlocal:sync-v2-finished",state.lastResult);
      return state.lastResult;
    }).catch(function(error){
      state.lastError = error.message || String(error);
      state.lastResult = { ok:false,targets:targets,results:results,message:state.lastError,at:now() };
      return state.lastResult;
    }).finally(function(){ state.running = false; state.queueRunning = false; state.currentTarget = ""; state.lockId = ""; state.startedAt = ""; });
  }

  function status(){
    var base = { version:VERSION,manualOnly:true,running:state.running || state.queueRunning,lockId:state.lockId,currentTarget:state.currentTarget,startedAt:state.startedAt,lastRunAt:state.lastRunAt,lastResult:state.lastResult,lastError:state.lastError,blockedRequests:state.blockedRequests,maxBatchSize:MAX_BATCH_SIZE,targets:TARGETS.slice() };
    return outbox() && outbox().counts ? outbox().counts({}).then(function(counts){ return Object.assign(base,{ outbox:true,counts:counts }); }) : Promise.resolve(Object.assign(base,{ outbox:false }));
  }

  window.BDLSyncOrchestrator = { version:VERSION,manualOnly:true,maxBatchSize:MAX_BATCH_SIZE,syncTarget:syncTarget,syncQueue:syncQueue,request:syncQueue,status:status,isRunning:function(){ return state.running || state.queueRunning; },safeLimit:safeLimit,normalizeTarget:targetKey,supportedTarget:function(target){ return TARGETS.indexOf(targetKey(target)) >= 0; } };
})(window);
