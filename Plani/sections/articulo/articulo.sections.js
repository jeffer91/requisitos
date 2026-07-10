/* =========================================================
Nombre completo: articulo.sections.js
Ruta o ubicacion: /Requisitos/Plani/sections/articulo/articulo.sections.js
Funcion:
- Construir secciones especificas de Planificacion de Articulo Academico.
- Insertar tablas y graficos logicos propios del documento.
========================================================= */
(function(window){
  "use strict";

  function c(key){return window.PlaniArticuloContent ? window.PlaniArticuloContent.get(key) : "";}
  function safeList(value){return Array.isArray(value) ? value : [];}

  function tableBlock(headers, rows, caption, source){
    return {type:"table", headers:headers || [], rows:rows || [], options:{caption:caption || "Tabla", source:source || "Plani"}};
  }

  function chartBlock(chart){
    return {type:"html", html:window.PlaniCharts && window.PlaniCharts.renderPlaceholder ? window.PlaniCharts.renderPlaceholder(chart) : ""};
  }

  function build(snapshot){
    snapshot = snapshot || {};
    var mapped = snapshot.cronogramaMapped || null;
    var headers = window.PlaniArticuloTables ? window.PlaniArticuloTables.cronogramaHeaders() : [];
    var rows = window.PlaniArticuloTables ? window.PlaniArticuloTables.cronogramaRows(mapped) : safeList(mapped && mapped.rows);
    var faseRows = window.PlaniArticuloTables ? window.PlaniArticuloTables.fasesRows(mapped) : [];
    var faseHeaders = window.PlaniArticuloTables ? window.PlaniArticuloTables.faseHeaders() : [];
    var evalHeaders = window.PlaniArticuloTables ? window.PlaniArticuloTables.evaluationHeaders() : [];
    var evalRows = window.PlaniArticuloTables ? window.PlaniArticuloTables.evaluationRows() : [];
    var chart = window.PlaniArticuloCharts ? window.PlaniArticuloCharts.buildFasesChart(mapped) : null;

    return [
      {id:"introduccion", title:"Introduccion", content:c("introduccion")},
      {id:"marco-normativo", title:"Marco Normativo y Estrategico", content:c("marcoNormativo")},
      {id:"metodologia", title:"Metodologia de Implementacion del Proceso", content:c("metodologia"), blocks:[tableBlock(faseHeaders, faseRows, "Resumen de fases del proceso", "Cronograma interpretado por Plani"), chartBlock(chart)]},
      {id:"desarrollo-operativo", title:"Desarrollo Operativo del Proceso de Titulacion", content:c("desarrolloOperativo")},
      {id:"cronograma", title:"Cronograma Referencial", content:c("cronograma"), blocks:[tableBlock(headers, rows, "Cronograma referencial por fase", "Cronograma cargado en Plani")]},
      {id:"evaluacion", title:"Evaluacion, Acreditacion y Seguimiento", content:c("evaluacion"), blocks:[tableBlock(evalHeaders, evalRows, "Criterios base de evaluacion", "Plantilla Plani Articulo Academico")]},
      {id:"disposiciones-finales", title:"Disposiciones Finales", content:c("disposiciones")},
      {id:"referencias", title:"Referencias", content:c("referencias")}
    ];
  }

  window.PlaniArticuloSections = {build:build};
})(window);
