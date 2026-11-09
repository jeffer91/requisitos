"use strict";
/* Notas → Trabajo: lector de actas SENESCYT, bloqueos y subida a /notas_trabajo.
 * Datos ficticios; Firestore y BDLocal simulados. */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const F=require("./fixtures/trabajo-actas.js");
const Parser=require("../Trabajo/trabajo.parser.js");

// ---------- 1. Lector ----------
let parsed=Parser.parse(F.text());
assert.equal(parsed.total,3);
assert.equal(parsed.validas,3,JSON.stringify(parsed.actas.map(a=>a.errors)));
const [a1,a2,a3]=parsed.actas.map(r=>r.acta);
assert.equal(a1.cedula,"1700000001");assert.equal(a1.codigoCarrera,"550417A01-P-1701");
assert.equal(a1.numeroActaSenescyt,"4136");assert.equal(a1.fechaActaGrado,"2026-04-14");
assert.deepEqual(a1.vocales.map(v=>v.nombre),["VOCAL UNO A","VOCAL DOS A","VOCAL TRES A"]);
assert.equal(a1.notaFinal,7.6);assert.equal(a1.notaFinalCalculada,7.6);
assert.deepEqual(a2.evaluacionPractica.totalesPorVocal,[9,8.5,8]);
assert.equal(a2.promedioEvaluacionPractica,8.5);assert.equal(a2.notaFinal,8.2);
assert.deepEqual(a3.evaluacionPractica.criterios[0].notas,[2,1,1]);
assert.equal(a3.promedioDefensaOral,7.75);assert.equal(a3.notaFinal,8.5);

// Acta mal copiada: un criterio cambiado ya no cuadra con el total del vocal.
const tampered=F.block({...F.actas[1],practica:F.actas[1].practica.map((r,i)=>i===0?[r[0],r[1],"1,00",r[3],r[4]]:r)});
let bad=Parser.parse(tampered).actas[0];
assert.equal(bad.ok,false);
assert.ok(bad.errors.some(e=>/primer vocal dice 9 pero sus criterios suman 8/.test(e)),bad.errors.join(" | "));
// Nota final que no respeta 60/40.
bad=Parser.parse(F.block({...F.actas[0],p5:"7,5"})).actas[0];
assert.ok(bad.errors.some(e=>/60 % escrito \+ 40 % defensa oral = 7.6, el acta dice 7.5/.test(e)));
// Puntaje sobre el máximo.
bad=Parser.parse(F.block({...F.actas[0],defensa:F.actas[0].defensa.map((r,i)=>i===0?[r[0],r[1],"2,50",r[3],r[4]]:r),totalDefensa:["7,50","7,00","7,00"],p3:"7,17"})).actas[0];
assert.ok(bad.errors.some(e=>/puso 2.5 sobre 2/.test(e)));
// Acta repetida para otra cédula dentro de lo pegado.
const dup=Parser.parse(F.text()+"\n\n"+F.block({...F.actas[2],cedula:"1700000009"}));
assert.ok(dup.actas[3].errors.some(e=>/El acta 4135 aparece también/.test(e)));
// Cédula de 9 dígitos recupera el cero inicial.
assert.equal(Parser.parse(F.block({...F.actas[0],cedula:"912345678"})).actas[0].acta.cedula,"0912345678");

// ---------- 2. Pantalla con BDLocal y Firestore simulados ----------
function fakeFirestore(){
 const stored={};const rows=n=>stored[n]||(stored[n]=new Map());
 return {stored,collection(name){return {doc(id){return {
  get(){const d=rows(name).get(id);return Promise.resolve(d?{id,exists:true,data:()=>({...d})}:{id,exists:false,data:()=>null});},
  set(p){rows(name).set(id,JSON.parse(JSON.stringify(p)));return Promise.resolve();}};}};},
  runTransaction(h){return Promise.resolve(h({get:r=>r.get(),set:(r,p)=>r.set(p)}));}};
}
const period="2025-10__2026-03";
const firestore=fakeFirestore();
function el(id){
 return {id,value:"",textContent:"",className:"",hidden:false,disabled:false,children:[],
  appendChild(c){this.children.push(c);return c;},addEventListener(){},querySelector(){return tbody;}};
}
const tbody=el("tbody");
const ids=["tt-period","tt-roster","tt-paste","tt-analyze","tt-save","tt-resync","tt-clear","tt-message","tt-results","tt-table","tt-count-total","tt-count-ready","tt-count-blocked","tt-saved"];
const dom=Object.fromEntries(ids.map(id=>[id,el(id)]));
Object.defineProperty(dom["tt-table"],"querySelector",{value:()=>tbody});
Object.defineProperty(tbody,"textContent",{set(v){this.children=[];},get(){return "";}});
const students={
 [period]:[
  {cedula:"1700000001",periodoId:period,estadoMatricula:"ACTIVO",CodigoCarrera:"550417A01-P-1701"},
  {cedula:"1700000002",periodoId:period,estadoMatricula:"ACTIVO",CodigoCarrera:"550414G01-P-1701"},
  {cedula:"1700000003",periodoId:period,estadoMatricula:"ACTIVO",CodigoCarrera:"550613A01-P-1701"}
 ],
 "2026-04__2026-09":[{cedula:"1700000004",periodoId:"2026-04__2026-09",estadoMatricula:"ACTIVO",CodigoCarrera:"550417A01-P-1701"}]
};
// Lo que adjunta BDLocal al listar: Aprobación final (Aprobación titulación + Aprobación complexivo/proyecto).
let approved={"1700000001":true,"1700000002":false,"1700000003":true,"1700000004":true};
const withFinal=s=>({...s,aprobacionFinal:approved[s.cedula]===true,
 _aprobacionFinal:approved[s.cedula]?{eligible:true,reason:""}:{eligible:false,reason:"Aprobación titulación (NO CUMPLE)"}});
const evaluations=new Map();const savedRows=[];
const ConNcomplex={
 async ready(){return {ok:true};},
 async listPeriods(){return Object.keys(students).map(id=>({id}));},
 async listStudents(o){return (students[o.periodoId]||[]).map(withFinal);},
 async checkRequirements(){throw Error("Ya no se consulta estudiante por estudiante.");},
 async getEvaluation(){throw Error("Ya no se consulta estudiante por estudiante.");},
 async saveMany(rows){rows.forEach(r=>{savedRows.push(r);evaluations.set(r.periodoId+"__"+r.cedula,{...r});});return rows;},
 async listEvaluations(o){return [...evaluations.values()].filter(r=>r.periodoId===o.periodoId);}
};
const sandbox={console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Map,Set,setTimeout,clearTimeout,URL,
 CustomEvent:function(n,o){this.type=n;this.detail=o&&o.detail;},dispatchEvent(){},
 BL2Sync:{ensureFirebase:()=>Promise.resolve(firestore)},
 firebase:{firestore:{FieldPath:{documentId:()=>"__name__"}}},
 location:{href:"file:///app/Trabajo/trabajo.html"},ConNcomplex,
 document:{readyState:"loading",baseURI:"file:///app/Trabajo/trabajo.html",currentScript:null,
  getElementById:id=>dom[id]||null,addEventListener(){},
  createElement(tag){const n=el(tag);n.tag=tag;return n;}}
};
sandbox.window=sandbox;
const ctx=vm.createContext(sandbox);
const load=f=>new vm.Script(fs.readFileSync(path.join(ROOT,f),"utf8"),{filename:f}).runInContext(ctx);
["BDLocal/firebase/bdl.firebase.schema.v2.js","BDLocal/firebase/bdl.firebase.identity.js","BDLocal/firebase/bdl.firebase.validator.v2.js",
 "BDLocal/firebase/bdl.firebase.mapper.v2.js","BDLocal/firebase/bdl.firebase.repository.v2.js",
 "Trabajo/trabajo.parser.js","Trabajo/trabajo.firebase.js","Trabajo/trabajo.app.js"].forEach(load);
sandbox.RequisitosFirebaseOperationCenter={async ensureNcomplex(){return true;}};
const app=sandbox.TrabajoApp,st=app._state;
const tick=()=>new Promise(r=>setTimeout(r,0));
async function until(test){for(let i=0;i<200;i++){if(test())return;await tick();}throw Error("timeout");}

(async()=>{
 // Sin período no analiza.
 dom["tt-paste"].value=F.text();
 app.analyze();assert.match(dom["tt-message"].textContent,/Seleccione el período/);
 st.periods=Object.keys(students);
 // Elegir el período: una sola lectura arma la lista de habilitados.
 dom["tt-period"].value=period;
 await app.loadRoster(period);
 assert.match(dom["tt-message"].textContent,/BDLocal leída en .* 2 habilitado\(s\) con Aprobación final de 3 matrícula\(s\) activa\(s\) · 0 con acta guardada/);
 assert.equal(dom["tt-roster"].hidden,false,"Se ve la lista de habilitados.");
 // Cuarto estudiante matriculado en otro período: se indica dónde está.
 const extra=F.block({...F.actas[0],cedula:"1700000004",acta:"4999"});
 dom["tt-paste"].value=F.text()+"\n\n"+extra;
 app.analyze();await until(()=>!st.working);
 assert.equal(st.checked.length,4);
 const by=c=>st.checked.find(i=>i.acta.cedula===c);
 assert.equal(by("1700000001").blocked.length,0,by("1700000001").blocked.join(" | "));
 assert.equal(by("1700000001").group,"PRESENCIAL");
 assert.ok(by("1700000002").blocked.some(b=>/falta Aprobación final \(Aprobación titulación \(NO CUMPLE\)\)/.test(b)),"Sin Aprobación final se bloquea.");
 assert.ok(by("1700000004").blocked.some(b=>/tiene matrícula activa en Abril 2026 a Septiembre 2026/.test(b)));
 assert.equal(dom["tt-count-ready"].textContent,2);
 assert.equal(dom["tt-save"].disabled,false);

 // Guardar: BDLocal + Firebase /notas_trabajo solo las listas.
 app.save();await until(()=>!st.working);
 assert.equal(savedRows.length,2);
 const local=savedRows.find(r=>r.cedula==="1700000003");
 assert.equal(local.modalidadTitulacion,"TRABAJO_TITULACION");
 assert.equal(local.notaTrabajoTitulacion,8.5,"La nota oficial es la del acta.");
 assert.equal(local.actaTrabajo.numeroActaSenescyt,"4135");
 const docs=firestore.stored.notas_trabajo;
 assert.equal(docs.size,2);
 const d=docs.get(period+"__1700000003");
 assert.equal(d.numeroActaSenescyt,"4135");assert.equal(d.fechaActaGrado,"2026-04-14");
 assert.equal(d.grupoInforme,"PRESENCIAL");assert.equal(d.notaFinal,8.5);assert.equal(d.promedioDefensaOral,7.75);
 assert.equal(d.estadoEvaluacion,"APROBADO");assert.equal(d.vocales.length,3);
 assert.equal(d.evaluacionPractica.criterios.map(c=>c.criterio).join("|"),"Diseño|Construcción|Funcionamiento|Aplicación");
 assert.equal(docs.has(period+"__1700000002"),false,"Bloqueada por requisitos: no se sube.");
 assert.match(dom["tt-message"].textContent,/2 nuevas .* Todo verificado/);
 assert.ok(firestore.stored.importaciones.size===1&&firestore.stored.historial.size===1);

 // Repetir: idempotente.
 st.checked.forEach(i=>{delete i.upload;});
 app.save();await until(()=>!st.working);
 assert.match(dom["tt-message"].textContent,/0 nuevas · 0 actualizadas · 2 ya iguales/);

 // Ya tiene notas de complexivo: se bloquea.
 evaluations.set(period+"__1700000002",{periodoId:period,cedula:"1700000002",modalidadTitulacion:"EXAMEN_COMPLEXIVO",notaTeorica:8});
 approved["1700000002"]=true;delete st.students[period];
 await app.loadRoster(period);
 dom["tt-paste"].value=F.block(F.actas[1]);
 app.analyze();await until(()=>!st.working);
 assert.ok(st.checked[0].blocked.some(b=>/Ya está en examen complexivo: no puede tener trabajo de titulación/.test(b)));

 // Código de carrera distinto al de la matrícula: se bloquea.
 dom["tt-paste"].value=F.block({...F.actas[0],codigo:"550411C02-P-1701"});
 app.analyze();await until(()=>!st.working);
 assert.ok(st.checked[0].blocked.some(b=>/no coincide con la matrícula/.test(b)));

 // Firebase editado a mano: "Volver a subir lo guardado" lo deja igual a BDLocal.
 const id=period+"__1700000001";
 docs.set(id,{...docs.get(id),notaFinal:1,dataHash:"manual"});
 assert.equal(docs.get(id).notaFinal,1);
 // Lo mismo que hace el botón «Volver a subir lo guardado»:
 const rows=await ConNcomplex.listEvaluations({periodoId:period});
 const resDocs=rows.filter(r=>r.actaTrabajo).map(r=>sandbox.TrabajoFirebase.buildDocument(r.actaTrabajo,{periodoId:period,grupoInforme:r.grupoInforme}));
 const summary=await sandbox.TrabajoFirebase.upload(resDocs,{periodoId:period});
 assert.equal(summary.actualizados,1);assert.equal(summary.iguales,1);
 assert.equal(docs.get(id).notaFinal,7.6);

 // El validador de Firebase rechaza un documento incoherente.
 const v=sandbox.RequisitosFirebaseValidator.validate("notas_trabajo",{...docs.get(id),notaFinal:9});
 assert.equal(v.ok,false);
 console.log("VERIFICACIÓN NOTAS → TRABAJO: OK (lector 3 actas, validación de cálculos, bloqueos, BDLocal y /notas_trabajo).");
})().catch(e=>{console.error("VERIFICACIÓN NOTAS → TRABAJO: ERROR",e);process.exitCode=1;});
