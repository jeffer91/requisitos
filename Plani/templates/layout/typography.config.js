/* =========================================================
Nombre completo: typography.config.js
Ruta o ubicacion: /Requisitos/Plani/templates/layout/typography.config.js
Funcion:
- Centralizar fuentes, tamanos, interlineado y estilos documentales.
- Evitar que Word, PDF y HTML tengan formatos separados.
========================================================= */
(function(window){
  "use strict";

  var TYPOGRAPHY = {
    fontFamily:"Times New Roman, serif",
    body:{fontSize:"12pt", lineHeight:"2", align:"justify"},
    title:{fontSize:"18pt", lineHeight:"1.2", align:"center", weight:"bold"},
    heading1:{fontSize:"14pt", lineHeight:"1.35", weight:"bold", transform:"uppercase"},
    heading2:{fontSize:"12pt", lineHeight:"1.35", weight:"bold"},
    heading3:{fontSize:"12pt", lineHeight:"1.35", weight:"bold"},
    header:{fontSize:"9pt", lineHeight:"1.15", weight:"bold"},
    table:{fontSize:"10pt", lineHeight:"1.25"},
    small:{fontSize:"9pt", lineHeight:"1.2"}
  };

  function clone(value){return JSON.parse(JSON.stringify(value == null ? null : value));}
  function get(){return clone(TYPOGRAPHY);}

  function css(){
    var t = TYPOGRAPHY;
    return [
      "body{font-family:" + t.fontFamily + ";font-size:" + t.body.fontSize + ";line-height:" + t.body.lineHeight + ";}",
      "p{text-align:" + t.body.align + ";margin:0 0 10pt;}",
      "h1{font-size:" + t.title.fontSize + ";text-align:" + t.title.align + ";font-weight:" + t.title.weight + ";}",
      "h2{font-size:" + t.heading1.fontSize + ";font-weight:" + t.heading1.weight + ";text-transform:" + t.heading1.transform + ";}",
      "h3{font-size:" + t.heading2.fontSize + ";font-weight:" + t.heading2.weight + ";}",
      "table{font-size:" + t.table.fontSize + ";line-height:" + t.table.lineHeight + ";}"
    ].join("\n");
  }

  window.PlaniTypography = {get:get, css:css};
})(window);
