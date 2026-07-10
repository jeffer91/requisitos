/* =========================================================
Nombre completo: complexivo.sections.js
Ruta o ubicacion: /Requisitos/Plani/sections/complexivo/complexivo.sections.js
Funcion:
- Construir secciones especificas de Planificacion de Examen Complexivo.
- Insertar tablas y graficos logicos propios del documento.
========================================================= */
(function(window){
  "use strict";

  function c(key){return window.PlaniComplexivoContent ? window.PlaniComplexivoContent.get(key) : "";}
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
    var headers = window.PlaniComplexivoTables ? window.PlaniComplexivoTables.cronogramaHeaders() : [];
    var rows = window.PlaniComplexivoTables ? window.PlaniComplexivoTables.cronogramaRows(mapped) : safeList(mapped && mapped.rows);
    var faseRows = window.PlaniComplexivoTables ? window.PlaniComplexivoTables.fasesRows(mapped) : [];
    var faseHeaders = window.PlaniComplexivoTables ? window.PlaniComplexivoTables.faseHeaders() : [];
    var chart = window.PlaniComplexivoCharts ? window.PlaniComplexivoCharts.buildFasesChart(mapped) : null;

    return [
      {id:"introduccion", title:"Introduccion", content:c("introduccion")},
      {id:"base-legal", title:"Base Legal", content:c("baseLegal")},
      {id:"metodologia", title:"Metodologia", content:c("metodologia"), blocks:[tableBlock(faseHeaders, faseRows, "Resumen de fases del proceso", "Cronograma interpretado por Plani"), chartBlock(chart)]},
      {id:"requisitos", title:"Requisitos para Titulacion", content:c("requisitos")},
      {id:"descripcion-examen", title:"Descripcion del Examen Complexivo", content:c("descripcionExamen")},
      {id:"seminarios", title:"Seminarios de Titulacion", content:c("seminarios")},
      {id:"distribucion-estudiantes", title:"Distribucion de Estudiantes por Carrera y Nivel", content:c("distribucion")},
      {id:"laboratorios", title:"Asignacion de Laboratorios y Capacidad", content:c("laboratorios")},
      {id:"imponderables", title:"Imponderables", content:c("imponderables")},
      {id:"criterios-evaluacion", title:"Criterios de Evaluacion", content:c("criterios")},
      {id:"cronograma", title:"Cronograma de Actividades", content:"Cronograma interpretado para la planificacion de Examen Complexivo.", blocks:[tableBlock(headers, rows, "Cronograma de actividades por fase", "Cronograma cargado en Plani")]},
      {id:"resumen-general", title:"Resumen General", content:c("resumen"), blocks:[tableBlock(faseHeaders, faseRows, "Resumen general por fase", "Clasificacion automatica Plani")]},
      {id:"bibliografia", title:"Bibliografia", content:c("bibliografia")}
    ];
  }

  window.PlaniComplexivoSections = {build:build};
})(window);
