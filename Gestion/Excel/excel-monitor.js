/* =========================================================
Nombre completo: excel-monitor.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-monitor.js
Función o funciones:
- Registrar eventos básicos del módulo Excel para diagnóstico rápido.
Con qué se conecta:
- excel-ui.cargar.js
========================================================= */
(function(window){"use strict";var logs=[];function log(origen,msg,data){var item={time:new Date().toISOString(),origen:origen,msg:msg,data:data||null};logs.push(item);console.info("[ExcelMonitor]",item);}function getLogs(){return logs.slice();}window.ExcelMonitor={log:log,getLogs:getLogs};})(window);
