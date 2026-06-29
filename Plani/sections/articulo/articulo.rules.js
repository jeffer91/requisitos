/* =========================================================
Nombre completo: articulo.rules.js
Ruta o ubicacion: /Requisitos/Plani/sections/articulo/articulo.rules.js
Funcion:
- Centralizar reglas especificas para Planificacion de Articulo Academico.
- Validar coherencia minima entre periodo, documento y cronograma.
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();}

  function isArticulo(documentType){return text(documentType).toUpperCase() === "ARTICULO";}

  function validate(state){
    state = state || {};
    var warnings = [];
    var errors = [];
    if(!isArticulo(state.documentType)){return {ok:true, errors:[], warnings:[], message:"No aplica regla Articulo."};}
    if(state.periodType && state.periodType.id && state.periodType.id !== "PVC"){
      warnings.push("Articulo Academico normalmente corresponde a periodo PVC.");
    }
    var raw = norm(state.cronogramaRaw);
    if(raw && raw.indexOf("induccion") < 0){warnings.push("No se detecto actividad de induccion en el cronograma.");}
    if(raw && raw.indexOf("metodologia") < 0 && raw.indexOf("tutoria") < 0){warnings.push("No se detecto actividad metodologica o tutoria academica.");}
    if(raw && raw.indexOf("entrega") < 0){warnings.push("No se detecto actividad de entrega del articulo.");}
    if(raw && raw.indexOf("defensa") < 0){warnings.push("No se detecto actividad de defensa oral.");}
    return {ok:errors.length === 0, errors:errors, warnings:warnings, message:errors.length ? errors.join(" ") : "Reglas Articulo revisadas."};
  }

  function phaseOf(row){
    var s = norm([row && row.actividad, row && row.observacion].join(" "));
    if(s.indexOf("induccion") >= 0){return "Induccion";}
    if(s.indexOf("metodologia") >= 0 || s.indexOf("tutoria") >= 0 || s.indexOf("clase") >= 0){return "Desarrollo metodologico";}
    if(s.indexOf("entrega") >= 0 || s.indexOf("borrador") >= 0 || s.indexOf("articulo") >= 0){return "Entrega documental";}
    if(s.indexOf("evaluacion") >= 0 || s.indexOf("antiplagio") >= 0 || s.indexOf("revision") >= 0){return "Evaluacion";}
    if(s.indexOf("defensa") >= 0){return "Defensa oral";}
    if(s.indexOf("supletorio") >= 0){return "Supletorio";}
    return "General";
  }

  window.PlaniArticuloRules = {isArticulo:isArticulo, validate:validate, phaseOf:phaseOf};
})(window);
