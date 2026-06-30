(function(window){
  "use strict";

  var B = window.BDLRepoBase;
  if(!B){ throw new Error("BDLRepoDashboard requiere BDLRepoBase."); }

  function cacheId(periodoId, tipo){
    return String(periodoId || "general") + "__" + String(tipo || "general");
  }

  function guardar(periodoId, tipo, data){
    var row = {
      id: cacheId(periodoId, tipo),
      periodoId: periodoId || "",
      tipo: tipo || "general",
      data: data || {},
      actualizadoEn: B.now()
    };
    return B.put(B.stores.dashboardCache, row).then(function(){ return row; });
  }

  function obtener(periodoId, tipo){
    return B.get(B.stores.dashboardCache, cacheId(periodoId, tipo));
  }

  function recalcularBasico(periodoId){
    return B.byIndex(B.stores.estudiantesResumen, "by_periodoId", periodoId, { limit: 0 }).then(function(rows){
      var data = { total: rows.length, cumple: 0, noCumple: 0, incompleto: 0, porCarrera: {}, porSede: {}, porEstadoMatricula: {} };
      rows.forEach(function(row){
        if(row.estadoGeneral === "CUMPLE"){ data.cumple += 1; }
        else if(row.estadoGeneral === "NO CUMPLE"){ data.noCumple += 1; }
        else { data.incompleto += 1; }
        data.porCarrera[row.nombreCarrera || "SIN CARRERA"] = (data.porCarrera[row.nombreCarrera || "SIN CARRERA"] || 0) + 1;
        data.porSede[row.sede || "SIN SEDE"] = (data.porSede[row.sede || "SIN SEDE"] || 0) + 1;
        data.porEstadoMatricula[row.estadoMatricula || "SIN ESTADO"] = (data.porEstadoMatricula[row.estadoMatricula || "SIN ESTADO"] || 0) + 1;
      });
      return guardar(periodoId, "general", data);
    });
  }

  window.BDLRepoDashboard = {
    guardar: guardar,
    obtener: obtener,
    recalcularBasico: recalcularBasico
  };
})(window);
