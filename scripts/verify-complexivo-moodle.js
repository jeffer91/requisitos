"use strict";
/* Notas → Complexivo: lector de Moodle, reglas 40/60 sin mezclar oportunidades,
 * bloqueos y subida directa a /notas_complexivo. Datos ficticios. */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const F=require("./fixtures/complexivo-moodle.js");
const M=require("../Complexivo/complexivo.moodle.js"),R=require("../Complexivo/complexivo.rules.js");
const P="2025-10__2026-03";

// ---------- 1. Lector: varios libros, columnas dinámicas ----------
const parsed=M.parse(F.all());
assert.equal(parsed.total,4,"Separa los libros por su título.");
const [bas,mkt,adm,sw]=parsed.libros;
assert.equal(bas.info.carrera,"Educación Básica");assert.equal(bas.info.periodoId,P);
assert.equal(mkt.info.carrera,"Marketing Digital y Comercio Electrónico");
assert.equal(M.readTitle("Examen Complexivo Redes abril septiembre 2026]").periodoId,"2026-04__2026-09");
assert.equal(bas.columnas.length,7);assert.equal(adm.columnas.length,11);assert.equal(sw.columnas.length,5);
assert.equal(adm.columnas.filter(c=>c.kind==="nota"&&c.oportunidad==="supletorio").length,6,"Versión 2 y ambas columnas de supletorio cuentan como supletorio.");
const row=(book,email)=>book.filas.find(f=>f.correo===email);
assert.equal(row(bas,"bsupletorio@itsqmet.edu.ec").ordinaria.teorico,5,"Escala 0–100 → 0–10.");
assert.equal(row(bas,"bsupletorio@itsqmet.edu.ec").supletorio.practico,7.5);
assert.equal(row(adm,"yversion@itsqmet.edu.ec").supletorio.teorico,9.6);
assert.ok(row(adm,"fdoble@itsqmet.edu.ec").errors.some(e=>/dos notas de teorico supletorio/.test(e)));
const blancos=row(sw,"jblancos@itsqmet.edu.ec");
assert.equal(blancos.errors.length,0,"Las celdas en blanco de Moodle no desplazan columnas.");
assert.equal(blancos.ordinaria.teorico,9.25);assert.equal(blancos.ordinaria.practico,5.6);
assert.equal(row(sw,"wcero@itsqmet.edu.ec").ordinaria.practico,0,"0,00 es una nota real.");
assert.equal(row(sw,"cnorinde@itsqmet.edu.ec").sinRendir,true,"«-» = no rindió.");

// ---------- 2. Reglas: 40/60, sin mezclar ordinario y supletorio ----------
const ev=(b,e)=>R.evaluate(row(b,e));
let r=ev(bas,"aordinaria@itsqmet.edu.ec");assert.equal(r.notaOficial,7.52);assert.equal(r.oportunidadAplicada,"ORDINARIA");assert.equal(r.estadoEvaluacion,"APROBADO");
r=ev(bas,"bsupletorio@itsqmet.edu.ec");assert.equal(r.notaOrdinaria,5.6);assert.equal(r.notaOficial,7.26,"Vale el supletorio, no el promedio de Moodle (6,43).");assert.equal(r.oportunidadAplicada,"SUPLETORIO");
r=ev(bas,"csolosuple@itsqmet.edu.ec");assert.equal(r.notaOficial,8.5);
r=ev(mkt,"dmena.prueba@itsqmet.edu.ec");assert.equal(r.estadoEvaluacion,"INCOMPLETO");assert.equal(r.notaOficial,null,"No combina teórico ordinario con práctico de supletorio.");assert.equal(r.publicable,false);
r=ev(adm,"esuple@itsqmet.edu.ec");assert.equal(r.notaOficial,9.54);
r=ev(adm,"yversion@itsqmet.edu.ec");assert.equal(r.notaOficial,9.54);assert.equal(r.oportunidadAplicada,"SUPLETORIO");
r=ev(sw,"wcero@itsqmet.edu.ec");assert.equal(r.notaOficial,2.5);assert.equal(r.estadoEvaluacion,"NO_APROBADO");assert.match(r.observaciones[0],/debe rendir supletorio/);
r=ev(sw,"cnorinde@itsqmet.edu.ec");assert.equal(r.estadoEvaluacion,"SIN_NOTAS");
assert.equal(R.evaluate({ordinaria:{teorico:8,practico:9},supletorio:{teorico:5,practico:5}}).notaOficial,8.6,"Si aprobó el ordinario, el supletorio no cuenta.");
assert.equal(R.evaluate({ordinaria:{teorico:8,practico:null},supletorio:{teorico:null,practico:null}}).estadoEvaluacion,"INCOMPLETO");

// ---------- 3. Pantalla con BDLocal y Firestore simulados ----------
function fakeFirestore(){
 const stored={};const rows=n=>stored[n]||(stored[n]=new Map());
 return {stored,collection(name){return {doc(id){return {
  get(){const d=rows(name).get(id);return Promise.resolve(d?{id,exists:true,data:()=>({...d})}:{id,exists:false,data:()=>null});},
  set(p){rows(name).set(id,JSON.parse(JSON.stringify(p)));return Promise.resolve();}};}};},
  runTransaction(h){return Promise.resolve(h({get:r=>r.get(),set:(r,p)=>r.set(p)}));}};
}
const firestore=fakeFirestore();
let n=0;const st=(email,career,code,extra)=>({cedula:"17000001"+String(++n).padStart(2,"0"),periodoId:P,estadoMatricula:"ACTIVO",
 correoInstitucional:email,NombreCarrera:career,CodigoCarrera:code,Nombres:"BDLOCAL "+email.split("@")[0].toUpperCase(),...extra});
const students={[P]:[
 st("aordinaria@itsqmet.edu.ec","EDUCACIÓN BÁSICA","550113A01-P-1701"),
 st("bsupletorio@itsqmet.edu.ec","EDUCACIÓN BÁSICA","550113A01-P-1701"),
 st("csolosuple@itsqmet.edu.ec","EDUCACIÓN BÁSICA","550113A01-P-1701"),
 st("donline@itsqmet.edu.ec","EDUCACIÓN BÁSICA ONLINE","550113A01-L-1701"),
 st("sinfila@itsqmet.edu.ec","EDUCACIÓN BÁSICA","550113A01-P-1701"),
 st("dmena.prueba@itsqmet.edu.ec","MARKETING DIGITAL Y COMERCIO ELECTRONICO","550414G01-P-1701"),
 st("erequisitos@itsqmet.edu.ec","MARKETING DIGITAL Y COMERCIO ELECTRONICO","550414G01-P-1701"),
 st("esuple@itsqmet.edu.ec","ADMINISTRACION","550413A02-P-1701"),
 st("yversion@itsqmet.edu.ec","ADMINISTRACION ONLINE","550413A02-L-1701"),
 st("fdoble@itsqmet.edu.ec","ADMINISTRACION","550413A02-P-1701"),
 st("wcero@itsqmet.edu.ec","DESARROLLO DE SOFTWARE","550613A01-P-1701"),
 st("cnorinde@itsqmet.edu.ec","DESARROLLO DE SOFTWARE","550613A01-P-1701"),
 st("jblancos@itsqmet.edu.ec","DESARROLLO DE SOFTWARE","550613A01-P-1701")
],"2026-05__2026-11":[{cedula:"1700000999",periodoId:"2026-05__2026-11",estadoMatricula:"ACTIVO",correoInstitucional:"operiodo@itsqmet.edu.ec",NombreCarrera:"DESARROLLO DE SOFTWARE",CodigoCarrera:"550613A01-P-1701"}]};
const cedOf=e=>students[P].find(s=>s.correoInstitucional===e).cedula;
const evaluations=new Map(),saved=[];
const ConNcomplex={
 async ready(){return {ok:true};},
 async listPeriods(){return Object.keys(students).map(id=>({id}));},
 async listStudents(o){return (students[o.periodoId]||[]).map(s=>({...s}));},
 async checkRequirements(p,c){return c===cedOf("erequisitos@itsqmet.edu.ec")?{eligible:false,reason:"Financiero (NO CUMPLE)"}:{eligible:true};},
 async getEvaluation(p,c){return evaluations.get(p+"__"+c)||null;},
 async saveMany(rows){rows.forEach(r=>{saved.push(r);evaluations.set(r.periodoId+"__"+r.cedula,{...r});});return rows;},
 async listEvaluations(o){return [...evaluations.values()].filter(r=>r.periodoId===o.periodoId);}
};
function el(id){return {id,value:"",textContent:"",className:"",hidden:false,disabled:false,colSpan:1,children:[],
 appendChild(c){this.children.push(c);return c;},addEventListener(){},querySelector(){return tbody;}};}
const tbody=el("tbody");
Object.defineProperty(tbody,"textContent",{set(){this.children=[];},get(){return "";}});
const ids=["cx-period","cx-paste","cx-analyze","cx-save","cx-resync","cx-clear","cx-message","cx-results","cx-table","cx-count-total","cx-count-ready","cx-count-blocked","cx-count-skip","cx-saved"];
const dom=Object.fromEntries(ids.map(id=>[id,el(id)]));
const sandbox={console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Map,Set,setTimeout,clearTimeout,URL,
 CustomEvent:function(n,o){this.type=n;this.detail=o&&o.detail;},dispatchEvent(){},
 BL2Sync:{ensureFirebase:()=>Promise.resolve(firestore)},firebase:{firestore:{FieldPath:{documentId:()=>"__name__"}}},
 location:{href:"file:///app/Complexivo/complexivo.html"},ConNcomplex,
 document:{readyState:"loading",baseURI:"file:///app/Complexivo/complexivo.html",currentScript:null,
  getElementById:id=>dom[id]||null,addEventListener(){},createElement(tag){const x=el(tag);x.tag=tag;return x;}}};
sandbox.window=sandbox;
const ctx=vm.createContext(sandbox);
const load=f=>new vm.Script(fs.readFileSync(path.join(ROOT,f),"utf8"),{filename:f}).runInContext(ctx);
["BDLocal/firebase/bdl.firebase.schema.v2.js","BDLocal/firebase/bdl.firebase.identity.js","BDLocal/firebase/bdl.firebase.validator.v2.js",
 "BDLocal/firebase/bdl.firebase.mapper.v2.js","BDLocal/firebase/bdl.firebase.repository.v2.js",
 "Complexivo/complexivo.moodle.js","Complexivo/complexivo.rules.js","Complexivo/complexivo.firebase.js","Complexivo/complexivo.app.js"].forEach(load);
sandbox.RequisitosFirebaseOperationCenter={async ensureNcomplex(){return true;}};
const app=sandbox.ComplexivoApp,S=app._state;
const tick=()=>new Promise(r=>setTimeout(r,0));
async function until(t){for(let i=0;i<400;i++){if(t())return;await tick();}throw Error("timeout");}

(async()=>{
 app.init();
 // Selector de período: etiqueta de BDLocal o, si falta, «Mes AAAA a Mes AAAA».
 await until(()=>dom["cx-period"].children.length>1);
 const labels=dom["cx-period"].children.map(o=>o.textContent);
 assert.equal(labels[0],"Automático (del título de Moodle)");
 assert.ok(labels.includes("Octubre 2025 a Marzo 2026")&&labels.includes("Mayo 2026 a Noviembre 2026"),labels.join(" | "));
 assert.equal(dom["cx-period"].children[1].value,"2026-05__2026-11","El valor sigue siendo el código.");
 S.periods=Object.keys(students);
 dom["cx-paste"].value=F.all();
 app.analyze();await until(()=>!S.working);
 assert.equal(S.books.length,4);
 const item=e=>S.items.find(i=>i.fila.correo===e);
 const ready=S.items.filter(i=>!i.blocked.length&&!i.skip).map(i=>i.fila.correo).sort();
 assert.equal(ready.join(","),["aordinaria","bsupletorio","csolosuple","donline","esuple","jblancos","wcero","yversion"].map(x=>x+"@itsqmet.edu.ec").join(","),
  JSON.stringify(S.items.map(i=>[i.fila.correo,i.blocked,i.skipReason])));
 assert.equal(item("donline@itsqmet.edu.ec").group,"ONLINE","Un mismo libro mezcla presencial y online.");
 assert.equal(item("aordinaria@itsqmet.edu.ec").group,"PRESENCIAL");
 assert.ok(item("erequisitos@itsqmet.edu.ec").blocked.some(b=>/9 requisitos: Financiero/.test(b)));
 assert.ok(item("operiodo@itsqmet.edu.ec").blocked.some(b=>/No tiene matrícula en Octubre 2025 a Marzo 2026; la tiene en Mayo 2026 a Noviembre 2026/.test(b)),"Los períodos se muestran con su nombre, no con el código.");
 assert.ok(item("fdoble@itsqmet.edu.ec").blocked.some(b=>/dos notas/.test(b)));
 assert.equal(item("dmena.prueba@itsqmet.edu.ec").skipReason,"Incompleto");
 assert.equal(item("cnorinde@itsqmet.edu.ec").skipReason,"No rindió");
 assert.equal(S.books[0].missing.length,1,"Avisa quién está matriculado y no aparece en Moodle.");
 assert.equal(dom["cx-count-ready"].textContent,8);

 app.save();await until(()=>!S.working);
 assert.equal(saved.length,8,"Solo se guardan las listas.");
 const docs=firestore.stored.notas_complexivo;
 assert.equal(docs.size,8);
 const d=docs.get(P+"__"+cedOf("bsupletorio@itsqmet.edu.ec"));
 assert.equal(d.notaOficial,7.26);assert.equal(d.oportunidadAplicada,"SUPLETORIO");assert.equal(d.notaOrdinaria,5.6);
 assert.equal(d.notaTeoricaSupletorio,6.9);assert.equal(d.grupoInforme,"PRESENCIAL");assert.equal(d.estadoEvaluacion,"APROBADO");
 assert.equal(d.cursoMoodle,"Examen Complexivo Educación Básica octubre marzo 2026");
 assert.equal(docs.get(P+"__"+cedOf("wcero@itsqmet.edu.ec")).estadoEvaluacion,"NO_APROBADO");
 assert.equal(docs.has(P+"__"+cedOf("dmena.prueba@itsqmet.edu.ec")),false,"El supletorio incompleto no se sube.");
 assert.match(dom["cx-message"].textContent,/8 nuevas .* Todo verificado/);
 const local=saved.find(x=>x.cedula===cedOf("yversion@itsqmet.edu.ec"));
 assert.equal(local.modalidadTitulacion,"EXAMEN_COMPLEXIVO");assert.equal(local.oportunidadAplicada,"SUPLETORIO");assert.equal(local.notaTeoricaSupletorio,9.6);

 // Idempotente.
 S.items.forEach(i=>{delete i.upload;});
 app.save();await until(()=>!S.working);
 assert.match(dom["cx-message"].textContent,/0 nuevas · 0 actualizadas · 8 ya iguales/);

 // Firebase editado a mano → «Volver a subir lo guardado» lo deja igual a BDLocal.
 const id=P+"__"+cedOf("aordinaria@itsqmet.edu.ec");
 docs.set(id,{...docs.get(id),notaOficial:1,dataHash:"manual"});
 dom["cx-period"].value=P;
 app.resync();await until(()=>!S.working);
 assert.equal(docs.get(id).notaOficial,7.52);
 assert.match(dom["cx-message"].textContent,/1 actualizadas · 7 ya iguales/);

 // Ya tiene trabajo de titulación → bloquea.
 evaluations.set(P+"__"+cedOf("aordinaria@itsqmet.edu.ec"),{periodoId:P,cedula:cedOf("aordinaria@itsqmet.edu.ec"),modalidadTitulacion:"TRABAJO_TITULACION",notaTrabajoTitulacion:8});
 dom["cx-period"].value="";dom["cx-paste"].value=F.basica;
 app.analyze();await until(()=>!S.working);
 assert.ok(item("aordinaria@itsqmet.edu.ec").blocked.some(b=>/trabajo de titulación/.test(b)));

 // El validador de Firebase rechaza una nota oficial que no respeta 40/60.
 assert.equal(sandbox.RequisitosFirebaseValidator.validate("notas_complexivo",{...d,notaOficial:6.43}).ok,false);
 console.log("VERIFICACIÓN NOTAS → COMPLEXIVO: OK (4 libros Moodle, 40/60 sin mezcla, Versión 2, incompletos, bloqueos y /notas_complexivo).");
})().catch(e=>{console.error("VERIFICACIÓN NOTAS → COMPLEXIVO: ERROR",e);process.exitCode=1;});
