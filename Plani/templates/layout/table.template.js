/* =========================================================
Nombre completo: table.template.js
Ruta o ubicacion: /Requisitos/Plani/templates/layout/table.template.js
Funcion:
- Construir tablas institucionales reutilizables.
- Usar una sola estructura para cronogramas, resumenes y controles.
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function safeList(value){return Array.isArray(value) ? value : [];}

  function render(headers, rows, options){
    headers = safeList(headers);
    rows = safeList(rows);
    options = options || {};
    var html = options.caption ? '<p class="plani-caption">' + esc(options.caption) + '</p>' : '';
    html += '<table class="plani-doc-table"><thead><tr>';
    html += headers.map(function(h){return '<th>' + esc(h.label || h.key || '') + '</th>';}).join('');
    html += '</tr></thead><tbody>';
    if(!rows.length){
      html += '<tr><td colspan="' + Math.max(headers.length, 1) + '">Sin registros.</td></tr>';
    }else{
      html += rows.map(function(row){
        return '<tr>' + headers.map(function(h){
          var value = typeof h.value === 'function' ? h.value(row) : row[h.key];
          return '<td>' + esc(value == null || value === '' ? '—' : value) + '</td>';
        }).join('') + '</tr>';
      }).join('');
    }
    html += '</tbody></table>';
    if(options.source){html += '<p class="plani-source">Fuente: ' + esc(options.source) + '</p>';}
    return html;
  }

  window.PlaniTableTemplate = {render:render};
})(window);
