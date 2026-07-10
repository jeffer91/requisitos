/* =========================================================
Nombre completo: cone.stats.js
Ruta o ubicación: /BDLocal/conexiones/cone.stats.js
Función o funciones:
- Conectar Stats con la caché consolidada de BDLocal.
- Filtrar estudiantes y requisitos por período y cédula.
- Ejecutar un refresco real de la caché cuando Stats lo solicita.
- Enlazar el adaptador legacy usado por el botón Actualizar.
- Entregar resúmenes coherentes con el período seleccionado.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.1.1-refresh-bridge";
  var HUB = window.BDLocalConexiones;
  var U = window.BDLocalConUtils;
  if(!HUB || !U){ return; }

  function text(value){ return U.text ? U.text(value) : String(value == null ? "" : value).trim(); }
  function cache(){ return U.readCache(); }
  function periods(){ return (cache().periods || []).map(U.normalizePeriod).filter(Boolean); }
  function students(options){ return U.filterStudents(cache().students || [],options || {}); }

  function requirements(options){
    options = options || {};
    var periodoId = U.canonicalPeriodId(options.periodoId || options.periodId || "");
    var cedula = text(options.cedula || options.numeroIdentificacion || "");
    return (cache().requirements || []).filter(function(row){
      var rowPeriod = U.canonicalPeriodId(row.periodoId || row.periodId || row.periodoCanonicoId || "");
      var rowCedula = text(row.cedula || row.numeroIdentificacion || "");
      if(periodoId && !U.samePeriod(rowPeriod,periodoId)){ return false; }
      if(cedula && rowCedula !== cedula){ return false; }
      return true;
    });
  }

  function refresh(options){
    options = Object.assign({ source:"cone.stats.refresh",full:true,immediate:true },options || {});
    return HUB.refreshCache(options);
  }

  function summary(periodoId){
    periodoId = U.canonicalPeriodId(periodoId || "");
    var rows = students({ periodoId:periodoId,matricula:"" });
    return {
      periodoId:periodoId,
      totalEstudiantes:rows.length,
      totalRequisitos:requirements({ periodoId:periodoId }).length,
      source:"BDLocalConStats"
    };
  }

  var api = {
    version:VERSION,
    source:"BDLocal/conexiones/cone.stats.js",
    ready:HUB.ready,
    refresh:refresh,
    periods:periods,
    listPeriods:periods,
    getPeriods:periods,
    periodos:periods,
    students:students,
    getStudents:students,
    listStudents:function(options){
      var rows = students(options || {});
      return { ok:true,rows:rows,total:rows.length,periodList:periods(),source:"BDLocalConStats" };
    },
    rows:students,
    getRows:students,
    requirements:requirements,
    getRequirements:requirements,
    summary:summary,
    getSummary:summary,
    resumen:summary,
    stats:function(periodoId){
      periodoId = U.canonicalPeriodId(periodoId || "");
      return {
        periodoId:periodoId,
        estudiantes:students({ periodoId:periodoId,matricula:"" }),
        requisitos:requirements({ periodoId:periodoId }),
        resumen:summary(periodoId),
        source:"BDLocalConStats"
      };
    }
  };

  HUB.register("stats",api);
  window.BDLocalStats = api;
  window.ConStats = api;
  window.BDLLegacyAdapter = Object.assign({},window.BDLLegacyAdapter || {},{
    version:VERSION,
    source:"BDLocalConStats",
    refresh:refresh,
    getSnapshot:function(){ return cache(); }
  });
})(window);
