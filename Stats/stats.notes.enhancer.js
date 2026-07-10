/* =========================================================
Nombre completo: stats.notes.enhancer.js
Ruta o ubicación: /Requisitos/Stats/stats.notes.enhancer.js
Función o funciones:
- Añadir gráficos avanzados al render existente de Notas sin romper compatibilidad.
- Insertar gráficos por carrera, Nart vs Ndef, distribución y semáforo usando StatsNotesCharts.
Con qué se conecta:
- stats.notes.js
- stats.notes.analytics.js
- stats.notes.charts.js
========================================================= */
(function(window,document){
  "use strict";

  var originalRender=window.StatsNotes&&window.StatsNotes.render;

  function el(id){return document.getElementById(id);}

  function insertarGraficos(data,targetId){
    if(!window.StatsNotesAnalytics||typeof window.StatsNotesAnalytics.analizar!=="function")return;
    if(!window.StatsNotesCharts||typeof window.StatsNotesCharts.render!=="function")return;
    var target=el(targetId||"stats-notes");
    if(!target||target.querySelector(".stats-note-chart-grid"))return;
    var analisis=window.StatsNotesAnalytics.analizar(data||{});
    var html=window.StatsNotesCharts.render(analisis);
    var dashboard=target.querySelector(".notes-analytics-dashboard")||target.querySelector(".stats-note-dashboard")||target;
    var ranking=dashboard.querySelector(".notes-analytics-ranking")||dashboard.querySelector(".stats-note-ranking-grid");
    if(ranking&&ranking.insertAdjacentHTML)ranking.insertAdjacentHTML("afterend",html);
    else if(dashboard.insertAdjacentHTML)dashboard.insertAdjacentHTML("beforeend",html);
  }

  function render(data,targetId){
    if(typeof originalRender==="function")originalRender(data,targetId);
    insertarGraficos(data,targetId);
  }

  window.StatsNotes=window.StatsNotes||{};
  window.StatsNotes.render=render;
  window.StatsNotes.insertarGraficos=insertarGraficos;
})(window,document);
