/* =========================================================
Nombre completo: carga.reader.xlsx.js
Ruta o ubicación: /Carga/readers/carga.reader.xlsx.js
Función o funciones:
- Cargar SheetJS 0.20.3 instalado localmente.
- Leer todas las filas y columnas de la primera hoja.
- Mantener la interfaz activa durante la limpieza de archivos grandes.
- Bloquear únicamente claves peligrosas de contaminación de prototipos.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="4.0.0-full-progress";
  var SANITIZE_CHUNK=1000;
  var currentScript=document.currentScript&&document.currentScript.src||document.baseURI;
  var LOCAL_XLSX_URL;
  try{LOCAL_XLSX_URL=new URL("../../node_modules/xlsx/dist/xlsx.full.min.js",currentScript).href;}
  catch(error){LOCAL_XLSX_URL="../node_modules/xlsx/dist/xlsx.full.min.js";}
  var loading=null;

  function text(value){return String(value==null?"":value).trim();}
  function emit(percent,message){
    try{window.dispatchEvent(new CustomEvent("carga:progress",{detail:{percent:Math.max(0,Math.min(100,Number(percent)||0)),message:message||"Procesando Excel",phase:"reading"}}));}catch(error){}
  }
  function yieldUI(){return new Promise(function(resolve){window.setTimeout(resolve,0);});}
  function safeKey(key){
    key=text(key);var lower=key.toLowerCase();
    return !!key&&lower!=="__proto__"&&lower!=="prototype"&&lower!=="constructor";
  }
  function safeCell(value){
    if(value==null){return "";}
    if(value instanceof Date){return value.toISOString();}
    if(typeof value==="object"){try{return JSON.stringify(value);}catch(error){return String(value);}}
    return String(value);
  }
  function sanitizeRows(rows){
    rows=Array.isArray(rows)?rows:[];
    var output=new Array(rows.length),index=0;
    return new Promise(function(resolve,reject){
      function step(){
        try{
          var end=Math.min(rows.length,index+SANITIZE_CHUNK);
          for(;index<end;index+=1){
            var row=rows[index]||{};
            var clean=Object.create(null);
            Object.keys(row).forEach(function(key){if(safeKey(key)){clean[text(key)]=safeCell(row[key]);}});
            output[index]=clean;
          }
          emit(82+(index/Math.max(1,rows.length))*16,"Preparando "+index+" de "+rows.length+" filas");
          if(index<rows.length){window.setTimeout(step,0);}else{resolve(output);}
        }catch(error){reject(error);}
      }
      step();
    });
  }

  function ensureXLSX(){
    if(window.XLSX){return Promise.resolve(window.XLSX);}
    if(loading){return loading;}
    loading=new Promise(function(resolve,reject){
      var existing=Array.prototype.slice.call(document.scripts||[]).find(function(script){return script.src===LOCAL_XLSX_URL;});
      if(existing){
        if(window.XLSX){resolve(window.XLSX);return;}
        existing.addEventListener("load",function(){window.XLSX?resolve(window.XLSX):reject(new Error("SheetJS local no quedó disponible."));},{once:true});
        existing.addEventListener("error",function(){reject(new Error("No se pudo cargar SheetJS local. Ejecute npm install."));},{once:true});
        return;
      }
      var script=document.createElement("script");
      script.src=LOCAL_XLSX_URL;script.async=true;script.setAttribute("data-requisitos-dependency","sheetjs@0.20.3");
      script.onload=function(){window.XLSX?resolve(window.XLSX):reject(new Error("SheetJS local no quedó disponible."));};
      script.onerror=function(){reject(new Error("No se pudo cargar SheetJS local. Ejecute npm install."));};
      document.head.appendChild(script);
    }).catch(function(error){loading=null;throw error;});
    return loading;
  }

  function readArrayBuffer(file){
    if(!file){return Promise.reject(new Error("No se recibió archivo XLSX."));}
    return new Promise(function(resolve,reject){
      var reader=new FileReader();
      reader.onprogress=function(event){
        if(event.lengthComputable){emit(5+(event.loaded/Math.max(1,event.total))*40,"Leyendo archivo: "+Math.round(event.loaded/1048576)+" MB");}
      };
      reader.onload=function(){emit(46,"Archivo leído. Preparando Excel...");resolve(reader.result);};
      reader.onerror=function(){reject(reader.error||new Error("No se pudo leer XLSX."));};
      reader.readAsArrayBuffer(file);
    });
  }

  function read(file){
    emit(1,"Preparando lector de Excel...");
    return ensureXLSX().then(function(XLSX){
      return readArrayBuffer(file).then(function(buffer){
        emit(50,"Interpretando libro de Excel...");
        return yieldUI().then(function(){
          var workbook=XLSX.read(buffer,{type:"array",cellFormula:false,cellHTML:false,cellStyles:false,bookVBA:false,bookDeps:false,dense:false});
          var firstSheet=workbook.SheetNames[0];
          if(!firstSheet){throw new Error("El archivo no contiene hojas.");}
          emit(68,"Convirtiendo la hoja "+firstSheet+"...");
          return yieldUI().then(function(){
            var sheet=workbook.Sheets[firstSheet];
            var rows=XLSX.utils.sheet_to_json(sheet,{defval:"",raw:false,blankrows:false});
            emit(80,"Excel convertido: "+rows.length+" filas");
            return sanitizeRows(rows).then(function(cleanRows){
              emit(100,"Excel leído completamente: "+cleanRows.length+" filas");
              return {rows:cleanRows,fileName:file.name,origen:"archivo",detectedType:"xlsx",sheetName:firstSheet,totalRows:cleanRows.length,totalSheets:workbook.SheetNames.length,warnings:[]};
            });
          });
        });
      });
    });
  }

  window.CargaReaderXLSX={version:VERSION,read:read,ensureXLSX:ensureXLSX,dependencyUrl:LOCAL_XLSX_URL,limits:{maxFileBytes:null,maxRows:null,maxColumns:null,maxCellLength:null},safeKey:safeKey};
})(window,document);
