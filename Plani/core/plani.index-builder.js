/* =========================================================
Nombre completo: plani.index-builder.js
Ruta o ubicacion: /Requisitos/Plani/core/plani.index-builder.js
Funcion:
- Construir indice logico desde las secciones numeradas.
- Preparar filas para indice visual, Word y PDF.
========================================================= */
(function(window){
  "use strict";

  function safeList(value){return Array.isArray(value) ? value : [];}
  function text(value){return String(value == null ? "" : value).trim();}

  function build(sections){
    var flat = window.PlaniNumbering && window.PlaniNumbering.flat ? window.PlaniNumbering.flat(sections) : safeList(sections);
    return flat.map(function(section, index){
      return {
        number:text(section.number || (index + 1)),
        title:text(section.title || section.label || section.id || "Seccion"),
        level:text(section.number).split(".").filter(Boolean).length || 1,
        page:section.page || ""
      };
    });
  }

  window.PlaniIndexBuilder = {build:build};
})(window);
