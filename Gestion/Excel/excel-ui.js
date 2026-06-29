/* =========================================================
Nombre completo: excel-ui.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-ui.js
Función o funciones:
- Arrancar la UI principal del motor Excel.
- Cargar solo módulos disponibles para permitir trabajo por bloques.
Con qué se conecta:
- excel-ui.periodo.js
- excel-ui.cargar.js
- excel-ui.resumen.js
========================================================= */
(function(window){
  "use strict";
  function safe(name){var mod=window[name];if(mod&&typeof mod.boot==="function"){try{mod.boot();}catch(e){console.error("[ExcelUI] Error en "+name,e);}}}
  function boot(){safe("ExcelUIPeriodo");safe("ExcelUICargar");safe("ExcelUIResumen");safe("ExcelUIBorrado");safe("ExcelUIHistorial");safe("ExcelUIForceUpload");}
  window.ExcelUI={boot:boot};
})(window);
