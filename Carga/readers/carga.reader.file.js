(function(window){
  "use strict";

  function extension(fileName){
    return String(fileName || "").split(".").pop().toLowerCase();
  }

  function readText(file){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(){ resolve(String(reader.result || "")); };
      reader.onerror = function(){ reject(reader.error || new Error("No se pudo leer el archivo.")); };
      reader.readAsText(file);
    });
  }

  function read(file){
    if(!file){ return Promise.reject(new Error("No se recibió archivo.")); }
    var ext = extension(file.name);

    if(ext === "xlsx"){
      if(!window.CargaReaderXLSX){ return Promise.reject(new Error("Lector XLSX no cargado.")); }
      return window.CargaReaderXLSX.read(file);
    }

    if(ext === "xls"){
      return readText(file).then(function(text){
        if(window.CargaReaderHTML && window.CargaReaderHTML.looksHtml(text)){
          return { rows: window.CargaReaderHTML.parse(text), fileName: file.name, origen: "html_excel_viejo", detectedType: "html" };
        }
        if(window.CargaReaderXLSX){
          return window.CargaReaderXLSX.read(file).catch(function(){
            var rows = window.CargaReaderCSV ? window.CargaReaderCSV.parse(text) : window.CargaReaderTXT.parse(text);
            return { rows: rows, fileName: file.name, origen: "archivo_xls_texto", detectedType: "texto" };
          });
        }
        var rows = window.CargaReaderCSV ? window.CargaReaderCSV.parse(text) : window.CargaReaderTXT.parse(text);
        return { rows: rows, fileName: file.name, origen: "archivo_xls_texto", detectedType: "texto" };
      });
    }

    return readText(file).then(function(text){
      if(window.CargaReaderHTML && window.CargaReaderHTML.looksHtml(text)){
        return { rows: window.CargaReaderHTML.parse(text), fileName: file.name, origen: "html_excel_viejo", detectedType: "html" };
      }
      var rows = ext === "csv" && window.CargaReaderCSV ? window.CargaReaderCSV.parse(text) : window.CargaReaderTXT.parse(text);
      return { rows: rows, fileName: file.name, origen: "archivo", detectedType: ext || "texto" };
    });
  }

  window.CargaReaderFile = { read: read, extension: extension, readText: readText };
})(window);