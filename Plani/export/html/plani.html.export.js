/* =========================================================
Nombre completo: plani.html.export.js
Ruta o ubicacion: /Requisitos/Plani/export/html/plani.html.export.js
Funcion:
- Generar HTML institucional completo desde el modelo documental Plani.
- Usar PlaniPageTemplate como fuente unica para Word y PDF.
========================================================= */
(function(window){
  "use strict";

  function assertModel(model){
    if(!model || !model.ok){throw new Error("No existe modelo documental Plani para exportar.");}
    if(!window.PlaniPageTemplate || typeof window.PlaniPageTemplate.render !== "function"){
      throw new Error("PlaniPageTemplate no esta disponible.");
    }
  }

  function buildHtml(model){
    assertModel(model);
    var html = window.PlaniPageTemplate.render(model);
    if(window.PlaniExportStyles && window.PlaniExportStyles.inject){
      html = window.PlaniExportStyles.inject(html);
    }
    return html;
  }

  function download(model){
    var html = buildHtml(model);
    var filename = window.PlaniExportFilename ? window.PlaniExportFilename.build(model, "html") : "plani.html";
    return window.PlaniExportHelpers.downloadText(filename, html, "text/html;charset=utf-8");
  }

  window.PlaniHtmlExport = {buildHtml:buildHtml, download:download};
})(window);
