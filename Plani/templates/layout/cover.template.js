/* =========================================================
Nombre completo: cover.template.js
Ruta o ubicacion: /Requisitos/Plani/templates/layout/cover.template.js
Funcion:
- Construir la portada institucional de documentos Plani.
- Integrar titulo, periodo y tabla de firmas.
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}

  function render(data){
    data = data || {};
    var title = text(data.title || "Planificacion de Titulacion");
    var period = text(data.periodLabel || "");
    var signatures = window.PlaniSignaturesTemplate && window.PlaniSignaturesTemplate.render ? window.PlaniSignaturesTemplate.render(data.signatures) : "";
    return '<section class="plani-cover">' +
      '<div class="plani-cover-center">' +
        '<h1>' + esc(title) + '</h1>' +
        (period ? '<h2>' + esc(period) + '</h2>' : '') +
      '</div>' +
      '<div class="plani-cover-signatures">' + signatures + '</div>' +
    '</section>';
  }

  window.PlaniCoverTemplate = {render:render};
})(window);
