/* =========================================================
Archivo: bl2.compat.js
Ruta: /BDLocal/bl2.compat.js
Función:
- Exponer BL2 con nombres compatibles para pantallas antiguas.
- Permitir que Tabla, Ficha, Stats y otros módulos lean BL2
  sin reescribir todo de golpe.
- Crear aliases: window.BDLocal, window.BL2DataEngine,
  window.ExcelLocalRepo y window.BL2ReportesRepo.
========================================================= */
(function(window){
  "use strict";

  var config = window.BL2Config || {};
  var utils = config.utils || {};

  var state = {
    initializing: null,
    ready: false
  };

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function clone(value){
    if(value === undefined){ return undefined; }
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeCedula(value){
    if(utils.normalizeCedula){
      return utils.normalizeCedula(value);
    }

    var raw = text(value).replace(/[^\dA-Za-z]/g, "");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function core(){
    return window.BL2Core || null;
  }

  function db(){
    return window.BL2DB || null;
  }

  function ready(){
    if(state.ready){
      return Promise.resolve(true);
    }

    if(state.initializing){
      return state.initializing;
    }

    if(!core() || typeof core().init !== "function"){
      return Promise.reject(new Error("BL2Core no está disponible."));
    }

    state.initializing = core().init().then(function(){
      state.ready = true;
      return true;
    }).finally(function(){
      state.initializing = null;
    });

    return state.initializing;
  }

  function withReady(fn){
    return ready().then(function(){
      return fn();
    });
  }

  function normalizeStudentForLegacy(row){
    row = Object.assign({}, row || {});

    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || row.NumeroIdentificacion || "");

    row.id = row.id || (cedula && row.periodoId ? cedula + "__" + row.periodoId : "");
    row.cedula = cedula;
    row._cedula = row._cedula || cedula;
    row.numeroIdentificacion = row.numeroIdentificacion || cedula;
    row.NumeroIdentificacion = row.NumeroIdentificacion || cedula;

    row.Nombres = row.Nombres || row.nombres || row.Nombre || "";
    row.nombres = row.nombres || row.Nombres || "";

    row.NombreCarrera = row.NombreCarrera || row.nombreCarrera || row.Carrera || "";
    row.CodigoCarrera = row.CodigoCarrera || row.codigoCarrera || "";

    row._telegramUser = row._telegramUser || row.telegramUser || "";
    row._telegramChatId = row._telegramChatId || row.telegramChatId || "";

    row.periodoId = row.periodoId || row.ultimoPeriodoId || "";
    row.periodoLabel = row.periodoLabel || row.periodoNombre || "";

    row.estadoMatricula = row.estadoMatricula || "ACTIVO";

    return row;
  }

  function normalizeRowsForLegacy(rows){
    return (Array.isArray(rows) ? rows : []).map(normalizeStudentForLegacy);
  }

  function getActivePeriod(){
    return withReady(function(){
      return core().getActivePeriod();
    });
  }

  function setActivePeriod(periodoId, periodoLabel){
    return withReady(function(){
      return core().setActivePeriod(periodoId, periodoLabel);
    });
  }

  function getPeriods(){
    return withReady(function(){
      return core().getPeriods();
    });
  }

  function getStudents(filters){
    filters = filters || {};

    return withReady(function(){
      return core().getStudents(filters).then(normalizeRowsForLegacy);
    });
  }

  function getAllStudents(){
    return getStudents({});
  }

  function getStudentsByPeriod(periodoId){
    return getStudents({
      periodoId: periodoId
    });
  }

  function getStudentByCedula(cedula, periodoId){
    return withReady(function(){
      return core().getStudentByCedula(cedula, periodoId).then(function(row){
        return row ? normalizeStudentForLegacy(row) : null;
      });
    });
  }

  function searchStudents(query, options){
    options = options || {};

    return getStudents(Object.assign({}, options, {
      query: query
    }));
  }

  function saveStudents(rows, options){
    return withReady(function(){
      return core().saveStudents(rows, options || {});
    });
  }

  function updateStudent(id, changes, options){
    return withReady(function(){
      return core().updateStudent(id, changes || {}, options || {});
    });
  }

  function getRequirements(filters){
    filters = filters || {};

    return withReady(function(){
      return core().getRequirements(filters);
    });
  }

  function getSummary(periodoId){
    return withReady(function(){
      return core().getSummary(periodoId);
    });
  }

  function exportBackup(options){
    return withReady(function(){
      return core().exportBackup(options || {});
    });
  }

  function importBackup(payload, options){
    return withReady(function(){
      return core().importBackup(payload, options || {});
    });
  }

  function getRawTable(name){
    return withReady(function(){
      if(!db() || typeof db().getAll !== "function"){
        return [];
      }

      return db().getAll(name);
    });
  }

  function getStatsData(periodoId){
    return Promise.all([
      getStudents({ periodoId: periodoId }),
      getRequirements({ periodoId: periodoId }),
      getSummary(periodoId)
    ]).then(function(values){
      return {
        periodoId: periodoId,
        estudiantes: values[0],
        requisitos: values[1],
        resumen: values[2],
        rows: values[0]
      };
    });
  }

  function buildReportData(filters){
    filters = filters || {};

    return Promise.all([
      getStudents(filters),
      getRequirements(filters),
      getSummary(filters.periodoId || "")
    ]).then(function(values){
      return {
        filters: clone(filters),
        estudiantes: values[0],
        requisitos: values[1],
        resumen: values[2],
        generatedAt: new Date().toISOString()
      };
    });
  }

  function legacyInit(){
    return ready();
  }

  var BDLocal = {
    version: config.version || "1.0.0",
    name: "BL2",

    init: legacyInit,
    ready: ready,

    getActivePeriod: getActivePeriod,
    setActivePeriod: setActivePeriod,

    getPeriods: getPeriods,
    listarPeriodos: getPeriods,
    periodos: getPeriods,

    getStudents: getStudents,
    getAllStudents: getAllStudents,
    getStudentsByPeriod: getStudentsByPeriod,
    listarEstudiantes: getStudents,
    obtenerEstudiantes: getStudents,
    estudiantes: getStudents,

    getStudentByCedula: getStudentByCedula,
    buscarPorCedula: getStudentByCedula,
    buscarEstudiante: getStudentByCedula,

    searchStudents: searchStudents,
    buscar: searchStudents,

    saveStudents: saveStudents,
    guardarEstudiantes: saveStudents,

    updateStudent: updateStudent,
    actualizarEstudiante: updateStudent,

    getRequirements: getRequirements,
    obtenerRequisitos: getRequirements,

    getSummary: getSummary,
    resumen: getSummary,

    exportBackup: exportBackup,
    importBackup: importBackup,

    getRawTable: getRawTable
  };

  var BL2DataEngine = {
    version: config.version || "1.0.0",
    source: "BL2",

    ready: ready,
    init: legacyInit,

    rows: getStudents,
    getRows: getStudents,
    getStudents: getStudents,
    estudiantes: getStudents,
    listarEstudiantes: getStudents,

    getStudentByCedula: getStudentByCedula,
    search: searchStudents,
    buscar: searchStudents,

    periods: getPeriods,
    periodos: getPeriods,
    getPeriods: getPeriods,

    activePeriod: getActivePeriod,
    getActivePeriod: getActivePeriod,
    setActivePeriod: setActivePeriod,

    requirements: getRequirements,
    getRequirements: getRequirements,

    summary: getSummary,
    getSummary: getSummary,

    stats: getStatsData,
    getStatsData: getStatsData,

    report: buildReportData,
    buildReportData: buildReportData
  };

  var ExcelLocalRepo = {
    ready: ready,
    source: "BL2",

    all: getStudents,
    rows: getStudents,
    getRows: getStudents,
    getStudents: getStudents,
    listar: getStudents,

    periods: getPeriods,
    getPeriods: getPeriods,

    summary: getSummary,
    getSummary: getSummary,

    search: searchStudents,
    byCedula: getStudentByCedula
  };

  var BL2ReportesRepo = {
    ready: ready,
    source: "BL2",

    build: buildReportData,
    buildReportData: buildReportData,

    getStudents: getStudents,
    getRequirements: getRequirements,
    getSummary: getSummary,
    getPeriods: getPeriods
  };

  window.BDLocal = BDLocal;
  window.BL2DataEngine = BL2DataEngine;
  window.ExcelLocalRepo = window.ExcelLocalRepo || ExcelLocalRepo;
  window.BL2ReportesRepo = BL2ReportesRepo;

  window.addEventListener("bl2:ready", function(){
    state.ready = true;
  });

  try{
    window.dispatchEvent(new CustomEvent("bl2:compat-ready", {
      detail: {
        aliases: ["BDLocal", "BL2DataEngine", "ExcelLocalRepo", "BL2ReportesRepo"]
      }
    }));
  }catch(error){}
})(window);