/* =========================================================
Nombre completo: index.template.js
Ruta o ubicacion: /Requisitos/Plani/templates/layout/index.template.js
Funcion:
- Construir indice automatico base a partir de secciones.
- Mantener numeracion y rotulos en un solo archivo.
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function safeList(value){return Array.isArray(value) ? value : [];}

  function flatten(sections, prefix){
    var out = [];
    safeList(sections).forEach(function(section, index){
      var number = prefix ? prefix + "." + (index + 1) : String(index + 1);
      out.push({number:number, title:section.title || section.label || section.id || "Seccion", page:section.page || ""});
      if(section.children && section.children.length){
        out = out.concat(flatten(section.children, number));
      }
    });
    return out;
  }

  function render(sections){
    var rows = flatten(sections || [], "");
    var html = '<section class="plani-index"><h2>Indice</h2>';
    if(!rows.length){return html + '<p>Indice pendiente de secciones.</p></section>';}
    html += '<table class="plani-index-table"><tbody>';
    html += rows.map(function(row){return '<tr><td>' + esc(row.number + '. ' + row.title) + '</td><td>' + esc(row.page || '') + '</td></tr>';}).join('');
    html += '</tbody></table></section>';
    return html;
  }

  window.PlaniIndexTemplate = {render:render, flatten:flatten};
})(window);
