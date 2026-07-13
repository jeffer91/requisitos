/* =========================================================
Nombre completo: plani.export.filename.js
Ruta o ubicacion: /Requisitos/Plani/export/shared/plani.export.filename.js
Funcion:
- Generar nombres de archivo para exportaciones Plani.
- Evitar nombres con caracteres problematicos.
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function clean(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "plani";
  }

  function build(model, extension){
    model = model || {};
    var type = clean(model.documentType || "planificacion");
    var period = clean(model.periodLabel || model.periodId || "periodo");
    var ext = text(extension || "html").replace(/^\./, "");
    return "PLANI-" + type + "-" + period + "." + ext;
  }

  window.PlaniExportFilename = {build:build, clean:clean};
})(window);
