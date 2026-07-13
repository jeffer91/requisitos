/* =========================================================
Nombre completo: plani.export.styles.js
Ruta o ubicacion: /Requisitos/Plani/export/shared/plani.export.styles.js
Funcion:
- Centralizar estilos adicionales para exportacion Plani.
- Complementar los estilos generados por PlaniPageTemplate.
========================================================= */
(function(window){
  "use strict";

  function css(){
    return '<style>' +
      'body{background:#fff;color:#111;}' +
      '.plani-doc-section{margin-bottom:18pt;}' +
      '.plani-doc-section h2{margin:14pt 0 8pt;}' +
      '.plani-doc-figure{text-align:center;margin:12pt 0;}' +
      '.plani-doc-figure img{max-width:100%;height:auto;}' +
      '.plani-doc-figure figcaption{font-size:9pt;margin-top:4pt;}' +
      '.plani-chart-placeholder{border:1px dashed #777;padding:10pt;margin:8pt 0;text-align:center;}' +
      '.plani-export-note{font-size:9pt;color:#555;text-align:left;}' +
    '</style>';
  }

  function inject(html){
    html = String(html || "");
    return html.replace("</head>", css() + "</head>");
  }

  window.PlaniExportStyles = {css:css, inject:inject};
})(window);
