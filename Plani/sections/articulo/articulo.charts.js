/* =========================================================
Nombre completo: articulo.charts.js
Ruta o ubicacion: /Requisitos/Plani/sections/articulo/articulo.charts.js
Funcion:
- Preparar graficos logicos especificos para Articulo Academico.
- Crear datos para distribucion por fases del cronograma.
========================================================= */
(function(window){
  "use strict";

  function buildFasesChart(mapped){
    var rows = window.PlaniArticuloTables && window.PlaniArticuloTables.fasesRows ? window.PlaniArticuloTables.fasesRows(mapped) : [];
    return {
      id:"articulo-fases-chart",
      kind:"CHART",
      type:"bar",
      title:"Actividades por fase del Articulo Academico",
      labels:rows.map(function(x){return x.fase;}),
      values:rows.map(function(x){return x.total;}),
      source:"Cronograma interpretado por Plani"
    };
  }

  function asAsset(mapped){
    var chart = buildFasesChart(mapped);
    return window.PlaniCharts && window.PlaniCharts.chartAsset ? window.PlaniCharts.chartAsset(chart, "articulo-cronograma") : chart;
  }

  window.PlaniArticuloCharts = {buildFasesChart:buildFasesChart, asAsset:asAsset};
})(window);
