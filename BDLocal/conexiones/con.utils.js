/* =========================================================
Nombre completo: con.utils.js
Ruta o ubicacion: /Requisitos/BDLocal/conexiones/con.utils.js
Funcion:
- Utilidades comunes para conectar BDLocal con pantallas externas.
- Normalizar periodo, cedula y respuestas antiguas.
- Mantener cache liviana en localStorage para pantallas sincronas.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.0";
  var CACHE_KEY = "REQ_BDLOCAL_CONEXIONES_CACHE_V1";
  var SIGNAL_KEY = "REQ_BDLOCAL_CONEXIONES_SIGNAL_V1";

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function nowISO(){
    return new Date().toISOString();
  }

  function clone(value){
    if(value === undefined){ return undefined; }
    try{ return JSON.parse(JSON.stringify(value)); }
    catch(error){ return value; }
  }

  function safeParse(value, fallback){
    try{
      if(!value){ return fallback; }
      var parsed = JSON.parse(value);
      return parsed == null ? fallback : parsed;
    }catch(error){
      return fallback;
    }
  }

  function normalizeBasic(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeKey(value){
    return normalizeBasic(value).toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
  }

  function normalizeCedula(value){
    var raw = text(value).replace(/[^0-9A-Za-z]/g, "");
    if(/^\d{9}$/.test(raw)){ return "0" + raw; }
    return raw;
  }

  function canonicalPeriodId(value){
    value = text(value);
    if(!value){ return ""; }
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    if(match){ return match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4]; }
    return value.replace(/_+/g, "__");
  }

  function normalizePeriod(period){
    period = period || {};
    var id = canonicalPeriodId(period.periodoCanonicoId || period.periodoId || period.id || period.value || period.key || "");
    if(!id){ return null; }
    var label = text(period.periodoCanonicoLabel || period.periodoLabel || period.label || period.nombre || period.name || id);
    return Object.assign({}, period, {
      id:id,
      value:id,
      key:id,
      label:label,
      nombre:label,
      periodoId:id,
      periodoLabel:label,
      periodoCanonicoId:id,
      periodoCanonicoLabel:label
    });
  }

  function samePeriod(a, b){
    a = canonicalPeriodId(a);
    b = canonicalPeriodId(b);
    if(!b){ return true; }
    return !!a && (a === b || normalizeKey(a) === normalizeKey(b));
  }

  function emit(name, detail){
    detail = Object.assign({ at:nowISO() }, clone(detail || {}));
    try{ window.dispatchEvent(new CustomEvent(name, { detail:detail })); }catch(error){}
    try{ localStorage.setItem(SIGNAL_KEY, JSON.stringify({ name:name, detail:detail })); }catch(error2){}
  }

  function readCache(){
    try{
      return normalizeCache(safeParse(localStorage.getItem(CACHE_KEY), null));
    }catch(error){
      return emptyCache();
    }
  }

  function writeCache(cache){
    cache = normalizeCache(cache);
    cache.meta.updatedAt = nowISO();
    cache.meta.totalPeriods = cache.periods.length;
    cache.meta.totalStudents = cache.students.length;
    try{ localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }catch(error){}
    emit("bdlocal:conexiones-cache-updated", {
      periods:cache.periods.length,
      students:cache.students.length,
      source:cache.meta.source || "BDLocal"
    });
    return clone(cache);
  }

  function emptyCache(){
    var at = nowISO();
    return {
      meta:{
        app:"Requisitos",
        module:"BDLocalConexiones",
        version:VERSION,
        source:"empty",
        createdAt:at,
        updatedAt:at,
        totalPeriods:0,
        totalStudents:0
      },
      periods:[],
      students:[],
      requirements:[],
      summaries:{},
      diagnostics:[]
    };
  }

  function normalizeCache(cache){
    cache = cache && typeof cache === "object" ? cache : emptyCache();
    cache.meta = cache.meta && typeof cache.meta === "object" ? cache.meta : {};
    cache.periods = Array.isArray(cache.periods) ? cache.periods.map(normalizePeriod).filter(Boolean) : [];
    cache.students = Array.isArray(cache.students) ? cache.students.map(normalizeStudent) : [];
    cache.requirements = Array.isArray(cache.requirements) ? cache.requirements : [];
    cache.summaries = cache.summaries && typeof cache.summaries === "object" ? cache.summaries : {};
    cache.diagnostics = Array.isArray(cache.diagnostics) ? cache.diagnostics : [];
    cache.meta.app = cache.meta.app || "Requisitos";
    cache.meta.module = cache.meta.module || "BDLocalConexiones";
    cache.meta.version = cache.meta.version || VERSION;
    cache.meta.source = cache.meta.source || "cache";
    cache.meta.updatedAt = cache.meta.updatedAt || nowISO();
    cache.meta.totalPeriods = cache.periods.length;
    cache.meta.totalStudents = cache.students.length;
    return cache;
  }

  function normalizeStudent(row){
    row = Object.assign({}, row || {});
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || row.NumeroIdentificacion || row.identificacion || row.Identificacion || row.Cedula || row["Cedula"] || row["Cédula"] || "");
    var periodoId = canonicalPeriodId(row.periodoId || row.periodId || row.ultimoPeriodoId || row.idPeriodo || row._periodoId || row._bl2PeriodoId || "");
    var periodoLabel = text(row.periodoLabel || row.periodo || row.Periodo || row._periodo || row._bl2Periodo || periodoId);

    row.id = row.id || row._id || (cedula && periodoId ? cedula + "__" + periodoId : cedula);
    row.cedula = cedula;
    row.numeroIdentificacion = row.numeroIdentificacion || cedula;
    row.NumeroIdentificacion = row.NumeroIdentificacion || cedula;
    row.periodoId = periodoId;
    row.periodId = periodoId;
    row.ultimoPeriodoId = row.ultimoPeriodoId || periodoId;
    row.periodoLabel = periodoLabel;
    row.Periodo = row.Periodo || periodoLabel;
    row._periodoId = row._periodoId || periodoId;
    row._periodo = row._periodo || periodoLabel;
    row._id = row._id || row.id;
    row._cedula = row._cedula || cedula;
    row._nombres = row._nombres || row.Nombres || row.nombres || row.Nombre || row.nombre || row.Estudiante || row.estudiante || "";
    row._carrera = row._carrera || row.NombreCarrera || row.nombreCarrera || row.Carrera || row.carrera || "";
    row._division = row._division || row.division || row.Division || row["División"] || (Array.isArray(row.divisiones) ? row.divisiones[0] : "") || "Sin división";
    row._estadoMatricula = text(row._estadoMatricula || row.estadoMatricula || row.EstadoMatricula || "ACTIVO").toUpperCase() === "RETIRADO" ? "RETIRADO" : "ACTIVO";
    return row;
  }

  function filterStudents(rows, options){
    options = options || {};
    rows = Array.isArray(rows) ? rows.map(normalizeStudent) : [];
    var periodoId = canonicalPeriodId(options.periodoId || options.periodId || options.period || "");
    var matricula = text(options.estadoMatricula || options.matricula || "");
    var division = normalizeBasic(options.division || "").toLowerCase();
    var search = normalizeBasic(options.search || options.busqueda || options.query || "").toLowerCase();

    return rows.filter(function(row){
      if(periodoId && !samePeriod(row.periodoId || row._periodoId || row.ultimoPeriodoId, periodoId)){ return false; }
      if(matricula && text(row._estadoMatricula || row.estadoMatricula).toUpperCase() !== matricula.toUpperCase()){ return false; }
      if(division && normalizeBasic(row._division || row.division || "").toLowerCase() !== division){ return false; }
      if(search){
        var haystack = normalizeBasic([
          row.cedula,
          row.numeroIdentificacion,
          row.Nombres,
          row.nombres,
          row._nombres,
          row.NombreCarrera,
          row.CodigoCarrera,
          row._carrera,
          row._division,
          row.CorreoPersonal,
          row.CorreoInstitucional,
          row.Celular,
          row._telegramUser,
          row._telegramChatId
        ].join(" ")).toLowerCase();
        if(haystack.indexOf(search) < 0){ return false; }
      }
      return true;
    });
  }

  function getGlobal(name){
    var contexts = [window];
    try{ if(window.parent && window.parent !== window){ contexts.push(window.parent); } }catch(error){}
    try{ if(window.top && window.top !== window){ contexts.push(window.top); } }catch(error2){}
    try{ if(window.opener && window.opener !== window){ contexts.push(window.opener); } }catch(error3){}

    for(var i = 0; i < contexts.length; i += 1){
      try{
        if(contexts[i] && contexts[i][name]){ return contexts[i][name]; }
      }catch(error4){}
    }
    return null;
  }

  window.BDLocalConUtils = {
    version:VERSION,
    cacheKey:CACHE_KEY,
    signalKey:SIGNAL_KEY,
    text:text,
    nowISO:nowISO,
    clone:clone,
    safeParse:safeParse,
    normalizeBasic:normalizeBasic,
    normalizeKey:normalizeKey,
    normalizeCedula:normalizeCedula,
    canonicalPeriodId:canonicalPeriodId,
    normalizePeriod:normalizePeriod,
    samePeriod:samePeriod,
    normalizeStudent:normalizeStudent,
    filterStudents:filterStudents,
    emptyCache:emptyCache,
    normalizeCache:normalizeCache,
    readCache:readCache,
    writeCache:writeCache,
    emit:emit,
    getGlobal:getGlobal
  };
})(window);
