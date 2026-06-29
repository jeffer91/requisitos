/* =========================================================
Nombre completo: bl2-estudiantes.repo.js
Ruta o ubicación: /Requisitos/BaseLocal2/repositories/bl2-estudiantes.repo.js
Función o funciones:
- Entregar estudiantes normalizados a Ficha, Tabla y módulos de Requisitos usando BL2.
- Usar BL2DataEngine como fuente principal cuando esté disponible.
- Mantener compatibilidad con BL2LegacyAdapter y Base Local V1.
- Exponer búsqueda, paginación, obtención por cédula, períodos y divisiones.
- Evitar que cada pantalla normalice campos con reglas distintas.
Con qué se conecta:
- core/bl2-student-normalizer.js
- core/bl2-data-engine.js
- core/bl2-memory-index.js
- bl2-api.js
- services/bl2-search.service.js
- Ficha/ficha.core.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-alpha.3-core";
  var DEFAULT_LIMIT = 120;
  var DIVISION_LIMIT = 5000;

  function parentValue(name){try{return window.parent && window.parent !== window ? window.parent[name] : null;}catch(error){return null;}}
  function api(){return window.BL2 || parentValue("BL2") || null;}
  function engine(){return window.BL2DataEngine || parentValue("BL2DataEngine") || null;}
  function legacy(){return window.BL2LegacyAdapter || parentValue("BL2LegacyAdapter") || null;}
  function normalizer(){return window.BL2StudentNormalizer || parentValue("BL2StudentNormalizer") || null;}
  function searchService(){return window.BL2SearchService || parentValue("BL2SearchService") || null;}
  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return searchService() && searchService().normalize ? searchService().normalize(value) : text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g," ").toLowerCase();}

  function normalizeRow(row){
    if(normalizer() && typeof normalizer().normalize === "function"){
      return normalizer().normalize(row || {}, {clone:false});
    }
    var copy = Object.assign({}, row || {});
    copy._bl2Id = text(copy._bl2Id || copy.cedula || copy.Cedula || copy.CEDULA || copy.numeroIdentificacion || copy.numeroidentificacion || copy._docId || copy.docId || copy.id);
    copy._bl2Nombre = text(copy._bl2Nombre || copy.nombres || copy.Nombres || copy.nombre || copy.estudiante);
    copy._bl2Carrera = text(copy._bl2Carrera || copy.nombrecarrera || copy.nombreCarrera || copy.NombreCarrera || copy.carrera || copy.Carrera || "SIN CARRERA");
    copy._bl2Periodo = text(copy._bl2Periodo || copy.periodoLabel || copy.periodo || copy.periodoId || copy.ultimoPeriodoId || "SIN PERÍODO");
    copy._bl2PeriodoId = text(copy._bl2PeriodoId || copy.periodoId || copy.ultimoPeriodoId || copy._bl2Periodo);
    var divs = Array.isArray(copy.divisiones) ? copy.divisiones : [];
    copy._bl2Division = text(copy._bl2Division || divs[0] || copy.division || copy.Division || copy.División || "Sin división");
    copy._bl2EstadoMatricula = norm(copy._bl2EstadoMatricula || copy.estadoMatricula || "ACTIVO") === "retirado" ? "RETIRADO" : "ACTIVO";
    copy._bl2Search = norm([copy._bl2Id,copy._bl2Nombre,copy._bl2Carrera,copy._bl2Periodo,copy._bl2Division,copy._bl2EstadoMatricula].join(" "));
    return copy;
  }

  function normalizeRows(rows){return (Array.isArray(rows) ? rows : []).map(normalizeRow);}
  function cedulaOf(row){return text(normalizeRow(row)._bl2Id);}
  function nombreOf(row){return text(normalizeRow(row)._bl2Nombre);}
  function carreraOf(row){return text(normalizeRow(row)._bl2Carrera);}
  function periodoOf(row){return text(normalizeRow(row)._bl2Periodo);}
  function periodoIdOf(row){return text(normalizeRow(row)._bl2PeriodoId);}
  function divisionOf(row){return text(normalizeRow(row)._bl2Division || "Sin división");}
  function estadoOf(row){return text(normalizeRow(row)._bl2EstadoMatricula || "ACTIVO");}

  function samePeriod(a,b){
    if(!text(b)){return true;}
    try{if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function"){return window.BLPeriodosCanon.samePeriod(a,b);}}catch(error){}
    return text(a) === text(b) || norm(a) === norm(b);
  }

  function listPeriods(){
    if(engine() && typeof engine().listPeriods === "function"){return engine().listPeriods() || [];}
    var bl2 = api();
    if(bl2 && bl2.periodos && typeof bl2.periodos.listar === "function"){return bl2.periodos.listar() || [];}
    if(legacy() && typeof legacy().listPeriods === "function"){return legacy().listPeriods() || [];}
    return [];
  }

  function sourceQuery(payload){
    if(engine() && typeof engine().listStudents === "function"){return engine().listStudents(payload);}
    if(legacy() && typeof legacy().listStudents === "function"){return legacy().listStudents(payload);}
    var bl2 = api();
    if(bl2 && bl2.estudiantes){
      if(typeof bl2.estudiantes.listarPagina === "function"){return bl2.estudiantes.listarPagina(payload);}
      if(typeof bl2.estudiantes.buscar === "function"){return bl2.estudiantes.buscar(payload);}
    }
    return {rows:[], total:0, offset:payload.offset || 0, limit:payload.limit || 0, source:"sin_bl2"};
  }

  function query(options){
    options = options || {};
    var payload = {
      search:options.search || options.q || "",
      q:options.search || options.q || "",
      periodId:options.periodId || options.periodoId || "",
      periodoId:options.periodoId || options.periodId || "",
      division:options.division || "",
      career:options.career || options.carrera || "",
      carrera:options.carrera || options.career || "",
      status:options.status || options.estado || "",
      requisito:options.requisito || options.requirementKey || "",
      requirementKey:options.requirementKey || options.requisito || "",
      matricula:options.matricula == null ? "ACTIVO" : options.matricula,
      estadoMatricula:options.estadoMatricula == null ? (options.matricula == null ? "ACTIVO" : options.matricula) : options.estadoMatricula,
      offset:Math.max(0, Number(options.offset || 0) || 0),
      limit:Math.max(0, Number(options.limit == null ? DEFAULT_LIMIT : options.limit) || 0),
      force:options.force === true
    };
    var result = sourceQuery(payload) || {rows:[], total:0};
    var rows = normalizeRows(result.rows || []);
    return {rows:rows, total:Number(result.total || rows.length) || rows.length, offset:payload.offset, limit:payload.limit || rows.length, source:result.source || (engine()?"BL2DataEngine":"bl2")};
  }

  function listarPagina(options){return query(options);}
  function buscar(options){return query(options);}

  function obtenerPorCedula(cedula, options){
    var wanted = text(cedula);
    if(!wanted){return null;}
    if(engine() && typeof engine().getStudentById === "function"){
      var directEngine = engine().getStudentById(wanted, options || {});
      if(directEngine){return normalizeRow(directEngine);}
    }
    if(legacy() && typeof legacy().getStudentById === "function"){
      var directLegacy = legacy().getStudentById(wanted, options || {});
      if(directLegacy){return normalizeRow(directLegacy);}
    }
    var rows = query(Object.assign({}, options || {}, {search:wanted, matricula:"", estadoMatricula:"", limit:20})).rows;
    return rows.find(function(row){return cedulaOf(row) === wanted;}) || null;
  }

  function listForDivisions(options){return query(Object.assign({}, options || {}, {search:"", limit:DIVISION_LIMIT})).rows;}
  function listDivisions(options){
    var rows = listForDivisions(options || {});
    var map = Object.create(null);
    rows.forEach(function(row){map[divisionOf(row) || "Sin división"] = true;});
    return Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es");});
  }

  function status(){
    var bl2 = api();
    return {ok:!!(engine() || bl2 || legacy()), mode:"bl2_estudiantes_repo", version:VERSION, engineReady:!!engine(), bl2Status:bl2 && typeof bl2.status === "function" ? bl2.status({deep:false}) : null, updatedAt:new Date().toISOString()};
  }

  window.BL2EstudiantesRepo = {version:VERSION,listPeriods:listPeriods,listarPeriodos:listPeriods,buscar:buscar,listarPagina:listarPagina,obtenerPorCedula:obtenerPorCedula,listDivisions:listDivisions,listForDivisions:listForDivisions,normalizeRow:normalizeRow,normalizeRows:normalizeRows,status:status,helpers:{cedulaOf:cedulaOf,nombreOf:nombreOf,carreraOf:carreraOf,periodoOf:periodoOf,periodoIdOf:periodoIdOf,divisionOf:divisionOf,estadoOf:estadoOf,samePeriod:samePeriod}};
})(window);
