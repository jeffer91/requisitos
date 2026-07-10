/* =========================================================
Nombre completo: plani.charts.js
Ruta o ubicacion: /Requisitos/Plani/core/plani.charts.js
Funcion:
- Preparar definiciones logicas de graficos para Plani.
- No dibuja todavia graficos finales; deja modelos para el motor documental.
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function safeList(value){return Array.isArray(value) ? value : [];}

  function fromCronogramaGroups(mapped){
    var summary = safeList(mapped && mapped.summary);
    return {
      id:"chart-cronograma-tipos",
      kind:"CHART",
      type:"bar",
      title:"Distribucion de actividades del cronograma",
      labels:summary.map(function(x){return text(x.tipo);}),
      values:summary.map(function(x){return Number(x.total || 0);}),
      source:"Cronograma cargado en Plani"
    };
  }

  function chartAsset(chart, sectionId){
    chart = chart || {};
    return Object.assign({}, chart, {
      id:chart.id || "chart-" + Date.now(),
      kind:"CHART",
      sectionId:text(sectionId || "general"),
      createdAt:new Date().toISOString()
    });
  }

  function renderPlaceholder(chart){
    chart = chart || {};
    return '<div class="plani-chart-placeholder"><strong>' + text(chart.title || 'Grafico') + '</strong><p>Grafico logico pendiente de render visual.</p></div>';
  }

  window.PlaniCharts = {fromCronogramaGroups:fromCronogramaGroups, chartAsset:chartAsset, renderPlaceholder:renderPlaceholder};
})(window);
