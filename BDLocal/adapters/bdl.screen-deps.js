/* =========================================================
Nombre completo: bdl.screen-deps.js
Ruta o ubicacion: /Requisitos/BDLocal/adapters/bdl.screen-deps.js
Funcion:
- Adaptador comun para pantallas que necesitan BDLocal.
- Carga conectores compatibles con Windows: cone.utils.js y cone.index.js.
- Carga BLDivisionesService para que Ficha, Stats, Tabla, Defensas y Reportes usen la misma lógica de divisiones.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.2.0";
  var currentScript = document.currentScript;
  var CACHE_KEY = "REQ_BDLOCAL_CONEXIONES_CACHE_V1";
  var OLD_SNAPSHOT_KEY = "REQ_EXCEL_LOCAL_V1:snapshot";

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function safeParse(value, fallback){
    try{
      return value ? JSON.parse(value) : fallback;
    }catch(error){
      return fallback;
    }
  }

  function normalizeCedula(value){
    var raw = text(value).replace(/[^0-9A-Za-z]/g, "");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function canonicalPeriodId(value){
    value = text(value);
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
      periodoLabel: label,
      periodoCanonicoId: id,
      periodoCanonicoLabel: label,
      divisiones: Array.isArray(period.divisiones) ? period.divisiones : [],
      carrerasDetectadas: Array.isArray(period.carrerasDetectadas) ? period.carrerasDetectadas : []
    });
  }

  function fallbackDivision(row){
    row = row || {};
    var direct = text(row.division || row.Division || row["División"] || "");
    var list = Array.isArray(row.divisiones) ? row.divisiones : [];
    return direct || list[0] || "Sin división";
  }

  function normalizeStudent(row){
    row = Object.assign({}, row || {});

    var cedula = normalizeCedula(
      row.cedula ||
      row.numeroIdentificacion ||
      row.NumeroIdentificacion ||
      row.identificacion ||
      row.Identificacion ||
      row.Cedula ||
      row["Cédula"] ||
      ""
    );

    var periodoId = canonicalPeriodId(
      row.periodoId ||
      row.periodId ||
      row.ultimoPeriodoId ||
      row.idPeriodo ||
      row._periodoId ||
      row._bl2PeriodoId ||
      ""
    );

    var periodoLabel = text(
      row.periodoLabel ||
      row.periodo ||
      row.Periodo ||
      row._periodo ||
      row._bl2Periodo ||
      periodoId
    );

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

    var division = "";
    try{
      if(window.BLDivisionesService && typeof window.BLDivisionesService.studentDivision === "function"){
        division = window.BLDivisionesService.studentDivision(row);
      }
    }catch(error){}

    division = text(division || fallbackDivision(row) || "Sin división");
    row.division = division;
    row._division = division;
    row.divisiones = Array.isArray(row.divisiones) && row.divisiones.length ? row.divisiones : (division && normalizeKey(division) !== "sindivision" ? [division] : []);

    row.estadoMatricula = text(row.estadoMatricula || row.EstadoMatricula || "ACTIVO").toUpperCase() === "RETIRADO" ? "RETIRADO" : "ACTIVO";
    row._estadoMatricula = row._estadoMatricula || row.estadoMatricula;

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

  function readCache(){
    var cache = emptyCache();

    try{
      cache = safeParse(localStorage.getItem(CACHE_KEY), null) || cache;
    }catch(error){}

    if((!cache.students || !cache.students.length) && (!cache.periods || !cache.periods.length)){
      try{
        var old = safeParse(localStorage.getItem(OLD_SNAPSHOT_KEY), null);
        if(old && typeof old === "object"){
          cache.periods = Array.isArray(old.periods) ? old.periods : [];
          cache.students = Array.isArray(old.students) ? old.students : [];
          cache.meta = Object.assign({}, old.meta || {}, { source: "legacy-snapshot" });
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

      if(division){
        var matchesDivision = false;
        try{
          if(window.BLDivisionesService && typeof window.BLDivisionesService.hasDivision === "function"){
            matchesDivision = window.BLDivisionesService.hasDivision(row, division);
          }
        }catch(error){}

        if(!matchesDivision && normalizeBasic(row.division || row._division || "").toLowerCase() !== division){ return false; }
      }

      if(search){
        var hay = normalizeBasic([
          row.cedula,
          row.numeroIdentificacion,
          row.Nombres,
          row.nombres,
          row.NombreCarrera,
          row.CodigoCarrera,
          row.division,
          row.CorreoPersonal,
          row.CorreoInstitucional,
          row.Celular
        ].join(" ")).toLowerCase();

        if(hay.indexOf(search) < 0){ return false; }
      }

      return true;
    });

    return limit > 0 ? rows.slice(0, limit) : rows;
  }

  function listPeriodsSync(){
    return readCache().periods;
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
      source: "BDLocalScreenDeps"
    };
  }

  function getRequirementsSync(filters){
    filters = filters || {};
    var periodoId = canonicalPeriodId(filters.periodoId || filters.periodId || "");
    var cedula = normalizeCedula(filters.cedula || filters.numeroIdentificacion || "");

    return readCache().requirements.filter(function(req){
      return (!periodoId || samePeriod(req.periodoId, periodoId)) && (!cedula || normalizeCedula(req.cedula) === cedula);
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
      matricula: options && options.matricula == null ? "" : options && options.matricula
    })).filter(function(row){
      return text(row.id) === id || text(row._id) === id || text(row.cedula) === id || text(row.numeroIdentificacion) === id;
    })[0] || null;
  }

  function makeSyncAdapters(){
    var readyFn = function(){ return window.BDLScreenDepsReady || Promise.resolve(true); };

    return {
      excel: {
        ready: readyFn,
        source: "BDLocalScreenDeps",
        getSnapshot: function(){
          var cache = readCache();
          return { meta: cache.meta, periods: cache.periods, students: cache.students, history: [], diagnostics: cache.diagnostics || [] };
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
        listStudentsByStatus: function(status, periodoId){ return getStudentsSync({ matricula: status || "", periodoId: periodoId || "" }); },
        byCedula: getStudentByCedulaSync,
        getStudentByCedula: getStudentByCedulaSync,
        getStudentById: getStudentByIdSync,
        search: function(q, options){ return listStudentsSync(Object.assign({}, options || {}, { search: q || "" })); },
        getSummary: getSummarySync,
        summary: getSummarySync,
        getRequirements: getRequirementsSync
      },
      engine: {
        ready: readyFn,
        source: "BDLocalScreenDeps",
        listPeriods: listPeriodsSync,
        getPeriods: listPeriodsSync,
        periods: listPeriodsSync,
        listStudents: listStudentsSync,
        getStudents: getStudentsSync,
        getRows: getStudentsSync,
        rows: getStudentsSync,
        filterStudents: getStudentsSync,
        listAllStudents: function(){ return getStudentsSync({ matricula: "" }); },
        listStudentsByStatus: function(status, periodoId){ return getStudentsSync({ matricula: status || "", periodoId: periodoId || "" }); },
        getStudentByCedula: getStudentByCedulaSync,
        getStudentById: getStudentByIdSync,
        search: function(options){ return listStudentsSync(options || {}); },
        getRequirements: getRequirementsSync,
        requirements: getRequirementsSync,
        getSummary: getSummarySync,
        summary: getSummarySync,
        stats: function(periodoId){
          return {
            periodoId: periodoId,
            estudiantes: getStudentsSync({ periodoId: periodoId, matricula: "" }),
            requisitos: getRequirementsSync({ periodoId: periodoId }),
            resumen: getSummarySync(periodoId),
            source: "BDLocalScreenDeps"
          };
        }
      },
      estudiantes: {
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
        getPeriods: listPeriodsSync
      },
      reportes: {
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
        listPeriods: listPeriodsSync
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

  function ensureDivisionesService(){
    if(window.BLDivisionesService && typeof window.BLDivisionesService.studentDivision === "function"){
      return Promise.resolve(window.BLDivisionesService);
    }

    return load("./bdl.divisiones.service.js").then(function(){
      return window.BLDivisionesService || null;
    });
  }

  function ready(){
    ensureSyncAdapters();

    return ensureDivisionesService()
      .then(function(){
        ensureSyncAdapters();

        if(window.BDLocalConexiones && typeof window.BDLocalConexiones.ready === "function"){
          return window.BDLocalConexiones.ready();
        }

        return sequential(["../conexiones/cone.utils.js", "../conexiones/cone.index.js"]).then(function(){
          ensureSyncAdapters();

          if(window.BDLocalConexiones && typeof window.BDLocalConexiones.ready === "function"){
            return window.BDLocalConexiones.ready().then(function(result){
              ensureSyncAdapters();
              return result;
            });
          }

          return { ok: false, message: "BDLocalConexiones no disponible." };
        });
      });
  }

  function status(){
    if(window.BDLocalConexiones && typeof window.BDLocalConexiones.status === "function"){
      return window.BDLocalConexiones.status();
    }

    var cache = readCache();
    return {
      ok: true,
      ready: false,
      version: VERSION,
      mode: "sync-adapter",
      periods: cache.periods.length,
      students: cache.students.length,
      divisionesService: !!window.BLDivisionesService,
      message: "Adaptador sincronico cargado; conexiones completas inicializando."
    };
  }

  ensureSyncAdapters();

  window.BDLocalScreenDeps = {
    version: VERSION,
    ready: ready,
    status: status,
    load: load,
    readCache: readCache,
    filterStudents: getStudentsSync,
    ensureSyncAdapters: ensureSyncAdapters,
    ensureDivisionesService: ensureDivisionesService
  };

  window.BDLScreenDepsReady = ready();

  window.BDLScreenDepsReady.then(function(){
    ensureSyncAdapters();
    try{
      window.dispatchEvent(new CustomEvent("bdlocal:screen-deps-ready", { detail: status() }));
    }catch(error){}
  }).catch(function(error){
    try{ console.warn("[BDLocalScreenDeps]", error); }catch(innerError){}
    return null;
  });
})(window, document);
