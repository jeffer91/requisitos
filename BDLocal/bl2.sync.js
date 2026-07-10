/* =========================================================
Nombre completo: bl2.sync.js
Ruta o ubicación: /BDLocal/bl2.sync.js
Función o funciones:
- Mantener compatibilidad con llamadas antiguas a BL2Sync.
- Centralizar toda escritura externa en BDLSyncV2.
- Bloquear sincronización automática, por inactividad y al cerrar.
- Exponer únicamente la inicialización compartida de Firebase.
- Limitar solicitudes manuales a un máximo de 25 cambios.
- No escribir directamente en Firebase ni Google Sheets.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="3.0.0-safe-compatibility-gate";
  var MAX_BATCH_SIZE=25;
  var state={firebaseReady:null,firebaseLoading:null,lastActivityAt:Date.now()};

  function text(value){return String(value==null?"":value).trim();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function now(){return new Date().toISOString();}
  function config(){return window.BL2Config||{};}
  function db(){return window.BL2DB||null;}
  function core(){return window.BL2Core||null;}
  function outbox(){return window.BDLSyncOutbox||null;}

  function normalizeCedula(value){
    var rules=window.BDLRulesPersona;
    if(rules&&typeof rules.normalizeCedula==="function"){return rules.normalizeCedula(value);}
    var utils=config().utils||{};
    if(typeof utils.normalizeCedula==="function"){return utils.normalizeCedula(value);}
    return text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
  }

  function canonicalPeriodId(value){
    value=text(value);
    var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }

  function markActivity(){state.lastActivityAt=Date.now();}
  function isIdle(){return false;}

  function progress(target,percent,detail){
    try{window.dispatchEvent(new CustomEvent("bl2:sync-progress",{detail:{target:text(target),percent:Math.max(0,Math.min(100,Number(percent||0))),detail:text(detail),at:now()}}));}catch(error){}
  }

  function blocked(message,source){
    return Promise.resolve({ok:true,skipped:true,blocked:true,manualOnly:true,source:text(source||"BL2Sync.compat"),message:message});
  }

  function activePeriod(){
    try{
      if(window.BL2App&&typeof window.BL2App.getSelectedPeriod==="function"){
        var selected=window.BL2App.getSelectedPeriod();
        if(selected&&text(selected.id)){return Promise.resolve({id:canonicalPeriodId(selected.id),label:text(selected.label||selected.id)});}
      }
    }catch(error){}
    if(core()&&typeof core().getActivePeriod==="function"){
      return core().getActivePeriod().then(function(period){return period&&text(period.id)?{id:canonicalPeriodId(period.id),label:text(period.label||period.periodoLabel||period.id)}:null;});
    }
    return Promise.resolve(null);
  }

  function getPeriod(options){
    options=options||{};
    if(text(options.periodoId)){return Promise.resolve({id:canonicalPeriodId(options.periodoId),label:text(options.periodoLabel||options.periodoId)});}
    return activePeriod();
  }

  function safeLimit(options){
    options=options||{};
    var requested=Math.floor(Number(options.limit||options.batchSize||MAX_BATCH_SIZE));
    return Math.min(MAX_BATCH_SIZE,Math.max(1,requested||MAX_BATCH_SIZE));
  }

  function getGoogleScriptUrl(){
    var current=db();
    var key=config().settingsKeys&&config().settingsKeys.googleScriptUrl||"googleScriptUrl";
    return current&&typeof current.getSetting==="function"?current.getSetting(key,""):Promise.resolve("");
  }

  function setGoogleScriptUrl(url){
    var current=db();
    var key=config().settingsKeys&&config().settingsKeys.googleScriptUrl||"googleScriptUrl";
    return current&&typeof current.setSetting==="function"?current.setSetting(key,text(url)):Promise.resolve(text(url));
  }

  function getPendingChangesFor(target,periodoId,options){
    target=text(target||"google").toLowerCase();
    periodoId=canonicalPeriodId(periodoId);
    options=Object.assign({},options||{},{periodoId:periodoId,limit:safeLimit(options)});
    if(!periodoId){return Promise.resolve([]);}
    if(outbox()&&typeof outbox().pending==="function"){return outbox().pending(target,options);}
    if(core()&&typeof core().getPendingChanges==="function"){
      return core().getPendingChanges(target,periodoId).then(function(rows){return (Array.isArray(rows)?rows:[]).slice(0,options.limit);});
    }
    return Promise.resolve([]);
  }

  function markChanges(changes,target,status,response){
    changes=Array.isArray(changes)?changes:[];
    target=text(target||"google").toLowerCase();
    status=text(status||"SINCRONIZADO").toUpperCase();
    if(outbox()&&typeof outbox().mark==="function"){
      return outbox().mark(changes,target,status,{syncedAt:now(),response:clone(response||{})});
    }
    return Promise.resolve({ok:true,updated:0,target:target,status:status,compatibilityFallback:true});
  }

  function loadScript(src){
    return new Promise(function(resolve,reject){
      var absolute;
      try{absolute=new URL(src,document.baseURI).href;}catch(error){absolute=src;}
      var existing=Array.prototype.slice.call(document.scripts||[]).find(function(script){return script.src===absolute||script.getAttribute("data-bl2-firebase-sdk")===src;});
      if(existing&&window.firebase){resolve(true);return;}
      var script=document.createElement("script");
      script.src=src;
      script.async=true;
      script.setAttribute("data-bl2-firebase-sdk",src);
      script.onload=function(){resolve(true);};
      script.onerror=function(){reject(new Error("No se pudo cargar Firebase SDK: "+src));};
      document.head.appendChild(script);
    });
  }

  function ensureFirebase(){
    if(state.firebaseReady){return Promise.resolve(state.firebaseReady);}
    if(state.firebaseLoading){return state.firebaseLoading;}
    state.firebaseLoading=Promise.resolve().then(function(){
      if(window.firebase&&window.firebase.firestore){return true;}
      return loadScript("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js")
        .then(function(){return loadScript("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js");});
    }).then(function(){
      if(!window.firebase||!window.firebase.firestore){throw new Error("Firebase SDK no quedó disponible.");}
      if(!window.firebase.apps||!window.firebase.apps.length){window.firebase.initializeApp(config().firebase&&config().firebase.config||{});}
      state.firebaseReady=window.firebase.firestore();
      return state.firebaseReady;
    }).finally(function(){state.firebaseLoading=null;});
    return state.firebaseLoading;
  }

  function requestTarget(target,options){
    options=Object.assign({},options||{});
    target=text(target).toLowerCase();
    if(options.manual!==true){return blocked("La sincronización automática está desactivada. Use una acción manual del Centro de Control.",options.source);}
    if(!window.BDLSyncV2||typeof window.BDLSyncV2.request!=="function"){
      return Promise.reject(new Error("BDLSyncV2 todavía no está disponible. Abra Base Local y vuelva a intentar."));
    }
    return getPeriod(options).then(function(period){
      if(!period){throw new Error("Seleccione un período antes de sincronizar.");}
      var limit=safeLimit(options);
      progress(target,5,"Preparando solicitud manual segura...");
      return window.BDLSyncV2.request({
        manual:true,
        automatic:false,
        source:text(options.source||"BL2Sync.compat.manual"),
        targets:[target],
        periodoId:period.id,
        periodoLabel:period.label,
        limit:limit,
        batchSize:limit,
        forceRetry:options.forceRetry===true
      });
    });
  }

  function syncGoogle(options){return requestTarget("google",options||{});}

  function syncFirebase(options){
    options=Object.assign({},options||{});
    var action=text(options.action||"upload").toLowerCase();
    if(options.manual!==true){return blocked("Firebase automático está desactivado. Use una acción manual del Centro de Control.",options.source);}
    if(action==="compare"||action==="download"){
      var guard=window.BL2FirebaseGuard;
      if(!guard||typeof guard.pullFirebaseToLocal!=="function"){return Promise.reject(new Error("La descarga segura de Firebase todavía no está disponible."));}
      return getPeriod(options).then(function(period){
        if(!period){throw new Error("Seleccione un período antes de consultar Firebase.");}
        return guard.pullFirebaseToLocal(period,{confirm:options.confirm!==false,previewOnly:action==="compare"});
      });
    }
    return requestTarget("firebase",options);
  }

  function maybeSyncGoogleIdle(options){return blocked("La sincronización por inactividad está desactivada.",options&&options.source);}
  function maybeSyncFirebaseDaily(options){return blocked("La sincronización diaria automática de Firebase está desactivada.",options&&options.source);}
  function syncBeforeClose(){return blocked("No se sincroniza al cerrar. Los cambios permanecen en cambios_pendientes.","BL2Sync.syncBeforeClose");}

  window.BL2Sync={
    version:VERSION,
    compatibilityOnly:true,
    manualOnly:true,
    automatic:false,
    singleGate:true,
    maxBatchSize:MAX_BATCH_SIZE,
    markActivity:markActivity,
    isIdle:isIdle,
    getGoogleScriptUrl:getGoogleScriptUrl,
    setGoogleScriptUrl:setGoogleScriptUrl,
    syncGoogle:syncGoogle,
    maybeSyncGoogleIdle:maybeSyncGoogleIdle,
    syncFirebase:syncFirebase,
    maybeSyncFirebaseDaily:maybeSyncFirebaseDaily,
    syncBeforeClose:syncBeforeClose,
    getPendingChangesFor:getPendingChangesFor,
    markChanges:markChanges,
    ensureFirebase:ensureFirebase,
    getState:function(){return clone(state);},
    status:function(){return {version:VERSION,compatibilityOnly:true,manualOnly:true,automatic:false,singleGate:true,maxBatchSize:MAX_BATCH_SIZE,directGoogleWrites:false,directFirebaseWrites:false};}
  };
})(window,document);
