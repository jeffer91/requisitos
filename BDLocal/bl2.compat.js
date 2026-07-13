/* =========================================================
Archivo: bl2.compat.js
Ruta: /BDLocal/bl2.compat.js
Funcion:
- Exponer BL2 con nombres compatibles para pantallas antiguas.
- Permitir que Carga, Tabla, Ficha, Stats, Coordi y Reportes lean BL2
  sin reescribir todo de golpe.
- Crear aliases: window.BDLocal, window.BL2DataEngine,
  window.ExcelLocalRepo, window.BL2ReportesRepo y window.BL2EstudiantesRepo.
========================================================= */
(function(window){
  "use strict";

  var config = window.BL2Config || {};
  var utils = config.utils || {};

  var state = {
    initializing:null,
    ready:false
  };

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function clone(value){
    if(value === undefined){ return undefined; }
    try{ return JSON.parse(JSON.stringify(value)); }
    catch(error){ return value; }
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
    if(utils.normalizeCedula){ return utils.normalizeCedula(value); }
    var raw = text(value).replace(/[^\dA-Za-z]/g, "");
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

  function core(){ return window.BL2Core || null; }
  function db(){ return window.BL2DB || null; }

  function ready(){
    if(state.ready){ return Promise.resolve(true); }
    if(state.initializing){ return state.initializing; }

    if(!core() || typeof core().init !== "function"){
      return Promise.reject(new Error("BL2Core no está disponible."));
    }

    try{
      if(typeof core().getState === "function"){
        var st = core().getState() || {};
        if(st.initialized){
          state.ready = true;
          return Promise.resolve(true);
        }
      }
    }catch(error){}

    state.initializing = core().init().then(function(){
      state.ready = true;
      return true;
    }).finally(function(){
      state.initializing = null;
    });

    return state.initializing;
  }

  function withReady(fn){
    return ready().then(function(){ return fn(); });
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

  function normalizeStudentForLegacy(row){
    row = Object.assign({}, row || {});

    var cedula = normalizeCedula(
      row.cedula ||
      row.numeroIdentificacion ||
      row.NumeroIdentificacion ||
      row.Cedula ||
      row["Cédula"] ||
      row.identificacion ||
      row.Identificacion ||
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

    var periodoLabel = text(row.periodoLabel || row.periodo || row.Periodo || row.periodoNombre || row._periodo || row._bl2Periodo || periodoId);

    row.id = row.id || row._id || (cedula && periodoId ? cedula + "__" + periodoId : cedula);
    row.cedula = cedula;
    row._cedula = row._cedula || cedula;
    row.numeroIdentificacion = row.numeroIdentificacion || cedula;
    row.NumeroIdentificacion = row.NumeroIdentificacion || cedula;

    row.Nombres = row.Nombres || row.nombres || row.Nombre || row.nombre || row.Estudiante || row.estudiante || "";
    row.nombres = row.nombres || row.Nombres || "";
    row._nombres = row._nombres || row.Nombres || row.nombres;

    row.NombreCarrera = row.NombreCarrera || row.nombreCarrera || row.Carrera || row.carrera || "";
    row.CodigoCarrera = row.CodigoCarrera || row.codigoCarrera || "";
    row._carrera = row._carrera || row.NombreCarrera || row.CodigoCarrera || "SIN CARRERA";

    row._telegramUser = row._telegramUser || row.telegramUser || row.telegram || "";
    row._telegramChatId = row._telegramChatId || row.telegramChatId || row.chatId || "";

    row.periodoId = periodoId;
    row.periodId = periodoId;
    row.ultimoPeriodoId = row.ultimoPeriodoId || periodoId;
    row.periodoLabel = periodoLabel;
    row.Periodo = row.Periodo || periodoLabel;
    row._periodoId = row._periodoId || periodoId;
    row._periodo = row._periodo || periodoLabel;

    row.division = row.division || row.Division || row["División"] || (Array.isArray(row.divisiones) ? row.divisiones[0] : "") || "Sin división";
    row._division = row._division || row.division;

    row.estadoMatricula = text(row.estadoMatricula || row.EstadoMatricula || "ACTIVO").toUpperCase() === "RETIRADO" ? "RETIRADO" : "ACTIVO";
    row._estadoMatricula = row._estadoMatricula || row.estadoMatricula;

    return row;
  }

  function normalizeRowsForLegacy(rows){
    return (Array.isArray(rows) ? rows : []).map(normalizeStudentForLegacy);
  }

  function filterRows(rows, filters){
    filters = filters || {};
    rows = normalizeRowsForLegacy(rows || []);

    var periodoId = canonicalPeriodId(filters.periodoId || filters.periodId || filters.period || "");
    var matricula = text(filters.matricula || filters.estadoMatricula || "");
    var division = normalizeBasic(filters.division || "").toLowerCase();
    var search = normalizeBasic(filters.search || filters.busqueda || filters.query || "").toLowerCase();
    var limit = Number(filters.limit || 0);

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

  function getActivePeriod(){
    return withReady(function(){ return core().getActivePeriod(); });
  }

  function setActivePeriod(periodoId, periodoLabel){
    return withReady(function(){ return core().setActivePeriod(periodoId, periodoLabel); });
  }

  function getPeriods(){
    return withReady(function(){
      return core().getPeriods().then(function(rows){
        return (rows || []).map(normalizePeriod).filter(Boolean);
      });
    });
  }

  function listPeriods(){ return getPeriods(); }

  function getStudents(filters){
    filters = filters || {};
    return withReady(function(){
      return core().getStudents(filters).then(function(rows){
        return filterRows(rows || [], filters);
      });
    });
  }

  function listStudents(filters){
    return getStudents(filters || {}).then(function(rows){
      return {
        ok:true,
        rows:rows,
        total:rows.length,
        periodList:[],
        source:"BL2"
      };
    });
  }

  function getRows(filters){ return getStudents(filters || {}); }
  function rows(filters){ return getStudents(filters || {}); }
  function getAllStudents(){ return getStudents({ matricula:"" }); }
  function listAllStudents(){ return getAllStudents(); }

  function getStudentsByPeriod(periodoId){
    return getStudents({ periodoId:periodoId });
  }

  function filterStudents(filters){
    return getStudents(filters || {});
  }

  function listStudentsByStatus(status, periodoId){
    return getStudents({ matricula:status || "", periodoId:periodoId || "" });
  }

  function getStudentByCedula(cedula, periodoId){
    return withReady(function(){
      return core().getStudentByCedula(cedula, periodoId).then(function(row){
        return row ? normalizeStudentForLegacy(row) : null;
      });
    });
  }

  function getStudentById(id, options){
    id = text(id);
    options = options || {};
    if(!id){ return Promise.resolve(null); }

    return getStudents(Object.assign({}, options, { matricula:options.matricula == null ? "" : options.matricula })).then(function(rows){
      return rows.filter(function(row){
        return text(row.id) === id || text(row._id) === id || text(row.cedula) === id || text(row.numeroIdentificacion) === id;
      })[0] || null;
    });
  }

  function searchStudents(query, options){
    options = Object.assign({}, options || {}, { search:query || "" });
    return getStudents(options);
  }

  function search(options){
    if(typeof options === "string"){
      return searchStudents(options, {});
    }
    return listStudents(options || {});
  }

  function saveStudents(rows, options){
    return withReady(function(){ return core().saveStudents(rows || [], options || {}); });
  }

  function guardarEstudiantes(rows, periodoInfo, options){
    return saveStudents(rows || [], Object.assign({}, options || {}, periodoInfo || {}));
  }

  function updateStudent(id, changes, options){
    return withReady(function(){ return core().updateStudent(id, changes || {}, options || {}); });
  }

  function getRequirements(filters){
    filters = filters || {};
    return withReady(function(){ return core().getRequirements(filters); });
  }

  function getSummary(periodoId){
    return withReady(function(){ return core().getSummary(periodoId); });
  }

  function exportBackup(options){
    return withReady(function(){ return core().exportBackup(options || {}); });
  }

  function importBackup(payload, options){
    return withReady(function(){ return core().importBackup(payload, options || {}); });
  }

  function getRawTable(name){
    return withReady(function(){
      if(!db() || typeof db().getAll !== "function"){ return []; }
      return db().getAll(name);
    });
  }

  function getStatsData(periodoId){
    return Promise.all([
      getStudents({ periodoId:periodoId, matricula:"" }),
      getRequirements({ periodoId:periodoId }),
      getSummary(periodoId)
    ]).then(function(values){
      return {
        periodoId:periodoId,
        estudiantes:values[0],
        requisitos:values[1],
        resumen:values[2],
        rows:values[0],
        source:"BL2"
      };
    });
  }

  function buildReportData(filters){
    filters = filters || {};
    return Promise.all([
      getStudents(filters),
      getRequirements(filters),
      getSummary(filters.periodoId || filters.periodId || "")
    ]).then(function(values){
      return {
        ok:true,
        filters:clone(filters),
        estudiantes:values[0],
        rows:values[0],
        requisitos:values[1],
        resumen:values[2],
        generatedAt:new Date().toISOString(),
        source:"BL2"
      };
    });
  }

  function getSnapshot(){
    return Promise.all([getPeriods(), getStudents({ matricula:"" })]).then(function(values){
      return {
        meta:{ source:"BL2", updatedAt:new Date().toISOString(), totalPeriods:values[0].length, totalStudents:values[1].length },
        periods:values[0],
        students:values[1],
        history:[],
        diagnostics:[]
      };
    });
  }

  function legacyInit(){ return ready(); }

  var BDLocal = {
    version:config.version || "1.0.0",
    name:"BL2",
    init:legacyInit,
    ready:ready,

    getActivePeriod:getActivePeriod,
    activePeriod:getActivePeriod,
    setActivePeriod:setActivePeriod,

    getPeriods:getPeriods,
    listPeriods:listPeriods,
    listarPeriodos:getPeriods,
    periods:getPeriods,
    periodos:getPeriods,

    getStudents:getStudents,
    listStudents:listStudents,
    getRows:getRows,
    rows:rows,
    getAllStudents:getAllStudents,
    listAllStudents:listAllStudents,
    getStudentsByPeriod:getStudentsByPeriod,
    listStudentsByStatus:listStudentsByStatus,
    filterStudents:filterStudents,
    listarEstudiantes:getStudents,
    obtenerEstudiantes:getStudents,
    estudiantes:getStudents,

    getStudentById:getStudentById,
    getStudentByCedula:getStudentByCedula,
    buscarPorCedula:getStudentByCedula,
    buscarEstudiante:getStudentByCedula,

    searchStudents:searchStudents,
    search:search,
    buscar:search,

    saveStudents:saveStudents,
    guardarEstudiantes:guardarEstudiantes,

    updateStudent:updateStudent,
    actualizarEstudiante:updateStudent,

    getRequirements:getRequirements,
    obtenerRequisitos:getRequirements,

    getSummary:getSummary,
    summary:getSummary,
    resumen:getSummary,

    getStatsData:getStatsData,
    stats:getStatsData,

    buildReportData:buildReportData,
    report:buildReportData,

    exportBackup:exportBackup,
    importBackup:importBackup,
    getRawTable:getRawTable,
    getSnapshot:getSnapshot
  };

  var BL2DataEngine = {
    version:config.version || "1.0.0",
    source:"BL2",
    ready:ready,
    init:legacyInit,

    rows:getStudents,
    getRows:getStudents,
    getStudents:getStudents,
    listStudents:listStudents,
    filterStudents:filterStudents,
    listAllStudents:listAllStudents,
    listStudentsByStatus:listStudentsByStatus,
    estudiantes:getStudents,
    listarEstudiantes:getStudents,

    getStudentById:getStudentById,
    getStudentByCedula:getStudentByCedula,
    search:search,
    buscar:search,

    periods:getPeriods,
    periodos:getPeriods,
    getPeriods:getPeriods,
    listPeriods:listPeriods,

    activePeriod:getActivePeriod,
    getActivePeriod:getActivePeriod,
    setActivePeriod:setActivePeriod,

    requirements:getRequirements,
    getRequirements:getRequirements,

    summary:getSummary,
    getSummary:getSummary,

    stats:getStatsData,
    getStatsData:getStatsData,

    report:buildReportData,
    buildReportData:buildReportData
  };

  var ExcelLocalRepo = {
    ready:ready,
    source:"BL2",
    getSnapshot:getSnapshot,

    all:getStudents,
    rows:getStudents,
    getRows:getStudents,
    getStudents:getStudents,
    listStudents:listStudents,
    listAllStudents:listAllStudents,
    listStudentsByStatus:listStudentsByStatus,
    filterStudents:filterStudents,
    listar:getStudents,

    periods:getPeriods,
    getPeriods:getPeriods,
    listPeriods:listPeriods,

    summary:getSummary,
    getSummary:getSummary,

    search:search,
    byCedula:getStudentByCedula,
    getStudentByCedula:getStudentByCedula,
    getStudentById:getStudentById
  };

  var BL2EstudiantesRepo = {
    ready:ready,
    source:"BL2",
    buscar:listStudents,
    getStudents:getStudents,
    listStudents:listStudents,
    filterStudents:filterStudents,
    listAllStudents:listAllStudents,
    listStudentsByStatus:listStudentsByStatus,
    obtenerPorCedula:getStudentByCedula,
    getStudentByCedula:getStudentByCedula,
    getStudentById:getStudentById,
    listPeriods:listPeriods,
    getPeriods:getPeriods
  };

  var BL2ReportesRepo = {
    ready:ready,
    source:"BL2",
    build:buildReportData,
    buildReportData:buildReportData,
    report:buildReportData,
    getStudents:getStudents,
    listStudents:listStudents,
    getRequirements:getRequirements,
    getSummary:getSummary,
    getPeriods:getPeriods,
    listPeriods:listPeriods
  };

  window.BDLocal = BDLocal;
  window.BL2DataEngine = Object.assign({}, window.BL2DataEngine || {}, BL2DataEngine);
  window.ExcelLocalRepo = Object.assign({}, window.ExcelLocalRepo || {}, ExcelLocalRepo);
  window.BL2EstudiantesRepo = Object.assign({}, window.BL2EstudiantesRepo || {}, BL2EstudiantesRepo);
  window.BL2ReportesRepo = Object.assign({}, window.BL2ReportesRepo || {}, BL2ReportesRepo);

  window.addEventListener("bl2:ready", function(){ state.ready = true; });

  try{
    window.dispatchEvent(new CustomEvent("bl2:compat-ready", {
      detail:{
        aliases:["BDLocal", "BL2DataEngine", "ExcelLocalRepo", "BL2EstudiantesRepo", "BL2ReportesRepo"],
        methods:["listStudents", "listPeriods", "filterStudents", "getStudentById", "getSnapshot"]
      }
    }));
  }catch(error){}
})(window);
