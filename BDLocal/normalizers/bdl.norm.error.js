(function(window){
  "use strict";

  var K = window.BDLKeys;
  var T = window.BDLNormText;

  if(!K || !T){ throw new Error("BDLKeys y BDLNormText deben cargarse antes de BDLNormError."); }

  function crear(tipoError, tablaDestino, registroOriginal, mensaje, nivel){
    return {
      id: K.id("error_" + tipoError),
      tipoError: tipoError || "DATO_INVALIDO",
      tablaDestino: tablaDestino || "",
      registroOriginal: registroOriginal || {},
      mensaje: mensaje || "Dato inválido detectado.",
      nivel: nivel || "medio",
      resuelto: false,
      createdAt: new Date().toISOString()
    };
  }

  function revisarBasicos(row, periodoInfo, numeroIdentificacion){
    var errores = [];
    if(!periodoInfo || periodoInfo.periodoId === "SIN_PERIODO"){
      errores.push(crear("PERIODO_VACIO", "periodos", row, "El registro no tiene periodoId válido.", "grave"));
    }
    if(!numeroIdentificacion || numeroIdentificacion === "SIN_IDENTIFICACION"){
      errores.push(crear("IDENTIFICACION_VACIA", "estudiantes_persona", row, "El registro no tiene numeroIdentificacion válido.", "grave"));
    }
    return errores;
  }

  window.BDLNormError = {
    crear: crear,
    revisarBasicos: revisarBasicos
  };
})(window);
