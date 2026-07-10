/* =========================================================
Nombre completo: bdl.sync.index.js
Ruta o ubicación: /BDLocal/sync/bdl.sync.index.js
Función o funciones:
- Ser el único punto de entrada del motor nuevo de sincronización.
- Aceptar únicamente solicitudes manuales y explícitas.
- Esperar la carga real del adaptador Firebase antes de ejecutar.
- Bloquear procesos paralelos y limitar cada lote a 25 cambios.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION = "0.5.0-manual-target-ready";
  var MAX_BATCH_SIZE = 25;
  var targetPromise = null;

  var state = {
    running:false,
    lockId:"",
    startedAt:"",
    pausedReason:"",
    lastRunAt:"",
    lastResult:null,
    blockedAutomaticRequests:0,
    targetLoadError:""
  };

  function text(value){ return String(value == null ? "" : value).trim(); }
  function num(value,fallback){ value = Number(value); return Number.isFinite(value) ? value : Number(fallback || 0); }
  function now(){ return new Date().toISOString(); }
  function outbox(){ return window.BDLSyncOutbox || null; }
  function orchestrator(){ return window.BDLSyncOrchestrator || null; }

  function basePath(){
    var script = document.currentScript;
    var source = script && script.getAttribute ? text(script.getAttribute("src")) : "";
    if(!source){ return "sync/"; }
    return source.slice(0,source.lastIndexOf("/") + 1);
  }

  function firebaseTargetReady(){
    return !!window.BDLSyncTargetFirebase && !!window.BDLSyncTargets && typeof window.BDLSyncTargets.get === "function" && !!window.BDLSyncTargets.get("firebase");
  }

  function findTargetScript(src){
    return Array.prototype.slice.call(document.scripts || []).filter(function(script){
      return script.getAttribute("data-bdl-sync-extra") === src || script.getAttribute("src") === src || text(script.src).slice(-src.length) === src;
    })[0] || null;
  }

  function waitForTarget(timeoutMs){
    timeoutMs = Math.max(500,Number(timeoutMs || 7000));
    var started = Date.now();
    return new Promise(function(resolve,reject){
      (function check(){
        if(firebaseTargetReady()){ resolve(window.BDLSyncTargetFirebase); return; }
        if(Date.now() - started >= timeoutMs){ reject(new Error("El adaptador Firebase no terminó de cargar.")); return; }
        window.setTimeout(check,50);
      })();
    });
  }

  function loadExtraTargets(){
    if(firebaseTargetReady()){ return Promise.resolve(window.BDLSyncTargetFirebase); }
    if(targetPromise){ return targetPromise; }

    var src = basePath() + "targets/bdl.sync.target.firebase.js";
    targetPromise = new Promise(function(resolve,reject){
      var script = findTargetScript(src);
      if(!script){
        script = document.createElement("script");
        script.src = src;
        script.async = false;
        script.setAttribute("data-bdl-sync-extra",src);
        document.body.appendChild(script);
      }

      function finish(){
        waitForTarget(7000).then(resolve).catch(reject);
      }

      if(firebaseTargetReady()){ resolve(window.BDLSyncTargetFirebase); return; }
      script.addEventListener("load",finish,{ once:true });
      script.addEventListener("error",function(){ reject(new Error("No se pudo cargar: " + src)); },{ once:true });
      window.setTimeout(finish,100);
    }).then(function(target){
      state.targetLoadError = "";
      return target;
    }).catch(function(error){
      state.targetLoadError = error.message || String(error);
      targetPromise = null;
      throw error;
    });

    return targetPromise;
  }

  function setPaused(reason){
    state.pausedReason = text(reason || "");
    try{
      window.dispatchEvent(new CustomEvent("bdlocal:sync-pause-changed",{
        detail:{ paused:!!state.pausedReason,reason:state.pausedReason,at:now() }
      }));
    }catch(error){}
    return state.pausedReason;
  }

  function isPaused(){ return !!state.pausedReason; }

  function safeBatch(value){
    value = num(value,MAX_BATCH_SIZE);
    if(value <= 0){ value = MAX_BATCH_SIZE; }
    return Math.min(MAX_BATCH_SIZE,Math.max(1,Math.floor(value)));
  }

  function baseStatus(){
    return {
      version:VERSION,
      manualOnly:true,
      automatic:false,
      syncOnIdle:false,
      syncOnClose:false,
      maxBatchSize:MAX_BATCH_SIZE,
      running:!!state.running,
      lockId:state.lockId,
      startedAt:state.startedAt,
      paused:isPaused(),
      pausedReason:state.pausedReason,
      lastRunAt:state.lastRunAt,
      lastResult:state.lastResult,
      blockedAutomaticRequests:state.blockedAutomaticRequests,
      targetLoadError:state.targetLoadError,
      firebaseTargetReady:firebaseTargetReady(),
      targets:window.BDLSyncTargets && typeof window.BDLSyncTargets.list === "function" ? window.BDLSyncTargets.list() : [],
      outboxReady:!!outbox(),
      orchestratorReady:!!orchestrator()
    };
  }

  function status(){
    return loadExtraTargets().catch(function(){ return null; }).then(function(){
      var base = baseStatus();
      if(orchestrator() && typeof orchestrator().status === "function"){
        return orchestrator().status().then(function(detail){ return Object.assign(base,{ detail:detail }); });
      }
      if(outbox() && typeof outbox().counts === "function"){
        return outbox().counts({}).then(function(counts){ return Object.assign(base,{ counts:counts }); });
      }
      return base;
    });
  }

  function blockedResult(message,extra){
    state.lastResult = Object.assign({ ok:false,blocked:true,message:message,at:now() },extra || {});
    return Promise.resolve(state.lastResult);
  }

  function validate(options){
    if(options.manual !== true){
      state.blockedAutomaticRequests += 1;
      return blockedResult("Solicitud automática bloqueada. La sincronización solo puede iniciarse manualmente.",{
        automatic:true,
        source:text(options.source || "desconocido")
      });
    }
    if(isPaused()){
      return blockedResult("Sincronización pausada: " + state.pausedReason,{ paused:true,pausedReason:state.pausedReason });
    }
    if(!text(options.periodoId) && options.allowAllPeriods !== true){
      return blockedResult("Seleccione un período antes de sincronizar.",{ missingPeriod:true });
    }
    return null;
  }

  function executeRequest(options){
    if(state.running){
      return blockedResult("Ya existe una sincronización en curso. No se inició un proceso paralelo.",{
        alreadyRunning:true,
        lockId:state.lockId,
        startedAt:state.startedAt
      });
    }

    options.limit = safeBatch(options.limit || options.batchSize);
    options.batchSize = options.limit;
    options.manual = true;
    options.idleOnly = false;
    options.automatic = false;

    state.running = true;
    state.lockId = "sync_lock__" + Date.now() + "__" + Math.random().toString(16).slice(2);
    state.startedAt = now();
    state.lastRunAt = state.startedAt;

    try{
      window.dispatchEvent(new CustomEvent("bdlocal:sync-v2-started",{
        detail:{ lockId:state.lockId,periodoId:options.periodoId,targets:options.targets || [],batchSize:options.batchSize,manual:true,at:state.startedAt }
      }));
    }catch(error){}

    if(!orchestrator() || typeof orchestrator().syncQueue !== "function"){
      state.running = false;
      state.lockId = "";
      state.startedAt = "";
      state.lastResult = { ok:false,message:"El orquestador seguro no está disponible.",options:options };
      return Promise.resolve(state.lastResult);
    }

    return orchestrator().syncQueue(options).then(function(result){
      state.lastResult = result;
      return result;
    }).catch(function(error){
      state.lastResult = { ok:false,message:error.message || String(error),at:now() };
      return state.lastResult;
    }).finally(function(){
      var finishedLock = state.lockId;
      state.running = false;
      state.lockId = "";
      state.startedAt = "";
      try{
        window.dispatchEvent(new CustomEvent("bdlocal:sync-v2-finished",{
          detail:{ lockId:finishedLock,result:state.lastResult,at:now() }
        }));
      }catch(error){}
    });
  }

  function request(options){
    options = Object.assign({},options || {});
    var blocked = validate(options);
    if(blocked){ return blocked; }

    return loadExtraTargets().then(function(){
      return executeRequest(options);
    }).catch(function(error){
      return blockedResult("No se pudo preparar el destino Firebase: " + (error.message || String(error)),{
        targetLoadError:true
      });
    });
  }

  window.BDLSyncV2 = {
    version:VERSION,
    manualOnly:true,
    automatic:false,
    maxBatchSize:MAX_BATCH_SIZE,
    status:status,
    request:request,
    syncQueue:request,
    setPaused:setPaused,
    pause:function(reason){ return setPaused(reason || "Pausa manual"); },
    resume:function(){ return setPaused(""); },
    isPaused:isPaused,
    isRunning:function(){ return !!state.running; },
    safeBatch:safeBatch,
    loadExtraTargets:loadExtraTargets,
    firebaseTargetReady:firebaseTargetReady
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded",function(){ loadExtraTargets().catch(function(){}); });
  }else{
    loadExtraTargets().catch(function(){});
  }
})(window,document);
