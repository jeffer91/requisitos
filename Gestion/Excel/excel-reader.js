/* =========================================================
Nombre completo: excel-reader.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-reader.js
Función o funciones:
- Leer archivo Excel/CSV con SheetJS.
- Detectar encabezados, normalizarlos y convertir filas a objetos.
Con qué se conecta:
- excel-xlsx-loader.js
- excel-logic.js
========================================================= */
(function(window){
  "use strict";
  function norm(value){return String(value==null?"":value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"").trim();}
  function text(value){return String(value==null?"":value).trim();}
  function isEmptyRow(row){return !row||row.every(function(c){return text(c)==="";});}
  function scoreHeader(row){var t=row.map(norm).join("|");var score=row.filter(function(c){return text(c);}).length;if(t.indexOf("numeroidentificacion")>=0||t.indexOf("cedula")>=0)score+=8;if(t.indexOf("nombres")>=0)score+=5;if(t.indexOf("nombrecarrera")>=0||t.indexOf("carrera")>=0)score+=5;return score;}
  function headerIndex(matrix){var best=0,bestScore=-1;(matrix||[]).slice(0,15).forEach(function(row,i){var s=scoreHeader(row||[]);if(s>bestScore){bestScore=s;best=i;}});return best;}
  function canonical(header){var Constants=window.ExcelConstants||{};var aliases=Constants.FIELD_ALIASES||{};var k=norm(header);var found=Object.keys(aliases).find(function(target){return (aliases[target]||[]).some(function(a){return norm(a)===k;});});return found||k||"columna";}
  async function readFile(file){
    if(!file)throw new Error("Selecciona un archivo Excel.");
    if(window.ExcelXlsxLoader)await window.ExcelXlsxLoader.ensureXLSX();
    if(!window.XLSX)throw new Error("XLSX no está disponible.");
    var buffer=await file.arrayBuffer();
    var wb=window.XLSX.read(buffer,{type:"array",cellDates:false,raw:false});
    var sheetName=wb.SheetNames[0];
    if(!sheetName)throw new Error("El archivo no contiene hojas.");
    var ws=wb.Sheets[sheetName];
    var matrix=window.XLSX.utils.sheet_to_json(ws,{header:1,defval:"",blankrows:false,raw:false});
    matrix=(matrix||[]).filter(function(r){return !isEmptyRow(r);});
    var hi=headerIndex(matrix);var rawHeaders=matrix[hi]||[];var headers=rawHeaders.map(canonical);
    var rows=matrix.slice(hi+1).filter(function(r){return !isEmptyRow(r);}).map(function(row,idx){var obj={__rowIndex:hi+idx+2,__sheetName:sheetName};headers.forEach(function(h,i){obj[h]=text(row[i]);});return obj;});
    return {ok:true,fileName:file.name,sheetName:sheetName,headerRowIndex:hi+1,headers:headers,rawHeaders:rawHeaders,rows:rows,totalRows:rows.length};
  }
  window.ExcelReader={readFile:readFile,norm:norm,canonical:canonical};
})(window);
