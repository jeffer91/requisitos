(function(window){
  "use strict";

  function distribute(normalized){
    normalized = normalized || {};
    var rows = normalized.rowsMapeadas || [];
    var out = { periodos:{}, personas:{}, resumen:[], detalle:[], requisitos:[], notas:[], divisiones:[], errores:[] };

    rows.forEach(function(row){
      var norm = window.BDLNormEstudiante ? window.BDLNormEstudiante.normalize(row) : null;
      if(!norm){ return; }
      out.periodos[norm.periodo.periodoId] = norm.periodo;
      out.personas[norm.persona.numeroIdentificacion] = norm.persona;
      out.resumen.push(norm.resumen);
      out.detalle.push(norm.detalle);
      if(window.BDLNormRequisito){ out.requisitos = out.requisitos.concat(window.BDLNormRequisito.registros(row, norm.resumen.idEstudiantePeriodo, norm.resumen.periodoId, norm.resumen.numeroIdentificacion)); }
      if(window.BDLNormNota){ out.notas = out.notas.concat(window.BDLNormNota.registros(row, norm.resumen.idEstudiantePeriodo, norm.resumen.periodoId, norm.resumen.numeroIdentificacion)); }
      if(window.BDLNormDivision){ out.divisiones = out.divisiones.concat(window.BDLNormDivision.registros(row, norm.resumen.idEstudiantePeriodo, norm.resumen.periodoId, norm.resumen.numeroIdentificacion)); }
      if(window.BDLNormError){ out.errores = out.errores.concat(window.BDLNormError.revisarBasicos(row, norm.periodo, norm.resumen.numeroIdentificacion)); }
    });

    out.periodos = Object.keys(out.periodos).map(function(k){ return out.periodos[k]; });
    out.personas = Object.keys(out.personas).map(function(k){ return out.personas[k]; });
    return out;
  }

  window.CargaDistributor = { distribute: distribute };
})(window);
