/* =========================================================
Nombre completo: signatures.template.js
Ruta o ubicacion: /Requisitos/Plani/templates/layout/signatures.template.js
Funcion:
- Construir la tabla institucional de firmas.
- Centralizar Elaborado por, Revisado por y Aprobado por.
========================================================= */
(function(window){
  "use strict";

  var DEFAULTS = [
    {role:"ELABORADO POR:", name:"MSc, Jefferson Villarreal", cargo:"GESTOR DE PROCESOS ACADEMICOS"},
    {role:"REVISADO POR:", name:"Ing. Martha Tomala", cargo:"COORDINADORA GENERAL DE CARRERAS"},
    {role:"APROBADO POR:", name:"Dr. Alex Leon T.", cargo:"VICERRECTOR"}
  ];

  function text(value){return String(value == null ? "" : value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function list(items){return Array.isArray(items) && items.length ? items : DEFAULTS;}

  function render(items){
    var rows = list(items);
    return '<table class="plani-signatures">' +
      '<thead><tr>' + rows.map(function(x){return '<th>' + esc(x.role) + '</th>';}).join('') + '</tr></thead>' +
      '<tbody>' +
        '<tr>' + rows.map(function(x){return '<td><strong>NOMBRE:</strong> ' + esc(x.name) + '</td>';}).join('') + '</tr>' +
        '<tr>' + rows.map(function(x){return '<td><strong>CARGO:</strong><br>' + esc(x.cargo) + '</td>';}).join('') + '</tr>' +
      '</tbody>' +
    '</table>';
  }

  window.PlaniSignaturesTemplate = {render:render, defaults:function(){return DEFAULTS.slice();}};
})(window);
