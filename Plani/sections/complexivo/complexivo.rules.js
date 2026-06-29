/* =========================================================
Nombre completo: complexivo.rules.js
Ruta o ubicacion: /Requisitos/Plani/sections/complexivo/complexivo.rules.js
Funcion:
- Centralizar reglas especificas para Planificacion de Examen Complexivo.
- Validar coherencia minima entre periodo, documento y cronograma.
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();}

  function isComplexivo(documentType){
    return text(documentType).toUpperCase() === "COMPLEXIVO";
  }

  function validate(state){
    state = state || {};
    var warnings = [];
    var errors = [];
    if(!isComplexivo(state.documentType)){return {ok:true, errors:[], warnings:[], message:"No aplica regla Complexivo."};}
    if(state.periodType && state.periodType.id && state.periodType.id !== "REGULAR"){
      warnings.push("Complexivo normalmente corresponde a periodo regular.");
    }
    var raw = norm(state.cronogramaRaw);
    if(raw && raw.indexOf("induccion") < 0){warnings.push("No se detecto actividad de induccion en el cronograma.");}
    if(raw && raw.indexOf("evaluacion") < 0 && raw.indexOf("calificacion") < 0){warnings.push("No se detecto actividad de evaluacion o calificacion.");}
    if(raw && raw.indexOf("defensa") < 0 && raw.indexOf("examen") < 0){warnings.push("No se detecto actividad de examen o defensa.");}
    return {ok:errors.length === 0, errors:errors, warnings:warnings, message:errors.length ? errors.join(" ") : "Reglas Complexivo revisadas."};
  }

  function phaseOf(row){
    var s = norm([row && row.actividad, row && row.observacion].join(" "));
    if(s.indexOf("induccion") >= 0){return "Induccion";}
    if(s.indexOf("seminario") >= 0 || s.indexOf("metodologia") >= 0){return "Preparacion";}
    if(s.indexOf("examen") >= 0 || s.indexOf("defensa") >= 0){return "Aplicacion";}
    if(s.indexOf("evaluacion") >= 0 || s.indexOf("calificacion") >= 0){return "Evaluacion";}
    if(s.indexOf("supletorio") >= 0){return "Supletorio";}
    return "General";
  }

  window.PlaniComplexivoRules = {isComplexivo:isComplexivo, validate:validate, phaseOf:phaseOf};
})(window);
