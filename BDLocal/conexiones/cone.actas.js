/* Actas lee estudiantes, requisitos y evaluaciones de Base Local; la única escritura académica permitida es modalidad a través de Ficha. */
(function(w,d){"use strict";
const base=d.currentScript&&d.currentScript.src||d.baseURI;
let promise=null,loaded=false,error="",stamp="";
function url(path){return new URL(path,base).href;}
function load(path,test){if(test())return Promise.resolve();const src=url(path);return new Promise((resolve,reject)=>{let el=[...d.scripts].find(x=>x.src===src);if(el){let count=0;const check=()=>test()?resolve():++count>160?reject(Error("No se inicializó "+path)):setTimeout(check,75);check();return;}el=d.createElement("script");el.src=src;el.async=false;el.onload=()=>test()?resolve():reject(Error("Módulo sin API: "+path));el.onerror=()=>reject(Error("No se pudo cargar "+path));d.head.appendChild(el);});}
function ready(){if(loaded)return Promise.resolve({ok:true});if(promise)return promise;error="";
promise=load("cone.ncomplex.js",()=>!!w.ConNcomplex).then(()=>w.ConNcomplex.ready()).then(s=>{if(!s||!s.ok)throw Error(s&&s.error||"No se pudo iniciar Ncomplex.");return load("../rules/bdl.rules.requisitos.js",()=>!!w.BDLRulesRequisitos);}).then(()=>load("../repositories/bdl.repo.requisitos.js",()=>!!w.BDLRepoRequisitos)).then(()=>{loaded=true;stamp=new Date().toISOString();return {ok:true};}).catch(e=>{error=e.message||String(e);throw e;}).finally(()=>{promise=null;});return promise;}
function text(v){return String(v==null?"":v).trim();}
function normPeriod(v){return text(v).replace(/_+/g,"__");}
function ced(v){return text(v).replace(/[^0-9A-Za-z]/g,"").toUpperCase();}
function studentKey(s){return ced(s.cedula||s.numeroIdentificacion||s.NumeroIdentificacion)+"__"+normPeriod(s.periodoId||s.periodId);}
function localStudents(opts){
const service=w.BDLServices&&typeof w.BDLServices.get==="function"?w.BDLServices.get("estudiantes"):w.BDLServiceEstudiantes;
return service&&typeof service.list==="function"?service.list({periodoId:opts.periodoId||"",matricula:""}):w.ConNcomplex.listStudents({periodoId:opts.periodoId||"",matricula:""});
}
async function read(opts){opts=opts||{};await ready();const [periods,students,evaluations,requirements]=await Promise.all([w.ConNcomplex.listPeriods(),localStudents(opts),w.ConNcomplex.listEvaluations({periodoId:opts.periodoId||""}),w.BDLRepoRequisitos.list({periodoId:opts.periodoId||""})]);
const index=new Map();for(const e of evaluations||[])if(e&&!e.eliminado)index.set(studentKey(e),e);
const joined=(students||[]).map(student=>{const evaluation=index.get(studentKey(student))||null;return Object.assign({},student,{_ncomplexHasSavedEvaluation:!!evaluation,_ncomplexEvaluation:evaluation,estadoEvaluacion:evaluation?evaluation.estadoEvaluacion:""});});
return {ok:true,data:{periods:periods||[],students:joined,requirements:requirements||[]},meta:{source:"BDLocal + Ncomplex",readOnly:true}};
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
