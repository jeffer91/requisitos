/* =========================================================
Nombre completo: infor.qa.js
Ruta o ubicación: /Requisitos/Titulacion/core/infor.qa.js
Función o funciones:
- Revisar dependencias principales de Infor.
- Validar el estado mínimo antes de procesar/exportar.
- Mostrar advertencias claras sin romper el flujo.
- Servir como diagnóstico rápido después de cambios grandes.
Con qué se conecta:
- core/infor.state.js
- core/infor.periodo.js
- core/infor.excel.js
- core/infor.match.js
- core/infor.report.js
- core/infor.gemini.js
- export/word/word.export.js
- export/pdf/pdf.from-word.js
- frontend/titulacion.html
========================================================= */
(function(window, document){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}

  var MODULES = [
    {name:"ExcelLocalStorage", value:"ExcelLocalStorage", required:true},
    {name:"ExcelLocalRepo", value:"ExcelLocalRepo", required:true},
    {name:"StatsRules", value:"StatsRules", required:true},
    {name:"InforPeriodo", value:"InforPeriodo", required:true},
    {name:"InforExcel", value:"InforExcel", required:true},
    {name:"InforMatch", value:"InforMatch", required:true},
    {name:"InforCronogramaParser", value:"InforCronogramaParser", required:true},
    {name:"InforReport", value:"InforReport", required:true},
    {name:"InforGemini", value:"InforGemini", required:true},
    {name:"InforState", value:"InforState", required:true},
    {name:"InforWordExport", value:"InforWordExport", required:true},
    {name:"InforPdfExport", value:"InforPdfExport", required:true},
    {name:"BL2EstudiantesRepo", value:"BL2EstudiantesRepo", required:false}
  ];

  function moduleChecks(){
    return MODULES.map(function(item){
      var ok = !!window[item.value];
      return {type:ok ? "ok" : (item.required ? "error" : "warn"), label:item.name, message:ok ? "Disponible" : (item.required ? "No cargado" : "No disponible, se usará respaldo si existe")};
    });
  }

  function stateChecks(snapshot){
    snapshot = snapshot || {};
    var checks = [];
    var hasPeriod = !!text(snapshot.periodId || snapshot.periodLabel);
    var excelRows = snapshot.excelData && Array.isArray(snapshot.excelData.rows) ? snapshot.excelData.rows.length : 0;
    var match = snapshot.matchResult || null;
    var matchSummary = match && match.summary ? match.summary : null;
    var report = snapshot.reportDraft || null;
    var key = window.InforState && typeof window.InforState.getGeminiKey === "function" ? window.InforState.getGeminiKey() : "";

    checks.push({type:hasPeriod ? "ok" : "warn", label:"Período", message:hasPeriod ? "Seleccionado" : "Pendiente de seleccionar"});
    checks.push({type:excelRows > 0 ? "ok" : "warn", label:"Excel", message:excelRows > 0 ? (excelRows + " filas detectadas") : "Sin filas detectadas"});
    checks.push({type:matchSummary && matchSummary.total ? (matchSummary.pendientes ? "warn" : "ok") : "warn", label:"Unión BaseLocal", message:matchSummary ? (matchSummary.unidos + " unidos, " + matchSummary.pendientes + " pendientes") : "Sin unión todavía"});
    checks.push({type:key ? "ok" : "warn", label:"Gemini", message:key ? "Clave configurada" : "Clave pendiente"});
    checks.push({type:report && report.ok ? "ok" : "warn", label:"Motor informe", message:report && report.ok ? (report.sections.length + " secciones listas") : "Pendiente de procesar"});
    checks.push({type:report && report.ok ? "ok" : "warn", label:"Exportación", message:report && report.ok ? "Word/PDF habilitados" : "Exportación bloqueada hasta procesar"});
    return checks;
  }

  function run(){
    var snapshot = window.InforState && typeof window.InforState.getState === "function" ? window.InforState.getState() : {};
    var checks = moduleChecks().concat(stateChecks(snapshot));
    var errors = checks.filter(function(x){return x.type === "error";}).length;
    var warnings = checks.filter(function(x){return x.type === "warn";}).length;
    return {
      ok:errors === 0,
      errors:errors,
      warnings:warnings,
      checks:checks,
      generatedAt:new Date().toISOString()
    };
  }

  function badge(type){
    if(type === "ok"){return "<span class='infor-pill-mini ok'>OK</span>";}
    if(type === "error"){return "<span class='infor-pill-mini bad'>ERROR</span>";}
    return "<span class='infor-pill-mini warn'>REVISAR</span>";
  }

  function render(result){
    var box = document.getElementById("infor-qa-results");
    if(!box){return;}
    result = result || run();
    var html = "<div class='infor-table-wrap'><table class='infor-small-table'><thead><tr><th>Estado</th><th>Elemento</th><th>Detalle</th></tr></thead><tbody>";
    html += result.checks.map(function(item){
      return "<tr><td>" + badge(item.type) + "</td><td>" + esc(item.label) + "</td><td>" + esc(item.message) + "</td></tr>";
    }).join("");
    html += "</tbody></table></div>";
    html += "<p class='infor-muted'>Errores: " + result.errors + " · Advertencias: " + result.warnings + " · " + esc(result.generatedAt) + "</p>";
    box.innerHTML = html;
  }

  function boot(){
    var btn = document.getElementById("infor-qa-run");
    if(btn){btn.addEventListener("click", function(){render(run());});}
    setTimeout(function(){render(run());}, 350);
  }

  if(document.readyState === "loading"){document.addEventListener("DOMContentLoaded", boot);}else{boot();}
  window.InforQA = {run:run, render:render};
})(window, document);
