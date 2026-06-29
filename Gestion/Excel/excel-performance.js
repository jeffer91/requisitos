/* =========================================================
Nombre completo: excel-performance.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-performance.js
Función o funciones:
- Medir tiempos de lectura y análisis del Excel.
- Reportar operaciones lentas en consola sin afectar al usuario.
Con qué se conecta:
- excel-ui.cargar.js
========================================================= */
(function(window){
  "use strict";
  function start(label){var t=(performance&&performance.now)?performance.now():Date.now();return {end:function(extra){var e=(performance&&performance.now)?performance.now():Date.now();var ms=Math.round(e-t);if(ms>250)console.info("[ExcelPerformance] "+label+" "+ms+"ms",extra||"");return ms;}};}
  window.ExcelPerformance={start:start};
})(window);
