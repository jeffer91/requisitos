/* =========================================================
Nombre completo: articulo.config.js
Ruta o ubicacion: /Requisitos/Plani/templates/documents/articulo.config.js
Funcion:
- Centralizar metadatos institucionales de Planificacion de Articulo Academico.
- Mantener codigo, titulo, version, fecha y reglas del documento en un solo lugar.
========================================================= */
(function(window){
  "use strict";

  var CONFIG = {
    id:"ARTICULO",
    label:"Articulo Academico",
    title:"Planificacion de Articulo Academico",
    code:"UTET-RGI3-01-PRO-56",
    version:"1.0",
    expectedPeriodType:"PVC",
    dateLabel:"1 - Abril - 2025",
    description:"Documento institucional para planificar el proceso de Articulo Academico.",
    output:{folder:"sections/articulo", defaultFilePrefix:"PLANI-ARTICULO"},
    requiredSections:[
      "introduccion",
      "marco-normativo",
      "metodologia",
      "desarrollo-operativo",
      "cronograma",
      "evaluacion",
      "disposiciones-finales",
      "referencias"
    ]
  };

  function clone(value){return JSON.parse(JSON.stringify(value == null ? null : value));}
  function get(){return clone(CONFIG);}

  window.PlaniArticuloConfig = {get:get};
})(window);
