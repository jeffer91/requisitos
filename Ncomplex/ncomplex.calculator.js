/* =========================================================
Nombre completo: ncomplex.calculator.js
Ruta o ubicación: /Ncomplex/ncomplex.calculator.js
Función o funciones:
- Normalizar notas entre 0 y 10.
- Calcular complexivo ordinario y supletorio con 40% teórico y 60% práctico.
- Calcular trabajo de titulación con 60% escrito y 40% defensa.
- Recalcular nota oficial y estado sin editar manualmente los resultados finales.
Con qué se conecta:
- BDLocal/rules/bdl.rules.evaluaciones-titulacion.js
- ncomplex.table.js
- ncomplex.matcher.js
- ncomplex.app.js
========================================================= */
(function(window){
  "use strict";

  var Config = window.NcomplexConfig || {};

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function round(value){
    var decimals = Number(Config.decimals || 2);
    var factor = Math.pow(10, decimals);
    return Math.round(Number(value) * factor) / factor;
  }

  function parse(value){
    var central = window.BDLRulesEvaluacionesTitulacion;
    if(central && typeof central.parseNota === "function"){
      return central.parseNota(value);
    }

    var raw = text(value).replace(/,/g, ".");
    if(!raw){ return null; }
    var number = Number(raw);
    if(!Number.isFinite(number)){ return null; }
    return round(Math.max(0, Math.min(10, number)));
  }

  function weighted(first, second, firstWeight, secondWeight){
    first = parse(first);
    second = parse(second);
    if(first == null || second == null){ return null; }
    return round(first * firstWeight + second * secondWeight);
  }

  function complexivo(teorico, practico){
    var central = window.BDLRulesEvaluacionesTitulacion;
    if(central && typeof central.complexivo === "function"){
      return central.complexivo(teorico, practico);
    }
    return weighted(teorico, practico, 0.40, 0.60);
  }

  function trabajo(escrito, defensa){
    var central = window.BDLRulesEvaluacionesTitulacion;
    if(central && typeof central.trabajo === "function"){
      return central.trabajo(escrito, defensa);
    }
    return weighted(escrito, defensa, 0.60, 0.40);
  }

  function recalculate(input){
    var row = Object.assign({}, input || {});
    var modalidades = Config.modalidades || {};
    var passing = Number(row.notaMinimaAprobacion || Config.passingGrade || 7);

    row.notaTeorica = parse(row.notaTeorica);
    row.notaPractica = parse(row.notaPractica);
    row.notaComplexivo = complexivo(row.notaTeorica, row.notaPractica);

    row.notaTeoricaSupletorio = parse(row.notaTeoricaSupletorio);
    row.notaPracticaSupletorio = parse(row.notaPracticaSupletorio);
    var calculatedSupletorio = complexivo(
      row.notaTeoricaSupletorio,
      row.notaPracticaSupletorio
    );
    row.notaSupletorio = calculatedSupletorio == null
      ? parse(row.notaSupletorio)
      : calculatedSupletorio;

    row.notaEscrito = parse(row.notaEscrito);
    row.notaDefensaTrabajo = parse(row.notaDefensaTrabajo);
    var calculatedWork = trabajo(row.notaEscrito, row.notaDefensaTrabajo);
    row.notaTrabajoTitulacion = calculatedWork == null
      ? parse(row.notaTrabajoTitulacion)
      : calculatedWork;

    if(row.modalidadTitulacion === modalidades.TRABAJO){
      row.notaOficial = row.notaTrabajoTitulacion;
      row.oportunidadAplicada = "ORDINARIA";
    }else{
      var ordinary = row.notaComplexivo;
      var supplementary = row.notaSupletorio;
      var useSupplementary = supplementary != null && ordinary != null && ordinary < passing;
      row.oportunidadAplicada = useSupplementary ? "SUPLETORIO" : "ORDINARIA";
      row.notaOficial = useSupplementary ? supplementary : ordinary;
    }

    var noteFields = Config.camposNota || [];
    var hasAny = noteFields.some(function(field){ return parse(row[field]) != null; });
    if(!hasAny){
      row.estadoEvaluacion = "SIN_NOTAS";
    }else if(row.notaOficial == null){
      row.estadoEvaluacion = "INCOMPLETO";
    }else{
      row.estadoEvaluacion = row.notaOficial >= passing ? "APROBADO" : "NO_APROBADO";
    }

    row.notaMinimaAprobacion = passing;
    row.updatedAt = new Date().toISOString();
    return row;
  }

  function display(value){
    value = parse(value);
    return value == null ? "—" : value.toFixed(Number(Config.decimals || 2));
  }

  window.NcomplexCalculator = {
    version: "1.0.0-bloque-2",
    parse: parse,
    round: round,
    complexivo: complexivo,
    trabajo: trabajo,
    recalculate: recalculate,
    display: display
  };
})(window);