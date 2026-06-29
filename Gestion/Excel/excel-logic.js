/* =========================================================
Nombre completo: excel-logic.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-logic.js
Función o funciones:
- Validar esquema del Excel cargado.
- Analizar duplicados, filas válidas y resumen por requisito/carrera.
Con qué se conecta:
- excel-constants.js
- excel-estados.js
- excel-resumen.logic.js
========================================================= */
(function(window){
  "use strict";
  function arr(v){return Array.isArray(v)?v:[];}
  function n(v){return Number(v||0);}
  function key(v){return String(v==null?"":v).trim();}
  function validateSchema(headers){
    var C=window.ExcelConstants||{};var h=arr(headers);var present=new Set(h);
    var missing=arr(C.EXPECTED_HEADERS).filter(function(x){return !present.has(x);});
    var criticalMissing=arr(C.CRITICAL_HEADERS).filter(function(x){return !present.has(x);});
    var extra=h.filter(function(x){return arr(C.EXPECTED_HEADERS).indexOf(x)<0;});
    return {ok:criticalMissing.length===0,missing:missing,extra:extra,criticalMissing:criticalMissing,expected:arr(C.EXPECTED_HEADERS)};
  }
  function analizarFilas(rows){
    var seen={};var duplicados=0;var sinId=0;var validas=0;
    arr(rows).forEach(function(r){var id=key(r.numeroidentificacion);if(!id){sinId++;return;}validas++;if(seen[id])duplicados++;seen[id]=true;});
    return {totalFilas:arr(rows).length,validas:validas,duplicados:duplicados,sinId:sinId};
  }
  function consolidar(rows){
    var C=window.ExcelConstants||{};var E=window.ExcelEstados||{};var reqs={};var carreras={};
    arr(C.REQUISITOS).forEach(function(r){reqs[r]={cumple:0,noCumple:0,pendiente:0,porcentaje:0};});
    arr(rows).forEach(function(row){
      var carrera=key(row.nombrecarrera)||"SIN CARRERA";if(!carreras[carrera])carreras[carrera]={total:0,cumple:0,noCumple:0,pendiente:0,porcentaje:0};carreras[carrera].total++;
      var okAll=true;
      arr(C.REQUISITOS).forEach(function(req){var estado=E.normalize?E.normalize(row[req]):"PENDIENTE";if(estado==="CUMPLE")reqs[req].cumple++;else if(estado==="NO_CUMPLE"){reqs[req].noCumple++;okAll=false;}else{reqs[req].pendiente++;okAll=false;}});
      if(okAll)carreras[carrera].cumple++;else carreras[carrera].noCumple++;
    });
    Object.keys(reqs).forEach(function(k){var r=reqs[k];var total=r.cumple+r.noCumple+r.pendiente;r.porcentaje=total?Math.round((r.cumple*10000)/total)/100:0;});
    Object.keys(carreras).forEach(function(k){var c=carreras[k];c.porcentaje=c.total?Math.round((c.cumple*10000)/c.total)/100:0;});
    return {totalEstudiantes:arr(rows).length,requisitos:reqs,carreras:carreras};
  }
  function procesar(readResult){
    var headers=arr(readResult&&readResult.headers);var rows=arr(readResult&&readResult.rows);
    return {schema:validateSchema(headers),analisis:analizarFilas(rows),consolidado:consolidar(rows),rows:rows,headers:headers,fileName:key(readResult&&readResult.fileName)};
  }
  window.ExcelLogic={validateSchema:validateSchema,analizarFilas:analizarFilas,consolidar:consolidar,procesar:procesar};
})(window);
