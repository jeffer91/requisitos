/* =========================================================
Nombre completo: maq-baselocal-session.js
Ruta o ubicación: /Requisitos/Maqueta/maq-baselocal-session.js
Función o funciones:
- Preparar la Base Local solo cuando una pantalla realmente la necesita.
- Mantener una copia rápida en memoria mientras el módulo está abierto.
- Entregar la misma Base Local a las pantallas internas sin releer todo desde cero.
- No sincronizar Firebase; este archivo solo acelera la lectura local.
- No bloquear el arranque de Requisitos leyendo un snapshot grande de localStorage.
Con qué se conecta:
- maq-index.html
- maq-core.js
- excel-local.storage.js
- baselocal.connector.js
========================================================= */
(function(window, document){
  "use strict";

  var SNAPSHOT_KEY = "REQ_EXCEL_LOCAL_V1:snapshot";
  var SIGNAL_KEY = "REQ_BL_SIGNAL_V1";
  var STATUS_KEY = "REQ_MAQ_BASELOCAL_SESSION_STATUS_V1";
  var VERSION = "1.1.0";

  var cache = {
    ready:false,
    raw:"",
    snapshot:null,
    loadedAt:"",
    updatedAt:"",
    source:"lazy",
    errorMessage:""
  };

  function now(){return new Date().toISOString();}
  function clone(value){try{return JSON.parse(JSON.stringify(value == null ? null : value));}catch(error){return value;}}
  function safeParse(value, fallback){try{return value ? JSON.parse(value) : fallback;}catch(error){return fallback;}}

  function emptySnapshot(){
    var at = now();
    return {
      meta:{app:"Requisitos", module:"ExcelLocal", source:"maq-session", version:VERSION, createdAt:at, updatedAt:at, totalPeriods:0, totalStudents:0},
      periods:[],
      students:[],
      history:[],
      diagnostics:[]
    };
  }

  function normalizeSnapshot(snapshot){
    var base = snapshot && typeof snapshot === "object" ? snapshot : emptySnapshot();
    base.meta = base.meta && typeof base.meta === "object" ? base.meta : {};
    base.periods = Array.isArray(base.periods) ? base.periods : [];
    base.students = Array.isArray(base.students) ? base.students : [];
    base.history = Array.isArray(base.history) ? base.history : [];
    base.diagnostics = Array.isArray(base.diagnostics) ? base.diagnostics : [];
    base.meta.app = base.meta.app || "Requisitos";
    base.meta.module = base.meta.module || "ExcelLocal";
    base.meta.totalPeriods = base.periods.length;
    base.meta.totalStudents = base.students.length;
    base.meta.updatedAt = base.meta.updatedAt || now();
    return base;
  }

  function saveStatus(status){
    var data = Object.assign({version:VERSION, updatedAt:now()}, status || {});
    try{window.localStorage.setItem(STATUS_KEY, JSON.stringify(data));}catch(error){}
    return data;
  }

  function emit(kind, payload){
    var detail = Object.assign({kind:kind, at:now()}, payload || {});
    try{window.dispatchEvent(new CustomEvent("maq:baselocal-session:" + kind, {detail:clone(detail)}));}catch(error){}
    try{window.localStorage.setItem(SIGNAL_KEY, JSON.stringify({id:"maq-session-" + Date.now(), kind:"session-" + kind, payload:detail, at:now()}));}catch(error){}
  }

  function readRawLocal(){
    try{return window.localStorage.getItem(SNAPSHOT_KEY) || "";}catch(error){return "";}
  }

  function ensureReady(options){
    options = options || {};
    var force = options.force === true;

    if(cache.ready && !force){
      return getStatus();
    }

    var raw = readRawLocal();

    try{
      var snapshot = normalizeSnapshot(safeParse(raw, emptySnapshot()));
      cache.ready = true;
      cache.raw = raw;
      cache.snapshot = snapshot;
      cache.loadedAt = cache.loadedAt || now();
      cache.updatedAt = now();
      cache.source = raw ? "localStorage" : "empty";
      cache.errorMessage = "";

      var status = getStatus();
      saveStatus(status);
      emit("ready", status);
      return status;
    }catch(error){
      cache.ready = true;
      cache.raw = "";
      cache.snapshot = emptySnapshot();
      cache.loadedAt = cache.loadedAt || now();
      cache.updatedAt = now();
      cache.source = "fallback";
      cache.errorMessage = error && error.message ? error.message : String(error);
      var failed = getStatus();
      saveStatus(failed);
      emit("error", failed);
      return failed;
    }
  }

  function getSnapshot(options){
    options = options || {};
    ensureReady({force:options.force === true});
    return options.clone === false ? cache.snapshot : clone(cache.snapshot);
  }

  function setSnapshot(snapshot, options){
    options = options || {};
    var clean = normalizeSnapshot(snapshot || emptySnapshot());
    clean.meta = Object.assign({}, clean.meta || {}, {updatedAt:now(), totalPeriods:clean.periods.length, totalStudents:clean.students.length});
    var raw = "";

    try{raw = JSON.stringify(clean);}catch(error){raw = JSON.stringify(emptySnapshot());}

    if(options.alreadyStored !== true){
      try{window.localStorage.setItem(SNAPSHOT_KEY, raw);}catch(error){}
    }

    cache.ready = true;
    cache.raw = raw;
    cache.snapshot = clean;
    cache.updatedAt = now();
    cache.loadedAt = cache.loadedAt || now();
    cache.source = options.source || "setSnapshot";
    cache.errorMessage = "";

    var status = getStatus();
    saveStatus(status);
    emit("updated", status);
    return options.clone === false ? clean : clone(clean);
  }

  function invalidate(reason){
    cache.ready = false;
    cache.errorMessage = "";
    cache.source = reason || "invalidate";
    emit("invalidated", {reason:reason || "manual"});
  }

  function getCounts(){
    ensureReady();
    return getCountsRaw();
  }

  function getStatus(){
    var counts = cache.snapshot ? getCountsRaw() : {periods:0, students:0, history:0};
    return {
      ok:cache.errorMessage ? false : true,
      ready:cache.ready,
      source:cache.source,
      loadedAt:cache.loadedAt,
      updatedAt:cache.updatedAt,
      errorMessage:cache.errorMessage,
      periods:counts.periods,
      students:counts.students,
      history:counts.history
    };
  }

  function getCountsRaw(){
    return {
      periods:Array.isArray(cache.snapshot && cache.snapshot.periods) ? cache.snapshot.periods.length : 0,
      students:Array.isArray(cache.snapshot && cache.snapshot.students) ? cache.snapshot.students.length : 0,
      history:Array.isArray(cache.snapshot && cache.snapshot.history) ? cache.snapshot.history.length : 0
    };
  }

  function boot(){
    saveStatus(getStatus());
    emit("lazy", {ready:false, source:"lazy", message:"Base Local se cargará cuando una pantalla la necesite."});
  }

  window.MAQ_BASELOCAL_SESSION = {
    version:VERSION,
    key:SNAPSHOT_KEY,
    ensureReady:ensureReady,
    getSnapshot:getSnapshot,
    setSnapshot:setSnapshot,
    invalidate:invalidate,
    getCounts:getCounts,
    getStatus:getStatus
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})(window, document);
