/* =========================================================
Nombre completo: con.stats.js
Ruta o ubicacion: /Requisitos/BDLocal/conexiones/con.stats.js
Funcion:
- Conectar Stats con BDLocal.
- Entregar estudiantes, periodos, requisitos y resumen desde cache liviana.
========================================================= */
(function(window){
  "use strict";

  var HUB = window.BDLocalConexiones;
  var U = window.BDLocalConUtils;
  if(!HUB || !U){ return; }

  function cache(){ return U.readCache(); }

  function periods(){
    return cache().periods.map(U.normalizePeriod).filter(Boolean);
  }

  function students(options){
    options = options || {};
    return U.filterStudents(cache().students, options);
  }

  function requirements(filter){
    filter = filter || {};
    var periodoId = U.canonicalPeriodId(filter.periodoId || filter.periodId || "");
    var cedula = U.normalizeCedula(filter.cedula || filter.numeroIdentificacion || "");
    return (cache().requirements || []).filter(function(req){
      if(periodoId && !U.samePeriod(req.periodoId, periodoId)){ return false; }
      if(cedula && U.normalizeCedula(req.cedula) !== cedula){ return false; }
      return true;
    });
  }

  function summary(periodoId){
    periodoId = U.canonicalPeriodId(periodoId || "");
    var rows = students({ periodoId:periodoId, matricula:"" });
    var activos = rows.filter(function(row){ return U.text(row._estadoMatricula || row.estadoMatricula).toUpperCase() !== "RETIRADO"; }).length;
    var retirados = rows.length - activos;
    return {
      id:periodoId,
      periodoId:periodoId,
      totalEstudiantes:rows.length,
      totalActivos:activos,
      totalRetirados:retirados,
      pendientesGoogle:0,
      pendientesFirebase:0,
      source:"BDLocalConStats"
    };
  }

  function listStudents(options){
    var rows = students(options || {});
    return {
      ok:true,
      rows:rows,
      total:rows.length,
      periodList:periods(),
      source:"BDLocalConStats"
    };
  }

  var api = {
    version:"1.0.0",
    source:"BDLocal/conexiones/con.stats.js",
    ready:HUB.ready,
    refresh:function(){ return HUB.refreshCache({ source:"con.stats.refresh" }); },
    periods:periods,
    listPeriods:periods,
    getPeriods:periods,
    periodos:periods,
    students:students,
    getStudents:students,
    listStudents:listStudents,
    rows:students,
    getRows:students,
    requirements:requirements,
    getRequirements:requirements,
    summary:summary,
    getSummary:summary,
    resumen:summary,
    stats:function(periodoId){
      return {
        periodoId:periodoId,
        estudiantes:students({ periodoId:periodoId, matricula:"" }),
        requisitos:requirements({ periodoId:periodoId }),
        resumen:summary(periodoId),
        source:"BDLocalConStats"
      };
    }
  };

  HUB.register("stats", api);
  window.BDLocalStats = api;
  window.ConStats = api;

  window.BL2DataEngine = Object.assign({}, window.BL2DataEngine || {}, {
    source:"BDLocalConStats",
    stats:api.stats,
    getStatsData:api.stats,
    getSummary:summary,
    summary:summary,
    getRequirements:requirements,
    requirements:requirements
  });
})(window);
