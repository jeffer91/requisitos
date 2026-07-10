/* =========================================================
Nombre completo: section.template.js
Ruta o ubicacion: /Requisitos/Plani/templates/layout/section.template.js
Funcion:
- Construir secciones documentales reutilizables.
- Soportar texto, tablas, imagenes y bloques HTML internos.
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function safeList(value){return Array.isArray(value) ? value : [];}

  function paragraphs(content){
    return text(content).split(/\n+/).map(text).filter(Boolean).map(function(p){return '<p>' + esc(p) + '</p>';}).join('');
  }

  function render(section, number){
    section = section || {};
    var title = text(number ? number + '. ' + (section.title || section.label || '') : (section.title || section.label || ''));
    var html = '<section class="plani-doc-section" data-section-id="' + esc(section.id || '') + '">';
    if(title){html += '<h2>' + esc(title) + '</h2>';}
    if(section.content){html += paragraphs(section.content);}
    safeList(section.blocks).forEach(function(block){
      if(block && block.type === 'html'){html += block.html || '';}
      if(block && block.type === 'text'){html += paragraphs(block.content);}
      if(block && block.type === 'table' && window.PlaniTableTemplate){html += window.PlaniTableTemplate.render(block.headers, block.rows, block.options);}
    });
    html += '</section>';
    return html;
  }

  window.PlaniSectionTemplate = {render:render, paragraphs:paragraphs};
})(window);
