/* =========================================================
Nombre completo: excel-bus.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-bus.js
Función o funciones:
- Compatibilizar eventos del módulo Excel.
- Dejar boot seguro para futuras integraciones.
Con qué se conecta:
- excel-state.js
========================================================= */
(function(window){
  "use strict";
  function emit(evt,payload){if(window.ExcelState&&window.ExcelState.emit)window.ExcelState.emit(evt,payload);}
  function on(evt,fn){return window.ExcelState&&window.ExcelState.on?window.ExcelState.on(evt,fn):function(){};}
  window.ExcelBus={boot:function(){},emit:emit,on:on};
})(window);
