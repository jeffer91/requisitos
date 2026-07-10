/* =========================================================
Nombre completo: carga.reader.xlsx.js
Ruta o ubicación: /Carga/readers/carga.reader.xlsx.js
Función o funciones:
- Cargar la dependencia XLSX instalada localmente por npm.
- Evitar descargar código remoto durante la ejecución.
- Leer la primera hoja de archivos XLSX o XLS.
========================================================= */
(function(window,document){
  "use strict";

  var currentScript=document.currentScript&&document.currentScript.src||document.baseURI;
  var LOCAL_XLSX_URL;
  try{LOCAL_XLSX_URL=new URL("../../node_modules/xlsx/dist/xlsx.full.min.js",currentScript).href;}
  catch(error){LOCAL_XLSX_URL="../node_modules/xlsx/dist/xlsx.full.min.js";}
  var loading=null;

  function ensureXLSX(){
    if(window.XLSX){return Promise.resolve(window.XLSX);}
    if(loading){return loading;}
    loading=new Promise(function(resolve,reject){
      var existing=Array.prototype.slice.call(document.scripts||[]).find(function(script){return script.src===LOCAL_XLSX_URL;});
      if(existing){
        existing.addEventListener("load",function(){window.XLSX?resolve(window.XLSX):reject(new Error("XLSX local no quedó disponible."));},{once:true});
        existing.addEventListener("error",function(){reject(new Error("No se pudo cargar XLSX local. Ejecute npm install."));},{once:true});
        return;
      }
      var script=document.createElement("script");
      script.src=LOCAL_XLSX_URL;
      script.async=true;
      script.setAttribute("data-requisitos-dependency","xlsx@0.18.5");
      script.onload=function(){window.XLSX?resolve(window.XLSX):reject(new Error("XLSX local no quedó disponible."));};
      script.onerror=function(){reject(new Error("No se pudo cargar XLSX local. Ejecute npm install."));};
      document.head.appendChild(script);
    }).catch(function(error){loading=null;throw error;});
    return loading;
  }

  function readArrayBuffer(file){
    return new Promise(function(resolve,reject){
      var reader=new FileReader();
      reader.onload=function(){resolve(reader.result);};
      reader.onerror=function(){reject(reader.error||new Error("No se pudo leer XLSX."));};
      reader.readAsArrayBuffer(file);
    });
  }

  function read(file){
    if(!file){return Promise.reject(new Error("No se recibió archivo XLSX."));}
    return ensureXLSX().then(function(XLSX){
      return readArrayBuffer(file).then(function(buffer){
        var workbook=XLSX.read(buffer,{type:"array"});
        var firstSheet=workbook.SheetNames[0];
        if(!firstSheet){throw new Error("El archivo no contiene hojas.");}
        var sheet=workbook.Sheets[firstSheet];
        var rows=XLSX.utils.sheet_to_json(sheet,{defval:""});
        return {rows:rows,fileName:file.name,origen:"archivo",sheetName:firstSheet};
      });
    });
  }

  window.CargaReaderXLSX={version:"2.0.0-local-dependency",read:read,ensureXLSX:ensureXLSX,dependencyUrl:LOCAL_XLSX_URL};
})(window,document);
