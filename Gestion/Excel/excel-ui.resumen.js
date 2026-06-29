/* =========================================================
Nombre completo: excel-ui.resumen.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-ui.resumen.js
Función o funciones:
- Mostrar esquema, análisis y consolidado del Excel cargado.
- Escuchar cambios del estado central sin recargar la pantalla.
Con qué se conecta:
- excel-state.js
- excel-resumen.logic.js
========================================================= */
(function(window,document){
  "use strict";
  var booted=false;
  function id(x){return document.getElementById(x);} 
  function render(state){state=state||window.ExcelState.get();var F=window.ExcelResumenLogic||{};var schema=id("excel-schema-box");var summary=id("excel-summary-box");if(schema)schema.textContent=(F.schema?F.schema(state.schema):"")+"\n\n"+(F.analisis?F.analisis(state.analisis):"");if(summary)summary.textContent=F.consolidado?F.consolidado(state.consolidado):"Sin consolidado.";}
  function restore(){try{var raw=localStorage.getItem("REQ_EXCEL_LAST_ANALYSIS");if(!raw)return;var last=JSON.parse(raw);if(last&&last.consolidado){window.ExcelState.set({periodoId:last.periodoId||"",periodoLabel:last.periodoLabel||"",fileName:last.fileName||"",schema:last.schema||null,analisis:last.analisis||null,consolidado:last.consolidado||null,lastAction:"restaurar"},"excel:restaurado");}}catch(e){}}
  function boot(){if(booted)return;booted=true;window.ExcelState.on("change",function(evt,state){render(state);});restore();render();}
  window.ExcelUIResumen={boot:boot,render:render};
})(window,document);
