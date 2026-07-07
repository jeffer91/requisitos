(function(window){
  "use strict";
  var HUB=window.BDLocalConexiones;
  var U=window.BDLocalConUtils;
  if(!HUB||!U){return;}
  function cache(){return U.readCache();}
  function periods(){return cache().periods.map(U.normalizePeriod).filter(Boolean);}
  function students(options){return U.filterStudents(cache().students,options||{});}
  function requirements(){return cache().requirements||[];}
  function summary(periodoId){
    var rows=students({periodoId:periodoId||"",matricula:""});
    return {periodoId:periodoId||"",totalEstudiantes:rows.length,source:"BDLocalConStats"};
  }
  var api={
    version:"1.0.0",
    source:"BDLocal/conexiones/cone.stats.js",
    ready:HUB.ready,
    refresh:function(){return HUB.refreshCache({source:"cone.stats.refresh"});},
    periods:periods,
    listPeriods:periods,
    getPeriods:periods,
    periodos:periods,
    students:students,
    getStudents:students,
    listStudents:function(options){var r=students(options||{});return {ok:true,rows:r,total:r.length,periodList:periods(),source:"BDLocalConStats"};},
    rows:students,
    getRows:students,
    requirements:requirements,
    getRequirements:requirements,
    summary:summary,
    getSummary:summary,
    resumen:summary,
    stats:function(periodoId){return {periodoId:periodoId,estudiantes:students({periodoId:periodoId,matricula:""}),requisitos:requirements({periodoId:periodoId}),resumen:summary(periodoId),source:"BDLocalConStats"};}
  };
  HUB.register("stats",api);
  window.BDLocalStats=api;
  window.ConStats=api;
})(window);
