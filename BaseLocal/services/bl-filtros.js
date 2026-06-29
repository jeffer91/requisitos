/* =========================================================
Nombre completo: bl-filtros.js
Ruta o ubicación: /Requisitos/BaseLocal/services/bl-filtros.js
Función o funciones:
- Filtrar estudiantes por período, estado de matrícula, división y búsqueda.
- Entregar paginación real sin armar primero una lista completa.
- Usar normalización liviana con caché por fila como respaldo cuando BL2 no esté disponible.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.5.0-fallback-paged";
  var rowCache = typeof WeakMap !== "undefined" ? new WeakMap() : null;

  function campos(){if(!window.BLCampos){throw new Error("BLCampos no disponible.");}return window.BLCampos;}
  function normalizador(){return window.BLNormalizador || null;}
  function text(value){try{return campos().text(value);}catch(error){return String(value == null ? "" : value).trim();}}
  function normalizeSearch(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();}

  function samePeriod(a, b){
    if(!text(b)){return true;}
    try{if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function"){return window.BLPeriodosCanon.samePeriod(a, b);}}catch(error){}
    return normalizeSearch(a) === normalizeSearch(b);
  }

  function periodOf(student){return text(student && (student._bl2PeriodoId || student.periodoId || student.ultimoPeriodoId || student.periodId || student.PeriodoId || student.periodo || student.Periodo || student.periodoLabel));}
  function statusOf(student){return campos().normalizeEstado(campos().getValue(student || {}, "estadoMatricula", student && (student._bl2EstadoMatricula || student.estadoMatricula) || "ACTIVO"));}
  function divisionOf(student){
    if(window.BLDivisionesService && typeof window.BLDivisionesService.studentDivision === "function"){return window.BLDivisionesService.studentDivision(student);}
    var list = normalizador() && typeof normalizador().normalizeDivisiones === "function" ? normalizador().normalizeDivisiones(student && (student.divisiones || student.division)) : [];
    return list[0] || student && (student._bl2Division || student.division) || "Sin división";
  }
  function careerOf(student){return text(campos().getValue(student || {}, "nombreCarrera", student && (student._bl2Carrera || student.nombrecarrera || student.NombreCarrera || student.carrera) || "")) || "SIN CARRERA";}

  function buildSearchText(student){
    if(student && student.searchText){return normalizeSearch(student.searchText);}
    if(student && student._bl2Search){return normalizeSearch(student._bl2Search);}
    var parts = [];
    try{campos().searchCanonicalFields.forEach(function(field){parts.push(campos().getValue(student, field, ""));});}catch(error){}
    parts.push(student && (student._bl2Id || student.cedula || student.numeroIdentificacion || student.Cedula));
    parts.push(student && (student._bl2Nombre || student.nombres || student.Nombres || student.nombre));
    parts.push(student && (student._bl2Carrera || student.nombrecarrera || student.nombreCarrera || student.NombreCarrera || student.carrera || student.Carrera));
    parts.push(student && (student._bl2Periodo || student.periodoLabel || student.periodoId || student.periodo));
    parts.push(divisionOf(student));
    return normalizeSearch(parts.join(" "));
  }

  function lightweightNormalize(student){
    var source = student && typeof student === "object" ? student : {};
    if(rowCache && rowCache.has(source)){return rowCache.get(source);}
    var row = source;
    if(normalizador() && typeof normalizador().normalizeStudent === "function" && !source._bl2Id && !source._blFilterReady){row = normalizador().normalizeStudent(source, 0, {source:source._source || "filter", clone:false});}
    row._blFilterReady = true;
    row._blFilterPeriod = row._blFilterPeriod || periodOf(row);
    row._blFilterStatus = row._blFilterStatus || statusOf(row);
    row._blFilterDivision = row._blFilterDivision || divisionOf(row);
    row._blFilterCareer = row._blFilterCareer || careerOf(row);
    row._blFilterSearch = row._blFilterSearch || buildSearchText(row);
    if(rowCache){rowCache.set(source, row);}
    return row;
  }

  function normalizeRows(rows){return (Array.isArray(rows) ? rows : []).map(lightweightNormalize);}
  function matchPeriod(student, periodId){var wanted = text(periodId);return !wanted || samePeriod(student._blFilterPeriod || periodOf(student), wanted);}
  function matchStatus(student, statusFilter){var wanted = text(statusFilter);return wanted === "" || (student._blFilterStatus || statusOf(student)) === wanted;}
  function matchDivision(student, division){var wanted = text(division || "");if(!wanted){return true;}if(window.BLDivisionesService && typeof window.BLDivisionesService.hasDivision === "function"){return window.BLDivisionesService.hasDivision(student, wanted);}return normalizeSearch(student._blFilterDivision || divisionOf(student)) === normalizeSearch(wanted);}
  function matchSearch(student, search){var wanted = normalizeSearch(search);return !wanted || String(student._blFilterSearch || buildSearchText(student)).indexOf(wanted) >= 0;}

  function predicate(options){
    options = options || {};
    var statusFilter = options.estadoMatricula;
    if(statusFilter == null){statusFilter = "ACTIVO";}
    var periodId = options.periodoId || options.periodId || "";
    var division = options.division || options.divisionNombre || "";
    var search = options.search || "";
    return function(row){var student = lightweightNormalize(row);return matchPeriod(student, periodId) && matchStatus(student, statusFilter) && matchDivision(student, division) && matchSearch(student, search);};
  }

  function filterStudents(rows, options){
    rows = Array.isArray(rows) ? rows : [];
    var ok = predicate(options || {}), out = [];
    for(var i = 0; i < rows.length; i += 1){if(ok(rows[i])){out.push(lightweightNormalize(rows[i]));}}
    return out;
  }

  function filterStudentsPage(rows, options){
    rows = Array.isArray(rows) ? rows : [];
    options = options || {};
    var offset = Math.max(0, Number(options.offset || 0) || 0);
    var limit = Math.max(0, Number(options.limit || 0) || 0);
    var ok = predicate(options), page = [], total = 0;
    for(var i = 0; i < rows.length; i += 1){
      if(!ok(rows[i])){continue;}
      if(!limit || (total >= offset && page.length < limit)){page.push(lightweightNormalize(rows[i]));}
      total += 1;
      if(limit && page.length >= limit && options.countTotal === false){break;}
    }
    return {rows:page,total:total,offset:offset,limit:limit || total,source:"BLFiltros.fallbackPaged"};
  }

  function countByStatus(rows){
    var counts = {ACTIVO:0, RETIRADO:0, TOTAL:0};
    rows = Array.isArray(rows) ? rows : [];
    for(var i = 0; i < rows.length; i += 1){var student = lightweightNormalize(rows[i]);var estado = student._blFilterStatus || statusOf(student);counts[estado] = (counts[estado] || 0) + 1;counts.TOTAL += 1;}
    return counts;
  }

  function uniqueCareers(rows){var map = {};normalizeRows(rows || []).forEach(function(student){map[student._blFilterCareer || careerOf(student) || "SIN CARRERA"] = true;});return Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es");});}
  function uniqueDivisions(rows){if(window.BLDivisionesService && typeof window.BLDivisionesService.listDivisionsWithEmpty === "function"){return window.BLDivisionesService.listDivisionsWithEmpty(rows || [], "");}var map = {};normalizeRows(rows || []).forEach(function(student){map[student._blFilterDivision || divisionOf(student) || "Sin división"] = true;});return Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es");});}
  function clearCache(){rowCache = typeof WeakMap !== "undefined" ? new WeakMap() : null;}

  window.BLFiltros = {version:VERSION,normalizeSearch:normalizeSearch,buildSearchText:buildSearchText,filterStudents:filterStudents,filterStudentsPage:filterStudentsPage,countByStatus:countByStatus,uniqueCareers:uniqueCareers,uniqueDivisions:uniqueDivisions,matchDivision:matchDivision,clearCache:clearCache,helpers:{periodOf:periodOf,statusOf:statusOf,divisionOf:divisionOf,careerOf:careerOf,samePeriod:samePeriod,normalizeRows:normalizeRows,lightweightNormalize:lightweightNormalize}};
})(window);
