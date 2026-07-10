(function(window){
  "use strict";

  var cfg = window.CargaConfig;
  if(!cfg){ throw new Error("CargaConfig debe cargarse antes de CargaState."); }

  var state = {
    status: cfg.estados.idle,
    origen: "",
    fileName: "",
    rows: [],
    preview: [],
    normalized: null,
    errors: [],
    warnings: [],
    progress: { current: 0, total: 0, message: "" },
    lastResult: null
  };

  function emit(name, detail){
    try{ window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(error){}
  }

  function get(){ return state; }
  function patch(partial){ Object.assign(state, partial || {}); return state; }
  function setStatus(status, message){ state.status = status; state.progress.message = message || ""; emit("carga:status", { status: status, message: message || "" }); return state; }
  function setProgress(current, total, message){ state.progress = { current: Number(current || 0), total: Number(total || 0), message: message || "" }; emit("carga:progress", state.progress); return state.progress; }
  function reset(){ state.status = cfg.estados.idle; state.origen = ""; state.fileName = ""; state.rows = []; state.preview = []; state.normalized = null; state.errors = []; state.warnings = []; state.progress = { current: 0, total: 0, message: "" }; state.lastResult = null; return state; }

  window.CargaState = { get: get, patch: patch, setStatus: setStatus, setProgress: setProgress, reset: reset, emit: emit };
})(window);
