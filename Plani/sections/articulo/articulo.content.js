/* =========================================================
Nombre completo: articulo.content.js
Ruta o ubicacion: /Requisitos/Plani/sections/articulo/articulo.content.js
Funcion:
- Centralizar contenido base de secciones de Articulo Academico.
- Permitir reemplazar textos luego sin tocar el motor general.
========================================================= */
(function(window){
  "use strict";

  var CONTENT = {
    introduccion:"El documento organiza la planificacion institucional del proceso de Articulo Academico. Define una ruta clara para induccion, desarrollo metodologico, entrega, evaluacion, defensa y seguimiento.",
    marcoNormativo:"Esta seccion consolida la normativa nacional, institucional y estrategica que sustenta la modalidad de Articulo Academico.",
    metodologia:"La metodologia de implementacion organiza fases, responsables, actividades, productos academicos y evidencias necesarias para el desarrollo del articulo.",
    desarrolloOperativo:"El desarrollo operativo describe las actividades principales del proceso, desde la induccion hasta la entrega final y la defensa oral.",
    cronograma:"El cronograma referencial se construye a partir de las fechas, responsables y actividades cargadas en Plani.",
    evaluacion:"La evaluacion considera criterios academicos, revision del documento, control de originalidad, defensa oral, registro de notas y retroalimentacion.",
    disposiciones:"Las disposiciones finales establecen condiciones de cumplimiento, ajustes operativos y responsabilidades para el cierre del proceso.",
    referencias:"Las referencias se completaran con fuentes normativas, reglamentarias y academicas utilizadas para sustentar la planificacion."
  };

  function get(key){return CONTENT[key] || "";}
  function all(){return JSON.parse(JSON.stringify(CONTENT));}

  window.PlaniArticuloContent = {get:get, all:all};
})(window);
