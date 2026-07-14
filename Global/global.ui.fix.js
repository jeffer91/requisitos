/* =========================================================
Nombre completo: global.ui.fix.js
Ruta o ubicación: /Requisitos/Global/global.ui.fix.js
Función:
- Activar etiquetas completas en el gráfico de graduados.
- Conservar el orden cronológico inicial en la tabla de graduados.
- Calcular la separación del menú lateral bajo los filtros fijos.
- Actualizar el texto informativo del mínimo de graduados.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.0.0-global-ui-fix";
  var resizeTimer = null;
  var chartWrapped = false;
  var tableWrapped = false;

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function updateStickyOffset(){
    var filters = document.querySelector(".global-filters");
    var height = filters
      ? Math.ceil(filters.getBoundingClientRect().height)
      : 0;

    document.documentElement.style.setProperty(
      "--global-sticky-offset",
      Math.max(12, height + 12) + "px"
    );
  }

  function scheduleStickyOffset(){
    if(resizeTimer){
      window.clearTimeout(resizeTimer);
    }

    resizeTimer = window.setTimeout(function(){
      resizeTimer = null;
      updateStickyOffset();
    }, 80);
  }

  function wrapChart(){
    if(
      chartWrapped ||
      !window.GlobalChart ||
      typeof window.GlobalChart.renderBar !== "function"
    ){
      return;
    }

    chartWrapped = true;
    var original = window.GlobalChart.renderBar;

    window.GlobalChart.renderBar = function(target, options){
      var next = Object.assign({}, options || {});
      var selector = typeof target === "string"
        ? target
        : text(target && target.id);

      if(
        selector.indexOf("globalGraficoGraduados") >= 0 ||
        next.valueKey === "cantidadGraduados"
      ){
        next.fullLabels = true;
      }

      return original.call(window.GlobalChart, target, next);
    };
  }

  function wrapTable(){
    if(
      tableWrapped ||
      !window.GlobalTable ||
      typeof window.GlobalTable.render !== "function"
    ){
      return;
    }

    tableWrapped = true;

    if(typeof window.GlobalTable.reset === "function"){
      window.GlobalTable.reset("globalTablaGraduados");
    }

    var original = window.GlobalTable.render;

    window.GlobalTable.render = function(target, options){
      var next = Object.assign({}, options || {});
      var id = text(next.id || (target && target.id));

      if(id === "globalTablaGraduados"){
        next.defaultSortKey = "";
        next.defaultSortDir = "asc";
      }

      return original.call(window.GlobalTable, target, next);
    };
  }

  function updateGraduateMessage(){
    var title = document.querySelector("#globalSectionTitle");
    if(!title || text(title.textContent) !== "Graduados por período"){
      return;
    }

    var paragraph = document.querySelector(
      "#globalSectionBody .global-section-intro p"
    );

    if(paragraph){
      paragraph.textContent =
        "Se muestran únicamente los períodos con al menos tres estudiantes cuyo campo AprobacionTitulacion contiene el valor CUMPLE. El resultado respeta todos los filtros superiores activos.";
    }
  }

  function boot(){
    wrapChart();
    wrapTable();
    updateStickyOffset();
    updateGraduateMessage();

    window.addEventListener("resize", scheduleStickyOffset);
    window.addEventListener("global:rendered", function(){
      wrapChart();
      wrapTable();
      scheduleStickyOffset();
      updateGraduateMessage();
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }

  window.GlobalUIFix = {
    version: VERSION,
    updateStickyOffset: updateStickyOffset,
    refresh: function(){
      wrapChart();
      wrapTable();
      updateStickyOffset();
      updateGraduateMessage();
    }
  };
})(window, document);
