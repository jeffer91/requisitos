(function(window){
  "use strict";

  var cfg = window.BDLConfig;

  if(!cfg){
    throw new Error("BDLConfig debe cargarse antes de BDLState.");
  }

  var state = {
    booted: false,
    bootedAt: "",
    periodoActivo: "",
    periodos: { status: cfg.loadStatus.idle, data: [], error: "" },
    estudiantesPorPeriodo: {},
    detalleEstudiante: {},
    dashboardPorPeriodo: {},
    sync: { status: cfg.loadStatus.idle, message: "", error: "" }
  };

  function get(){
    return state;
  }

  function patch(partial){
    Object.assign(state, partial || {});
    return state;
  }

  function setPeriodoActivo(periodoId){
    state.periodoActivo = String(periodoId || "");
    try{
      window.localStorage.setItem(cfg.keys.activePeriod, state.periodoActivo);
    }catch(error){}
    return state.periodoActivo;
  }

  function getPeriodoActivo(){
    if(state.periodoActivo){ return state.periodoActivo; }
    try{
      state.periodoActivo = window.localStorage.getItem(cfg.keys.activePeriod) || "";
    }catch(error){}
    return state.periodoActivo;
  }

  function reset(){
    state.estudiantesPorPeriodo = {};
    state.detalleEstudiante = {};
    state.dashboardPorPeriodo = {};
    return state;
  }

  window.BDLState = {
    get: get,
    patch: patch,
    setPeriodoActivo: setPeriodoActivo,
    getPeriodoActivo: getPeriodoActivo,
    reset: reset
  };
})(window);
