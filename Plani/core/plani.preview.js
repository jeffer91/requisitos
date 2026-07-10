/* =========================================================
Nombre completo: plani.preview.js
Ruta o ubicacion: /Requisitos/Plani/core/plani.preview.js
Funcion:
- Crear una vista previa HTML ligera del modelo documental.
- Mostrar portada, indice, secciones y cronograma sin exportar todavia.
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function safeList(value){return Array.isArray(value) ? value : [];}

  function sectionCard(section){
    section = section || {};
    var html = '<article class="plani-preview-section">';
    html += '<h3>' + esc((section.number ? section.number + '. ' : '') + (section.title || section.label || section.id || 'Seccion')) + '</h3>';
    if(section.content){html += '<p>' + esc(section.content).slice(0,500) + '</p>';}
    if(section.blocks && section.blocks.length){html += '<small>' + section.blocks.length + ' bloque(s) interno(s)</small>';}
    html += '</article>';
    return html;
  }

  function render(model){
    if(!model || !model.ok){return '<div class="plani-empty">Documento interno no construido.</div>';}
    var html = '<div class="plani-document-preview">';
    html += '<div class="plani-preview-cover"><strong>' + esc(model.title || 'Planificacion') + '</strong><span>' + esc(model.periodLabel || '') + '</span></div>';
    html += '<div class="plani-table-wrap"><table class="plani-small-table"><thead><tr><th>Elemento</th><th>Valor</th></tr></thead><tbody>';
    html += '<tr><td>Tipo</td><td>' + esc(model.documentType || '') + '</td></tr>';
    html += '<tr><td>Codigo</td><td>' + esc(model.code || '') + '</td></tr>';
    html += '<tr><td>Secciones</td><td>' + safeList(model.sections).length + '</td></tr>';
    html += '<tr><td>Cronograma</td><td>' + (model.cronogramaMapped && model.cronogramaMapped.rows ? model.cronogramaMapped.rows.length : 0) + ' actividades</td></tr>';
    html += '</tbody></table></div>';
    html += '<div class="plani-preview-sections">' + safeList(model.sections).map(sectionCard).join('') + '</div>';
    html += '</div>';
    return html;
  }

  window.PlaniPreview = {render:render};
})(window);
