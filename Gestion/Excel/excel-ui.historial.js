/* =========================================================
Nombre completo: excel-ui.historial.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-ui.historial.js
Función o funciones:
- Mostrar historial local básico dentro de Excel.
Con qué se conecta:
- excel-historial.repo.js
========================================================= */
(function(window,document){
  "use strict";
  function boot(){var box=document.getElementById("excel-history");if(!box||!window.ExcelHistorialRepo)return;var list=window.ExcelHistorialRepo.list();box.textContent=list.length?list.map(function(h){return (h.createdAt||"")+" | "+(h.periodoLabel||h.periodoId||"")+" | "+(h.fileName||"")+" | "+(h.totalRows||0)+" filas";}).join("\n"):"Sin historial local todavía.";}
  window.ExcelUIHistorial={boot:boot};
})(window,document);
