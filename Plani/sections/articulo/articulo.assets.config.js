/* =========================================================
Nombre completo: articulo.assets.config.js
Ruta o ubicacion: /Requisitos/Plani/sections/articulo/articulo.assets.config.js
Funcion:
- Definir carpetas logicas de recursos para Articulo Academico.
- Mantener imagenes, graficos y tablas por seccion.
========================================================= */
(function(window){
  "use strict";

  var FOLDERS = [
    {sectionId:"introduccion", path:"sections/articulo/01-introduccion", accepts:["images"]},
    {sectionId:"marco-normativo", path:"sections/articulo/02-marco-normativo", accepts:["tables","files"]},
    {sectionId:"metodologia", path:"sections/articulo/03-metodologia", accepts:["images","tables"]},
    {sectionId:"desarrollo-operativo", path:"sections/articulo/04-desarrollo-operativo", accepts:["tables","images"]},
    {sectionId:"cronograma", path:"sections/articulo/05-cronograma", accepts:["tables","charts"]},
    {sectionId:"evaluacion", path:"sections/articulo/06-evaluacion", accepts:["tables","charts"]},
    {sectionId:"disposiciones-finales", path:"sections/articulo/07-disposiciones-finales", accepts:["files"]},
    {sectionId:"referencias", path:"sections/articulo/08-referencias", accepts:["files"]}
  ];

  function list(){return JSON.parse(JSON.stringify(FOLDERS));}
  function bySection(sectionId){return list().find(function(item){return item.sectionId === sectionId;}) || null;}

  window.PlaniArticuloAssetsConfig = {list:list, bySection:bySection};
})(window);
