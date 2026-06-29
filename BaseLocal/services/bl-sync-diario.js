/* =========================================================
Nombre completo: bl-sync-diario.js
Ruta o ubicación: /Requisitos/BaseLocal/services/bl-sync-diario.js
Función o funciones:
- Controlar la sincronización automática una vez al día.
- Evitar consultas repetidas a Firebase en el mismo día.
- Evitar doble ejecución si una sincronización ya está corriendo.
- Si no hay internet o falla Firebase, dejar pendiente para intentar después.
- Guardar estado diario en localStorage.
- Incluir estado de cola incremental BL2 cuando exista.
Con qué se conecta:
- maq-baselocal-background-sync.js
- baselocal.firebase.js
- baselocal.app.js
- ../BaseLocal2/sync/bl2-sync-queue.js
========================================================= */
(function(window){
  "use strict";

  var KEY = "REQ_BL_LAST_DAILY_SYNC";
  var RUNNING_LIMIT_MINUTES = 12;

  function now(){return new Date().toISOString();}
  function today(){return now().slice(0, 10);}
  function minutesSince(value){var time = Date.parse(String(value || ""));return Number.isFinite(time) ? ((Date.now() - time) / 60000) : 9999;}
  function queueStatus(){try{return window.BL2SyncQueue && typeof window.BL2SyncQueue.status === "function" ? window.BL2SyncQueue.status() : null;}catch(error){return null;}}

  function read(){
    try{
      var raw = window.localStorage.getItem(KEY);
      var data = raw ? JSON.parse(raw) : {date:"", lastRunAt:"", ok:false, running:false};
      data.queue = queueStatus();
      return data;
    }catch(error){
      return {date:"", lastRunAt:"", ok:false, running:false, queue:queueStatus()};
    }
  }

  function save(payload){
    var data = Object.assign({}, read(), payload || {}, {updatedAt:now(), queue:queueStatus()});
    try{window.localStorage.setItem(KEY, JSON.stringify(data));}catch(error){console.warn("[BLSyncDiario] Estado diario no guardado", error);}
    return data;
  }

  function isRunningFresh(state){state = state || read();return state.running === true && minutesSince(state.startedAt) < RUNNING_LIMIT_MINUTES;}
  function shouldRun(forceRun){if(forceRun){return true;}var state = read();if(isRunningFresh(state)){return false;}return state.date !== today() || state.ok !== true;}
  function markStarted(mode){return save({date:today(), mode:mode || "daily", startedAt:now(), ok:false, running:true, skipped:false, message:"Sincronización diaria iniciada en segundo plano."});}
  function markSuccess(summary){return save(Object.assign({}, summary || {}, {date:today(), lastRunAt:now(), ok:true, running:false, skipped:false, message:(summary && summary.message) || "Sincronización diaria completada."}));}
  function markPending(reason){var msg = reason && reason.message ? reason.message : String(reason || "Sincronización diaria pendiente.");return save({date:today(), lastRunAt:now(), ok:false, running:false, skipped:false, pending:true, errorMessage:msg, message:msg});}
  function markError(error){var msg = error && error.message ? error.message : String(error || "Error desconocido");return save({date:today(), lastRunAt:now(), ok:false, running:false, skipped:false, errorMessage:msg, message:msg});}
  function skipped(){var state = read();return Object.assign({}, state, {ok:state.ok === true, skipped:true, running:isRunningFresh(state), message:state.ok === true ? "La sincronización diaria ya se ejecutó hoy." : "La sincronización diaria ya está en curso o pendiente."});}
  function clearRunning(){return save({running:false});}

  window.BLSyncDiario = {key:KEY, today:today, read:read, save:save, shouldRun:shouldRun, markStarted:markStarted, markSuccess:markSuccess, markPending:markPending, markError:markError, skipped:skipped, clearRunning:clearRunning, isRunningFresh:isRunningFresh, queueStatus:queueStatus};
})(window);
