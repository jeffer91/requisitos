/* =========================================================
Nombre completo: excel-estados.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-estados.js
Función o funciones:
- Normalizar valores de cumplimiento de requisitos.
- Determinar si una celda representa cumple, no cumple o pendiente.
Con qué se conecta:
- excel-logic.js
========================================================= */
(function(window){
  "use strict";
  function key(value){return String(value==null?"":value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();}
  function normalize(value){
    var k=key(value);
    if(!k)return "PENDIENTE";
    if(["si","sí","s","ok","cumple","aprobado","aprobada","1","true","x","validado","completo"].indexOf(k)>=0)return "CUMPLE";
    if(["no","n","no cumple","reprobado","reprobada","0","false","pendiente","falta","incompleto"].indexOf(k)>=0)return k==="pendiente"?"PENDIENTE":"NO_CUMPLE";
    return "PENDIENTE";
  }
  function cumple(value){return normalize(value)==="CUMPLE";}
  function noCumple(value){return normalize(value)==="NO_CUMPLE";}
  window.ExcelEstados={key:key,normalize:normalize,cumple:cumple,noCumple:noCumple};
})(window);
