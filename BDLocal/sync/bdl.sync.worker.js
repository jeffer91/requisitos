/* =========================================================
Nombre completo: bdl.sync.worker.js
Ruta o ubicación: /Requisitos/BDLocal/sync/bdl.sync.worker.js
Función o funciones:
- Procesar la cola de sincronización en segundo plano.
- Subir cambios pendientes poco a poco sin bloquear la app.
- Enviar cada cambio a Firebase, Supabase o Google Sheets según corresponda.
- Reintentar errores cuando vuelva internet.
- Emitir avance para el semáforo de sincronización.
Con qué se conecta:
- bdl.sync.queue.js
- bdl.sync.status.js
- bdl.sync.upload.js
- bdl.sync.firebase.js
- fb.upload.js
- sb.upload-critical.js
- gs.sync-continuous.js
========================================================= */
(function(window){
  "use strict";

  var S = window.BDLSyncConfig || null;

  var state = {
    running: false,
    startedAt: "",
    finishedAt: "",
    lastError: "",
    currentBase: "",
    currentLabel: "",
    processed: 0,
    total: 0,
    percent: 0,
    timer: null
  };

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function now(){
    return S && typeof S.now === "function" ? S.now() : new Date().toISOString();
  }

  function clone(value){
    try{
      return JSON.parse(JSON.stringify(value == null ? null : value));
    }catch(error){
      return value;
    }
  }

  function emit(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, { detail:detail || {} }));
    }catch(error){}
  }

  function online(){
    return typeof navigator === "undefined" || navigator.onLine !== false;
  }

  function labelBase(base){
    if(window.BDLSyncChanges && typeof window.BDLSyncChanges.labelBase === "function"){
      return window.BDLSyncChanges.labelBase(base);
    }

    if(base === "firebase"){ return "Firebase"; }
    if(base === "supabase"){ return "Supabase"; }
    if(base === "google_sheets"){ return "Google Sheets"; }
    return base || "";
  }

  function publishStatus(extra){
    var payload = Object.assign({}, clone(state), extra || {}, {
      updatedAt: now()
    });

    if(window.BDLSyncStatus && typeof window.BDLSyncStatus.patch === "function"){
      try{
        window.BDLSyncStatus.patch(payload);
      }catch(error){}
    }

    emit("bdlocal:sync-worker-status", payload);

    return payload;
  }

  function maxBatch(){
    var n = S && S.limites && S.limites.loteSubida ? Number(S.limites.loteSubida) : 100;
    return Number.isFinite(n) && n > 0 ? n : 100;
  }

  function queue(){
    if(!window.BDLSyncQueue){
      throw new Error("BDLSyncQueue no está disponible.");
    }

    return window.BDLSyncQueue;
  }

  function logStart(detail){
    if(window.BDLSyncLog && typeof window.BDLSyncLog.crear === "function"){
      return window.BDLSyncLog.crear("sync_worker", S && S.estados ? S.estados.uploading : "uploading", detail || {}).catch(function(){
        return null;
      });
    }

    return Promise.resolve(null);
  }

  function logEnd(log, estado, detail){
    if(log && window.BDLSyncLog && typeof window.BDLSyncLog.cerrar === "function"){
      return window.BDLSyncLog.cerrar(log, estado, detail || {}).catch(function(){
        return log;
      });
    }

    return Promise.resolve(log);
  }

  function callIf(path, item){
    var fn = path.fn;
    var ctx = path.ctx || window;

    if(typeof fn !== "function"){
      return null;
    }

    return Promise.resolve().then(function(){
      return fn.call(ctx, item);
    });
  }

  function uploadFirebase(item){
    var candidates = [
      { ctx: window.BDLSyncUpload, fn: window.BDLSyncUpload && (window.BDLSyncUpload.subirItem || window.BDLSyncUpload.uploadItem || window.BDLSyncUpload.enviarItem) },
      { ctx: window.BDLSyncFirebase, fn: window.BDLSyncFirebase && (window.BDLSyncFirebase.saveQueueItem || window.BDLSyncFirebase.saveItem || window.BDLSyncFirebase.uploadItem) },
      { ctx: window.BDLFirebaseUpload, fn: window.BDLFirebaseUpload && (window.BDLFirebaseUpload.uploadItem || window.BDLFirebaseUpload.upsert || window.BDLFirebaseUpload.save) },
      { ctx: window.BDLFirebaseAdapter, fn: window.BDLFirebaseAdapter && (window.BDLFirebaseAdapter.uploadItem || window.BDLFirebaseAdapter.upsert || window.BDLFirebaseAdapter.save) }
    ];

    var selected = candidates.filter(function(c){ return typeof c.fn === "function"; })[0];

    if(!selected){
      return Promise.reject(new Error("No hay adaptador Firebase disponible para subir el cambio."));
    }

    return callIf(selected, item);
  }

  function uploadSupabase(item){
    var candidates = [
      { ctx: window.BDLSupabaseUploadCritical, fn: window.BDLSupabaseUploadCritical && (window.BDLSupabaseUploadCritical.uploadItem || window.BDLSupabaseUploadCritical.upsert || window.BDLSupabaseUploadCritical.save) },
      { ctx: window.BDLSupabaseAdapter, fn: window.BDLSupabaseAdapter && (window.BDLSupabaseAdapter.uploadItem || window.BDLSupabaseAdapter.upsert || window.BDLSupabaseAdapter.save) },
      { ctx: window.BDLSupabaseClient, fn: window.BDLSupabaseClient && (window.BDLSupabaseClient.uploadItem || window.BDLSupabaseClient.upsert || window.BDLSupabaseClient.save) }
    ];

    var selected = candidates.filter(function(c){ return typeof c.fn === "function"; })[0];

    if(!selected){
      return Promise.reject(new Error("No hay adaptador Supabase disponible para subir el cambio."));
    }

    return callIf(selected, item);
  }

  function uploadGoogleSheets(item){
    var candidates = [
      { ctx: window.BDLGSSyncContinuous, fn: window.BDLGSSyncContinuous && (window.BDLGSSyncContinuous.uploadItem || window.BDLGSSyncContinuous.enqueueItem || window.BDLGSSyncContinuous.save) },
      { ctx: window.BDLGoogleSheetsContinuous, fn: window.BDLGoogleSheetsContinuous && (window.BDLGoogleSheetsContinuous.uploadItem || window.BDLGoogleSheetsContinuous.enqueueItem || window.BDLGoogleSheetsContinuous.save) },
      { ctx: window.BDLGoogleSheetsAdapter, fn: window.BDLGoogleSheetsAdapter && (window.BDLGoogleSheetsAdapter.uploadItem || window.BDLGoogleSheetsAdapter.upsert || window.BDLGoogleSheetsAdapter.save) },
      { ctx: window.BDLGSAdapter, fn: window.BDLGSAdapter && (window.BDLGSAdapter.uploadItem || window.BDLGSAdapter.upsert || window.BDLGSAdapter.save) }
    ];

    var selected = candidates.filter(function(c){ return typeof c.fn === "function"; })[0];

    if(!selected){
      return Promise.reject(new Error("No hay adaptador Google Sheets disponible para subir el cambio."));
    }

    return callIf(selected, item);
  }

  function uploadItem(item){
    var base = text(item && item.base);

    if(base === "firebase"){
      return uploadFirebase(item);
    }

    if(base === "supabase"){
      return uploadSupabase(item);
    }

    if(base === "google_sheets"){
      return uploadGoogleSheets(item);
    }

    return Promise.reject(new Error("Base de sincronización no reconocida: " + base));
  }

  function processOne(item){
    state.currentBase = text(item.base);
    state.currentLabel = labelBase(item.base);
    state.lastError = "";

    publishStatus({
      status: "processing",
      message: "Sincronizando " + state.currentLabel
    });

    return queue().marcarProcesando(item).then(function(current){
      return uploadItem(current).then(function(response){
        return queue().marcarSincronizado(current, response || {}).then(function(){
          state.processed += 1;
          state.percent = state.total ? Math.round((state.processed / state.total) * 100) : 100;

          publishStatus({
            status: "processing",
            message: state.currentLabel + " " + state.percent + "%"
          });

          return {
            ok: true,
            item: current,
            response: response || {}
          };
        });
      }).catch(function(error){
        state.lastError = error && error.message ? error.message : String(error || "Error de sincronización");

        return queue().marcarError(current, error).then(function(){
          state.processed += 1;
          state.percent = state.total ? Math.round((state.processed / state.total) * 100) : 100;

          publishStatus({
            status: "error",
            message: state.currentLabel + " pendiente",
            error: state.lastError
          });

          return {
            ok: false,
            item: current,
            error: state.lastError
          };
        });
      });
    });
  }

  function processList(items){
    items = Array.isArray(items) ? items : [];

    var results = [];
    var chain = Promise.resolve();

    items.forEach(function(item){
      chain = chain.then(function(){
        return processOne(item).then(function(result){
          results.push(result);
          return result;
        });
      });
    });

    return chain.then(function(){
      return results;
    });
  }

  function run(options){
    options = options || {};

    if(state.running){
      return Promise.resolve({
        ok: true,
        running: true,
        message: "La sincronización ya está en proceso."
      });
    }

    if(!online()){
      state.lastError = "Sin internet.";
      publishStatus({
        status: "offline",
        message: "Sin internet. Los cambios quedan pendientes.",
        error: state.lastError
      });

      return Promise.resolve({
        ok: false,
        offline: true,
        message: state.lastError
      });
    }

    state.running = true;
    state.startedAt = now();
    state.finishedAt = "";
    state.lastError = "";
    state.currentBase = "";
    state.currentLabel = "";
    state.processed = 0;
    state.total = 0;
    state.percent = 0;

    publishStatus({
      status: "starting",
      message: "Preparando sincronización"
    });

    var logRef = null;

    return logStart({
      source: options.source || "BDLSyncWorker",
      manual: !!options.manual,
      at: now()
    }).then(function(log){
      logRef = log;

      return queue().reintentarErrores();
    }).then(function(){
      return queue().pendientes(options.limit || maxBatch(), options.base || "");
    }).then(function(items){
      state.total = items.length;
      state.percent = items.length ? 0 : 100;

      publishStatus({
        status: items.length ? "processing" : "completed",
        message: items.length ? ("Sincronizando 0 de " + items.length) : "Sin pendientes"
      });

      if(!items.length){
        return [];
      }

      return processList(items);
    }).then(function(results){
      var ok = results.filter(function(x){ return x.ok; }).length;
      var bad = results.filter(function(x){ return !x.ok; }).length;

      state.running = false;
      state.finishedAt = now();
      state.percent = state.total ? Math.round((state.processed / state.total) * 100) : 100;

      publishStatus({
        status: bad ? "partial" : "completed",
        message: bad ? ("Sincronización parcial: " + ok + " OK, " + bad + " pendientes") : "Sincronización completada",
        ok: ok,
        bad: bad
      });

      return logEnd(
        logRef,
        bad ? (S && S.estados ? S.estados.error : "error") : (S && S.estados ? S.estados.completed : "completed"),
        { ok:ok, bad:bad, total:results.length }
      ).then(function(){
        return {
          ok: bad === 0,
          total: results.length,
          synchronized: ok,
          errors: bad,
          results: results
        };
      });
    }).catch(function(error){
      state.running = false;
      state.finishedAt = now();
      state.lastError = error && error.message ? error.message : String(error || "Error de sincronización");

      publishStatus({
        status: "error",
        message: "Error general de sincronización",
        error: state.lastError
      });

      return logEnd(
        logRef,
        S && S.estados ? S.estados.error : "error",
        { error: state.lastError }
      ).then(function(){
        return {
          ok: false,
          error: state.lastError
        };
      });
    });
  }

  function schedule(options){
    options = options || {};
    var delay = Number(options.delayMs == null ? 1500 : options.delayMs);

    if(state.timer){
      clearTimeout(state.timer);
      state.timer = null;
    }

    state.timer = setTimeout(function(){
      state.timer = null;
      run(Object.assign({}, options, { source:options.source || "schedule" }));
    }, Math.max(0, delay));

    return {
      ok: true,
      scheduled: true,
      delayMs: delay
    };
  }

  function startAuto(){
    window.addEventListener("online", function(){
      schedule({
        source: "online",
        delayMs: 1000
      });
    });

    window.addEventListener("bdlocal:sync-requested", function(event){
      schedule({
        source: event && event.detail && event.detail.source || "event",
        delayMs: 800
      });
    });

    window.addEventListener("bdlocal:changes-created", function(event){
      schedule({
        source: event && event.detail && event.detail.source || "changes",
        delayMs: 800
      });
    });

    emit("bdlocal:sync-worker-ready", {
      ready: true,
      at: now()
    });
  }

  function getState(){
    return clone(state);
  }

  window.BDLSyncWorker = {
    run: run,
    process: run,
    syncNow: run,
    schedule: schedule,
    syncBackground: schedule,
    getState: getState,
    startAuto: startAuto
  };

  startAuto();
})(window);