/* =========================================================
Nombre completo: bdl.screen-deps.js
Ruta o ubicación: /Requisitos/BDLocal/adapters/bdl.screen-deps.js
Función o funciones:
- Adaptador común para pantallas que necesitan BDLocal.
- Evitar parsear y normalizar localStorage en cada filtro.
- Cargar conectores compatibles con Windows.
- Cargar BLDivisionesService y fast-cache de divisiones.
- Exponer adaptadores compatibles: ExcelLocalRepo, BL2DataEngine,
  BL2EstudiantesRepo y BL2ReportesRepo.
- Mantener compatibilidad con Ficha, Tabla, Stats, Coordi, Reportes y Defensas.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.3.0-fast-screen-deps";
  var currentScript = document.currentScript;
  var CACHE_KEY = "REQ_BDLOCAL_CONEXIONES_CACHE_V1";
  var OLD_SNAPSHOT_KEY = "REQ_EXCEL_LOCAL_V1:snapshot";

  var memo = {
    raw: "",
    cache: null,
    normalizedAt: "",
    readyPromise: null
  };

  function text(value){
    return String(value == null ? "" : value).trim();
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

  function rawStorage(key){
    try{ return window.localStorage.getItem(key) || ""; }
    catch(error){ return ""; }
  }

  function normalizeCedula(value){
    var raw = text(value).replace(/[^0-9A-Za-z]/g, "");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function canonicalPeriodId(value){
    value = text(value);
    if(!value){ return ""; }
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match ? match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4] : value.replace(/_+/g, "__");
  }

  function normalizeBasic(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeKey(value){
    return normalizeBasic(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function samePeriod(a, b){
    a = canonicalPeriodId(a);
    b = canonicalPeriodId(b);
    return !b || !!a && (a === b || normalizeKey(a) === normalizeKey(b));
  }

  function sameText(a, b){
    a = normalizeKey(a);
    b = normalizeKey(b);
    return !b || a === b;
  }

  function containsText(haystack, needle){
    needle = normalizeBasic(needle).toLowerCase();
    if(!needle){ return true; }
    return normalizeBasic(haystack).toLowerCase().indexOf(needle) >= 0;
  }

  function normalizePeriod(period){
    period = period || {};

    var id = canonicalPeriodId(
      period.periodoCanonicoId ||
      period.periodoId ||
      period.periodId ||
      period.id ||
      period.value ||
      period.key ||
      ""
    );

    if(!id){ return null; }

    var label = text(
      period.periodoCanonicoLabel ||
      period.periodoLabel ||
      period.label ||
      period.nombre ||
      period.name ||
      id
    );

    return Object.assign({}, period, {
      id: id,
      value: id,
      key: id,
      label: label,
      nombre: label,
      periodoId: id,
      periodId: id,
      periodoLabel: label,
      periodoCanonicoId: id,
      periodoCanonicoLabel: label,
      divisiones: Array.isArray(period.divisiones) ? period.divisiones : [],
      carrerasDetectadas: Array.isArray(period.carrerasDetectadas) ? period.carrerasDetectadas : []
    });
  }

  function fallbackDivision(row){
    row = row || {};
    var direct = text(row._division || row._bl2Division || row.division || row.Division || row["División"] || row.divisionActual || "");
    var list = Array.isArray(row.divisiones) ? row.divisiones : [];
    return direct || text(list[0]) || "Sin división";
  }

  function resolveDivision(row){
    var division = "";

    try{
      if(window.BLDivisionesService && typeof window.BLDivisionesService.studentDivision === "function"){
        division = window.BLDivisionesService.studentDivision(row);
      }
    }catch(error){}

    division = text(division || fallbackDivision(row) || "Sin división");
    return division || "Sin división";
  }

  function normalizeStudent(row){
    row = Object.assign({}, row || {});

    if(row.__bdlScreenDepsVersion === VERSION){
      return row;
    }

    var cedula = normalizeCedula(
      row.cedula ||
      row.numeroIdentificacion ||
      row.NumeroIdentificacion ||
      row.identificacion ||
      row.Identificacion ||
      row.Cedula ||
      row["Cédula"] ||
      row._cedula ||
      ""
    );

    var periodoId = canonicalPeriodId(
      row.periodoCanonicoId ||
      row.periodoId ||
      row.periodId ||
      row.ultimoPeriodoId ||
      row.idPeriodo ||
      row._periodoId ||
      row._bl2PeriodoId ||
      ""
    );

    var periodoLabel = text(
      row.periodoCanonicoLabel ||
      row.periodoLabel ||
      row.periodo ||
      row.Periodo ||
      row._periodo ||
      row._bl2Periodo ||
      periodoId
    );

    var nombres = text(
      row.Nombres ||
      row.nombres ||
      row.nombreCompleto ||
      row.Nombre ||
      row.nombre ||
      row.Estudiante ||
      row.estudiante ||
      row._nombres ||
      ""
    );

    var carrera = text(
      row.NombreCarrera ||
      row.nombreCarrera ||
      row.Carrera ||
      row.carrera ||
      row._carrera ||
      ""
    );

    var codigoCarrera = text(row.CodigoCarrera || row.codigoCarrera || row.codCarrera || "");
    var sede = text(row.Sede || row.sede || row.campus || row._sede || "");
    var division = resolveDivision(Object.assign({}, row, {
      cedula: cedula,
      periodoId: periodoId,
      periodId: periodoId,
      NombreCarrera: carrera,
      carrera: carrera,
      CodigoCarrera: codigoCarrera
    }));

    var estado = text(row._estadoMatricula || row.estadoMatricula || row.EstadoMatricula || row.estado || row.Estado || "ACTIVO").toUpperCase();
    estado = estado === "RETIRADO" ? "RETIRADO" : "ACTIVO";

    row.id = row.id || row._id || row.idEstudiantePeriodo || (cedula && periodoId ? cedula + "__" + periodoId : cedula);
    row._id = row._id || row.id;
    row.studentId = row.studentId || row.idEstudiantePeriodo || row.id;
    row.idEstudiantePeriodo = row.idEstudiantePeriodo || (periodoId && cedula ? periodoId + "__" + cedula : row.studentId || row.id);

    row.cedula = cedula;
    row._cedula = row._cedula || cedula;
    row.numeroIdentificacion = row.numeroIdentificacion || cedula;
    row.NumeroIdentificacion = row.NumeroIdentificacion || cedula;

    row.periodoId = periodoId;
    row.periodId = periodoId;
    row.ultimoPeriodoId = row.ultimoPeriodoId || periodoId;
    row.periodoCanonicoId = row.periodoCanonicoId || periodoId;
    row.periodoLabel = periodoLabel;
    row.periodoCanonicoLabel = row.periodoCanonicoLabel || periodoLabel;
    row.Periodo = row.Periodo || periodoLabel;
    row._periodoId = row._periodoId || periodoId;
    row._periodo = row._periodo || periodoLabel;

    row.Nombres = row.Nombres || nombres;
    row.nombres = row.nombres || nombres;
    row.nombreCompleto = row.nombreCompleto || nombres;
    row._nombres = row._nombres || nombres;

    row.NombreCarrera = row.NombreCarrera || carrera;
    row.nombreCarrera = row.nombreCarrera || carrera;
    row.Carrera = row.Carrera || carrera;
    row.carrera = row.carrera || carrera;
    row.CodigoCarrera = row.CodigoCarrera || codigoCarrera;
    row.codigoCarrera = row.codigoCarrera || codigoCarrera;
    row._carrera = row._carrera || carrera || codigoCarrera || "SIN CARRERA";

    row.Sede = row.Sede || sede;
    row.sede = row.sede || sede;
    row._sede = row._sede || sede || "SIN SEDE";

    row.division = division;
    row.Division = row.Division || division;
    row._division = division;
    row.divisiones = Array.isArray(row.divisiones) && row.divisiones.length
      ? row.divisiones
      : (division && normalizeKey(division) !== "sindivision" ? [division] : []);

    row.estadoMatricula = estado;
    row._estadoMatricula = estado;

    row.CorreoPersonal = row.CorreoPersonal || row.correoPersonal || "";
    row.CorreoInstitucional = row.CorreoInstitucional || row.correoInstitucional || "";
    row.Celular = row.Celular || row.celular || row.telefono || "";

    row.__bdlScreenDepsVersion = VERSION;

    return row;
  }

  function emptyCache(){
    return {
      meta: {
        source: "empty",
        updatedAt: new Date().toISOString(),
        totalPeriods: 0,
        totalStudents: 0
      },
      periods: [],
      students: [],
      requirements: [],
      summaries: {},
      diagnostics: []
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

    cache.meta.totalPeriods = cache.periods.length;
    cache.meta.totalStudents = cache.students.length;
    cache.meta.screenDepsVersion = VERSION;

    return cache;
  }

  function readCache(force){
    var raw = rawStorage(CACHE_KEY);

    if(!raw){
      raw = rawStorage(OLD_SNAPSHOT_KEY);
    }

    if(!force && memo.cache && memo.raw === raw){
      return memo.cache;
    }

    var cache = safeParse(raw, null);

    if((!cache || !Array.isArray(cache.students)) && rawStorage(OLD_SNAPSHOT_KEY)){
      cache = safeParse(rawStorage(OLD_SNAPSHOT_KEY), null);
    }

    cache = normalizeCache(cache);
    memo.raw = raw;
    memo.cache = cache;
    memo.normalizedAt = new Date().toISOString();

    return cache;
  }

  function clearMemo(){
    memo.raw = "";
    memo.cache = null;
    memo.normalizedAt = "";
  }

  function filterStudents(rows, options){
    options = options || {};
    rows = Array.isArray(rows) ? rows : [];

    var periodoId = canonicalPeriodId(options.periodoId || options.periodId || options.period || "");
    var matricula = text(options.matricula || options.estadoMatricula || "");
    var division = text(options.division || "");
    var carrera = text(options.carrera || options.career || "");
    var sede = text(options.sede || "");
    var search = text(options.search || options.busqueda || options.query || "");
    var limit = Number(options.limit || 0);

    var out = rows.filter(function(input){
      var row = input && input.__bdlScreenDepsVersion === VERSION ? input : normalizeStudent(input);

      if(periodoId && !samePeriod(row.periodoId || row._periodoId || row.ultimoPeriodoId, periodoId)){ return false; }

      if(matricula){
        if(text(row.estadoMatricula || row._estadoMatricula).toUpperCase() !== matricula.toUpperCase()){ return false; }
      }

      if(division){
        var matchesDivision = sameText(row.division || row._division, division);
        if(!matchesDivision){
          try{
            if(window.BLDivisionesService && typeof window.BLDivisionesService.hasDivision === "function"){
              matchesDivision = window.BLDivisionesService.hasDivision(row, division);
            }
          }catch(error){}
        }
        if(!matchesDivision){ return false; }
      }

      if(carrera && !containsText([row.NombreCarrera, row.nombreCarrera, row.Carrera, row.carrera, row.CodigoCarrera, row.codigoCarrera].join(" "), carrera)){ return false; }
      if(sede && !containsText([row.Sede, row.sede, row._sede].join(" "), sede)){ return false; }

      if(search){
        var haystack = [
          row.cedula,
          row.numeroIdentificacion,
          row.NumeroIdentificacion,
          row.Nombres,
          row.nombres,
          row.nombreCompleto,
          row.NombreCarrera,
          row.nombreCarrera,
          row.Carrera,
          row.carrera,
          row.CodigoCarrera,
          row.codigoCarrera,
          row.division,
          row._division,
          row.Sede,
          row.sede,
          row.CorreoPersonal,
          row.CorreoInstitucional,
          row.correoPersonal,
          row.correoInstitucional,
          row.Celular,
          row.celular
        ].join(" ");

        if(!containsText(haystack, search)){ return false; }
      }

      return true;
    });

    return limit > 0 ? out.slice(0, limit) : out;
  }

  function listPeriodsSync(){
    return readCache().periods.slice();
  }

  function getStudentsSync(options){
    return filterStudents(readCache().students, options || {});
  }

  function listStudentsSync(options){
    var rows = getStudentsSync(options || {});
    return {
      ok: true,
      rows: rows,
      total: rows.length,
      periodList: listPeriodsSync(),
      source: "BDLocalScreenDeps",
      cacheAt: memo.normalizedAt
    };
  }

  function getRequirementsSync(filters){
    filters = filters || {};
    var periodoId = canonicalPeriodId(filters.periodoId || filters.periodId || "");
    var cedula = normalizeCedula(filters.cedula || filters.numeroIdentificacion || "");

    return readCache().requirements.filter(function(req){
      req = req || {};
      return (!periodoId || samePeriod(req.periodoId || req.periodId, periodoId)) &&
             (!cedula || normalizeCedula(req.cedula || req.numeroIdentificacion) === cedula);
    });
  }

  function getSummarySync(periodoId){
    periodoId = canonicalPeriodId(periodoId || "");
    var rows = getStudentsSync({ periodoId: periodoId, matricula: "" });
    var activos = rows.filter(function(row){ return text(row.estadoMatricula).toUpperCase() !== "RETIRADO"; }).length;

    return {
      id: periodoId,
      periodoId: periodoId,
      totalEstudiantes: rows.length,
      totalActivos: activos,
      totalRetirados: rows.length - activos,
      source: "BDLocalScreenDeps"
    };
  }

  function getStudentByCedulaSync(cedula, periodoId){
    cedula = normalizeCedula(cedula);
    return getStudentsSync({ periodoId: periodoId || "", matricula: "" }).filter(function(row){
      return normalizeCedula(row.cedula || row.numeroIdentificacion) === cedula;
    })[0] || null;
  }

  function getStudentByIdSync(id, options){
    id = text(id);
    if(!id){ return null; }

    return getStudentsSync(Object.assign({}, options || {}, {
      matricula: options && options.matricula != null ? options.matricula : ""
    })).filter(function(row){
      return text(row.id) === id ||
             text(row._id) === id ||
             text(row.studentId) === id ||
             text(row.idEstudiantePeriodo) === id ||
             text(row.cedula) === id ||
             text(row.numeroIdentificacion) === id;
    })[0] || null;
  }

  function makeSyncAdapters(){
    var readyFn = function(){
      return window.BDLScreenDepsReady || Promise.resolve(true);
    };

    var excelAdapter = {
      ready: readyFn,
      source: "BDLocalScreenDeps",
      getSnapshot: function(){
        var cache = readCache();
        return {
          meta: cache.meta,
          periods: cache.periods,
          students: cache.students,
          history: [],
          diagnostics: cache.diagnostics || []
        };
      },
      listPeriods: listPeriodsSync,
      getPeriods: listPeriodsSync,
      periods: listPeriodsSync,
      listStudents: listStudentsSync,
      getStudents: getStudentsSync,
      getRows: getStudentsSync,
      rows: getStudentsSync,
      all: getStudentsSync,
      listar: getStudentsSync,
      listAllStudents: function(){ return getStudentsSync({ matricula: "" }); },
      filterStudents: getStudentsSync,
      listStudentsByStatus: function(status, periodoId){
        return getStudentsSync({ matricula: status || "", periodoId: periodoId || "" });
      },
      byCedula: getStudentByCedulaSync,
      getStudentByCedula: getStudentByCedulaSync,
      getStudentById: getStudentByIdSync,
      search: function(q, options){
        return listStudentsSync(Object.assign({}, options || {}, { search: q || "" }));
      },
      getSummary: getSummarySync,
      summary: getSummarySync,
      getRequirements: getRequirementsSync,
      invalidate: clearMemo
    };

    var engineAdapter = Object.assign({}, excelAdapter, {
      search: function(options){ return listStudentsSync(options || {}); },
      requirements: getRequirementsSync,
      stats: function(periodoId){
        return {
          periodoId: periodoId,
          estudiantes: getStudentsSync({ periodoId: periodoId, matricula: "" }),
          requisitos: getRequirementsSync({ periodoId: periodoId }),
          resumen: getSummarySync(periodoId),
          source: "BDLocalScreenDeps"
        };
      }
    });

    var estudiantesAdapter = {
      ready: readyFn,
      source: "BDLocalScreenDeps",
      buscar: listStudentsSync,
      getStudents: getStudentsSync,
      listStudents: listStudentsSync,
      filterStudents: getStudentsSync,
      listAllStudents: function(){ return getStudentsSync({ matricula: "" }); },
      obtenerPorCedula: getStudentByCedulaSync,
      getStudentByCedula: getStudentByCedulaSync,
      getStudentById: getStudentByIdSync,
      listPeriods: listPeriodsSync,
      getPeriods: listPeriodsSync,
      invalidate: clearMemo
    };

    var reportesAdapter = {
      ready: readyFn,
      source: "BDLocalScreenDeps",
      buildReportData: function(filters){
        filters = filters || {};
        var rows = getStudentsSync(filters);
        return {
          ok: true,
          source: "BDLocalScreenDeps",
          filters: filters,
          generatedAt: new Date().toISOString(),
          estudiantes: rows,
          rows: rows,
          requisitos: getRequirementsSync(filters),
          periodos: listPeriodsSync(),
          resumen: { totalEstudiantes: rows.length }
        };
      },
      build: function(filters){ return this.buildReportData(filters || {}); },
      report: function(filters){ return this.buildReportData(filters || {}); },
      getStudents: getStudentsSync,
      listStudents: listStudentsSync,
      getRequirements: getRequirementsSync,
      getSummary: getSummarySync,
      getPeriods: listPeriodsSync,
      listPeriods: listPeriodsSync,
      invalidate: clearMemo
    };

    return {
      excel: excelAdapter,
      engine: engineAdapter,
      estudiantes: estudiantesAdapter,
      reportes: reportesAdapter
    };
  }

  function ensureSyncAdapters(){
    var adapters = makeSyncAdapters();

    window.ExcelLocalRepo = Object.assign({}, window.ExcelLocalRepo || {}, adapters.excel);
    window.BL2DataEngine = Object.assign({}, window.BL2DataEngine || {}, adapters.engine);
    window.BL2EstudiantesRepo = Object.assign({}, window.BL2EstudiantesRepo || {}, adapters.estudiantes);
    window.BL2ReportesRepo = Object.assign({}, window.BL2ReportesRepo || {}, adapters.reportes);

    return adapters;
  }

  function resolve(relative){
    try{
      return new URL(relative, currentScript && currentScript.src ? currentScript.src : window.location.href).href;
    }catch(error){
      return relative;
    }
  }

  function loaded(src){
    return Array.prototype.slice.call(document.scripts || []).some(function(script){
      return script.src === src || script.getAttribute("data-bdl-screen-src") === src;
    });
  }

  function load(relative){
    var src = resolve(relative);
    if(loaded(src)){ return Promise.resolve(src); }

    return new Promise(function(resolvePromise){
      var script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.defer = false;
      script.setAttribute("data-bdl-screen-src", src);

      script.onload = function(){ resolvePromise(src); };
      script.onerror = function(){
        try{ console.warn("[BDLocalScreenDeps] No se pudo cargar", src); }catch(error){}
        resolvePromise(src);
      };

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

  function ensureDivisionesService(){
    if(window.BLDivisionesService && typeof window.BLDivisionesService.studentDivision === "function"){
      return Promise.resolve(window.BLDivisionesService);
    }

    return sequential([
      "./bdl.divisiones.service.js",
      "./bdl.divisiones.fast-cache.js"
    ]).then(function(){
      clearMemo();
      return window.BLDivisionesService || null;
    });
  }

  function ensureConexiones(){
    if(window.BDLocalConexiones && typeof window.BDLocalConexiones.ready === "function"){
      return window.BDLocalConexiones.ready();
    }

    return sequential([
      "../conexiones/cone.utils.js",
      "../conexiones/cone.index.js"
    ]).then(function(){
      if(window.BDLocalConexiones && typeof window.BDLocalConexiones.ready === "function"){
        return window.BDLocalConexiones.ready();
      }

      return {
        ok: false,
        ready: false,
        message: "BDLocalConexiones no disponible."
      };
    });
  }

  function ready(){
    if(memo.readyPromise){ return memo.readyPromise; }

    ensureSyncAdapters();

    memo.readyPromise = ensureDivisionesService()
      .then(function(){
        ensureSyncAdapters();
        return ensureConexiones();
      })
      .then(function(result){
        clearMemo();
        ensureSyncAdapters();

        try{
          window.dispatchEvent(new CustomEvent("bdlocal:screen-deps-ready", {
            detail: status()
          }));
        }catch(error){}

        return result || status();
      })
      .catch(function(error){
        try{ console.warn("[BDLocalScreenDeps]", error); }catch(innerError){}
        ensureSyncAdapters();
        return status();
      });

    return memo.readyPromise;
  }

  function status(){
    var cache = readCache();

    return {
      ok: true,
      ready: !!memo.readyPromise,
      version: VERSION,
      mode: "sync-adapter-fast",
      periods: cache.periods.length,
      students: cache.students.length,
      requirements: cache.requirements.length,
      cacheAt: memo.normalizedAt,
      divisionesService: !!window.BLDivisionesService,
      conexiones: !!window.BDLocalConexiones,
      message: "Adaptador rápido de pantallas cargado."
    };
  }

  ensureSyncAdapters();

  window.BDLocalScreenDeps = {
    version: VERSION,
    ready: ready,
    status: status,
    load: load,
    readCache: readCache,
    clearMemo: clearMemo,
    filterStudents: getStudentsSync,
    listStudents: listStudentsSync,
    listPeriods: listPeriodsSync,
    getRequirements: getRequirementsSync,
    getSummary: getSummarySync,
    getStudentByCedula: getStudentByCedulaSync,
    getStudentById: getStudentByIdSync,
    ensureSyncAdapters: ensureSyncAdapters,
    ensureDivisionesService: ensureDivisionesService,
    normalizeStudent: normalizeStudent,
    normalizePeriod: normalizePeriod
  };

  window.BDLScreenDepsReady = ready();

  window.addEventListener("storage", function(event){
    if(!event || event.key === CACHE_KEY || event.key === OLD_SNAPSHOT_KEY || event.key === "carga.periodos.divisiones" || event.key === "carga.periodos.local"){
      clearMemo();
      ensureSyncAdapters();
    }
  });

  window.addEventListener("bdlocal:conexiones-cache-updated", function(){
    clearMemo();
    ensureSyncAdapters();
  });

  window.addEventListener("bdlocal:divisiones-fast-cache-ready", function(){
    clearMemo();
    ensureSyncAdapters();
  });
})(window, document);