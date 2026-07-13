/* =========================================================
Nombre completo: complexivo.content.js
Ruta o ubicacion: /Requisitos/Plani/sections/complexivo/complexivo.content.js
Funcion:
- Centralizar contenido base de secciones de Examen Complexivo.
- Permitir reemplazar textos luego sin tocar el motor.
========================================================= */
(function(window){
  "use strict";

  var CONTENT = {
    introduccion:"El documento organiza la planificacion institucional del Examen Complexivo. Define una ruta clara para induccion, preparacion, aplicacion, evaluacion y mejora continua dentro del periodo seleccionado.",
    baseLegal:"Esta seccion consolida la normativa nacional e institucional que sustenta la titulacion mediante Examen Complexivo.",
    metodologia:"La metodologia se estructura por fases operativas: induccion, diseno, organizacion, preparacion, aplicacion, evaluacion, retroalimentacion y mejora continua.",
    requisitos:"La aprobacion del proceso requiere verificar requisitos academicos, documentales, financieros, practicas, vinculacion, lengua extranjera y actualizacion de datos.",
    descripcionExamen:"El Examen Complexivo se organiza mediante componentes teoricos y practicos para verificar resultados de aprendizaje y competencias de la carrera.",
    seminarios:"Los seminarios de titulacion fortalecen la preparacion de los estudiantes antes de la aplicacion del examen.",
    distribucion:"La distribucion de estudiantes por carrera y nivel permite organizar espacios, horarios, responsables y recursos logisticos.",
    laboratorios:"La asignacion de laboratorios considera capacidad, disponibilidad, modalidad, recursos tecnologicos y condiciones del proceso.",
    imponderables:"Los imponderables contemplan situaciones no previstas que puedan afectar el cronograma, la asistencia, los recursos o la aplicacion.",
    criterios:"Los criterios de evaluacion definen calificacion, evidencias, ponderaciones, rubricas y condiciones de aprobacion.",
    resumen:"El resumen general consolida la informacion principal de la planificacion y verifica coherencia entre periodo, actividades, responsables y resultados.",
    bibliografia:"La bibliografia se completara con fuentes normativas, reglamentarias y academicas utilizadas para sustentar la planificacion."
  };

  function get(key){return CONTENT[key] || "";}
  function all(){return JSON.parse(JSON.stringify(CONTENT));}

  window.PlaniComplexivoContent = {get:get, all:all};
})(window);
