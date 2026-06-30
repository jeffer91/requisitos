(function(window, document){
  "use strict";

  var CDN = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
  var loading = null;

  function ensureXLSX(){
    if(window.XLSX){ return Promise.resolve(window.XLSX); }
    if(loading){ return loading; }
    loading = new Promise(function(resolve, reject){
      var script = document.createElement("script");
      script.src = CDN;
      script.async = true;
      script.onload = function(){ window.XLSX ? resolve(window.XLSX) : reject(new Error("La librería XLSX no quedó disponible.")); };
      script.onerror = function(){ reject(new Error("No se pudo cargar la librería XLSX.")); };
      document.head.appendChild(script);
    });
    return loading;
  }

  function readArrayBuffer(file){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(){ resolve(reader.result); };
      reader.onerror = function(){ reject(reader.error || new Error("No se pudo leer XLSX.")); };
      reader.readAsArrayBuffer(file);
    });
  }

  function read(file){
    return ensureXLSX().then(function(XLSX){
      return readArrayBuffer(file).then(function(buffer){
        var workbook = XLSX.read(buffer, { type: "array" });
        var firstSheet = workbook.SheetNames[0];
        var sheet = workbook.Sheets[firstSheet];
        var rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        return { rows: rows, fileName: file.name, origen: "archivo", sheetName: firstSheet };
      });
    });
  }

  window.CargaReaderXLSX = { read: read, ensureXLSX: ensureXLSX };
})(window, document);
