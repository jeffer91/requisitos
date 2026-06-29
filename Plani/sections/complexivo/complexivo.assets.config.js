/* =========================================================
Nombre completo: complexivo.assets.config.js
Ruta o ubicacion: /Requisitos/Plani/sections/complexivo/complexivo.assets.config.js
Funcion:
- Definir carpetas logicas de recursos para Examen Complexivo.
- Mantener imagenes, graficos y tablas por seccion.
========================================================= */
(function(window){
  "use strict";

  var FOLDERS = [
    {sectionId:"introduccion", path:"sections/complexivo/01-introduccion", accepts:["images"]},
    {sectionId:"base-legal", path:"sections/complexivo/02-base-legal", accepts:["tables"]},
    {sectionId:"metodologia", path:"sections/complexivo/03-metodologia", accepts:["images","tables"]},
    {sectionId:"requisitos", path:"sections/complexivo/04-requisitos", accepts:["tables"]},
    {sectionId:"descripcion-examen", path:"sections/complexivo/05-descripcion-examen", accepts:["tables","charts"]},
    {sectionId:"seminarios", path:"sections/complexivo/06-seminarios", accepts:["tables"]},
    {sectionId:"distribucion-estudiantes", path:"sections/complexivo/07-distribucion-estudiantes", accepts:["charts","tables"]},
    {sectionId:"laboratorios", path:"sections/complexivo/08-laboratorios", accepts:["tables"]},
    {sectionId:"cronograma", path:"sections/complexivo/09-cronograma", accepts:["tables","charts"]},
    {sectionId:"criterios-evaluacion", path:"sections/complexivo/10-criterios-evaluacion", accepts:["tables"]},
    {sectionId:"resumen-general", path:"sections/complexivo/11-resumen-general", accepts:["charts","tables"]},
    {sectionId:"bibliografia", path:"sections/complexivo/12-bibliografia", accepts:["files"]}
  ];

  function list(){return JSON.parse(JSON.stringify(FOLDERS));}
  function bySection(sectionId){return list().find(function(item){return item.sectionId === sectionId;}) || null;}

  window.PlaniComplexivoAssetsConfig = {list:list, bySection:bySection};
})(window);
