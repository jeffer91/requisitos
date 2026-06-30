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
    if(ext === "xlsx" || ext === "xls"){
      if(!window.CargaReaderXLSX){ return Promise.reject(new Error("Lector XLSX no cargado.")); }
      return window.CargaReaderXLSX.read(file);
    }
    return readText(file).then(function(text){
      var rows = ext === "csv" && window.CargaReaderCSV ? window.CargaReaderCSV.parse(text) : window.CargaReaderTXT.parse(text);
      return { rows: rows, fileName: file.name, origen: "archivo" };
    });
  }

  window.CargaReaderFile = { read: read, extension: extension };
})(window);
