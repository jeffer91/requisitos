/* =========================================================
Nombre completo: con.reportes.js
Ruta o ubicacion: /Requisitos/BDLocal/conexiones/con.reportes.js
Funcion:
- Conectar Reportes con BDLocal.
- Construir datos base para reportes desde estudiantes y requisitos.
========================================================= */
(function(window){
  "use strict";

  var HUB = window.BDLocalConexiones;
  var U = window.BDLocalConUtils;
  if(!HUB || !U){ return; }

  function rows(filters){
    return U.filterStudents(U.readCache().students, filters || {});
  }

  function requirements(filters){
    filters = filters || {};
    var periodoId = U.canonicalPeriodId(filters.periodoId || filters.periodId || "");
    var cedula = U.normalizeCedula(filters.cedula || filters.numeroIdentificacion || "");
    return (U.readCache().requirements || []).filter(function(req){
      if(periodoId && !U.samePeriod(req.periodoId, periodoId)){ return false; }
      if(cedula && U.normalizeCedula(req.cedula) !== cedula){ return false; }
      return true;
    });
  }

  function periods(){
    return U.readCache().periods.map(U.normalizePeriod).filter(Boolean);
  }

  function buildReportData(filters){
    filters = filters || {};
    var estudiantes = rows(filters);
    var requisitos = requirements(filters);
    return {
      ok:true,
      source:"BDLocalConReportes",
      filters:U.clone(filters),
      generatedAt:U.nowISO(),
      estudiantes:estudiantes,
      rows:estudiantes,
      requisitos:requisitos,
      periodos:periods(),
      resumen:{
        totalEstudiantes:estudiantes.length,
        totalRequisitos:requisitos.length
      }
    };
  }

  var api = {
    version:"1.0.0",
    source:"BDLocal/conexiones/con.reportes.js",
    ready:HUB.ready,
    refresh:function(){ return HUB.refreshCache({ source:"con.reportes.refresh" }); },
    build:buildReportData,
    buildReportData:buildReportData,
    report:buildReportData,
    getStudents:rows,
    listStudents:function(options){ var r = rows(options || {}); return { ok:true, rows:r, total:r.length, source:"BDLocalConReportes" }; },
    getRequirements:requirements,
    getPeriods:periods,
    listPeriods:periods
  };

  HUB.register("reportes", api);
  window.BDLocalReportes = api;
  window.ConReportes = api;

  window.BL2ReportesRepo = Object.assign({}, window.BL2ReportesRepo || {}, api);
})(window);
