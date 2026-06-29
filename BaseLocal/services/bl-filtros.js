/* =========================================================
Nombre completo: bl-filtros.js
Ruta o ubicación: /Requisitos/BaseLocal/services/bl-filtros.js
Función o funciones:
- Filtrar estudiantes por período, estado de matrícula, división y búsqueda.
- Mostrar ACTIVO por defecto y RETIRADO solo cuando se seleccione.
- Calcular contadores para la pantalla Base Local.
Con qué se conecta:
- bl-campos.js
- bl-normalizador.js
- bl-divisiones.service.js
- baselocal.core.js
- baselocal.app.js
========================================================= */
(function(window){
  "use strict";

  function campos(){if(!window.BLCampos){throw new Error("BLCampos no disponible.");}return window.BLCampos;}
  function normalizador(){if(!window.BLNormalizador){throw new Error("BLNormalizador no disponible.");}return window.BLNormalizador;}
  function text(value){return campos().text(value);}

  function normalizeSearch(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();}

  function buildSearchText(student){
    var parts = [];
    campos().searchCanonicalFields.forEach(function(field){parts.push(campos().getValue(student, field, ""));});
    parts.push(student && student.division);
    parts.push(Array.isArray(student && student.divisiones) ? student.divisiones.join(" ") : "");
    return normalizeSearch(parts.join(" "));
  }

  function samePeriod(a, b){
    if(!text(b)){return true;}
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function"){
      return window.BLPeriodosCanon.samePeriod(a, b);
    }
    return text(a) === text(b);
  }

  function matchPeriod(student, periodId){
    var wanted = text(periodId);
    if(!wanted){return true;}
    return samePeriod(student.periodoId || campos().getValue(student, "periodoId", ""), wanted);
  }

  function matchStatus(student, statusFilter){
    var wanted = text(statusFilter);
    if(wanted === ""){return true;}
    var estado = campos().normalizeEstado(campos().getValue(student, "estadoMatricula", student.estadoMatricula || "ACTIVO"));
    return estado === wanted;
  }

  function matchDivision(student, division){
    var wanted = text(division || "");
    if(!wanted){return true;}
    if(window.BLDivisionesService && typeof window.BLDivisionesService.hasDivision === "function"){
      return window.BLDivisionesService.hasDivision(student, wanted);
    }
    var list = normalizador().normalizeDivisiones(student && (student.divisiones || student.division));
    var current = list[0] || "Sin división";
    return normalizeSearch(current) === normalizeSearch(wanted);
  }

  function matchSearch(student, search){
    var wanted = normalizeSearch(search);
    if(!wanted){return true;}
    return buildSearchText(student).indexOf(wanted) >= 0;
  }

  function filterStudents(rows, options){
    options = options || {};
    var statusFilter = options.estadoMatricula;
    if(statusFilter == null){statusFilter = "ACTIVO";}
    return normalizador().normalizeStudents(rows || []).filter(function(student){
      return matchPeriod(student, options.periodoId || "")
        && matchStatus(student, statusFilter)
        && matchDivision(student, options.division || options.divisionNombre || "")
        && matchSearch(student, options.search || "");
    });
  }

  function countByStatus(rows){
    var counts = {ACTIVO:0, RETIRADO:0, TOTAL:0};
    normalizador().normalizeStudents(rows || []).forEach(function(student){
      var estado = campos().normalizeEstado(campos().getValue(student, "estadoMatricula", student.estadoMatricula || "ACTIVO"));
      counts[estado] = (counts[estado] || 0) + 1;
      counts.TOTAL += 1;
    });
    return counts;
  }

  function uniqueCareers(rows){
    var map = {};
    normalizador().normalizeStudents(rows || []).forEach(function(student){
      var carrera = text(campos().getValue(student, "nombreCarrera", student.nombrecarrera || student.NombreCarrera || student.carrera || "SIN CARRERA"));
      map[carrera || "SIN CARRERA"] = true;
    });
    return Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es");});
  }

  function uniqueDivisions(rows){
    if(window.BLDivisionesService && typeof window.BLDivisionesService.listDivisionsWithEmpty === "function"){
      return window.BLDivisionesService.listDivisionsWithEmpty(rows || [], "");
    }
    var map = {};
    normalizador().normalizeStudents(rows || []).forEach(function(student){
      var list = normalizador().normalizeDivisiones(student.divisiones || student.division);
      map[list[0] || "Sin división"] = true;
    });
    return Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es");});
  }

  window.BLFiltros = {
    normalizeSearch:normalizeSearch,
    buildSearchText:buildSearchText,
    filterStudents:filterStudents,
    countByStatus:countByStatus,
    uniqueCareers:uniqueCareers,
    uniqueDivisions:uniqueDivisions,
    matchDivision:matchDivision
  };
})(window);
