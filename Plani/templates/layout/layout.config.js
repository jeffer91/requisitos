/* =========================================================
Nombre completo: layout.config.js
Ruta o ubicacion: /Requisitos/Plani/templates/layout/layout.config.js
Funcion:
- Centralizar la configuracion institucional general de los documentos Plani.
- Definir margenes, tamano de pagina, encabezado, version, fecha y textos base.
========================================================= */
(function(window){
  "use strict";

  var CONFIG = {
    documentFamily:"PLANI",
    page:{
      size:"A4",
      margins:{top:"2.54cm", right:"2.54cm", bottom:"2.54cm", left:"2.54cm"}
    },
    institution:{
      unit:"UNIDAD DE TITULACION Y EFICIENCIA TERMINAL",
      shortUnit:"UTET",
      institute:"ITSQMET",
      logoPath:""
    },
    control:{
      version:"1.0",
      elaborationDate:"1 - Octubre - 2025",
      pageLabel:"Pagina"
    },
    document:{
      defaultTitle:"Planificacion de Titulacion",
      defaultCode:"UTET-RGI-PLANI-PRO-56"
    }
  };

  function clone(value){return JSON.parse(JSON.stringify(value == null ? null : value));}

  function get(){return clone(CONFIG);}

  function merge(base, extra){
    base = base || {};
    extra = extra || {};
    Object.keys(extra).forEach(function(key){
      if(extra[key] && typeof extra[key] === "object" && !Array.isArray(extra[key])){
        base[key] = merge(base[key] || {}, extra[key]);
      }else{
        base[key] = extra[key];
      }
    });
    return base;
  }

  function build(overrides){return merge(get(), overrides || {});}

  window.PlaniLayoutConfig = {get:get, build:build};
})(window);
