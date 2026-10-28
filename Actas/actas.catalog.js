/* Cronogramas editables por período y modalidad. Las fechas de imagen son OPCIONALES. */
(function(w){"use strict";
const COMPLEXIVO="EXAMEN_COMPLEXIVO",TRABAJO="TRABAJO_TITULACION";
const plantillas={
[COMPLEXIVO]:[{fase:"Desarrollo del examen complexivo",actividades:[
["nucleo1","Núcleo 1","2026-03-30","2026-04-02"],["nucleo2","Núcleo 2","2026-04-06","2026-04-09"],["nucleo3","Núcleo 3","2026-04-10","2026-04-14"],["nucleo4","Núcleo 4","2026-04-15","2026-04-18"],["examen","Examen Complexivo","2026-04-20","2026-04-24"],["supletorio","Supletorio","2026-05-04","2026-05-04"]]}],
[TRABAJO]:[
{fase:"Fase 1: Inicio y planificación",actividades:[
["induccion","Inducción","2025-12-16","2025-12-16"],["redaccion","Clase Redacción eficiente de tesis","2026-01-28","2026-01-28"],["propuesta","Elaboración de propuesta de temas","2026-02-01","2026-02-01"],["tema","Aprobación del tema","2026-02-02","2026-02-04"],["plan1","Elaboración del plan de titulación","2026-02-08","2026-02-08"],["plan2","Elaboración del plan de titulación","2026-02-09","2026-02-11"]]},
{fase:"Fase 2: Desarrollo y tutorías",actividades:[
["desarrollo","Desarrollo del trabajo (redacción)","2026-02-11","2026-02-28"],["borrador1","Borrador 1","2026-03-01","2026-03-01"],["revision1","Revisión del borrador 1 con el estudiante","2026-03-02","2026-03-05"],["borrador2","Borrador 2","2026-03-08","2026-03-08"],["revision2","Revisión del borrador 2 con el estudiante","2026-03-09","2026-03-13"],["ajustes","Ajustes finales del trabajo","2026-03-14","2026-03-19"],["entrega","Entrega de trabajo de titulación","2026-03-22","2026-03-22"],["antiplagio","Aprobación del tutor e informe antiplagio","2026-03-23","2026-03-25"],["finclases","Fin de clases","2026-03-27","2026-03-27"]]},
{fase:"Fase 3: Defensa final",actividades:[
["preparacion","Preparación de defensa","2026-03-25","2026-04-08"],["defensa","Defensa de tesis","2026-04-14","2026-04-15"],["tutoriaextra","Tutoría extra de supletorio","2026-04-14","2026-04-15"],["supletorio","Supletorio defensa","2026-04-16","2026-04-18"],["cierre","Cierre del proceso","2026-04-20","2026-04-20"]]}]
};
function get(mode,useDates){return (plantillas[mode]||plantillas[COMPLEXIVO]).map(g=>({fase:g.fase,actividades:g.actividades.map(a=>({id:a[0],nombre:a[1],inicio:useDates?a[2]:"",fin:useDates?a[3]:""}))}));}
function valid(schedule){return Array.isArray(schedule)&&schedule.every(g=>g&&Array.isArray(g.actividades)&&g.actividades.every(a=>!a.inicio||!a.fin||a.inicio<=a.fin));}
w.ActasCatalog=Object.freeze({COMPLEXIVO,TRABAJO,get,valid});
})(window);
