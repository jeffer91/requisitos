/* =========================================================
Nombre completo: bdl.screen-deps.js
Ruta o ubicacion: /Requisitos/BDLocal/adapters/bdl.screen-deps.js
Funcion:
- Adaptador comun para pantallas que necesitan BDLocal.
- Exponer APIs sincronicas inmediatas para que Tabla/Ficha/Stats no arranquen sin repositorio.
- Cargar el sistema completo de conexiones BDLocal en segundo plano.
- Mantener compatibilidad con ExcelLocalRepo, BL2DataEngine, BL2EstudiantesRepo y BL2ReportesRepo.
- Evitar que metodos asincronos de BL2 pisen los metodos sincronicos que las pantallas esperan.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.1.1";
  var currentScript = document.currentScript;
  var CACHE_KEY = "REQ_BDLOCAL_CONEXIONES_CACHE_V1";
  var OLD_SNAPSHOT_KEY = "REQ_EXCEL_LOCAL_V1:snapshot";

  function text(value){ return String(value == null ? "" : value).trim(); }

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
    }catch(error){ return fallback; }
  }

  function normalizeBasic(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeKey(value){ return normalizeBasic(value).toLowerCase().replace(/[^a-z0-9]+/g, ""); }

  function normalizeCedula(value){
    var raw = text(value).replace(/[^0-9A-Za-z]/g, "");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function canonicalPeriodId(value){
    value = text(value);
    if(!value){ return ""; }
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    if(match){ return match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4]; }
    return value.replace(/_+/g, "__");
  }

  function samePeriod(a, b){
    a = canonicalPeriodId(a);
    b = canonicalPeriodId(b);
    if(!b){ return true; }
    return !!a && (a === b || normalizeKey(a) === normalizeKey(b));
  }

  function normalizePeriod(period){
    period = period || {};
    var id = canonicalPeriodId(period.periodoCanonicoId || period.periodoId || period.periodId || period.id || period.value || period.key || "");
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

  function normalizeStudent(row){
    row = Object.assign({}, row || {});
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || row.NumeroIdentificacion || row.identificacion || row.Identificacion || row.Cedula || row["Cédula"] || "");
    var periodoId = canonicalPeriodId(row.periodoId || row.periodId || row.ultimoPeriodoId || row.idPeriodo || row._periodoId || row._bl2PeriodoId || "");
    var periodoLabel = text(row.periodoLabel || row.periodo || row.Periodo || row._periodo || row._bl2Periodo || periodoId);

    row.id = row.id || row._id || (cedula && periodoId ? cedula + "__" + periodoId : cedula);
    row._id = row._id || row.id;
    row.cedula = cedula;
    row._cedula = row._cedula || cedula;
    row.numeroIdentificacion = row.numeroIdentificacion || cedula;
    row.NumeroIdentificacion = row.NumeroIdentificacion || cedula;
    row.periodoId = periodoId;
    row.periodId = periodoId;
    row.ultimoPeriodoId = row.ultimoPeriodoId || periodoId;
    row.periodoLabel = periodoLabel;
    row.Periodo = row.Periodo || periodoLabel;
    row._periodoId = row._periodoId || periodoId;
    row._periodo = row._periodo || periodoLabel;
    row.Nombres = row.Nombres || row.nombres || row.Nombre || row.nombre || row.Estudiante || row.estudiante || "";
    row.nombres = row.nombres || row.Nombres || "";
    row._nombres = row._nombres || row.Nombres || row.nombres;
    row.NombreCarrera = row.NombreCarrera || row.nombreCarrera || row.Carrera || row.carrera || "";
    row.CodigoCarrera = row.CodigoCarrera || row.codigoCarrera || "";
    row._carrera = row._carrera || row.NombreCarrera || row.CodigoCarrera || "SIN CARRERA";
    row.division = row.division || row.Division || row["División"] || (Array.isArray(row.divisiones) ? row.divisiones[0] : "") || "Sin división";
    row._division = row._division || row.division;
    row.estadoMatricula = text(row.estadoMatricula || row.EstadoMatricula || "ACTIVO").toUpperCase() === "RETIRADO" ? "RETIRADO" : "ACTIVO";
    row._estadoMatricula = row._estadoMatricula || row.estadoMatricula;
    row._telegramUser = row._telegramUser || row.telegramUser || row.telegram || "";
    row._telegramChatId = row._telegramChatId || row.telegramChatId || row.chatId || "";
    return row;
  }

  function emptyCache(){
    return {
      meta:{ source:"empty", updatedAt:new Date().toISOString(), totalPeriods:0, totalStudents:0 },
      periods:[],
      students:[],
      requirements:[],
      summaries:{},
      diagnostics:[]
    };
  }

  function readCache(){
    var cache = emptyCache();
    try{ cache = safeParse(localStorage.getItem(CACHE_KEY), null) || cache; }catch(error){}

    if((!cache.students || !cache.students.length) && (!cache.periods || !cache.periods.length)){
      try{
        var oldSnap = safeParse(localStorage.getItem(OLD_SNAPSHOT_KEY), null);
        if(oldSnap && typeof oldSnap === "object"){
          cache.periods = Array.isArray(oldSnap.periods) ? oldSnap.periods : [];
          cache.students = Array.isArray(oldSnap.students) ? oldSnap.students : [];
          cache.meta = Object.assign({}, oldSnap.meta || {}, { source:"legacy-snapshot" });
        }
      }catch(error2){}
    }

    cache.periods = Array.isArray(cache.periods) ? cache.periods.map(normalizePeriod).filter(Boolean) : [];
    cache.students = Array.isArray(cache.students) ? cache.students.map(normalizeStudent) : [];
    cache.requirements = Array.isArray(cache.requirements) ? cache.requirements : [];
    cache.summaries = cache.summaries && typeof cache.summaries === "object" ? cache.summaries : {};
    cache.diagnostics = Array.isArray(cache.diagnostics) ? cache.diagnostics : [];
    cache.meta = cache.meta && typeof cache.meta === "object" ? cache.meta : {};
    cache.meta.totalPeriods = cache.periods.length;
    cache.meta.totalStudents = cache.students.length;
    return cache;
  }

  function filterStudents(rows, options){
    options = options || {};
    rows = Array.isArray(rows) ? rows.map(normalizeStudent) : [];
    var periodoId = canonicalPeriodId(options.periodoId || options.periodId || options.period || "");
    var matricula = text(options.matricula || options.estadoMatricula || "");
    var division = normalizeBasic(options.division || "").toLowerCase();
    var search = normalizeBasic(options.search || options.busqueda || options.query || "").toLowerCase();
    var limit = Number(options.limit || 0);

    rows = rows.filter(function(row){
      if(periodoId && !samePeriod(row.periodoId || row._periodoId || row.ultimoPeriodoId, periodoId)){ return false; }
      if(matricula && text(row.estadoMatricula || row._estadoMatricula).toUpperCase() !== matricula.toUpperCase()){ return false; }
      if(division && normalizeBasic(row.division || row._division || "").toLowerCase() !== division){ return false; }
      if(search){
        var haystack = normalizeBasic([
          row.cedula,
          row.numeroIdentificacion,
          row.Nombres,
          row.nombres,
          row.NombreCarrera,
          row.CodigoCarrera,
          row.division,
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

    if(limit > 0){ rows = rows.slice(0, limit); }
    return rows;
  }

  function listPeriodsSync(){ return readCache().periods; }
  function getStudentsSync(options){ return filterStudents(readCache().students, options || {}); }

  function listStudentsSync(options){
    var rows = getStudentsSync(options || {});
    return { ok:true, rows:rows, total:rows.length, periodList:listPeriodsSync(), source:"BDLocalScreenDeps" };
  }

  function getRequirementsSync(filters){
    filters = filters || {};
    var periodoId = canonicalPeriodId(filters.periodoId || filters.periodId || "");
    var cedula = normalizeCedula(filters.cedula || filters.numeroIdentificacion || "");
    return readCache().requirements.filter(function(req){
      if(periodoId && !samePeriod(req.periodoId, periodoId)){ return false; }
      if(cedula && normalizeCedula(req.cedula) !== cedula){ return false; }
      return true;
    });
  }

  function getSummarySync(periodoId){
    periodoId = canonicalPeriodId(periodoId || "");
    var rows = getStudentsSync({ periodoId:periodoId, matricula:"" });
    var activos = rows.filter(function(row){ return text(row.estadoMatricula).toUpperCase() !== "RETIRADO"; }).length;
    return {
      id:periodoId,
      periodoId:periodoId,
      totalEstudiantes:rows.length,
      totalActivos:activos,
      totalRetirados:rows.length - activos,
      source:"BDLocalScreenDeps"
    };
  }

  function getStudentByCedulaSync(cedula, periodoId){
    cedula = normalizeCedula(cedula);
    return getStudentsSync({ periodoId:periodoId || "", matricula:"" }).filter(function(row){
      return normalizeCedula(row.cedula || row.numeroIdentificacion) === cedula;
    })[0] || null;
  }

  function getStudentByIdSync(id, options){
    id = text(id);
    if(!id){ return null; }
    return getStudentsSync(Object.assign({}, options || {}, { matricula:(options && options.matricula) == null ? "" : options.matricula })).filter(function(row){
      return text(row.id) === id || text(row._id) === id || text(row.cedula) === id || text(row.numeroIdentificacion) === id;
    })[0] || null;
  }

  function makeSyncAdapters(){
    var readyFn = function(){ return window.BDLScreenDepsReady || Promise.resolve(true); };

    return {
      excel:{
        ready:readyFn,
        source:"BDLocalScreenDeps",
        getSnapshot:function(){
          var c = readCache();
          return { meta:c.meta, periods:c.periods, students:c.students, history:[], diagnostics:c.diagnostics || [] };
        },
        listPeriods:listPeriodsSync,
        getPeriods:listPeriodsSync,
        periods:listPeriodsSync,
        listStudents:listStudentsSync,
        getStudents:getStudentsSync,
        getRows:getStudentsSync,
        rows:getStudentsSync,
        all:getStudentsSync,
        listar:getStudentsSync,
        listAllStudents:function(){ return getStudentsSync({ matricula:"" }); },
        filterStudents:getStudentsSync,
        listStudentsByStatus:function(status, periodoId){ return getStudentsSync({ matricula:status || "", periodoId:periodoId || "" }); },
        byCedula:getStudentByCedulaSync,
        getStudentByCedula:getStudentByCedulaSync,
        getStudentById:getStudentByIdSync,
        search:function(query, options){ return listStudentsSync(Object.assign({}, options || {}, { search:query || "" })); },
        getSummary:getSummarySync,
        summary:getSummarySync,
        getRequirements:getRequirementsSync
      },
      engine:{
        ready:readyFn,
        source:"BDLocalScreenDeps",
        listPeriods:listPeriodsSync,
        getPeriods:listPeriodsSync,
        periods:listPeriodsSync,
        listStudents:listStudentsSync,
        getStudents:getStudentsSync,
        getRows:getStudentsSync,
        rows:getStudentsSync,
        filterStudents:getStudentsSync,
        listAllStudents:function(){ return getStudentsSync({ matricula:"" }); },
        listStudentsByStatus:function(status, periodoId){ return getStudentsSync({ matricula:status || "", periodoId:periodoId || "" }); },
        getStudentByCedula:getStudentByCedulaSync,
        getStudentById:getStudentByIdSync,
        search:function(options){ return listStudentsSync(options || {}); },
        getRequirements:getRequirementsSync,
        requirements:getRequirementsSync,
        getSummary:getSummarySync,
        summary:getSummarySync,
        stats:function(periodoId){ return { periodoId:periodoId, estudiantes:getStudentsSync({ periodoId:periodoId, matricula:"" }), requisitos:getRequirementsSync({ periodoId:periodoId }), resumen:getSummarySync(periodoId), source:"BDLocalScreenDeps" }; },
        getStatsData:function(periodoId){ return this.stats(periodoId); }
      },
      estudiantes:{
        ready:readyFn,
        source:"BDLocalScreenDeps",
        buscar:listStudentsSync,
        getStudents:getStudentsSync,
        listStudents:listStudentsSync,
        filterStudents:getStudentsSync,
        listAllStudents:function(){ return getStudentsSync({ matricula:"" }); },
        listStudentsByStatus:function(status, periodoId){ return getStudentsSync({ matricula:status || "", periodoId:periodoId || "" }); },
        obtenerPorCedula:getStudentByCedulaSync,
        getStudentByCedula:getStudentByCedulaSync,
        getStudentById:getStudentByIdSync,
        listPeriods:listPeriodsSync,
        getPeriods:listPeriodsSync
      },
      reportes:{
        ready:readyFn,
        source:"BDLocalScreenDeps",
        build:function(filters){ return this.buildReportData(filters || {}); },
        report:function(filters){ return this.buildReportData(filters || {}); },
        buildReportData:function(filters){
          filters = filters || {};
          var rows = getStudentsSync(filters);
          return {
            ok:true,
            source:"BDLocalScreenDeps",
            filters:clone(filters),
            generatedAt:new Date().toISOString(),
            estudiantes:rows,
            rows:rows,
            requisitos:getRequirementsSync(filters),
            periodos:listPeriodsSync(),
            resumen:{ totalEstudiantes:rows.length }
          };
        },
        getStudents:getStudentsSync,
        listStudents:listStudentsSync,
        getRequirements:getRequirementsSync,
        getSummary:getSummarySync,
        getPeriods:listPeriodsSync,
        listPeriods:listPeriodsSync
      }
    };
  }

  function ensureSyncAdapters(){
    var adapters = makeSyncAdapters();

    window.ExcelLocalRepo = Object.assign({}, window.ExcelLocalRepo || {}, adapters.excel);
    window.BL2DataEngine = Object.assign({}, window.BL2DataEngine || {}, adapters.engine);
    window.BL2EstudiantesRepo = Object.assign({}, window.BL2EstudiantesRepo || {}, adapters.estudiantes);
    window.BL2ReportesRepo = Object.assign({}, window.BL2ReportesRepo || {}, adapters.reportes);
  }

  function resolve(relative){
    try{ return new URL(relative, currentScript && currentScript.src ? currentScript.src : window.location.href).href; }
    catch(error){ return relative; }
  }

  function loaded(src){
    return Array.prototype.slice.call(document.scripts || []).some(function(script){
      return script.src === src || script.getAttribute("data-bdl-screen-src") === src;
    });
  }

  function load(relative){
    var src = resolve(relative);
    if(loaded(src)){ return Promise.resolve(src); }

    return new Promise(function(resolvePromise, reject){
      var script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.defer = false;
      script.setAttribute("data-bdl-screen-src", src);
      script.onload = function(){ resolvePromise(src); };
      script.onerror = function(){ reject(new Error("No se pudo cargar " + src)); };
      document.head.appendChild(script);
    });
  }

  function sequential(files){
    var chain = Promise.resolve();
    files.forEach(function(file){
      chain = chain.then(function(){ return load(file); });
    });
    return chain;
  }

  function ready(){
    ensureSyncAdapters();

    if(window.BDLocalConexiones && typeof window.BDLocalConexiones.ready === "function"){
      return window.BDLocalConexiones.ready();
    }

    return sequential([
      "../conexiones/con.utils.js",
      "../conexiones/con.index.js"
    ]).then(function(){
      ensureSyncAdapters();
      if(window.BDLocalConexiones && typeof window.BDLocalConexiones.ready === "function"){
        return window.BDLocalConexiones.ready().then(function(result){
          ensureSyncAdapters();
          return result;
        });
      }
      return { ok:false, message:"BDLocalConexiones no disponible." };
    });
  }

  function status(){
    if(window.BDLocalConexiones && typeof window.BDLocalConexiones.status === "function"){
      return window.BDLocalConexiones.status();
    }
    var c = readCache();
    return {
      ok:true,
      ready:false,
      version:VERSION,
      mode:"sync-adapter",
      periods:c.periods.length,
      students:c.students.length,
      message:"Adaptador sincronico cargado; conexiones completas inicializando."
    };
  }

  ensureSyncAdapters();

  window.BDLocalScreenDeps = {
    version:VERSION,
    ready:ready,
    status:status,
    load:load,
    readCache:readCache,
    filterStudents:getStudentsSync,
    ensureSyncAdapters:ensureSyncAdapters
  };

  window.BDLScreenDepsReady = ready();

  window.BDLScreenDepsReady.then(function(){
    ensureSyncAdapters();
    try{ window.dispatchEvent(new CustomEvent("bdlocal:screen-deps-ready", { detail:status() })); }catch(error){}
  }).catch(function(error){
    try{ console.warn("[BDLocalScreenDeps]", error); }catch(e){}
    return null;
  });
})(window, document);
