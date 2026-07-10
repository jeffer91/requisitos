/* =========================================================
Nombre completo: plani.word.export.js
Ruta o ubicacion: /Requisitos/Plani/export/word/plani.word.export.js
Funcion:
- Exportar el modelo documental Plani como archivo Word compatible .doc.
- Reutilizar el mismo HTML institucional del exportador HTML.
========================================================= */
(function(window){
  "use strict";

  function build(model){
    if(!window.PlaniHtmlExport || !window.PlaniHtmlExport.buildHtml){
      throw new Error("PlaniHtmlExport no esta disponible.");
    }
    var html = window.PlaniHtmlExport.buildHtml(model);
    return '\ufeff' + html;
  }

  function download(model){
    var content = build(model);
    var filename = window.PlaniExportFilename ? window.PlaniExportFilename.build(model, "doc") : "plani.doc";
    return window.PlaniExportHelpers.downloadText(filename, content, "application/msword;charset=utf-8");
  }

  window.PlaniWordExport = {build:build, download:download};
})(window);
