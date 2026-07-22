/* =========================================================
Nombre completo: maq-baselocal-background-sync.js
Ruta o ubicación: /Maqueta/maq-baselocal-background-sync.js
Función o funciones:
- Detectar cuándo Requisitos deja de usarse mediante foco e inactividad del sistema.
- Sincronizar un único lote pequeño después de tres minutos de inactividad.
- Mantener pausas, límites y un bloqueo persistente para evitar ciclos paralelos.
- Delegar las operaciones de BDLocal al puente seguro del proceso principal.
- Procesar todos los períodos y destinos habilitados antes de permitir el cierre.
- Mostrar una pantalla de bloqueo mientras se sincroniza para cerrar.
Con qué se conecta:
- Maqueta/maq-core.js
- electron/preload.js
- electron/main-safe.js
- BDLocal/bl2.html
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="4.1.0-idle-safe-close-bridge";
  var STATUS_KEY="REQ_MAQ_BL_BACKGROUND_SYNC_STATUS_V2";
  var AUTO_KEY="REQ_BL_AUTO_SYNC_ENABLED_V1";
  var GOOGLE_AUTO_KEY="REQ_BL_AUTO_SYNC_GOOGLE_ENABLED_V1";
  var LOCK_KEY="REQ_MAQ_BL_AUTO_SYNC_LOCK_V1";
  var OWNER_KEY="REQ_MAQ_BL_AUTO_SYNC_OWNER_V1";

  var IDLE_MS=3*60*1000;
  var QUIET_AFTER_CHANGE_MS=60*1000;
  var CHECK_EVERY_MS=15000;
  var AUTO_COOLDOWN_MS=5*60*1000;
  var ERROR_PAUSE_MS=30*60*1000;
  var AUTO_BATCH_SIZE=5;
  var CLOSE_BATCH_SIZE=25;
  var MAX_CONSECUTIVE_ERRORS=2;
  var LOCK_TTL_MS=2*60*1000;
  var LOCK_HEARTBEAT_MS=30000;
  var CLOSE_TIMEOUT_MS=5*60*1000;
  var MAX_CLOSE_REQUESTS=200;
  var API_WAIT_MS=45000;

  var state={
    started:false,
    running:false,
    checking:false,
    closing:false,
    lastActivityAt:Date.now(),
    lastChangeAt:Date.now(),
    lastRunAt:0,
    errorPauseUntil:0,
    consecutiveErrors:0,
    timer:null,
    heartbeat:null,
    baseFrame:null,
    lastResult:null,
    ownerId:"",
    lastFocused:null
  };

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function sleep(ms){return new Promise(function(resolve){window.setTimeout(resolve,ms);});}
  function parse(value,fallback){try{return value?JSON.parse(value):fallback;}catch(error){return fallback;}}
  function number(value,fallback){value=Number(value);return Number.isFinite(value)?value:Number(fallback||0);}
  function statusText(message){var node=document.getElementById("maq-status-text");if(node){node.textContent=message;}}
  function memoryText(message){var node=document.getElementById("maq-memory-text");if(node){node.textContent=message;}}

  function saveStatus(patch){
    var current=parse(window.localStorage.getItem(STATUS_KEY),{})||{};
    var next=Object.assign({},current,patch||{}, {
      version:VERSION,
      updatedAt:now(),
      source:"MaquetaAutoSync"
    });
    try{window.localStorage.setItem(STATUS_KEY,JSON.stringify(next));}catch(error){}
    state.lastResult=next;
    return next;
  }

  function getOwnerId(){
    if(state.ownerId){return state.ownerId;}
    try{state.ownerId=text(window.sessionStorage.getItem(OWNER_KEY));}catch(error){}
    if(!state.ownerId){
      state.ownerId="autosync__"+Date.now()+"__"+Math.random().toString(16).slice(2);
      try{window.sessionStorage.setItem(OWNER_KEY,state.ownerId);}catch(error){}
    }
    return state.ownerId;
  }

  function autoEnabled(){
    try{
      var value=window.localStorage.getItem(AUTO_KEY);
      if(value===null){window.localStorage.setItem(AUTO_KEY,"true");return true;}
      return value==="true";
    }catch(error){return true;}
  }

  function googleAutoEnabled(){
    try{return window.localStorage.getItem(GOOGLE_AUTO_KEY)==="true";}catch(error){return false;}
  }

  function markActivity(){
    state.lastActivityAt=Date.now();
    if(!state.closing){
      saveStatus({mode:"waiting",message:"Esperando inactividad para sincronizar.",lastActivityAt:new Date(state.lastActivityAt).toISOString()});
    }
  }

  function markChange(){
    state.lastChangeAt=Date.now();
    saveStatus({mode:"pending",message:"Cambio local detectado; se espera el período de seguridad.",lastChangeAt:new Date(state.lastChangeAt).toISOString()});
  }

  function bindActivityTarget(target){
    if(!target||target.__reqAutoSyncActivityBound){return;}
    try{target.__reqAutoSyncActivityBound=true;}catch(error){}
    ["pointerdown","mousedown","keydown","input","change","wheel","touchstart","scroll"].forEach(function(eventName){
      try{target.addEventListener(eventName,markActivity,{capture:true,passive:eventName!=="keydown"&&eventName!=="input"&&eventName!=="change"});}catch(error){
        try{target.addEventListener(eventName,markActivity,true);}catch(innerError){}
      }
    });
  }

  function watchActivity(){
    bindActivityTarget(window);
    bindActivityTarget(document);
    window.addEventListener("focus",markActivity);
    window.addEventListener("message",function(event){
      var data=event&&event.data||{};
      if(data&&data.type==="REQ_APP_ACTIVITY"){markActivity();}
      if(data&&data.type==="REQ_BDLOCAL_CHANGE"){markChange();}
    });
  }

  function waitFor(test,timeoutMs,label){
    var started=Date.now();
    return new Promise(function(resolve,reject){
      (function check(){
        var result=null;
        try{result=test();}catch(error){}
        if(result){resolve(result);return;}
        if(Date.now()-started>=timeoutMs){reject(new Error(label||"Tiempo agotado esperando un módulo."));return;}
        window.setTimeout(check,100);
      })();
    });
  }

  function existingBaseFrame(){return document.querySelector('iframe[data-module-id="baselocal"]');}

  function ensureBaseFrame(){
    var existing=existingBaseFrame();
    if(existing){state.baseFrame=existing;return Promise.resolve(existing);}

    return waitFor(function(){
      var core=window.MAQ_CORE;
      return core&&core.router&&typeof core.router.navegarPorModuloId==="function"&&core.state&&core.state.moduloActivoId?core:null;
    },15000,"Maqueta no terminó de iniciar.").then(function(core){
      var active=text(core.state.moduloActivoId||"carga_excel");
      var previous=core.state.moduloAnteriorId;
      var host=document.getElementById("maq-main-frame-host");
      var oldVisibility=host?host.style.visibility:"";
      if(host){host.style.visibility="hidden";}
      try{
        core.router.navegarPorModuloId("baselocal");
        existing=existingBaseFrame();
        if(active&&active!=="baselocal"){core.router.navegarPorModuloId(active);}
        core.state.moduloAnteriorId=previous;
      }finally{
        if(host){host.style.visibility=oldVisibility;}
      }
      if(!existing){throw new Error("No se pudo preparar Base Local en segundo plano.");}
      state.baseFrame=existing;
      return existing;
    });
  }

  function bridge(){
    return window.electronAPI&&window.electronAPI.baseLocalSync
      ?window.electronAPI.baseLocalSync
      :null;
  }

  function waitForBaseApi(){
    return ensureBaseFrame().then(function(){
      return waitFor(function(){
        var api=bridge();
        return api&&typeof api.status==="function"?api:null;
      },10000,"El puente seguro de Electron no está disponible.");
    }).then(function(api){
      var started=Date.now();
      function probe(){
        return api.status().then(function(result){
          if(result&&result.ready){
            return api.installConfirmationGuard().then(function(){return result;});
          }
          if(Date.now()-started>=API_WAIT_MS){throw new Error(text(result&&result.message||"Base Local no terminó de preparar el motor de sincronización."));}
          return sleep(250).then(probe);
        });
      }
      return probe();
    });
  }

  function readLock(){return parse(window.localStorage.getItem(LOCK_KEY),null);}

  function acquireLock(reason){
    var ownerId=getOwnerId();
    var current=readLock();
    var currentExpires=Date.parse(current&&current.expiresAt||"")||0;
    if(current&&text(current.ownerId)!==ownerId&&currentExpires>Date.now()){
      return {ok:false,busy:true,lock:current};
    }
    var lock={
      ownerId:ownerId,
      reason:text(reason||"autosync"),
      startedAt:now(),
      heartbeatAt:now(),
      expiresAt:new Date(Date.now()+LOCK_TTL_MS).toISOString()
    };
    try{window.localStorage.setItem(LOCK_KEY,JSON.stringify(lock));}catch(error){return {ok:false,error:error.message||String(error)};}
    var verified=readLock();
    if(!verified||text(verified.ownerId)!==ownerId){return {ok:false,busy:true,lock:verified};}
    startHeartbeat(reason);
    return {ok:true,lock:verified};
  }

  function startHeartbeat(reason){
    stopHeartbeat();
    state.heartbeat=window.setInterval(function(){
      var current=readLock();
      if(!current||text(current.ownerId)!==getOwnerId()){stopHeartbeat();return;}
      current.reason=text(reason||current.reason||"autosync");
      current.heartbeatAt=now();
      current.expiresAt=new Date(Date.now()+LOCK_TTL_MS).toISOString();
      try{window.localStorage.setItem(LOCK_KEY,JSON.stringify(current));}catch(error){}
    },LOCK_HEARTBEAT_MS);
  }

  function stopHeartbeat(){if(state.heartbeat){window.clearInterval(state.heartbeat);state.heartbeat=null;}}

  function releaseLock(){
    stopHeartbeat();
    var current=readLock();
    if(current&&text(current.ownerId)===getOwnerId()){
      try{window.localStorage.removeItem(LOCK_KEY);}catch(error){}
    }
  }

  function enabledTargets(connectionStatus,mode){
    var config=connectionStatus&&connectionStatus.config||{};
    var targets=[];
    if(config.firebaseEnabled!==false){targets.push("firebase");}
    if(config.supabaseEnabled===true){targets.push("supabase");}
    if(config.sheetsEnabled===true&&(mode==="close"||googleAutoEnabled())){targets.push("google");}
    return targets;
  }

  function targetLabel(target){return target==="google"?"Google Sheets":target==="firebase"?"Firebase":"Supabase";}

  function summarize(mode,forceRetry){
    var api=bridge();
    if(!api){return Promise.reject(new Error("El puente seguro de Electron no está disponible."));}
    return api.status().then(function(connectionStatus){
      if(!connectionStatus||!connectionStatus.ready){throw new Error(text(connectionStatus&&connectionStatus.message||"Base Local no está lista."));}
      var targets=enabledTargets(connectionStatus,mode);
      return api.snapshot({targets:targets,forceRetry:forceRetry===true}).then(function(summary){
        summary=summary||{};
        summary.targets=targets;
        summary.connectionStatus=connectionStatus;
        return summary;
      });
    });
  }

  function firstWork(summary){
    var targets=summary.targets||[];
    for(var i=0;i<targets.length;i+=1){
      var target=targets[i];
      var periods=summary.detail&&summary.detail[target]&&summary.detail[target].periods||{};
      var ids=Object.keys(periods).sort();
      if(ids.length){return {target:target,periodoId:ids[0],pending:periods[ids[0]]};}
    }
    return null;
  }

  function requestTarget(work,options){
    options=options||{};
    var api=bridge();
    if(!api){return Promise.reject(new Error("El puente seguro de Electron no está disponible."));}
    return api.request({
      target:work.target,
      periodoId:work.periodoId,
      periodoLabel:work.periodoId,
      source:text(options.source||"MAQAutoSync."+text(options.mode||"idle")),
      limit:number(options.limit,AUTO_BATCH_SIZE),
      forceRetry:options.forceRetry===true
    });
  }

  function updateElectronActivity(){
    var api=bridge();
    if(!api||typeof api.getIdleState!=="function"){return Promise.resolve(null);}
    return api.getIdleState().then(function(info){
      info=info||{};
      var focused=info.focused===true;
      var idleSeconds=number(info.systemIdleSeconds,0);
      if(state.lastFocused===true&&!focused){state.lastActivityAt=Date.now();}
      if(focused&&idleSeconds<IDLE_MS/1000){state.lastActivityAt=Date.now();}
      state.lastFocused=focused;
      return info;
    }).catch(function(){return null;});
  }

  function idleReady(){
    var current=Date.now();
    return autoEnabled()&&
      !state.running&&
      !state.closing&&
      current-state.lastActivityAt>=IDLE_MS&&
      current-state.lastChangeAt>=QUIET_AFTER_CHANGE_MS&&
      current-state.lastRunAt>=AUTO_COOLDOWN_MS&&
      current>=state.errorPauseUntil;
  }

  function runIdleCycle(){
    if(!idleReady()){
      return Promise.resolve({ok:true,skipped:true,message:"Aún no se cumplen las condiciones de inactividad."});
    }
    var lock=acquireLock("idle");
    if(!lock.ok){return Promise.resolve({ok:true,skipped:true,busy:true,message:"Otra sincronización mantiene el bloqueo."});}

    state.running=true;
    statusText("AutoSync: revisando cambios pendientes...");
    saveStatus({mode:"checking",message:"Revisando pendientes después de la inactividad."});

    var beforeTotal=0;
    return waitForBaseApi().then(function(){
      return summarize("idle",false).then(function(summary){
        beforeTotal=number(summary.total,0);
        if(summary.invalid&&summary.invalid.length){throw new Error("Existen cambios sin período válido; se requiere revisión manual.");}
        var latestPendingMs=Date.parse(text(summary.latestPendingAt||""))||0;
        if(latestPendingMs&&Date.now()-latestPendingMs<QUIET_AFTER_CHANGE_MS){
          state.lastChangeAt=Math.max(state.lastChangeAt,latestPendingMs);
          state.lastRunAt=Date.now();
          saveStatus({mode:"quiet",message:"Se detectó un cambio reciente; el lote esperará sesenta segundos.",latestPendingAt:summary.latestPendingAt,pending:summary.total,lastRunAt:now()});
          return {ok:true,skipped:true,quiet:true,pending:summary.total};
        }
        var work=firstWork(summary);
        if(!work){
          state.consecutiveErrors=0;
          state.lastRunAt=Date.now();
          saveStatus({mode:"synced",message:"No existen pendientes automáticos.",pending:0,lastRunAt:now()});
          statusText("AutoSync: todo sincronizado");
          return {ok:true,skipped:true,pending:0};
        }
        statusText("AutoSync: "+targetLabel(work.target)+" · máximo "+AUTO_BATCH_SIZE);
        saveStatus({mode:"syncing",message:"Sincronizando "+targetLabel(work.target)+" después de la inactividad.",target:work.target,periodoId:work.periodoId,pending:summary.total});
        return requestTarget(work,{mode:"idle",source:"MAQAutoSync.idle",limit:AUTO_BATCH_SIZE}).then(function(result){
          if(!result||result.ok===false){throw new Error(text(result&&(result.message||result.error)||"El destino rechazó la sincronización."));}
          return summarize("idle",false).then(function(after){
            if(number(after.total,0)>=beforeTotal&&beforeTotal>0){throw new Error("La cola no disminuyó; la sincronización automática fue pausada para evitar un ciclo.");}
            state.consecutiveErrors=0;
            state.lastRunAt=Date.now();
            statusText("AutoSync: lote confirmado");
            return saveStatus({mode:"completed",message:text(result.message||"Lote automático confirmado."),target:work.target,periodoId:work.periodoId,pending:after.total,lastRunAt:now()});
          });
        });
      });
    }).catch(function(error){
      state.consecutiveErrors+=1;
      if(state.consecutiveErrors>=MAX_CONSECUTIVE_ERRORS){state.errorPauseUntil=Date.now()+ERROR_PAUSE_MS;}
      statusText("AutoSync pausada por seguridad");
      return saveStatus({ok:false,mode:"error",message:error.message||String(error),consecutiveErrors:state.consecutiveErrors,pausedUntil:state.errorPauseUntil?new Date(state.errorPauseUntil).toISOString():""});
    }).finally(function(){
      state.running=false;
      releaseLock();
    });
  }

  function ensureOverlay(){
    var overlay=document.getElementById("maq-sync-close-overlay");
    if(overlay){return overlay;}
    overlay=document.createElement("div");
    overlay.id="maq-sync-close-overlay";
    overlay.setAttribute("role","alertdialog");
    overlay.setAttribute("aria-live","assertive");
    overlay.style.cssText="position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.94);display:flex;align-items:center;justify-content:center;padding:24px;color:#fff;font-family:Arial,sans-serif;";
    overlay.innerHTML='<div style="width:min(620px,92vw);background:#fff;color:#0f172a;border-radius:18px;padding:28px;box-shadow:0 24px 80px rgba(0,0,0,.35)"><div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#475569">Cierre protegido</div><h2 style="margin:8px 0 10px;font-size:25px">Sincronizando antes de cerrar</h2><p id="maq-sync-close-message" style="margin:0 0 18px;line-height:1.5;color:#334155">Preparando Base Local...</p><div style="height:10px;background:#e2e8f0;border-radius:999px;overflow:hidden"><div id="maq-sync-close-progress" style="height:100%;width:8%;background:#2563eb;transition:width .2s ease"></div></div><p style="margin:14px 0 0;font-size:13px;color:#64748b">La aplicación permanecerá abierta si algún destino no confirma los cambios.</p></div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function updateOverlay(message,percent){
    var overlay=ensureOverlay();
    var messageNode=overlay.querySelector("#maq-sync-close-message");
    var progressNode=overlay.querySelector("#maq-sync-close-progress");
    if(messageNode){messageNode.textContent=text(message||"Sincronizando...");}
    if(progressNode){progressNode.style.width=Math.max(5,Math.min(100,number(percent,5)))+"%";}
  }

  function removeOverlay(){var overlay=document.getElementById("maq-sync-close-overlay");if(overlay&&overlay.parentNode){overlay.parentNode.removeChild(overlay);}}

  function handleCloseRequest(){
    if(state.closing||state.running){
      return Promise.resolve({ok:false,canClose:false,busy:true,message:"Hay una sincronización en curso. Espere a que finalice."});
    }
    state.closing=true;
    state.running=true;
    ensureOverlay();
    updateOverlay("Revisando todos los períodos y destinos habilitados...",5);
    var lock=acquireLock("close");
    if(!lock.ok){
      state.closing=false;
      state.running=false;
      removeOverlay();
      return Promise.resolve({ok:false,canClose:false,busy:true,message:"Otra sincronización está activa. Espere y vuelva a intentar."});
    }

    var startedAt=Date.now();
    var requests=0;
    var noProgress=0;
    var lastTotal=null;

    function finish(result){
      if(!result||result.canClose!==true){removeOverlay();}
      saveStatus(Object.assign({},result||{}, {mode:result&&result.canClose?"close-ready":"close-blocked",closeCheckedAt:now()}));
      return result;
    }

    function step(){
      if(Date.now()-startedAt>CLOSE_TIMEOUT_MS){
        return Promise.resolve({ok:false,canClose:false,message:"La sincronización previa al cierre superó cinco minutos. La aplicación permanecerá abierta.",requests:requests});
      }
      if(requests>=MAX_CLOSE_REQUESTS){
        return Promise.resolve({ok:false,canClose:false,message:"Se alcanzó el límite de seguridad de solicitudes. La aplicación permanecerá abierta.",requests:requests});
      }

      return summarize("close",true).then(function(summary){
        if(summary.invalid&&summary.invalid.length){
          return {ok:false,canClose:false,message:"Existen cambios sin período válido. Revise la cola de Base Local antes de cerrar.",invalid:summary.invalid};
        }
        if(number(summary.total,0)===0){
          updateOverlay("Todos los cambios fueron confirmados. Cerrando...",100);
          return {ok:true,canClose:true,message:"Todos los destinos habilitados están sincronizados.",requests:requests,pending:0};
        }

        if(lastTotal!==null&&number(summary.total,0)>=lastTotal){noProgress+=1;}else{noProgress=0;}
        lastTotal=number(summary.total,0);
        if(noProgress>=MAX_CONSECUTIVE_ERRORS){
          return {ok:false,canClose:false,message:"La cola no disminuyó después de dos intentos. El cierre fue bloqueado para evitar un ciclo.",pending:summary.total,requests:requests};
        }

        var work=firstWork(summary);
        if(!work){
          return {ok:false,canClose:false,message:"Hay pendientes, pero ninguno puede procesarse. Revise configuración, bloqueos y errores.",pending:summary.total};
        }

        requests+=1;
        var percent=Math.min(95,10+Math.round((requests/Math.max(requests+Math.ceil(number(summary.total,0)/CLOSE_BATCH_SIZE),1))*85));
        updateOverlay(targetLabel(work.target)+" · "+work.periodoId+" · "+summary.total+" pendiente(s)",percent);
        return requestTarget(work,{mode:"close",source:"MAQAutoSync.close",limit:CLOSE_BATCH_SIZE,forceRetry:true}).then(function(result){
          if(!result||result.ok===false){
            return {ok:false,canClose:false,message:targetLabel(work.target)+" no confirmó el lote: "+text(result&&(result.message||result.error)||"error sin detalle"),target:work.target,periodoId:work.periodoId,pending:summary.total,requests:requests};
          }
          return step();
        });
      });
    }

    return waitForBaseApi().then(step).catch(function(error){
      return {ok:false,canClose:false,message:error.message||String(error),requests:requests};
    }).then(finish).finally(function(){
      state.closing=false;
      state.running=false;
      releaseLock();
    });
  }

  function check(){
    if(state.checking){return;}
    state.checking=true;
    updateElectronActivity().then(function(){
      if(!autoEnabled()){
        saveStatus({mode:"paused",message:"Sincronización automática desactivada."});
        memoryText("AutoSync desactivada");
        return;
      }
      if(Date.now()<state.errorPauseUntil){memoryText("AutoSync pausada por error");return;}
      if(state.running){memoryText("AutoSync procesando");return;}
      var idleFor=Date.now()-state.lastActivityAt;
      if(idleFor<IDLE_MS){memoryText("AutoSync espera inactividad");return;}
      memoryText("AutoSync revisando pendientes");
      return runIdleCycle();
    }).catch(function(error){saveStatus({ok:false,mode:"warning",message:error.message||String(error)});}).finally(function(){state.checking=false;});
  }

  function enable(){try{window.localStorage.setItem(AUTO_KEY,"true");}catch(error){}markActivity();return status();}
  function disable(){try{window.localStorage.setItem(AUTO_KEY,"false");}catch(error){}saveStatus({mode:"paused",message:"Sincronización automática desactivada por el usuario."});return status();}
  function enableGoogle(){try{window.localStorage.setItem(GOOGLE_AUTO_KEY,"true");}catch(error){}return status();}
  function disableGoogle(){try{window.localStorage.setItem(GOOGLE_AUTO_KEY,"false");}catch(error){}return status();}

  function status(){
    return Object.assign({},parse(window.localStorage.getItem(STATUS_KEY),{})||{}, {
      version:VERSION,
      automatic:autoEnabled(),
      googleAutomatic:googleAutoEnabled(),
      running:state.running,
      closing:state.closing,
      lastActivityAt:new Date(state.lastActivityAt).toISOString(),
      lastChangeAt:new Date(state.lastChangeAt).toISOString(),
      lastRunAt:state.lastRunAt?new Date(state.lastRunAt).toISOString():"",
      errorPauseUntil:state.errorPauseUntil?new Date(state.errorPauseUntil).toISOString():"",
      limits:{idleMs:IDLE_MS,quietMs:QUIET_AFTER_CHANGE_MS,cooldownMs:AUTO_COOLDOWN_MS,autoBatch:AUTO_BATCH_SIZE,closeBatch:CLOSE_BATCH_SIZE,maxErrors:MAX_CONSECUTIVE_ERRORS}
    });
  }

  function boot(){
    if(state.started){return;}
    state.started=true;
    getOwnerId();
    watchActivity();
    if(autoEnabled()){saveStatus({ok:true,mode:"waiting",message:"AutoSync activa; espera tres minutos de inactividad.",automatic:true});}
    else{saveStatus({ok:true,mode:"paused",message:"Sincronización automática desactivada.",automatic:false});}
    ensureBaseFrame().then(waitForBaseApi).then(function(){
      memoryText(autoEnabled()?"AutoSync protegida activa":"AutoSync desactivada");
    }).catch(function(error){
      saveStatus({ok:false,mode:"warning",message:error.message||String(error)});
      memoryText("AutoSync pendiente de Base Local");
    });
    state.timer=window.setInterval(check,CHECK_EVERY_MS);
  }

  window.MAQ_BASELOCAL_BACKGROUND_SYNC={
    version:VERSION,
    boot:boot,
    run:runIdleCycle,
    handleCloseRequest:handleCloseRequest,
    enable:enable,
    disable:disable,
    enableGoogle:enableGoogle,
    disableGoogle:disableGoogle,
    markActivity:markActivity,
    markChange:markChange,
    status:status,
    removeCloseOverlay:removeOverlay,
    constants:{idleMs:IDLE_MS,quietMs:QUIET_AFTER_CHANGE_MS,autoBatch:AUTO_BATCH_SIZE,closeBatch:CLOSE_BATCH_SIZE}
  };

  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
})(window,document);
