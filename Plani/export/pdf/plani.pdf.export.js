/* =========================================================
Nombre completo: plani.pdf.export.js
Ruta o ubicacion: /Requisitos/Plani/export/pdf/plani.pdf.export.js
Funcion:
- Abrir vista imprimible del documento Plani para guardar como PDF.
- Reutilizar el mismo HTML institucional del exportador HTML.
========================================================= */
(function(window){
  "use strict";

  function print(model){
    if(!window.PlaniHtmlExport || !window.PlaniHtmlExport.buildHtml){
      throw new Error("PlaniHtmlExport no esta disponible.");
    }
    var html = window.PlaniHtmlExport.buildHtml(model);
    var title = model && model.title ? model.title : "Plani";
    return window.PlaniExportHelpers.printHtml(html, title);
  }

  window.PlaniPdfExport = {print:print};
})(window);
