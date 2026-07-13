/* =========================================================
Nombre completo: complexivo.tables.js
Ruta o ubicacion: /Requisitos/Plani/sections/complexivo/complexivo.tables.js
Funcion:
- Construir tablas especificas para Examen Complexivo.
- Generar tabla de cronograma por fase y resumen por tipo de actividad.
========================================================= */
(function(window){
  "use strict";

  function safeList(value){return Array.isArray(value) ? value : [];}
  function phase(row){return window.PlaniComplexivoRules && window.PlaniComplexivoRules.phaseOf ? window.PlaniComplexivoRules.phaseOf(row) : "General";}

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
    return safeList(mapped && mapped.rows).map(function(row){
      return Object.assign({}, row, {fase:phase(row)});
    });
  }

  function fasesRows(mapped){
    var acc = {};
    cronogramaRows(mapped).forEach(function(row){
      acc[row.fase] = (acc[row.fase] || 0) + 1;
    });
    return Object.keys(acc).map(function(key){return {fase:key, total:acc[key]};});
  }

  function faseHeaders(){
    return [{key:"fase", label:"Fase"}, {key:"total", label:"Actividades"}];
  }

  window.PlaniComplexivoTables = {cronogramaHeaders:cronogramaHeaders, cronogramaRows:cronogramaRows, fasesRows:fasesRows, faseHeaders:faseHeaders};
})(window);
