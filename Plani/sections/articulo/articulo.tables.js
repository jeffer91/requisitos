/* =========================================================
Nombre completo: articulo.tables.js
Ruta o ubicacion: /Requisitos/Plani/sections/articulo/articulo.tables.js
Funcion:
- Construir tablas especificas para Articulo Academico.
- Generar tabla de cronograma por fase y resumen por tipo de actividad.
========================================================= */
(function(window){
  "use strict";

  function safeList(value){return Array.isArray(value) ? value : [];}
  function phase(row){return window.PlaniArticuloRules && window.PlaniArticuloRules.phaseOf ? window.PlaniArticuloRules.phaseOf(row) : "General";}

  function cronogramaHeaders(){
    return [
      {key:"fase", label:"Fase"},
      {key:"fecha", label:"Fecha"},
      {key:"actividad", label:"Actividad"},
      {key:"responsable", label:"Responsable"},
      {key:"observacion", label:"Observacion"}
    ];
  }

  function cronogramaRows(mapped){
    return safeList(mapped && mapped.rows).map(function(row){return Object.assign({}, row, {fase:phase(row)});});
  }

  function fasesRows(mapped){
    var acc = {};
    cronogramaRows(mapped).forEach(function(row){acc[row.fase] = (acc[row.fase] || 0) + 1;});
    return Object.keys(acc).map(function(key){return {fase:key, total:acc[key]};});
  }

  function faseHeaders(){return [{key:"fase", label:"Fase"}, {key:"total", label:"Actividades"}];}

  function evaluationHeaders(){return [{key:"criterio", label:"Criterio"}, {key:"descripcion", label:"Descripcion"}, {key:"ponderacion", label:"Ponderacion"}];}

  function evaluationRows(){
    return [
      {criterio:"Articulo academico", descripcion:"Estructura, coherencia, desarrollo metodologico, resultados, referencias y control de originalidad.", ponderacion:"70%"},
      {criterio:"Defensa oral", descripcion:"Exposicion, dominio del tema, respuestas y sustentacion academica.", ponderacion:"30%"}
    ];
  }

  window.PlaniArticuloTables = {cronogramaHeaders:cronogramaHeaders, cronogramaRows:cronogramaRows, fasesRows:fasesRows, faseHeaders:faseHeaders, evaluationHeaders:evaluationHeaders, evaluationRows:evaluationRows};
})(window);
