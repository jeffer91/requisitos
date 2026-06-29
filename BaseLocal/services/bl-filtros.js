/* =========================================================
Nombre completo: bl-filtros.js
Ruta o ubicación: /Requisitos/BaseLocal/services/bl-filtros.js
Función o funciones:
- Filtrar estudiantes por período, estado de matrícula, división y búsqueda.
- Mostrar ACTIVO por defecto y RETIRADO solo cuando se seleccione.
- Calcular contadores para la pantalla Base Local.
- Evitar normalizar toda la base en cada render usando caché liviana por fila.
- Entregar paginación real para Base Local.
Con qué se conecta:
- bl-campos.js
- bl-normalizador.js
- bl-divisiones.service.js
- baselocal.core.js
- baselocal.app.js
========================================================= */
(function(window){
  "use strict";

  var rowCache = typeof WeakMap !== "undefined" ? new WeakMap() : null;

  function campos(){if(!window.BLCampos){throw new Error("BLCampos no disponible.");}return window.BLCampos;}
  function normalizador(){return window.BLNormalizador || null;}
  function text(value){return campos().text(value);}
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

  function lightweightNormalize(student){
    var source = student && typeof student === "object" ? student : {};
    if(rowCache && rowCache.has(source)){return rowCache.get(source);}
    var row = source;
    if(normalizador() && typeof normalizador().normalizeStudent === "function" && !source._bl2Id && !source._blFilterReady){
      row = normalizador().normalizeStudent(source, 0, {source:source._source || "filter", clone:false});
    }
    row._blFilterReady = true;
    row._blFilterPeriod = periodOf(row);
    row._blFilterStatus = statusOf(row);
    row._blFilterDivision = divisionOf(row);
    row._blFilterCareer = careerOf(row);
    if(!row._blFilterSearch){row._blFilterSearch = buildSearchText(row);}
    if(rowCache){rowCache.set(source, row);}
    return row;
  }

  function normalizeRows(rows){return (Array.isArray(rows) ? rows : []).map(lightweightNormalize);}

  function buildSearchText(student){
    if(student && student._bl2Search){return normalizeSearch(student._bl2Search);}
    var parts = [];
    try{campos().searchCanonicalFields.forEach(function(field){parts.push(campos().getValue(student, field, ""));});}catch(error){}
    parts.push(student && (student._bl2Id || student.cedula || student.numeroIdentificacion || student.Cedula));
    parts.push(student && (student._bl2Nombre || student.nombres || student.Nombres || student.nombre));
    parts.push(student && (student._bl2Carrera || student.nombrecarrera || student.nombreCarrera || student.NombreCarrera || student.carrera || student.Carrera));
    parts.push(student && (student._bl2Periodo || student.periodoLabel || student.periodoId || student.periodo));
    parts.push(divisionOf(student));
    parts.push(Array.isArray(student && student.divisiones) ? student.divisiones.join(" ") : "");
    return normalizeSearch(parts.join(" "));
  }

  function matchPeriod(student, periodId){var wanted = text(periodId);return !wanted || samePeriod(student._blFilterPeriod || periodOf(student), wanted);}
  function matchStatus(student, statusFilter){var wanted = text(statusFilter);return wanted === "" || (student._blFilterStatus || statusOf(student)) === wanted;}
  function matchDivision(student, division){
    var wanted = text(division || "");
    if(!wanted){return true;}
    if(window.BLDivisionesService && typeof window.BLDivisionesService.hasDivision === "function"){return window.BLDivisionesService.hasDivision(student, wanted);}
    return normalizeSearch(student._blFilterDivision || divisionOf(student)) === normalizeSearch(wanted);
  }
  function matchSearch(student, search){var wanted = normalizeSearch(search);return !wanted || String(student._blFilterSearch || buildSearchText(student)).indexOf(wanted) >= 0;}

  function filterStudents(rows, options){
    options = options || {};
    var statusFilter = options.estadoMatricula;
    if(statusFilter == null){statusFilter = "ACTIVO";}
    var periodId = options.periodoId || options.periodId || "";
    var division = options.division || options.divisionNombre || "";
    var search = options.search || "";
    return normalizeRows(rows).filter(function(student){
      return matchPeriod(student, periodId)
        && matchStatus(student, statusFilter)
        && matchDivision(student, division)
        && matchSearch(student, search);
    });
  }

  function filterStudentsPage(rows, options){
    options = options || {};
    var filtered = filterStudents(rows, options);
    var offset = Math.max(0, Number(options.offset || 0) || 0);
    var limit = Math.max(0, Number(options.limit || 0) || 0);
    return {rows:limit ? filtered.slice(offset, offset + limit) : filtered,total:filtered.length,offset:offset,limit:limit || filtered.length};
  }

  function countByStatus(rows){
    var counts = {ACTIVO:0, RETIRADO:0, TOTAL:0};
    normalizeRows(rows || []).forEach(function(student){
      var estado = student._blFilterStatus || statusOf(student);
      counts[estado] = (counts[estado] || 0) + 1;
      counts.TOTAL += 1;
    });
    return counts;
  }

  function uniqueCareers(rows){
    var map = {};
    normalizeRows(rows || []).forEach(function(student){map[student._blFilterCareer || careerOf(student) || "SIN CARRERA"] = true;});
    return Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es");});
  }

  function uniqueDivisions(rows){
    if(window.BLDivisionesService && typeof window.BLDivisionesService.listDivisionsWithEmpty === "function"){
      return window.BLDivisionesService.listDivisionsWithEmpty(rows || [], "");
    }
    var map = {};
    normalizeRows(rows || []).forEach(function(student){map[student._blFilterDivision || divisionOf(student) || "Sin división"] = true;});
    return Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es");});
  }

  function clearCache(){rowCache = typeof WeakMap !== "undefined" ? new WeakMap() : null;}

  window.BLFiltros = {
    normalizeSearch:normalizeSearch,
    buildSearchText:buildSearchText,
    filterStudents:filterStudents,
    filterStudentsPage:filterStudentsPage,
    countByStatus:countByStatus,
    uniqueCareers:uniqueCareers,
    uniqueDivisions:uniqueDivisions,
    matchDivision:matchDivision,
    clearCache:clearCache,
    helpers:{periodOf:periodOf,statusOf:statusOf,divisionOf:divisionOf,careerOf:careerOf,samePeriod:samePeriod,normalizeRows:normalizeRows}
  };
})(window);
