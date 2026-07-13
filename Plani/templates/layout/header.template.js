/* =========================================================
Nombre completo: header.template.js
Ruta o ubicacion: /Requisitos/Plani/templates/layout/header.template.js
Funcion:
- Construir el encabezado institucional para documentos Plani.
- Usar una sola fuente para codigo, version, fecha, titulo y pagina.
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function config(overrides){
    return window.PlaniLayoutConfig && window.PlaniLayoutConfig.build ? window.PlaniLayoutConfig.build(overrides || {}) : (overrides || {});
  }

  function render(data){
    data = data || {};
    var cfg = config(data.layout || {});
    var title = text(data.title || cfg.document.defaultTitle);
    var code = text(data.code || cfg.document.defaultCode);
    var version = text(data.version || cfg.control.version);
    var date = text(data.elaborationDate || cfg.control.elaborationDate);
    var page = text(data.page || "1");
    var total = text(data.totalPages || "Y");
    return '<table class="plani-doc-header">' +
      '<tr>' +
        '<td class="plani-doc-logo" rowspan="4">' + esc(data.logoText || '') + '</td>' +
        '<td class="plani-doc-unit" rowspan="2">' + esc(cfg.institution.unit) + '</td>' +
        '<td><strong>Codigo:</strong><br>' + esc(code) + '</td>' +
      '</tr>' +
      '<tr><td><strong>Version:</strong> ' + esc(version) + '</td></tr>' +
      '<tr>' +
        '<td class="plani-doc-title" rowspan="2">' + esc(title) + '</td>' +
        '<td><strong>Fecha de Elaboracion:</strong><br>' + esc(date) + '</td>' +
      '</tr>' +
      '<tr><td>' + esc(cfg.control.pageLabel) + ' ' + esc(page) + ' de ' + esc(total) + '</td></tr>' +
    '</table>';
  }

  window.PlaniHeaderTemplate = {render:render};
})(window);
