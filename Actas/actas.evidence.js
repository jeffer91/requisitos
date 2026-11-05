/* Actas valida el expediente DOCUMENTAL. Las calificaciones pertenecen a Ncomplex.
 * La emisión final exige 9/9 requisitos y ambas aprobaciones CUMPLE,
 * sin imprimir ni recalcular calificaciones.
 */
(function(w){"use strict";
const REQUIREMENTS=Object.freeze([
 {key:"academico",label:"Académico / cumplimiento curricular",aliases:["academico"]},
 {key:"documentacion",label:"Documentación académica",aliases:["documentacion","documentacionacademica"]},
 {key:"financiero",label:"Financiero",aliases:["financiero"]},
 {key:"practicas",label:"Prácticas preprofesionales",aliases:["practicas","practicaspreprofesionales","practicasvinculacion","pricasvinculacion"]},
 {key:"vinculacion",label:"Vinculación con la sociedad",aliases:["vinculacion","vinculacionconlasociedad"]},
 {key:"seguimientograduados",label:"Seguimiento a graduados",aliases:["seguimientograduados","seguimiento"]},
 {key:"ingles",label:"Segunda lengua / Inglés",aliases:["ingles","segundalengua"]},
 {key:"actualizaciondatos",label:"Actualización de datos",aliases:["actualizaciondatos"]},
 {key:"titulacion",label:"Titulación",aliases:["titulacion"]}
]);
const txt=v=>String(v===null||v===undefined?"":v).trim();
const key=v=>txt(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
function status(v){
 const raw=key(v&&typeof v==="object"?(v.valor!==undefined?v.valor:v.estado!==undefined?v.estado:v.value!==undefined?v.value:v.label):v);
 return raw==="cumple"?"CUMPLE":raw==="nocumple"?"NO CUMPLE":raw==="pendiente"?"PENDIENTE":"SIN DATO";
}
function sources(input){
 const student=input.student||{},map={};
 function put(name,value){if(name)map[key(name)]=value;}
 // 1. Los campos y registros anidados del estudiante son respaldo histórico.
 const fields=Object.assign({},student,student.valores||{});
 Object.keys(fields).forEach(k=>put(k,fields[k]));
 function takeRows(rows){
  for(const row of Array.isArray(rows)?rows:[]){
   if(!row||typeof row!=="object")continue;
   const field=row.requisitoKey||row.requirementKey||row.key||row.campo||row.nombre||row.requisitoLabel;
   put(field,row.valor!==undefined?row.valor:row.estado!==undefined?row.estado:row.value);
  }
 }
 takeRows(student.requisitos);
 takeRows(student._requisitos);
 // 2. El resultado conciliado del repositorio de requisitos prevalece sobre el historial.
 const current=input.requirementValues||{};
 Object.keys(current).forEach(k=>put(k,current[k]));
 takeRows(input.requirementRows);
 return map;
}
function value(map,aliases){for(const alias of aliases){const k=key(alias);if(Object.prototype.hasOwnProperty.call(map,k)&&map[k]!==undefined&&map[k]!==null&&txt(map[k])!=="")return map[k];}return null;}
function assess(input){
 input=input||{};
 const student=input.student||{},mode=txt(input.mode),values=sources(input);
 const requirements=REQUIREMENTS.map(r=>({key:r.key,label:r.label,status:status(value(values,r.aliases))}));
 const title=requirements.find(r=>r.key==="titulacion").status;
 const approvalTitle=status(value(values,["aprobaciontitulacion"]));
 const approvalResult=status(value(values,["aprobacioncomplexivoproyecto"]));
 const missing=requirements.filter(r=>r.status!=="CUMPLE").map(r=>r.label+" ("+r.status+")");
 if(approvalTitle!=="CUMPLE")missing.push("Aprobación de titulación ("+approvalTitle+")");
 if(approvalResult!=="CUMPLE")missing.push("Aprobación complexivo/proyecto ("+approvalResult+")");
 const eligible=missing.length===0&&(mode==="EXAMEN_COMPLEXIVO"||mode==="TRABAJO_TITULACION");
 const academic=requirements[0].status;
 return {
  version:2,mode,studentName:txt(student.Nombres||student.nombres||student.nombreCompleto||student.nombre||student.Nombre),
  requirements,academicStatus:academic,titulationStatus:title,
  finalTitleStatus:approvalTitle,finalResultStatus:approvalResult,
  eligible,officialEligible:eligible,draftEligible:mode==="EXAMEN_COMPLEXIVO"||mode==="TRABAJO_TITULACION",
  missing,requiredCount:requirements.length,
  mallaText:academic==="CUMPLE"?
   "El requisito Académico registra CUMPLE según el expediente institucional. La culminación curricular se acredita conforme a los documentos académicos correspondientes.":
   "El requisito Académico se encuentra pendiente de verificación; no se certifica la culminación curricular mientras persista esta condición.",
  componentText:mode==="TRABAJO_TITULACION"?
   "La modalidad registrada es Trabajo de Titulación. Las evaluaciones académicas se gestionan por separado en Ncomplex y no se presentan en esta acta.":
   "La modalidad registrada es Examen Complexivo. Las calificaciones y oportunidades se administran exclusivamente en Ncomplex y no se presentan en esta acta.",
  closureText:eligible?
   "Constan como CUMPLE los nueve requisitos institucionales y las dos aprobaciones finales, de acuerdo con el expediente académico verificado.":
   "No se acredita el cierre institucional mientras existan requisitos o aprobaciones pendientes."
 };
}
w.ActasEvidence=Object.freeze({version:2,REQUIREMENTS,assess,status});
})(window);
