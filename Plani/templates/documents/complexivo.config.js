/* =========================================================
Nombre completo: complexivo.config.js
Ruta o ubicacion: /Requisitos/Plani/templates/documents/complexivo.config.js
Funcion:
- Centralizar metadatos institucionales de Planificacion de Examen Complexivo.
- Mantener codigo, titulo, version, fecha y reglas del documento en un solo lugar.
========================================================= */
(function(window){
  "use strict";

  var CONFIG = {
    id:"COMPLEXIVO",
    label:"Examen Complexivo",
    title:"Planificacion de Examen Complexivo",
    code:"UTET-RGI1-01-PRO-56",
    version:"1.0",
    expectedPeriodType:"REGULAR",
    dateLabel:"1 - Octubre - 2025",
    description:"Documento institucional para planificar el proceso de Examen Complexivo.",
    output:{
      folder:"sections/complexivo",
      defaultFilePrefix:"PLANI-COMPLEXIVO"
    },
    requiredSections:[
      "introduccion",
      "base-legal",
      "metodologia",
      "requisitos",
      "descripcion-examen",
      "seminarios",
      "distribucion-estudiantes",
      "laboratorios",
      "imponderables",
      "criterios-evaluacion",
      "resumen-general",
      "bibliografia"
    ]
  };

  function clone(value){return JSON.parse(JSON.stringify(value == null ? null : value));}
  function get(){return clone(CONFIG);}

  window.PlaniComplexivoConfig = {get:get};
})(window);
