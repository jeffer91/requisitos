/* =========================================================
Nombre completo: complexivo.charts.js
Ruta o ubicacion: /Requisitos/Plani/sections/complexivo/complexivo.charts.js
Funcion:
- Preparar graficos logicos especificos para Examen Complexivo.
- Crear datos para distribucion por fases del cronograma.
========================================================= */
(function(window){
  "use strict";

  function buildFasesChart(mapped){
    var rows = window.PlaniComplexivoTables && window.PlaniComplexivoTables.fasesRows ? window.PlaniComplexivoTables.fasesRows(mapped) : [];
    return {
      id:"complexivo-fases-chart",
      kind:"CHART",
      type:"bar",
      title:"Actividades por fase del Examen Complexivo",
      labels:rows.map(function(x){return x.fase;}),
      values:rows.map(function(x){return x.total;}),
      source:"Cronograma interpretado por Plani"
    };
  }

  function asAsset(mapped){
    var chart = buildFasesChart(mapped);
    return window.PlaniCharts && window.PlaniCharts.chartAsset ? window.PlaniCharts.chartAsset(chart, "complexivo-cronograma") : chart;
  }

  window.PlaniComplexivoCharts = {buildFasesChart:buildFasesChart, asAsset:asAsset};
})(window);
