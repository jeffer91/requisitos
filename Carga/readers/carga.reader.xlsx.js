/* =========================================================
Nombre completo: carga.reader.xlsx.js
Ruta o ubicación: /Carga/readers/carga.reader.xlsx.js
Función o funciones:
- Cargar SheetJS 0.20.3 instalado localmente.
- Limitar tamaño, filas y columnas del archivo.
- Bloquear claves peligrosas de contaminación de prototipos.
- Leer la primera hoja de archivos XLSX o XLS.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="3.0.0-secure-local-sheetjs";
  var MAX_FILE_BYTES=15*1024*1024;
  var MAX_ROWS=50000;
  var MAX_COLUMNS=500;
  var MAX_CELL_LENGTH=50000;
  var currentScript=document.currentScript&&document.currentScript.src||document.baseURI;
  var LOCAL_XLSX_URL;
  try{LOCAL_XLSX_URL=new URL("../../node_modules/xlsx/dist/xlsx.full.min.js",currentScript).href;}
  catch(error){LOCAL_XLSX_URL="../node_modules/xlsx/dist/xlsx.full.min.js";}
  var loading=null;

  function text(value){return String(value==null?"":value).trim();}
  function safeKey(key){key=text(key);return key!=="__proto__"&&key!=="prototype"&&key!=="constructor";}
  function safeCell(value){
    if(value==null){return "";}
    if(value instanceof Date){return value.toISOString();}
    if(typeof value==="object"){try{return JSON.stringify(value).slice(0,MAX_CELL_LENGTH);}catch(error){return "";}}
    return String(value).slice(0,MAX_CELL_LENGTH);
  }
  function sanitizeRows(rows){
    rows=Array.isArray(rows)?rows:[];
    if(rows.length>MAX_ROWS){throw new Error("El archivo supera el máximo de "+MAX_ROWS+" filas.");}
    return rows.map(function(row){
      var output=Object.create(null);
      Object.keys(row||{}).slice(0,MAX_COLUMNS).forEach(function(key){if(safeKey(key)){output[text(key).slice(0,300)]=safeCell(row[key]);}});
      return output;
    });
  }

  function ensureXLSX(){
    if(window.XLSX){return Promise.resolve(window.XLSX);}
    if(loading){return loading;}
    loading=new Promise(function(resolve,reject){
      var existing=Array.prototype.slice.call(document.scripts||[]).find(function(script){return script.src===LOCAL_XLSX_URL;});
      if(existing){
        existing.addEventListener("load",function(){window.XLSX?resolve(window.XLSX):reject(new Error("SheetJS local no quedó disponible."));},{once:true});
        existing.addEventListener("error",function(){reject(new Error("No se pudo cargar SheetJS local. Ejecute npm install."));},{once:true});
        return;
      }
      var script=document.createElement("script");
      script.src=LOCAL_XLSX_URL;
      script.async=true;
      script.setAttribute("data-requisitos-dependency","sheetjs@0.20.3");
      script.onload=function(){window.XLSX?resolve(window.XLSX):reject(new Error("SheetJS local no quedó disponible."));};
      script.onerror=function(){reject(new Error("No se pudo cargar SheetJS local. Ejecute npm install."));};
      document.head.appendChild(script);
    }).catch(function(error){loading=null;throw error;});
    return loading;
  }

  function readArrayBuffer(file){
    if(!file){return Promise.reject(new Error("No se recibió archivo XLSX."));}
    if(Number(file.size||0)>MAX_FILE_BYTES){return Promise.reject(new Error("El archivo supera el máximo permitido de 15 MB."));}
    return new Promise(function(resolve,reject){
      var reader=new FileReader();
      reader.onload=function(){resolve(reader.result);};
      reader.onerror=function(){reject(reader.error||new Error("No se pudo leer XLSX."));};
      reader.readAsArrayBuffer(file);
    });
  }

  function read(file){
    return ensureXLSX().then(function(XLSX){
      return readArrayBuffer(file).then(function(buffer){
        var workbook=XLSX.read(buffer,{type:"array",cellFormula:false,cellHTML:false,cellStyles:false,bookVBA:false,bookDeps:false,sheetRows:MAX_ROWS+1});
        var firstSheet=workbook.SheetNames[0];
        if(!firstSheet){throw new Error("El archivo no contiene hojas.");}
        var sheet=workbook.Sheets[firstSheet];
        var rows=sanitizeRows(XLSX.utils.sheet_to_json(sheet,{defval:"",raw:false,blankrows:false}).slice(0,MAX_ROWS));
        return {rows:rows,fileName:file.name,origen:"archivo",sheetName:firstSheet};
      });
    });
  }

  window.CargaReaderXLSX={version:VERSION,read:read,ensureXLSX:ensureXLSX,dependencyUrl:LOCAL_XLSX_URL,limits:{maxFileBytes:MAX_FILE_BYTES,maxRows:MAX_ROWS,maxColumns:MAX_COLUMNS,maxCellLength:MAX_CELL_LENGTH}};
})(window,document);
