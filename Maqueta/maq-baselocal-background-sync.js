/* =========================================================
Nombre completo: maq-baselocal-background-sync.js
Ruta o ubicación: /Requisitos/Maqueta/maq-baselocal-background-sync.js
Función o funciones:
- Mantener disponible la sincronización Base Local ↔ Firebase en segundo plano.
- Respetar regla central: una sola sincronización automática por día.
- No bloquear el menú ni las pantallas internas de Requisitos.
- Dejar la sincronización automática pausada por defecto para acelerar el arranque.
- Si no hay internet, dejar pendiente para intentar después cuando se ejecute manualmente.
- Cargar servicios BL2 de sincronización incremental solo cuando se ejecuta Firebase.
Con qué se conecta:
- maq-index.html
- maq-baselocal-session.js
- BaseLocal/services/bl-sync-diario.js
- BaseLocal/baselocal.firebase.js
- BaseLocal2/sync/bl2-sync-queue.js
========================================================= */
(function(window, document){
  "use strict";

  var DAILY_KEY = "REQ_BL_LAST_DAILY_SYNC";
  var BG_STATUS_KEY = "REQ_MAQ_BL_BACKGROUND_SYNC_STATUS_V1";
  var RUN_LOCK_KEY = "REQ_MAQ_BL_BACKGROUND_SYNC_LOCK_V1";
  var AUTO_SYNC_KEY = "REQ_BL_AUTO_SYNC_ENABLED_V1";
  var VERSION = "1.2.0";
  var MAX_LOCK_MINUTES = 12;
  var started = false;

  function now(){return new Date().toISOString();}
  function today(){return now().slice(0, 10);}
  function readJson(key, fallback){try{var raw = window.localStorage.getItem(key);return raw ? JSON.parse(raw) : fallback;}catch(error){return fallback;}}
  function saveJson(key, value){try{window.localStorage.setItem(key, JSON.stringify(value));}catch(error){}return value;}
  function minutesSince(value){var time = Date.parse(String(value || ""));return Number.isFinite(time) ? ((Date.now() - time) / 60000) : 9999;}
  function autoSyncAllowed(){try{return window.localStorage.getItem(AUTO_SYNC_KEY)==="true";}catch(error){return false;}}
  function queueStatus(){try{return window.BL2SyncQueue && typeof window.BL2SyncQueue.status === "function" ? window.BL2SyncQueue.status() : null;}catch(error){return null;}}

  function saveStatus(payload){return saveJson(BG_STATUS_KEY, Object.assign({version:VERSION, updatedAt:now(), autoSyncEnabled:autoSyncAllowed(), queue:queueStatus()}, payload || {}));}

  function dailyAlreadyDone(){
    var state = readJson(DAILY_KEY, {date:"", ok:false, running:false});
    if(state.date === today() && state.ok === true){return true;}
    if(state.running === true && minutesSince(state.startedAt) < MAX_LOCK_MINUTES){return true;}
    return false;
  }

  function lockActive(){var lock = readJson(RUN_LOCK_KEY, {running:false, startedAt:""});return lock.running === true && minutesSince(lock.startedAt) < MAX_LOCK_MINUTES;}
  function setLock(running){return saveJson(RUN_LOCK_KEY, {running:!!running, startedAt:running ? now() : "", updatedAt:now()});}
  function scriptUrl(relativeOrAbsolute){try{return new URL(relativeOrAbsolute, document.currentScript ? document.currentScript.src : window.location.href).href;}catch(error){return relativeOrAbsolute;}}

  function loadScriptOnce(url, marker){
    return new Promise(function(resolve, reject){
      if(marker && window[marker]){resolve();return;}
      var existing = marker ? document.querySelector('script[data-maq-bg-marker="' + marker + '"]') : null;
      if(existing){existing.addEventListener("load", function(){resolve();});existing.addEventListener("error", function(){reject(new Error("No se pudo cargar " + url));});return;}
      var script = document.createElement("script");
      script.src = url;
      script.async = false;
      if(marker){script.dataset.maqBgMarker = marker;}
      script.onload = function(){if(marker){window[marker] = true;}resolve();};
      script.onerror = function(){reject(new Error("No se pudo cargar " + url));};
      document.head.appendChild(script);
    });
  }

  function emit(kind, payload){var detail = Object.assign({kind:kind, at:now()}, payload || {});try{window.dispatchEvent(new CustomEvent("maq:baselocal-background-sync:" + kind, {detail:detail}));}catch(error){}}

  async function loadDependencies(){
    await loadScriptOnce("https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js", "__REQ_BG_FIREBASE_APP__");
    await loadScriptOnce("https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js", "__REQ_BG_FIREBASE_FIRESTORE__");
    await loadScriptOnce(scriptUrl("../../incorporaciones/sedes/js/firebase-config.js"), "__REQ_BG_FIREBASE_CONFIG__");
    await loadScriptOnce(scriptUrl("../Gestion/Excel/excel-local/excel-local.config.js"), "__REQ_BG_EXCEL_LOCAL_CONFIG__");
    await loadScriptOnce(scriptUrl("../Gestion/Excel/excel-local/excel-local.storage.js"), "__REQ_BG_EXCEL_LOCAL_STORAGE__");
    await loadScriptOnce(scriptUrl("../Gestion/Excel/excel-local/excel-local.bridge.js"), "__REQ_BG_EXCEL_LOCAL_BRIDGE__");
    await loadScriptOnce(scriptUrl("../BaseLocal/services/bl-campos.js"), "__REQ_BG_BL_CAMPOS__");
    await loadScriptOnce(scriptUrl("../BaseLocal/services/bl-periodos-canon.service.js"), "__REQ_BG_BL_PERIODOS_CANON__");
    await loadScriptOnce(scriptUrl("../BaseLocal/services/bl-divisiones.service.js"), "__REQ_BG_BL_DIVISIONES__");
    await loadScriptOnce(scriptUrl("../BaseLocal/services/bl-normalizador.js"), "__REQ_BG_BL_NORMALIZADOR__");
    await loadScriptOnce(scriptUrl("../BaseLocal/services/bl-periodos.service.js"), "__REQ_BG_BL_PERIODOS_SERVICE__");
    await loadScriptOnce(scriptUrl("../BaseLocal/services/bl-estudiantes.service.js"), "__REQ_BG_BL_ESTUDIANTES_SERVICE__");
    await loadScriptOnce(scriptUrl("../BaseLocal/services/bl-sync-diario.js"), "__REQ_BG_BL_SYNC_DIARIO__");
    await loadScriptOnce(scriptUrl("../BaseLocal/services/bl-matricula.service.js"), "__REQ_BG_BL_MATRICULA__");
    await loadScriptOnce(scriptUrl("../BaseLocal/services/bl-firestore-patch.js"), "__REQ_BG_BL_FIRESTORE_PATCH__");
    await loadScriptOnce(scriptUrl("../BaseLocal2/sync/bl2-sync-queue.js"), "__REQ_BG_BL2_SYNC_QUEUE__");
    await loadScriptOnce(scriptUrl("../BaseLocal2/sync/bl2-conflicts.js"), "__REQ_BG_BL2_CONFLICTS__");
    await loadScriptOnce(scriptUrl("../BaseLocal2/sync/bl2-firebase-push.js"), "__REQ_BG_BL2_FIREBASE_PUSH__");
    await loadScriptOnce(scriptUrl("../BaseLocal2/sync/bl2-firebase-pull.js"), "__REQ_BG_BL2_FIREBASE_PULL__");
    await loadScriptOnce(scriptUrl("../BaseLocal/baselocal.connector.js"), "__REQ_BG_BL_CONNECTOR__");
    await loadScriptOnce(scriptUrl("../BaseLocal/baselocal.firebase.js"), "__REQ_BG_BL_FIREBASE_SERVICE__");
  }

  async function run(options){
    options = options || {};
    if(started && options.force !== true){return;}
    started = true;
    if(options.force !== true && !autoSyncAllowed()){saveStatus({ok:true, mode:"paused", skipped:true, message:"Sincronización automática pausada para que Requisitos abra más rápido."});return;}
    if(dailyAlreadyDone()){saveStatus({ok:true, mode:"skipped", skipped:true, message:"La sincronización diaria ya está resuelta o en ejecución."});return;}
    if(lockActive()){saveStatus({ok:true, mode:"locked", skipped:true, message:"Ya existe una sincronización en segundo plano."});return;}
    if(navigator.onLine === false){saveStatus({ok:false, mode:"offline", skipped:true, message:"Sin internet. La Base Local queda activa y Firebase se intentará después."});return;}
    setLock(true);
    saveStatus({ok:false, mode:"loading", running:true, message:"Preparando sincronización diaria en segundo plano."});
    emit("started", {mode:"background"});
    try{
      await loadDependencies();
      if(!window.BaseLocalFirebase || typeof window.BaseLocalFirebase.runDailyIfNeeded !== "function"){throw new Error("BaseLocalFirebase no quedó disponible para segundo plano.");}
      var result = await window.BaseLocalFirebase.runDailyIfNeeded(!!options.force, {mode:options.mode || "daily_background", background:true});
      if(window.MAQ_BASELOCAL_SESSION && typeof window.MAQ_BASELOCAL_SESSION.ensureReady === "function"){window.MAQ_BASELOCAL_SESSION.ensureReady({force:true});}
      saveStatus({ok:!!(result && result.ok), mode:"finished", running:false, result:result || null, message:(result && result.message) || "Sincronización en segundo plano finalizada."});
      emit("finished", result || {});
    }catch(error){
      var message = error && error.message ? error.message : String(error);
      saveStatus({ok:false, mode:"error", running:false, errorMessage:message, message:message});
      emit("error", {errorMessage:message});
    }finally{setLock(false);}
  }

  function schedule(){
    if(!autoSyncAllowed()){saveStatus({ok:true, mode:"paused", skipped:true, message:"Sincronización automática pausada. Usa Base Local > Sincronizar ahora cuando la necesites."});return;}
    if(dailyAlreadyDone()){saveStatus({ok:true, mode:"skipped", skipped:true, message:"La sincronización diaria ya se ejecutó hoy."});return;}
    if("requestIdleCallback" in window){window.requestIdleCallback(function(){setTimeout(run, 1800);}, {timeout:6500});}else{setTimeout(run, 5000);}
  }

  if(document.readyState === "loading"){document.addEventListener("DOMContentLoaded", schedule);}else{schedule();}
  window.MAQ_BASELOCAL_BACKGROUND_SYNC = {version:VERSION, run:run, status:function(){return readJson(BG_STATUS_KEY, {mode:"sin_estado"});}, autoSyncAllowed:autoSyncAllowed, autoSyncKey:AUTO_SYNC_KEY, queueStatus:queueStatus};
})(window, document);
