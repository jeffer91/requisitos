/* =========================================================
Nombre completo: stats.summary.js
Ruta o ubicación: /Requisitos/Stats/stats.summary.js
Función o funciones:
- Mostrar el gráfico principal dentro de la sección Resumen.
- Adaptar títulos, KPI y gráfico al requisito seleccionado.
- Mantener el resumen general cuando no existe requisito seleccionado.
- Evitar duplicar la antigua sección independiente de Gráficos.
Con qué se conecta:
- stats.html
- stats.app.js
- stats.charts.js
========================================================= */
(function(window, document){
  "use strict";

  var observer = null;
  var scheduled = false;

  function el(id){
    return document.getElementById(id);
  }

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function num(value){
    value = Number(value);
    return Number.isFinite(value) ? value : 0;
  }

  function pct(value, total){
    return total ? Math.round((num(value) * 10000) / num(total)) / 100 : 0;
  }

  function setText(id, value){
    var node = el(id);
    if(node){
      node.textContent = value;
    }
  }

  function empty(message){
    var safe = text(message)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");

    return '<div class="empty">' + safe + '</div>';
  }

  function currentData(){
    if(!window.StatsApp || typeof window.StatsApp.getState !== "function"){
      return null;
    }

    var state = window.StatsApp.getState() || {};
    return state.data || null;
  }

  function renderGeneral(data){
    setText("stats-summary-eyebrow", "Resumen general");
    setText("stats-summary-title", "Estadísticas de requisitos");

    setText("stats-total-label", "Total estudiantes");
    setText("stats-ok-label", "Estudiantes aprobados");
    setText("stats-no-label", "Estudiantes no aprobados");
    setText("stats-avance-label", "Cumplimiento general");
    setText("stats-period-approval-label", "Aprobación por período");

    setText("stats-total", data.total || 0);
    setText("stats-ok", data.estados && data.estados.cumple ? data.estados.cumple : 0);
    setText("stats-no", data.estados && data.estados.no_cumple ? data.estados.no_cumple : 0);
    setText("stats-avance", (data.avanceGeneral || 0) + "%");

    setText("stats-summary-chart-title", "Gráfico general");
    setText("stats-summary-chart-meta", "Aprobados / No aprobados");

    if(window.StatsCharts && typeof window.StatsCharts.renderGeneral === "function"){
      window.StatsCharts.renderGeneral(data, "stats-chart-summary");
    }
  }

  function renderSelected(data, selected){
    var stats = selected.stats || {};
    var total = num(stats.aplica || stats.total || 0);
    var cumple = num(stats.cumple);
    var noCumple = num(stats.no_cumple);
    var noAplica = num(stats.no_aplica);
    var avance = stats.avance == null ? pct(cumple, total) : num(stats.avance);
    var label = text(selected.label || selected.key || "Requisito");

    setText("stats-summary-eyebrow", "Resumen del requisito");
    setText("stats-summary-title", label);

    setText("stats-total-label", "Total evaluados");
    setText("stats-ok-label", "Cumplen");
    setText("stats-no-label", "No cumplen");
    setText("stats-avance-label", "Cumplimiento");
    setText("stats-period-approval-label", "No aplica");

    setText("stats-total", total);
    setText("stats-ok", cumple);
    setText("stats-no", noCumple);
    setText("stats-avance", avance + "%");
    setText("stats-period-approval", noAplica + " estudiante" + (noAplica === 1 ? "" : "s"));
    setText("stats-period-type", "Requisito · " + label);

    setText("stats-summary-chart-title", "Gráfico de " + label);
    setText("stats-summary-chart-meta", "Cumple / No cumple");

    if(window.StatsCharts && typeof window.StatsCharts.renderSelected === "function"){
      window.StatsCharts.renderSelected(data, "stats-chart-summary");
    }
  }

  function render(){
    var target = el("stats-chart-summary");
    if(!target){
      return;
    }

    var data = currentData();
    if(!data){
      target.innerHTML = empty("Cargando resumen...");
      return;
    }

    if(data._requiresPeriod){
      target.innerHTML = empty("Selecciona un período para ver el resumen y su gráfico.");
      setText("stats-summary-eyebrow", "Resumen general");
      setText("stats-summary-title", "Estadísticas de requisitos");
      return;
    }

    if(data.selectedRequirement){
      renderSelected(data, data.selectedRequirement);
    }else{
      renderGeneral(data);
    }
  }

  function scheduleRender(){
    if(scheduled){
      return;
    }

    scheduled = true;
    setTimeout(function(){
      scheduled = false;
      render();
    }, 0);
  }

  function bind(){
    var status = el("stats-status");

    if(status && typeof MutationObserver === "function"){
      observer = new MutationObserver(scheduleRender);
      observer.observe(status, {
        childList: true,
        characterData: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"]
      });
    }

    [
      "stats-periodo",
      "stats-division",
      "stats-matricula",
      "stats-carrera",
      "stats-estado",
      "stats-requisito"
    ].forEach(function(id){
      var node = el(id);
      if(node){
        node.addEventListener("change", scheduleRender);
      }
    });

    var refresh = el("stats-refresh");
    if(refresh){
      refresh.addEventListener("click", scheduleRender);
    }

    window.addEventListener("bdlocal:conexiones-cache-updated", scheduleRender);
    window.addEventListener("requisitos:bdlocal-cambio-disponible", scheduleRender);
    window.addEventListener("stats:cache-invalidated", scheduleRender);

    scheduleRender();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bind);
  }else{
    bind();
  }

  window.StatsSummary = {
    render: render,
    refresh: scheduleRender
  };
})(window, document);
