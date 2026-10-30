/* Actas: evidencia académica verificable por estudiante y período.
 * Solo interpreta registros de Base Local y Ncomplex; jamás inventa núcleos, notas ni aprobaciones.
 */
(function(w){"use strict";
const REQUIREMENTS=Object.freeze([
 {key:"academico",label:"Académico / cumplimiento curricular",aliases:["academico"]},
 {key:"documentacion",label:"Documentación académica",aliases:["documentacion","documentacionacademica"]},
 {key:"practicasvinculacion",label:"Prácticas preprofesionales",aliases:["practicasvinculacion","pricasvinculacion","practicaspreprofesionales","practicas"]},
 {key:"vinculacion",label:"Vinculación con la sociedad",aliases:["vinculacion"]},
 {key:"seguimientograduados",label:"Seguimiento a graduados",aliases:["seguimientograduados","graduados"]},
 {key:"ingles",label:"Segunda lengua / Inglés",aliases:["ingles","segundalengua"]},
 {key:"actualizaciondatos",label:"Actualización de datos",aliases:["actualizaciondatos"]},
 {key:"financiero",label:"Financiero",aliases:["financiero"]}
]);
function txt(v){return String(v==null?"":v).trim();}
function key(v){return txt(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");}
function status(v){const raw=key(typeof v==="object"&&v?(v.valor||v.estado||v.value||v.label||""):v);if(raw==="cumple")return "CUMPLE";if(raw==="nocumple")return "NO CUMPLE";if(raw==="pendiente")return "PENDIENTE";return "SIN DATO";}
function note(v){if(v===null||v===undefined||txt(v)==="")return null;const number=Number(txt(v).replace(",","."));return Number.isFinite(number)&&number>=0&&number<=10?Math.round(number*100)/100:null;}
function formatNote(v){const n=note(v);return n===null?"NO REGISTRADA":n.toFixed(2).replace(".",",")+"/10";}
function read(map,aliases){for(const alias of aliases){const k=key(alias);if(Object.prototype.hasOwnProperty.call(map,k))return map[k];}return null;}
function sources(input){
 const source=Object.assign({},input.student||{},input.requirementValues||{});
 const map={};for(const [k,v] of Object.entries(source))map[key(k)]=v;
 for(const r of [].concat(input.requirementRows||[],input.student&&input.student.requisitos||[],input.student&&input.student._requisitos||[])){
  const reqKey=key(r.requisitoKey||r.requirementKey||r.key||r.nombre||r.requisitoLabel);
  if(reqKey)map[reqKey]=r.valor!==undefined?r.valor:r.estado!==undefined?r.estado:r.value;
 }
 return map;
}
function assess(input){
 input=input||{};
 const values=sources(input),mode=txt(input.mode),student=input.student||{};
 const items=REQUIREMENTS.map(r=>({key:r.key,label:r.label,status:status(read(values,r.aliases))}));
 const titleStatus=status(read(values,["titulacion"]));
 const approvalTitle=status(read(values,["aprobaciontitulacion"]));
 const approvalResult=status(read(values,["aprobacioncomplexivoproyecto"]));
 const missing=items.filter(r=>r.status!=="CUMPLE").map(r=>r.label+" ("+r.status+")");
 if(titleStatus!=="CUMPLE")missing.push("Titulación / núcleos ("+titleStatus+")");
 if(approvalTitle!=="CUMPLE")missing.push("Aprobación de titulación ("+approvalTitle+")");
 if(approvalResult!=="CUMPLE")missing.push("Aprobación complexivo/proyecto ("+approvalResult+")");
 const evalRow=input.evaluation||student._ncomplexEvaluation||null;
 const hasEval=!!evalRow&&student._ncomplexHasSavedEvaluation!==false;
 const evaluation=evalRow||{};
 const expected=mode==="TRABAJO_TITULACION"?"TRABAJO_TITULACION":"EXAMEN_COMPLEXIVO";
 const evalMode=txt(evaluation.modalidadTitulacion);
 const sameMode=!hasEval||evalMode===expected;
 const actualState=txt(evaluation.estadoEvaluacion).toUpperCase();
 const official=note(evaluation.notaOficial);
 const pass=note(evaluation.notaMinimaAprobacion);
 const minimum=Math.max(7,pass===null?7:pass);
 const op=txt(evaluation.oportunidadAplicada).toUpperCase()==="SUPLETORIO"?"SUPLETORIO":"ORDINARIA";
 const work=expected==="TRABAJO_TITULACION";
 const primary=work?note(evaluation.notaEscrito):note(op==="SUPLETORIO"?evaluation.notaTeoricaSupletorio:evaluation.notaTeorica);
 const secondary=work?note(evaluation.notaDefensaTrabajo):note(op==="SUPLETORIO"?evaluation.notaPracticaSupletorio:evaluation.notaPractica);
 const weightA=work?60:40,weightB=work?40:60;
 const computed=primary===null||secondary===null?null:Math.round((primary*weightA+secondary*weightB))/100;
 const inconsistent=computed!==null&&official!==null&&Math.abs(computed-official)>0.02;
 const verified=hasEval&&sameMode&&actualState==="APROBADO"&&official!==null&&official>=minimum&&primary!==null&&secondary!==null&&!inconsistent;
 if(!hasEval)missing.push("Evaluación oficial no disponible en Ncomplex");
 else {
  if(!sameMode)missing.push("Modalidad distinta entre Ficha y Ncomplex");
  if(actualState!=="APROBADO")missing.push("Resultado Ncomplex: "+(actualState||"SIN DATO"));
  if(official===null)missing.push("Nota oficial Ncomplex sin registro");
  else if(official<minimum)missing.push("Nota oficial inferior al mínimo de aprobación");
  if(primary===null||secondary===null)missing.push("No consta desglose de calificaciones de la evaluación");
  if(inconsistent)missing.push("Inconsistencia entre ponderación y nota oficial");
 }
 const eligible=missing.length===0;
 const labels=items.map(r=>r.label);
 const gradeRows=[
  {label:work?"Trabajo escrito (60 %)":op==="SUPLETORIO"?"Evaluación teórica supletoria (40 %)":"Evaluación teórica (40 %)",value:formatNote(primary)},
  {label:work?"Defensa oral (40 %)":op==="SUPLETORIO"?"Evaluación práctica supletoria (60 %)":"Evaluación práctica (60 %)",value:formatNote(secondary)},
  {label:"Nota final oficial",value:formatNote(official)},
  {label:"Nota mínima de aprobación",value:minimum.toFixed(2).replace(".",",")+"/10"},
  {label:"Resultado de Ncomplex",value:verified?"APROBADO":hasEval?(actualState||"SIN DATO"):"SIN EVALUACIÓN REGISTRADA"}
 ];
 return {
  version:1,mode,studentName:txt(student.Nombres||student.nombres||student.nombreCompleto||student.nombre||student.Nombre),
  requirements:items,academicStatus:items[0].status, titulationStatus:titleStatus,
  finalTitleStatus:approvalTitle,finalResultStatus:approvalResult,
  evaluation:{saved:hasEval,verified,mode:evalMode,opportunity:work?"DEFENSA":op,official,minimum,primary,secondary,computed,state:actualState,inconsistent,rows:gradeRows},
  eligible,missing,requiredCount:items.length,
  mallaText:items[0].status==="CUMPLE"?
   "El control académico institucional registra el requisito Académico como CUMPLE, correspondiente al cumplimiento curricular para continuar con la titulación. La culminación integral de la malla debe contrastarse con la constancia de egreso y el historial de asignaturas del expediente académico.":
   "El requisito Académico no registra cumplimiento completo. No es posible certificar la culminación curricular con la información consultada.",
  nucleiText:work?
   "El requisito Titulación corresponde al desarrollo y la aprobación del trabajo de titulación y su defensa, según los registros institucionales.":
   "El requisito Titulación corresponde al proceso de núcleos formativos. Base Local registra su estado, pero Actas no dispone de calificaciones independientes de los cuatro núcleos; no se atribuyen notas inexistentes.",
  closureText:eligible?
   "Verificada la condición académica, los ocho requisitos previos, el requisito Titulación y el resultado oficial de "+(work?"Trabajo de Titulación":"Examen Complexivo")+" en Ncomplex, se deja constancia del resultado APROBADO. El documento requiere revisión y legalización institucional.":
   "No se acredita el cierre completo del proceso. Faltan evidencias o existen discrepancias; no corresponde emitir una constancia definitiva de aprobación."
 };
}
w.ActasEvidence=Object.freeze({REQUIREMENTS,assess,status,note,formatNote});
})(window);
