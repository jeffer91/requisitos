/* =========================================================
Nombre completo: plani.cronograma.mapper.js
Ruta o ubicacion: /Requisitos/Plani/core/plani.cronograma.mapper.js
Funcion:
- Mapear filas de cronograma hacia secciones documentales.
- Separar cronograma general, actividades ordinarias y actividades supletorias.
- Preparar datos para tablas institucionales del documento final.
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();}
  function safeList(value){return Array.isArray(value) ? value : [];}

  function classifyRow(row){
    var s = norm([row.actividad,row.observacion,row.responsable].join(" "));
    if(s.indexOf("supletorio") >= 0){return "SUPLETORIO";}
    if(s.indexOf("defensa") >= 0){return "DEFENSA";}
    if(s.indexOf("induccion") >= 0){return "INDUCCION";}
    if(s.indexOf("metodologia") >= 0 || s.indexOf("seminario") >= 0){return "METODOLOGIA";}
    if(s.indexOf("evaluacion") >= 0 || s.indexOf("rubrica") >= 0 || s.indexOf("calificacion") >= 0){return "EVALUACION";}
    if(s.indexOf("entrega") >= 0){return "ENTREGA";}
    return "GENERAL";
  }

  function mapRows(parsed, documentType){
    var rows = safeList(parsed && parsed.rows).map(function(row){
      return Object.assign({}, row, {tipo:classifyRow(row), documento:text(documentType)});
    });
    var groups = rows.reduce(function(acc,row){
      acc[row.tipo] = acc[row.tipo] || [];
      acc[row.tipo].push(row);
      return acc;
    },{});
    return {
      ok:rows.length > 0,
      documentType:text(documentType),
      rows:rows,
      groups:groups,
      summary:Object.keys(groups).map(function(key){return {tipo:key,total:groups[key].length};}),
      generatedAt:new Date().toISOString()
    };
  }

  function tableHeaders(){
    return [
      {key:"fecha", label:"Fecha"},
      {key:"actividad", label:"Actividad"},
      {key:"responsable", label:"Responsable"},
      {key:"observacion", label:"Observacion"}
    ];
  }

  window.PlaniCronogramaMapper = {mapRows:mapRows, classifyRow:classifyRow, tableHeaders:tableHeaders};
})(window);
