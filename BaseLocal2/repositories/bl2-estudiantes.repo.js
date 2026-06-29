/* =========================================================
Nombre completo: bl2-estudiantes.repo.js
Ruta o ubicación: /Requisitos/BaseLocal2/repositories/bl2-estudiantes.repo.js
Función o funciones:
- Entregar estudiantes normalizados a Base Local y módulos de Requisitos.
- Priorizar IndexedDB/BL2Storage cuando se consulta de forma asíncrona.
- Evitar BL2DataEngine como camino principal de Base Local porque reconstruye índices completos.
- Hacer fallback paginado real: recorrer, contar y guardar solo la página solicitada.
Con qué se conecta:
- db/bl2-storage.js
- bl2-legacy-adapter.js
- services/bl2-search.service.js
- BaseLocal/baselocal.core.js
- BaseLocal/baselocal.app.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.1-repo-page-first";
  var DEFAULT_LIMIT = 100;
  var MAX_LIMIT = 500;
  var DIVISION_LIMIT = 5000;
  var CACHE_MS = 2500;
  var cache = {key:"", result:null, at:0};

  function parentValue(name){try{return window.parent && window.parent !== window ? window.parent[name] : null;}catch(error){return null;}}
  function storage(){return window.BL2Storage || parentValue("BL2Storage") || null;}
  function legacy(){return window.BL2LegacyAdapter || parentValue("BL2LegacyAdapter") || null;}
  function searchService(){return window.BL2SearchService || parentValue("BL2SearchService") || null;}
  function schema(){return window.BL2Schema || parentValue("BL2Schema") || null;}
  function periodRepo(){return window.BL2PeriodosRepo || parentValue("BL2PeriodosRepo") || null;}

  function text(value){if(schema() && schema().helpers && schema().helpers.text){return schema().helpers.text(value);}return String(value == null ? "" : value).trim();}
  function norm(value){if(searchService() && searchService().normalize){return searchService().normalize(value);}if(schema() && schema().helpers && schema().helpers.searchKey){return schema().helpers.searchKey(value);}return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g," ").toLowerCase().trim();}

  function normalizeRow(row){
    if(!row || typeof row !== "object"){row = {};}
    if(row._bl2Normalized === true){return row;}
    if(schema() && schema().helpers && typeof schema().helpers.normalizeStudent === "function"){
      var n = schema().helpers.normalizeStudent(row);
      n._bl2Normalized = true;
      return n;
    }
    var copy = Object.assign({}, row);
    var cedula = text(copy._bl2Id || copy.cedula || copy.Cedula || copy.CEDULA || copy.numeroIdentificacion || copy.numeroidentificacion || copy._docId || copy.docId || copy.id);
    var nombres = text(copy._bl2Nombre || copy.nombres || copy.Nombres || copy.nombre || copy.Nombre || copy.estudiante || copy.Estudiante);
    var carrera = text(copy._bl2Carrera || copy.nombrecarrera || copy.nombreCarrera || copy.NombreCarrera || copy.carrera || copy.Carrera || "SIN CARRERA");
    var periodo = text(copy._bl2Periodo || copy.periodoLabel || copy.periodo || copy.Periodo || copy.periodoId || copy.ultimoPeriodoId || "SIN PERÍODO");
    var periodoId = text(copy._bl2PeriodoId || copy.periodoId || copy.ultimoPeriodoId || periodo);
    var divs = Array.isArray(copy.divisiones) ? copy.divisiones : [];
    var division = text(copy._bl2Division || divs[0] || copy.division || copy.Division || copy.División || "Sin división");
    var estado = norm(copy._bl2EstadoMatricula || copy.estadoMatricula || "ACTIVO").indexOf("retir") >= 0 ? "RETIRADO" : "ACTIVO";
    copy._bl2Id = cedula;
    copy.cedula = text(copy.cedula || cedula);
    copy.numeroIdentificacion = text(copy.numeroIdentificacion || copy.numeroidentificacion || cedula);
    copy._bl2Nombre = nombres;
    copy.nombres = text(copy.nombres || copy.Nombres || nombres);
    copy._bl2Carrera = carrera;
    copy.nombreCarrera = text(copy.nombreCarrera || copy.nombrecarrera || copy.NombreCarrera || carrera);
    copy._bl2Periodo = periodo;
    copy._bl2PeriodoId = periodoId;
    copy.periodoId = text(copy.periodoId || periodoId);
    copy.periodoLabel = text(copy.periodoLabel || periodo);
    copy._bl2Division = division;
    copy._bl2EstadoMatricula = estado;
    copy.estadoMatricula = estado;
    copy._bl2Search = norm([cedula, nombres, carrera, periodo, periodoId, division, estado, copy.sede || copy.Sede || "", copy.jornada || copy.Jornada || ""].join(" "));
    copy._bl2Normalized = true;
    return copy;
  }

  function cedulaOf(row){return text(normalizeRow(row)._bl2Id || row.cedula || row.numeroIdentificacion);}
  function nombreOf(row){return text(normalizeRow(row)._bl2Nombre || row.nombres);}
  function carreraOf(row){return text(normalizeRow(row)._bl2Carrera || row.nombreCarrera);}
  function periodoOf(row){return text(normalizeRow(row)._bl2Periodo || row.periodoLabel);}
  function periodoIdOf(row){return text(normalizeRow(row)._bl2PeriodoId || row.periodoId);}
  function divisionOf(row){return text(normalizeRow(row)._bl2Division || "Sin división");}
  function estadoOf(row){return text(normalizeRow(row)._bl2EstadoMatricula || "ACTIVO");}
  function samePeriod(a,b){if(!text(b)){return true;}try{if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function"){return window.BLPeriodosCanon.samePeriod(a,b);}}catch(error){}return text(a) === text(b) || norm(a) === norm(b);}

  function sanitizeOptions(options){
    options = options || {};
    var limit = Math.max(0, Number(options.limit == null ? DEFAULT_LIMIT : options.limit) || 0);
    if(limit > MAX_LIMIT && options.allowLarge !== true){limit = MAX_LIMIT;}
    return {search:options.search || options.q || "",q:options.search || options.q || "",periodId:options.periodId || options.periodoId || "",periodoId:options.periodoId || options.periodId || "",division:options.division || "",career:options.career || options.carrera || "",carrera:options.carrera || options.career || "",sede:options.sede || "",jornada:options.jornada || "",matricula:options.all === true ? "" : (options.matricula == null ? "ACTIVO" : options.matricula),estadoMatricula:options.all === true ? "" : (options.estadoMatricula == null ? (options.matricula == null ? "ACTIVO" : options.matricula) : options.estadoMatricula),offset:Math.max(0, Number(options.offset || 0) || 0),limit:limit,force:options.force === true,allowLarge:options.allowLarge === true,countTotal:options.countTotal !== false};
  }

  function listPeriods(){if(periodRepo() && typeof periodRepo().listar === "function"){return periodRepo().listar() || [];}if(legacy() && typeof legacy().listPeriods === "function"){return legacy().listPeriods() || [];}return [];}

  function snapshotRows(){
    try{if(legacy() && typeof legacy().readSnapshot === "function"){var snap = legacy().readSnapshot({clone:false});return Array.isArray(snap && snap.students) ? snap.students : [];}}catch(error){}
    return [];
  }

  function rowMatches(row, payload){
    row = normalizeRow(row);
    var search = norm(payload.search || payload.q || "");
    var period = text(payload.periodoId || payload.periodId || "");
    var career = norm(payload.carrera || payload.career || "");
    var division = norm(payload.division || "");
    var estado = text(payload.estadoMatricula || payload.matricula || "").toUpperCase();
    if(period && !samePeriod(periodoIdOf(row), period) && !samePeriod(periodoOf(row), period)){return false;}
    if(career && norm(carreraOf(row)) !== career){return false;}
    if(division && norm(divisionOf(row)) !== division){return false;}
    if(estado && estado !== "TODOS" && estado !== "ALL" && estadoOf(row).toUpperCase() !== estado){return false;}
    if(search && String(row._bl2Search || "").indexOf(search) < 0){return false;}
    return true;
  }

  function pageFromRows(rows, payload){
    rows = Array.isArray(rows) ? rows : [];
    var out = [], total = 0;
    for(var i = 0; i < rows.length; i += 1){
      if(!rowMatches(rows[i], payload)){continue;}
      if(!payload.limit || (total >= payload.offset && out.length < payload.limit)){out.push(normalizeRow(rows[i]));}
      total += 1;
      if(payload.limit && out.length >= payload.limit && payload.countTotal === false){break;}
    }
    return {rows:out, estudiantes:out, total:total, offset:payload.offset, limit:payload.limit || total, page:payload.limit ? Math.floor(payload.offset / payload.limit) + 1 : 1, source:"BL2EstudiantesRepo.pageFirst"};
  }

  function cacheKey(payload){return JSON.stringify(payload);}
  function fromCache(payload){var key = cacheKey(payload);if(payload.force !== true && cache.result && cache.key === key && Date.now() - cache.at < CACHE_MS){return cache.result;}return null;}
  function saveCache(payload, result){cache.key = cacheKey(payload);cache.result = result;cache.at = Date.now();return result;}

  function query(options){var payload = sanitizeOptions(options || {});var cached = fromCache(payload);if(cached){return cached;}return saveCache(payload, pageFromRows(snapshotRows(), payload));}
  function listarPagina(options){return query(options);}
  function buscar(options){return query(options);}

  function listarPaginaAsync(options){
    var payload = sanitizeOptions(options || {});
    if(storage() && typeof storage().listStudents === "function"){
      return storage().listStudents(payload).then(function(result){
        result = result || {rows:[], total:0};
        result.rows = (result.rows || []).map(normalizeRow);
        result.estudiantes = result.rows;
        result.source = result.source || "BL2Storage";
        if((result.total || result.rows.length) > 0 || payload.force === true){return result;}
        return query(payload);
      }).catch(function(){return query(payload);});
    }
    return Promise.resolve(query(payload));
  }

  function obtenerPorCedula(cedula, options){var wanted = text(cedula);if(!wanted){return null;}var rows = query(Object.assign({}, options || {}, {search:wanted, all:true, limit:25, force:true})).rows;return rows.filter(function(row){return cedulaOf(row) === wanted || text(row.numeroIdentificacion) === wanted;})[0] || null;}
  function obtenerPorCedulaAsync(cedula, options){if(storage() && typeof storage().getStudentById === "function"){return storage().getStudentById(cedula, options || {}).then(function(row){return row ? normalizeRow(row) : obtenerPorCedula(cedula, options);}).catch(function(){return obtenerPorCedula(cedula, options);});}return Promise.resolve(obtenerPorCedula(cedula, options));}

  function listForDivisions(options){return query(Object.assign({}, options || {}, {search:"", limit:DIVISION_LIMIT, allowLarge:true, estadoMatricula:"", matricula:""})).rows;}
  function listDivisions(options){var rows = listForDivisions(options || {});var map = Object.create(null);rows.forEach(function(row){map[divisionOf(row) || "Sin división"] = true;});return Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es");});}
  function invalidate(){cache = {key:"", result:null, at:0};return true;}
  function status(){return {ok:!!(storage() || legacy()), mode:"bl2_estudiantes_repo_page_first", version:VERSION, storageReady:!!storage(), legacyReady:!!legacy(), cacheAgeMs:cache.at ? Date.now() - cache.at : null, updatedAt:new Date().toISOString()};}

  window.BL2EstudiantesRepo = {version:VERSION,listPeriods:listPeriods,listarPeriodos:listPeriods,buscar:buscar,listarPagina:listarPagina,listarPaginaAsync:listarPaginaAsync,obtenerPorCedula:obtenerPorCedula,obtenerPorCedulaAsync:obtenerPorCedulaAsync,listDivisions:listDivisions,listForDivisions:listForDivisions,invalidate:invalidate,normalizeRow:normalizeRow,normalizeRows:function(rows){return (Array.isArray(rows) ? rows : []).map(normalizeRow);},status:status,helpers:{cedulaOf:cedulaOf,nombreOf:nombreOf,carreraOf:carreraOf,periodoOf:periodoOf,periodoIdOf:periodoIdOf,divisionOf:divisionOf,estadoOf:estadoOf,samePeriod:samePeriod}};
})(window);
