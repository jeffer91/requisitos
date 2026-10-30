/* Actas lee estudiantes, requisitos y evaluaciones de Base Local; la única escritura académica permitida es modalidad a través de Ficha. */
(function(w,d){"use strict";
const base=d.currentScript&&d.currentScript.src||d.baseURI;
let promise=null,loaded=false,error="",stamp="";
function url(path){return new URL(path,base).href;}
function load(path,test){if(test())return Promise.resolve();const src=url(path);return new Promise((resolve,reject)=>{let el=[...d.scripts].find(x=>x.src===src);if(el){let count=0;const check=()=>test()?resolve():++count>160?reject(Error("No se inicializó "+path)):setTimeout(check,75);check();return;}el=d.createElement("script");el.src=src;el.async=false;el.onload=()=>test()?resolve():reject(Error("Módulo sin API: "+path));el.onerror=()=>reject(Error("No se pudo cargar "+path));d.head.appendChild(el);});}
function ready(){if(loaded)return Promise.resolve({ok:true});if(promise)return promise;error="";
promise=load("cone.ncomplex.js",()=>!!w.ConNcomplex).then(()=>w.ConNcomplex.ready()).then(s=>{if(!s||!s.ok)throw Error(s&&s.error||"No se pudo iniciar Ncomplex.");return load("../rules/bdl.rules.requisitos.js",()=>!!w.BDLRulesRequisitos);}).then(()=>load("../repositories/bdl.repo.requisitos.js",()=>!!w.BDLRepoRequisitos)).then(()=>{loaded=true;stamp=new Date().toISOString();return {ok:true};}).catch(e=>{error=e.message||String(e);throw e;}).finally(()=>{promise=null;});return promise;}
function text(v){return String(v==null?"":v).trim();}
function normPeriod(v){
 const value=text(v),m=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
 return m?m[1]+"-"+m[2]+"__"+m[3]+"-"+m[4]:value.replace(/_+/g,"__");
}
function ced(v){const raw=text(v).replace(/[^0-9A-Za-z]/g,"").toUpperCase();return /^\d{9}$/.test(raw)?"0"+raw:raw;}
function first(row,keys){for(const key of keys){if(row&&row[key]!==undefined&&row[key]!==null&&text(row[key])!=="")return row[key];}return "";}
function parsedId(row){
 const raw=text(first(row,["idEstudiantePeriodo","studentId","id","_bl2Id","_id"]));
 const direct=raw.match(/^([A-Za-z0-9]{9,13})__(\d{4}-\d{2}_+\d{4}-\d{2})(?:__|$)/);
 if(direct)return {cedula:ced(direct[1]),periodoId:normPeriod(direct[2])};
 const reversed=raw.match(/^(\d{4}-\d{2}_+\d{4}-\d{2})__([A-Za-z0-9]{9,13})(?:__|$)/);
 return reversed?{cedula:ced(reversed[2]),periodoId:normPeriod(reversed[1])}:{};
}
function keyOf(row){
 const id=parsedId(row);
 const studentCedula=ced(first(row,["cedula","numeroIdentificacion","NumeroIdentificacion","Cedula","Cédula","_cedula","identificacion","Identificacion"])||id.cedula);
 const periodo=normPeriod(first(row,["periodoId","periodId","periodoCanonicoId","ultimoPeriodoId","_periodoId","idPeriodo"])||id.periodoId);
 return studentCedula&&periodo?studentCedula+"__"+periodo:"";
}
function compact(v){return text(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");}
function reqKey(row){return compact(first(row,["requisitoKey","requirementKey","key","campo","field","nombre","codigo","requisitoLabel","requisitoNombre"]));}
function reqValue(row){return first(row,["valor","value","estado","cumple","aprobado","resultado"]);}
function asRows(v){if(Array.isArray(v))return v;if(v&&typeof v==="object")return Array.isArray(v.rows)?v.rows:Array.isArray(v.students)?v.students:[];return [];}
function localStudents(opts){
 const service=w.BDLServices&&typeof w.BDLServices.get==="function"?w.BDLServices.get("estudiantes"):w.BDLServiceEstudiantes;
 return service&&typeof service.list==="function"?service.list({periodoId:opts.periodoId||"",matricula:""}):w.ConNcomplex.listStudents({periodoId:opts.periodoId||"",matricula:""});
}
function supplementaryRequirements(periodoId){
 const repositories=w.BDLRepositories,legacyStore=repositories&&typeof repositories.storeName==="function"?repositories.storeName("requisitos","requisitos"):"requisitos";
 const legacy=repositories&&typeof repositories.safeGetAll==="function"?repositories.safeGetAll(legacyStore).catch(()=>[]):Promise.resolve([]);
 function cached(con){
  if(!con||typeof con.getRequirements!=="function")return [];
  try{return con.getRequirements({periodoId})||[];}catch(e){return [];}
 }
 return Promise.all([legacy,Promise.resolve(cached(w.ConCoordi||w.BDLocalCoordi)),Promise.resolve(cached(w.ConFicha||w.BDLocalFicha))]);
}
function joinRequirements(periodoId,primary,supplementary){
 // Prefer the V2 repository for each student/key; use legacy and cached rows only to fill gaps.
 const map=new Map(),counts={primary:0,legacy:0,coordi:0,ficha:0};
 const groups=[asRows(primary),asRows(supplementary[0]),asRows(supplementary[1]),asRows(supplementary[2])];
 groups.forEach((rows,i)=>rows.forEach(row=>{
  if(!row)return;
  const identity=keyOf(row),key=reqKey(row);
  if(!identity||!key||!identity.endsWith("__"+periodoId))return;
  const composite=identity+"__"+key;
  const value=reqValue(row);
  if(!map.has(composite)||(!text(reqValue(map.get(composite)))&&text(value))){
   map.set(composite,Object.assign({},row,{
    cedula:identity.split("__")[0],periodoId:periodoId,requisitoKey:key,valor:value,estado:value
   }));
   counts[["primary","legacy","coordi","ficha"][i]]++;
  }
 }));
 return {rows:[...map.values()],counts};
}
function usableNcomplexNote(row){
 if(!row)return false;
 const origin=compact(row.origen||row.source||"");
 return origin.includes("ncomplex")||[
  "notaTeorica","notaPractica","notaComplexivo","notaTeoricaSupletorio",
  "notaPracticaSupletorio","notaEscrito","notaDefensaTrabajo","notaOficial"
 ].some(k=>row[k]!==undefined&&row[k]!==null&&text(row[k])!=="");
}
async function read(opts){
 opts=opts||{};await ready();
 const periodId=normPeriod(opts.periodoId||opts.periodId||"");
 const notas=w.BDLRepoNotas||(w.BDLRepositories&&typeof w.BDLRepositories.get==="function"?w.BDLRepositories.get("notas"):null);
 const notesPromise=notas&&typeof notas.list==="function"?notas.list({periodoId:periodId}).catch(()=>[]):Promise.resolve([]);
 const [periods,students,evaluations,primaryRequirements,supplementary,notes]=await Promise.all([
  w.ConNcomplex.listPeriods(),
  localStudents({periodoId}),
  w.ConNcomplex.listEvaluations({periodoId}),
  w.BDLRepoRequisitos.list({periodoId}),
  supplementaryRequirements(periodId),
  notesPromise
 ]);
 const joinedRequirements=joinRequirements(periodId,primaryRequirements,supplementary);
 const evaluationIndex=new Map(),notesIndex=new Map();
 asRows(evaluations).forEach(row=>{const k=keyOf(row);if(k&&row&&!row.eliminado)evaluationIndex.set(k,row);});
 asRows(notes).forEach(row=>{const k=keyOf(row);if(k&&!notesIndex.has(k)&&usableNcomplexNote(row))notesIndex.set(k,row);});
 let matchedEvaluations=0,matchedMirrors=0;
 const joined=asRows(students).map(student=>{
  const k=keyOf(student);
  const official=evaluationIndex.get(k)||null;
  const mirrored=!official?notesIndex.get(k)||null:null;
  const evaluation=official||mirrored||student._ncomplexHasSavedEvaluation&&student._ncomplexEvaluation||null;
  if(official)matchedEvaluations++;
  else if(mirrored)matchedMirrors++;
  return Object.assign({},student,{
   _ncomplexHasSavedEvaluation:!!evaluation,
   _ncomplexEvaluation:evaluation,
   estadoEvaluacion:evaluation?evaluation.estadoEvaluacion||"":""
  });
 });
 return {ok:true,data:{periods:asRows(periods),students:joined,requirements:joinedRequirements.rows},meta:{
  source:"BDLocal requisitos_estudiante + requisitos legacy + Ncomplex",readOnly:true,
  diagnostics:{students:joined.length,requirements:joinedRequirements.rows.length,
   requirementSources:joinedRequirements.counts,evaluations:asRows(evaluations).length,
   mirroredNotes:notesIndex.size,matchedEvaluations,matchedMirrors}
 }};
}
async function setModality(opts){opts=opts||{};await ready();const mode=text(opts.mode);if(!["EXAMEN_COMPLEXIVO","TRABAJO_TITULACION"].includes(mode))throw Error("Modalidad inválida.");
await load("cone.ficha.js",()=>!!w.ConFicha);
if(typeof w.ConFicha.ready==="function")await w.ConFicha.ready();
if(typeof w.ConFicha.updateGraduationModality!=="function")throw Error("El conector Ficha no permite actualizar modalidad.");
const periodId=normPeriod(opts.periodoId),identity=text(opts.studentId)||ced(opts.cedula)+"__"+periodId;
if(!periodId||!ced(opts.cedula))throw Error("El estudiante necesita cédula y período.");
return w.ConFicha.updateGraduationModality(identity,mode,{periodoId,periodId,cedula:ced(opts.cedula),periodoLabel:text(opts.periodoLabel),source:"actas.selector"});
}
function status(){return {ok:loaded&&!error,ready:loaded,error,loadedAt:stamp};}
const api={version:"2.0",screen:"actas",ready,read,setModality,listPeriods:()=>ready().then(()=>w.ConNcomplex.listPeriods()),status,diagnose:()=>({ok:loaded&&!error,source:"BDLocal + Ncomplex",canRead:true,canWrite:true,writeScope:"modalidad únicamente",error}),refresh:read};
w.ConActas=w.BDLocalConeActas=api;const hub=w.BDLocalConexiones;if(hub&&typeof hub.register==="function")hub.register("actas",api);
})(window,document);
