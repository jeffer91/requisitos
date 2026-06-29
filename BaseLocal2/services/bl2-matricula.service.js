/* =========================================================
Nombre completo: bl2-matricula.service.js
Ruta o ubicación: /Requisitos/BaseLocal2/services/bl2-matricula.service.js
Función o funciones:
- Normalizar filas de matrícula para la importación BL2.
- Detectar cédula, estado, período, carrera y divisiones sin modificar la fila original.
- Entregar estadísticas rápidas para importación Excel.
Con qué se conecta:
- bl2-import-excel.service.js
- workers/bl2-import.worker.js
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function key(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();}
  function now(){return new Date().toISOString();}
  function cedulaOf(row){return text(row && (row.cedula || row.Cedula || row.CEDULA || row.numeroIdentificacion || row.numeroidentificacion || row.NumeroIdentificacion || row.identificacion || row.Identificacion || row.docId || row._docId));}
  function nombreOf(row){return text(row && (row.nombres || row.Nombres || row.nombre || row.Nombre || row.estudiante || row.Estudiante));}
  function carreraOf(row){return text(row && (row.nombrecarrera || row.nombreCarrera || row.NombreCarrera || row.carrera || row.Carrera || row.programa || row.Programa));}
  function estadoOf(row){var raw=text(row && (row.estadoMatricula || row.EstadoMatricula || row.estado || row.Estado || "ACTIVO")).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();return raw === "RETIRADO" ? "RETIRADO" : "ACTIVO";}
  function normalizeDivisiones(value){if(Array.isArray(value)){return value.map(text).filter(Boolean);}var single=text(value);return single?[single]:[];}

  function normalizeRow(row, index, period){
    period = period || {};
    var r = Object.assign({}, row || {});
    var cedula = cedulaOf(r) || [period.id || "periodo", "fila", index + 1].join("_");
    var divs = normalizeDivisiones(r.divisiones || r.division || r.Division || r.División);
    r.cedula = text(r.cedula || r.Cedula || r.CEDULA || r.numeroIdentificacion || r.numeroidentificacion || cedula);
    r.numeroIdentificacion = text(r.numeroIdentificacion || r.numeroidentificacion || r.NumeroIdentificacion || r.cedula || cedula);
    r._docId = text(r._docId || r.docId || cedula);
    r.docId = text(r.docId || r._docId || cedula);
    r.nombres = nombreOf(r);
    r.nombrecarrera = carreraOf(r);
    r.nombreCarreraKey = key(r.nombrecarrera);
    r.periodoId = text(period.id || period.periodoId || r.periodoId);
    r.ultimoPeriodoId = r.periodoId;
    r.periodoLabel = text(period.label || period.periodoLabel || r.periodoLabel || r.periodoId);
    r.estadoMatricula = estadoOf(r);
    r.divisiones = divs;
    if(divs.length){r.division = divs[0];}else{delete r.division;}
    r.searchText = key([r.cedula, r.numeroIdentificacion, r.nombres, r.nombrecarrera, r.periodoLabel, r.estadoMatricula].join(" "));
    r.updatedAt = now();
    r.ultimaSincronizacion = now();
    return r;
  }

  function normalizeRows(rows, period){
    rows = Array.isArray(rows) ? rows : [];
    var seen = Object.create(null);
    var stats = {totalIncoming:rows.length, normalized:0, withoutCedula:0, duplicatedCedulas:0};
    var out = rows.map(function(row, index){
      var normalized = normalizeRow(row, index, period || {});
      var cedula = cedulaOf(normalized);
      if(!cedula){stats.withoutCedula += 1;}
      if(cedula && seen[cedula]){stats.duplicatedCedulas += 1;}
      if(cedula){seen[cedula] = true;}
      stats.normalized += 1;
      return normalized;
    });
    return {rows:out, stats:stats, processedAt:now()};
  }

  window.BL2MatriculaService = {version:"2.0.0-alpha.1",cedulaOf:cedulaOf,estadoOf:estadoOf,normalizeRow:normalizeRow,normalizeRows:normalizeRows};
})(window);
