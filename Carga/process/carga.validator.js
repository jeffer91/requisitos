(function(window){
  "use strict";

  function validate(normalized){
    normalized = normalized || {};
    var rows = normalized.rowsMapeadas || [];
    var errors = [];
    var warnings = [];

    rows.forEach(function(row, index){
      var periodo = window.BDLNormPeriodo ? window.BDLNormPeriodo.normalize(row, normalized.periodoDetectado && normalized.periodoDetectado.periodoId) : { periodoId: "SIN_PERIODO" };
      var numero = window.BDLNormEstudiante ? window.BDLNormEstudiante.numero(row) : "";
      if(periodo.periodoId === "SIN_PERIODO"){
        errors.push({ row:index + 1, tipo:"PERIODO_VACIO", mensaje:"Registro sin periodo válido." });
      }
      if(!numero || numero === "SIN_IDENTIFICACION"){
        errors.push({ row:index + 1, tipo:"IDENTIFICACION_VACIA", mensaje:"Registro sin número de identificación." });
      }
      if(!row.nombreCarrera && !row.NombreCarrera && !row.carrera && !row.Carrera){
        warnings.push({ row:index + 1, tipo:"CARRERA_VACIA", mensaje:"Registro sin carrera detectada." });
      }
    });

    return { ok: errors.length === 0, errors: errors, warnings: warnings, total: rows.length };
  }

  window.CargaValidator = { validate: validate };
})(window);
