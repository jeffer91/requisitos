/* =========================================================
Nombre completo: cont.event.classify.js
Ruta: /BDLocal/continuity/events/cont.event.classify.js
Función:
- Clasificar cambios como recuperables, manuales o críticos.
========================================================= */
(function(window){
  "use strict";

  function norm(v){ return String(v == null ? "" : v).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }

  var CRITICAL = ["nota", "notas", "nart", "ndef", "nfin", "titulo", "titulos", "decision", "aprobacion", "historial"];
  var MANUAL = ["division", "divisiones", "telegram", "modalidad", "observacion", "comentario", "chatid", "usuario_telegram"];

  function containsAny(value, list){
    value = norm(value);
    return list.some(function(item){ return value.indexOf(item) >= 0; });
  }

  function classify(input){
    input = input || {};
    var raw = [input.tipoDato, input.campo, input.key, input.field].join(" ");
    if(containsAny(raw, CRITICAL)){ return "critico"; }
    if(containsAny(raw, MANUAL)){ return "manual"; }
    return "recuperable";
  }

  window.BDLContEventClassify = { classify: classify };
})(window);
