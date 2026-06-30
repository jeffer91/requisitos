/* =========================================================
Nombre completo: cont.rules.priority.js
Ruta: /BDLocal/continuity/rules/cont.rules.priority.js
Función:
- Definir prioridad de datos para sincronización.
========================================================= */
(function(window){
  "use strict";

  var PRIORITY = {
    recuperable: "recuperable",
    manual: "manual",
    critico: "critico"
  };

  var LABELS = {
    recuperable: "Recuperable desde Excel",
    manual: "Manual importante",
    critico: "Crítico"
  };

  function label(value){ return LABELS[value] || value || "Sin prioridad"; }

  window.BDLContPriority = {
    values: PRIORITY,
    label: label
  };
})(window);
