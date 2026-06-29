/* =========================================================
Nombre completo: plani.numbering.js
Ruta o ubicacion: /Requisitos/Plani/core/plani.numbering.js
Funcion:
- Numerar secciones y subsecciones del modelo documental.
- Mantener numeracion separada de contenido, plantillas y exportacion.
========================================================= */
(function(window){
  "use strict";

  function safeList(value){return Array.isArray(value) ? value : [];}
  function clone(value){return JSON.parse(JSON.stringify(value == null ? null : value));}

  function numberSections(sections, prefix){
    return safeList(sections).map(function(section, index){
      var copy = clone(section || {});
      var num = prefix ? prefix + "." + (index + 1) : String(index + 1);
      copy.number = num;
      if(copy.children && copy.children.length){
        copy.children = numberSections(copy.children, num);
      }
      return copy;
    });
  }

  function flat(sections){
    var out = [];
    safeList(sections).forEach(function(section){
      out.push(section);
      if(section.children && section.children.length){
        out = out.concat(flat(section.children));
      }
    });
    return out;
  }

  window.PlaniNumbering = {numberSections:numberSections, flat:flat};
})(window);
