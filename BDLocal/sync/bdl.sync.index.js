/* =========================================================
Nombre completo: bdl.sync.index.js
Ruta o ubicación: /BDLocal/sync/bdl.sync.index.js
Función o funciones:
- Ser el único punto de entrada del motor nuevo de sincronización.
- Aceptar únicamente solicitudes manuales y explícitas.
- Bloquear ejecuciones paralelas.
- Limitar cada solicitud a lotes de máximo 25 cambios.
- Mantener pausa de emergencia y estado consultable.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "0.4.0-manual-lock";
  var MAX_BATCH_SIZE = 25;
  var state = {
    running:false,
    lockId:"",
    startedAt:"",
    pausedReason:"",
    lastRunAt:"",
    lastResult:null,
    blockedAutomaticRequests:0
  };

  function text(value){ return String(value == null ? "" : value).trim(); }
  function num(value,fallback){ value = Number(value); return Number.isFinite(value) ? value : (fallback || 0); }
  function nowISO(){ return new Date().toISOString(); }
  function outbox(){ return window.BDLSyncOutbox || null; }
  function orchestrator(){ return window.BDLSyncOrchestrator || null; }

  function basePath(){
    var script = document.currentScript;
    var src = script && script.getAttribute ? text(script.getAttribute("src")) : "";
    if(!src){ return "sync/"; }
    return src.slice(0,src.lastIndexOf("/") + 1);
  }

  function loadOnce(src){
    if(!src || document.querySelector('script[data-bdl-sync-extra="' + src + '"]')){ return; }
    var script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.bdlSyncExtra = src;
    document.body.appendChild(script);
  }

  function loadExtraTargets(){
    if(window.BDLSyncTargetFirebase){ return; }
    loadOnce(basePath() + "targets/bdl.sync.target.firebase.js");
  }

  function setPaused(reason){
    state.pausedReason = text(reason || "");
    try{
      window.dispatchEvent(new CustomEvent("bdlocal:sync-pause-changed",{
        detail:{ paused:!!state.pausedReason,reason:state.pausedReason,at:nowISO() }
      }));
    }catch(error){}
    return state.pausedReason;
  }

  function isPaused(){ return !!state.pausedReason; }

  function safeBatch(value){
    value = num(value,MAX_BATCH_SIZE);
    if(value <= 0){ value = MAX_BATCH_SIZE; }
    return Math.min(MAX_BATCH_SIZE,Math.max(1,value));
  }

  function status(){
    loadExtraTargets();
    var base = {
      version:VERSION,
      manualOnly:true,
      maxBatchSize:MAX_BATCH_SIZE,
      running:!!state.running,
      lockId:state.lockId,
      startedAt:state.startedAt,
      paused:isPaused(),
      pausedReason:state.pausedReason,
      lastRunAt:state.lastRunAt,
      lastResult:state.lastResult,
      blockedAutomaticRequests:state.blockedAutomaticRequests,
      targets:window.BDLSyncTargets && typeof window.BDLSyncTargets.list === "function" ? window.BDLSyncTargets.list() : [],
      outboxReady:!!outbox(),
      orchestratorReady:!!orchestrator()
    };
    if(orchestrator() && typeof orchestrator().status === "function"){
      return orchestrator().status().then(function(detail){ return Object.assign(base,{ detail:detail }); });
    }
    if(outbox() && typeof outbox().counts === "function"){
      return outbox().counts({}).then(function(counts){ return Object.assign(base,{ counts:counts }); });
    }
    return Promise.resolve(base);
  }

  function blockedResult(message,extra){
    state.lastResult = Object.assign({ ok:false,blocked:true,message:message,at:nowISO() },extra || {});
    return Promise.resolve(state.lastResult);
  }

  function request(options){
    options = Object.assign({},options || {});
    loadExtraTargets();

    if(options.manual !== true){
      state.blockedAutomaticRequests += 1;
      return blockedResult("Solicitud automática bloqueada. La sincronización solo puede iniciarse manualmente.",{
        automatic:true,
        source:text(options.source || "desconocido")
      });
    }

    if(isPaused()){
      return blockedResult("Sincronización pausada: " + state.pausedReason,{
        paused:true,
        pausedReason:state.pausedReason
      });
    }

    if(state.running){
      return blockedResult("Ya existe una sincronización en curso. No se inició un proceso paralelo.",{
        alreadyRunning:true,
        lockId:state.lockId,
        startedAt:state.startedAt
      });
    }

    if(!text(options.periodoId) && options.allowAllPeriods !== true){
      return blockedResult("Seleccione un período antes de sincronizar.",{
        missingPeriod:true
      });
    }

    options.limit = safeBatch(options.limit || options.batchSize);
    options.batchSize = options.limit;
    options.manual = true;
    options.idleOnly = false;
    options.automatic = false;

    state.running = true;
    state.lockId = "sync_lock__" + Date.now() + "__" + Math.random().toString(16).slice(2);
    state.startedAt = nowISO();
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
      state.lastResult = { ok:false,message:"BDLSyncV2 está preparado, pero el orquestador no está disponible.",options:options };
      return Promise.resolve(state.lastResult);
    }

    return orchestrator().syncQueue(options).then(function(result){
      state.lastResult = result;
      return result;
    }).catch(function(error){
      state.lastResult = { ok:false,message:error.message || String(error),at:nowISO() };
      return state.lastResult;
    }).finally(function(){
      var finishedLock = state.lockId;
      state.running = false;
      state.lockId = "";
      state.startedAt = "";
      try{
        window.dispatchEvent(new CustomEvent("bdlocal:sync-v2-finished",{
          detail:{ lockId:finishedLock,result:state.lastResult,at:nowISO() }
        }));
      }catch(error){}
    });
  }

  window.BDLSyncV2 = {
    version:VERSION,
    manualOnly:true,
    maxBatchSize:MAX_BATCH_SIZE,
    status:status,
    request:request,
    syncQueue:request,
    setPaused:setPaused,
    pause:function(reason){ return setPaused(reason || "Pausa manual"); },
    resume:function(){ return setPaused(""); },
    isPaused:isPaused,
    isRunning:function(){ return !!state.running; },
    loadExtraTargets:loadExtraTargets
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded",loadExtraTargets);
  }else{
    loadExtraTargets();
  }
})(window, document);
