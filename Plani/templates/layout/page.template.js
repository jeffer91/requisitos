/* =========================================================
Nombre completo: page.template.js
Ruta o ubicacion: /Requisitos/Plani/templates/layout/page.template.js
Funcion:
- Construir el HTML documental completo con estilos base.
- Unificar portada, indice, encabezado, secciones y saltos de pagina.
========================================================= */
(function(window){
  "use strict";

  function safeList(value){return Array.isArray(value) ? value : [];}

  function baseStyles(layout){
    layout = layout || (window.PlaniLayoutConfig && window.PlaniLayoutConfig.get ? window.PlaniLayoutConfig.get() : {});
    var margins = layout.page && layout.page.margins ? layout.page.margins : {top:"2.54cm",right:"2.54cm",bottom:"2.54cm",left:"2.54cm"};
    var typo = window.PlaniTypography && window.PlaniTypography.css ? window.PlaniTypography.css() : "";
    return '<style>' +
      '@page{margin:' + margins.top + ' ' + margins.right + ' ' + margins.bottom + ' ' + margins.left + ';}' +
      typo +
      '.plani-doc-header,.plani-signatures,.plani-doc-table,.plani-index-table{width:100%;border-collapse:collapse;}' +
      '.plani-doc-header td,.plani-signatures th,.plani-signatures td,.plani-doc-table th,.plani-doc-table td{border:1px solid #222;padding:5pt;vertical-align:middle;}' +
      '.plani-doc-header{font-size:9pt;line-height:1.15;margin-bottom:18pt;}' +
      '.plani-doc-logo{width:22%;text-align:center;}' +
      '.plani-doc-unit{text-align:center;font-weight:bold;}' +
      '.plani-doc-title{text-align:center;font-weight:bold;}' +
      '.plani-cover{min-height:22cm;display:flex;flex-direction:column;justify-content:space-between;page-break-after:always;}' +
      '.plani-cover-center{text-align:center;margin-top:7cm;}' +
      '.plani-cover h1{text-transform:uppercase;font-size:18pt;}' +
      '.plani-cover h2{font-size:15pt;}' +
      '.plani-signatures{font-size:10pt;line-height:1.2;}' +
      '.plani-index{page-break-after:always;}' +
      '.plani-index-table td{border:0;border-bottom:1px dotted #888;padding:3pt;}' +
      '.plani-index-table td:last-child{text-align:right;width:60pt;}' +
      '.plani-doc-table th{background:#f1f5f9;text-align:center;font-weight:bold;}' +
      '.plani-caption{font-weight:bold;text-align:left;margin:8pt 0 2pt;}' +
      '.plani-source{font-size:9pt;text-align:left;margin-top:-6pt;}' +
      '.plani-page-break{page-break-before:always;}' +
    '</style>';
  }

  function render(documentModel){
    documentModel = documentModel || {};
    var layout = window.PlaniLayoutConfig && window.PlaniLayoutConfig.build ? window.PlaniLayoutConfig.build(documentModel.layout || {}) : {};
    var html = '<!doctype html><html><head><meta charset="utf-8">' + baseStyles(layout) + '</head><body>';
    if(window.PlaniCoverTemplate){html += window.PlaniCoverTemplate.render(documentModel.cover || documentModel);}
    if(window.PlaniIndexTemplate){html += window.PlaniIndexTemplate.render(documentModel.sections || []);}
    safeList(documentModel.sections).forEach(function(section, index){
      if(window.PlaniHeaderTemplate){html += window.PlaniHeaderTemplate.render(Object.assign({}, documentModel, {page:index + 3, totalPages:documentModel.totalPages || 'Y'}));}
      if(window.PlaniSectionTemplate){html += window.PlaniSectionTemplate.render(section, index + 1);}
    });
    html += '</body></html>';
    return html;
  }

  window.PlaniPageTemplate = {render:render, baseStyles:baseStyles};
})(window);
