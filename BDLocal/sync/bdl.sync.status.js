/* =========================================================
Nombre completo: bdl.sync.status.js
Ruta o ubicación: /Requisitos/BDLocal/sync/bdl.sync.status.js
Función o funciones:
- Mantener el estado visual de sincronización de Base Local.
- Mostrar semáforo, porcentaje y base activa: Firebase, Supabase y Google Sheets.
- Guardar el último estado en localStorage para que no se pierda al recargar.
- Escuchar eventos de cola y sincronización para actualizar el indicador.
- Entregar datos listos para bdl.sync-indicator.js y bl.ui.js.
Con qué se conecta:
- bdl.sync.queue.js
- bdl.sync.worker.js
- bdl.sync.engine.js
- bdl.sync.upload.js
- bdl.sync.firebase.js
- bdl.sync-indicator.js
========================================================= */
(function(window){
  "use strict";

  var STORAGE_KEY = "REQ_BDLOCAL_SYNC_STATUS_V2";

  var DEFAULT_BASES = {
    firebase: {
      id: "firebase",
      label: "Firebase",
      status: "idle",
      percent: 100,
      pending: 0,
      processing: 0,
      done: 0,
      errors: 0,
      message: "Sin pendientes",
      updatedAt: ""
    },
    supabase: {
      id: "supabase",
      label: "Supabase",
      status: "idle",
      percent: 100,
      pending: 0,
      processing: 0,
      done: 0,
      errors: 0,
      message: "Sin pendientes",
      updatedAt: ""
    },
    google_sheets: {
      id: "google_sheets",
      label: "Google Sheets",
      status: "idle",
      percent: 100,
      pending: 0,
      processing: 0,
      done: 0,
      errors: 0,
      message: "Sin pendientes",
      updatedAt: ""
    }
  };

  var state = load() || initial();

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function now(){
    return new Date().toISOString();
  }

  function clone(value){
    try{
      return JSON.parse(JSON.stringify(value == null ? null : value));
    }catch(error){
      return value;
    }
  }

  function normalizeBase(value){
    var raw = text(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    if(raw === "sheets" || raw === "google" || raw === "google_sheets" || raw === "googlesheets"){
      return "google_sheets";
    }

    if(raw === "firestore"){
      return "firebase";
    }

    return raw || "";
  }

  function labelBase(base){
    base = normalizeBase(base);

    if(base === "firebase"){ return "Firebase"; }
    if(base === "supabase"){ return "Supabase"; }
    if(base === "google_sheets"){ return "Google Sheets"; }

    return base || "Base";
  }

  function initial(){
    return {
      globalStatus: "idle",
      globalLabel: "Sincronización lista",
      globalPercent: 100,
      activeBase: "",
      activeLabel: "",
      running: false,
      lastError: "",
      updatedAt: now(),
      bases: clone(DEFAULT_BASES)
    };
  }

  function load(){
    try{
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if(!raw){ return null; }

      var parsed = JSON.parse(raw);
      parsed.bases = Object.assign({}, clone(DEFAULT_BASES), parsed.bases || {});
      return parsed;
    }catch(error){
      return null;
    }
  }

  function save(){
    state.updatedAt = now();

    try{
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }catch(error){}

    return get();
  }

  function emit(){
    try{
      window.dispatchEvent(new CustomEvent("bdlocal:sync-status-change", {
        detail: get()
      }));
    }catch(error){}
  }

  function get(){
    return clone(state);
  }

  function getBase(base){
    base = normalizeBase(base);
    return clone(state.bases[base] || null);
  }

  function ensureBase(base){
    base = normalizeBase(base);

    if(!state.bases[base]){
      state.bases[base] = {
        id: base,
        label: labelBase(base),
        status: "idle",
        percent: 100,
        pending: 0,
        processing: 0,
        done: 0,
        errors: 0,
        message: "Sin pendientes",
        updatedAt: now()
      };
    }

    return state.bases[base];
  }

  function computeGlobal(){
    var bases = Object.keys(state.bases).map(function(id){
      return state.bases[id];
    });

    var running = bases.some(function(base){
      return base.status === "processing" || base.processing > 0;
    });

    var errors = bases.some(function(base){
      return Number(base.errors || 0) > 0 || base.status === "error" || base.status === "partial";
    });

    var pending = bases.some(function(base){
      return Number(base.pending || 0) > 0;
    });

    var totalPercent = bases.reduce(function(sum, base){
      return sum + Number(base.percent || 0);
    }, 0);

    state.globalPercent = bases.length ? Math.round(totalPercent / bases.length) : 100;
    state.running = running;

    if(running){
      state.globalStatus = "processing";
      state.globalLabel = state.activeLabel ? ("Sincronizando " + state.activeLabel + " " + state.globalPercent + "%") : "Sincronizando";
    }else if(errors){
      state.globalStatus = "error";
      state.globalLabel = "Hay pendientes con error";
    }else if(pending){
      state.globalStatus = "pending";
      state.globalLabel = "Hay pendientes por sincronizar";
    }else{
      state.globalStatus = "ok";
      state.globalLabel = "Todo sincronizado";
      state.globalPercent = 100;
    }
  }

  function setBase(base, patchData){
    base = normalizeBase(base);
    patchData = patchData || {};

    var current = ensureBase(base);

    Object.keys(patchData).forEach(function(key){
      if(key !== "id"){
        current[key] = patchData[key];
      }
    });

    current.id = base;
    current.label = current.label || labelBase(base);
    current.percent = Math.max(0, Math.min(100, Number(current.percent == null ? 100 : current.percent)));
    current.pending = Math.max(0, Number(current.pending || 0));
    current.processing = Math.max(0, Number(current.processing || 0));
    current.done = Math.max(0, Number(current.done || 0));
    current.errors = Math.max(0, Number(current.errors || 0));
    current.updatedAt = now();

    if(current.status === "processing"){
      state.activeBase = base;
      state.activeLabel = current.label;
    }

    computeGlobal();
    save();
    emit();

    return get();
  }

  function patch(data){
    data = data || {};

    if(data.currentBase || data.base){
      setBase(data.currentBase || data.base, {
        status: data.status || "processing",
        percent: data.percent == null ? undefined : data.percent,
        message: data.message || "",
        error: data.error || ""
      });
    }

    if(data.status){
      state.globalStatus = data.status;
    }

    if(data.message){
      state.globalLabel = data.message;
    }

    if(data.percent != null){
      state.globalPercent = Math.max(0, Math.min(100, Number(data.percent || 0)));
    }

    if(data.error){
      state.lastError = data.error;
    }

    if(data.running != null){
      state.running = !!data.running;
    }

    if(data.currentBase){
      state.activeBase = normalizeBase(data.currentBase);
      state.activeLabel = labelBase(data.currentBase);
    }

    computeGlobal();
    save();
    emit();

    return get();
  }

  function fromQueueSummary(summary){
    summary = summary || {};

    ["firebase", "supabase", "google_sheets"].forEach(function(base){
      var row = summary[base] || {};
      var totalActive =
        Number(row.pendiente || 0) +
        Number(row.procesando || 0) +
        Number(row.sincronizado || 0) +
        Number(row.error || 0);

      var done = Number(row.sincronizado || 0);
      var pending = Number(row.pendiente || 0);
      var processing = Number(row.procesando || 0);
      var errors = Number(row.error || 0);
      var percent = totalActive ? Math.round((done / totalActive) * 100) : 100;
      var status = "ok";
      var message = "Todo sincronizado";

      if(processing > 0){
        status = "processing";
        message = labelBase(base) + " " + percent + "%";
      }else if(errors > 0){
        status = "error";
        message = labelBase(base) + " con " + errors + " pendiente(s)";
      }else if(pending > 0){
        status = "pending";
        message = labelBase(base) + " pendiente";
      }

      setBase(base, {
        status: status,
        percent: percent,
        pending: pending,
        processing: processing,
        done: done,
        errors: errors,
        message: message
      });
    });

    return get();
  }

  function refreshFromQueue(){
    if(!window.BDLSyncQueue || typeof window.BDLSyncQueue.pendientesPorBase !== "function"){
      return Promise.resolve(get());
    }

    return window.BDLSyncQueue.pendientesPorBase().then(function(summary){
      return fromQueueSummary(summary);
    }).catch(function(){
      return get();
    });
  }

  function reset(){
    state = initial();
    save();
    emit();
    return get();
  }

  function bindEvents(){
    window.addEventListener("bdlocal:sync-queue-added", function(event){
      var detail = event && event.detail || {};
      var base = normalizeBase(detail.base || "");
      if(base){
        refreshFromQueue();
      }
    });

    window.addEventListener("bdlocal:sync-item-processing", function(event){
      var detail = event && event.detail || {};
      var base = normalizeBase(detail.base || "");
      if(base){
        setBase(base, {
          status: "processing",
          processing: 1,
          message: "Sincronizando " + labelBase(base)
        });
      }
    });

    window.addEventListener("bdlocal:sync-item-ok", function(){
      refreshFromQueue();
    });

    window.addEventListener("bdlocal:sync-item-error", function(event){
      var detail = event && event.detail || {};
      var base = normalizeBase(detail.base || "");
      if(base){
        setBase(base, {
          status: "error",
          errors: 1,
          message: labelBase(base) + " pendiente",
          error: detail.error || ""
        });
      }
      refreshFromQueue();
    });

    window.addEventListener("online", function(){
      patch({
        status: "pending",
        message: "Internet recuperado. Revisando pendientes."
      });
      refreshFromQueue();
    });

    window.addEventListener("offline", function(){
      patch({
        status: "offline",
        message: "Sin internet. Los cambios quedan pendientes.",
        error: "Sin internet."
      });
    });
  }

  window.BDLSyncStatus = {
    get: get,
    getBase: getBase,
    patch: patch,
    setBase: setBase,
    fromQueueSummary: fromQueueSummary,
    refreshFromQueue: refreshFromQueue,
    reset: reset,
    labelBase: labelBase,
    normalizeBase: normalizeBase
  };

  bindEvents();
  save();
})(window);