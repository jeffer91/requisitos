"use strict";
/* Pruebas sintéticas; no toca estudiantes, credenciales ni Firebase reales. */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const src=p=>fs.readFileSync(path.join(root,p),"utf8");
const scripts=[
 "BDLocal/firebase/bdl.firebase.schema.v2.js",
 "BDLocal/firebase/bdl.firebase.identity.js",
 "BDLocal/firebase/bdl.firebase.validator.v2.js",
 "Ncomplex/ncomplex.nucleos.parser.js",
 "Ncomplex/ncomplex.nucleos.policy.js",
 "Ncomplex/ncomplex.nucleos.store.js",
 "Ncomplex/ncomplex.nucleos.firebase.js",
 "Ncomplex/ncomplex.nucleos.resolver.js",
 "Ncomplex/ncomplex.firebase-auth.js",
 "Ncomplex/ncomplex.center.js"
];
scripts.forEach(p=>assert.doesNotThrow(()=>new vm.Script(src(p),{filename:p})));
const window={BL2Config:{dbName:"REQUISITOS_BL2"},dispatchEvent(){},addEventListener(){}};
const document={};
const context=vm.createContext({window,document,console,Math,Date,Promise,Map,Set,CustomEvent:function(){}});
scripts.filter(p=>!p.endsWith("center.js")&&!p.endsWith("firebase-auth.js"))
.forEach(p=>new vm.Script(src(p),{filename:p}).runInContext(context));

const parser=window.NcomplexNucleosParser;
const raw=["T-NUCLEO - GESTIÓN COMERCIAL [Mod 13, OCT-MAR26]",
 "Nombre / Apellido(s)","Dirección de correo",
 "CuestionarioEVALUACIÓN PARCIAL 1","CuestionarioEVALUACIÓN PARCIAL 2",
 "CuestionarioEVALUACIÓN PARCIAL 3","CuestionarioEVALUACIÓN PARCIAL 4",
 "TareaTALLER PRÁCTICO 1","CuestionarioPRUEBA","Media de calificacionesTotal del curso",
 "ESTUDIANTE EJEMPLO UNO","alumno1@itsqmet.edu.ec",
 "9,00","10,00","10,00","10,00","10,00","10,00","9,83",
 "ESTUDIANTE EJEMPLO DOS","alumno2@itsqmet.edu.ec",
 "-","-","-","-","0,00","-","0,00"].join("\n");
const result=parser.parse(raw);
assert.equal(result.ok,true);
assert.equal(result.rows[1].taller,0);
assert.equal(result.rows[1].evaluaciones[0],null);
assert.equal(result.rows[0].totalMoodle,9.83);
const roster=[
 {cedula:"0101010101",Nombres:"ESTUDIANTE EJEMPLO UNO",correoInstitucional:"alumno1@itsqmet.edu.ec"},
 {cedula:"0202020202",Nombres:"ESTUDIANTE EJEMPLO DOS",correoInstitucional:"alumno2@itsqmet.edu.ec"}
];
const matched=parser.match(result.rows,roster);
assert.equal(matched.matched,2);
const unknown=parser.match([{...result.rows[0],correo:"otro@itsqmet.edu.ec",
 nombreCompleto:"NOMBRE DISTINTO",rowNumber:99}],roster);
assert.equal(unknown.matched,0);
assert.equal(unknown.review.length,1);
const corrected=parser.match([{...result.rows[0],correo:"otro@itsqmet.edu.ec",
 nombreCompleto:"NOMBRE DISTINTO",rowNumber:99}],roster,{"99":"0101010101"});
assert.equal(corrected.matched,1);
assert.equal(corrected.matches[0].matchMethod,"manual");
const allKeys=["academico","documentacion","financiero","practicas","vinculacion",
 "seguimientograduados","ingles","actualizaciondatos","titulacion"];
const requirements={requirements:allKeys.map(k=>({key:k,label:k,status:k==="titulacion"?"NO APLICA":"CUMPLE"}))};
assert.equal(window.NcomplexNucleosPolicy.check(requirements,"nucleos").eligible,true);
assert.equal(window.NcomplexNucleosPolicy.check(requirements,"complexivo").eligible,false);
const blocked={requirements:allKeys.map(k=>({key:k,label:k,status:k==="financiero"?"PENDIENTE":"CUMPLE"}))};
assert.equal(window.NcomplexNucleosPolicy.check(blocked,"nucleos").eligible,false);

const period="2025-10__2026-03",rows=[],cloud=new Map();
for(let n=0;n<58;n++){
 const cedula=String(1000000000+n);
 rows.push({id:cedula+"__"+period+"__N1",periodoId:period,cedula,nucleo:1,
   codigoCarrera:"ADMINISTRACION",nombreCarrera:"Administración",grupoInforme:"PRESENCIAL",
   evaluaciones:[9,8,7,6],taller:8,prueba:9,totalMoodle:8,
   estadoCarga:"CONCILIADO",habilitado:true,requisitosPendientes:[],
   sourceHash:"hash-"+n,updatedAt:"2026-11-05T14:00:00.000Z",
   estadoSync:"PENDIENTE",remoteHash:"",historialCambios:[]});
}
let writes=0,reads=0,allowWrite=true,guarded=0,inflight=0,maximumConcurrent=0;
const store=window.NcomplexNucleosStore={
 async list(p){return rows.filter(r=>r.periodoId===p).map(r=>({...r}));},
 async update(id,fields,guard){
  const r=rows.find(x=>x.id===id);
  assert.ok(r);
  if(guard&&r.updatedAt!==guard.updatedAt)throw new Error("Conflicto de versión local.");
  if(guard&&r.sourceHash!==guard.sourceHash)throw new Error("Conflicto de origen local.");
  guarded++;
  Object.assign(r,fields);
  return r;
 }
};
window.NcomplexFirebaseAuth={
 async requireUser(){return {email:"personal@itsqmet.edu.ec"};},
 async requireWriter(){if(!allowWrite)throw new Error("Sin rol institucional");return {email:"personal@itsqmet.edu.ec"};}
};
window.RequisitosFirebaseOperationCenter={async ensure(){}};
window.RequisitosFirebaseRepository={
 async getById(entity,id){assert.equal(entity,"evaluaciones_nucleos");reads++;return cloud.get(id)||null;},
 async writeChecked(entity,doc,options){
  assert.equal(entity,"evaluaciones_nucleos");
  assert.ok(options.expected&&typeof options.expected.exists==="boolean","Toda escritura lleva la base remota leída.");
  inflight++;maximumConcurrent=Math.max(maximumConcurrent,inflight);
  try{
   await Promise.resolve(); // Simula latencia simultánea.
   const id=doc.periodoId+"__"+doc.cedula+"__N"+doc.nucleo;
   const old=cloud.get(id);
   if(old&&old.data.dataHash===doc.dataHash)return {ok:true,unchanged:true};
   const base=options.expected,matches=base.exists===false?!old:!!old&&old.data.dataHash===base.hash;
   // rows[0]: otro equipo escribe justo entre la lectura y la escritura.
   if(!matches||id===raceId){const error=new Error("Cambió en Firebase.");error.code="FIREBASE_CONFLICT";throw error;}
   writes++;cloud.set(id,{data:{...doc,version:1,createdAt:"2026-11-05T14:01:00.000Z"}});
   return {ok:true,unchanged:false};
  }finally{inflight--;}
 }
};
function remoteId(r){return r.periodoId+"__"+r.cedula+"__N"+r.nucleo;}
var raceId=remoteId(rows[0]);
const publisher=window.NcomplexNucleosFirebase;
const other={...publisher.remote(rows[0]),evaluaciones:[2,2,2,2]};
other.dataHash=publisher.hash({...other,dataHash:undefined});
other.version=1;other.createdAt="2026-11-05T14:00:00.000Z";
cloud.set(remoteId(rows[0]),{data:other});
const run=async()=>{
 let skip=[],processed=0,errors=0,conflicts=0;
 for(let i=0;i<5;i++){
  const result=await publisher.push({periodoId:period,grupoInforme:"PRESENCIAL",limit:25,skipIds:skip});
  processed+=result.processed;errors+=result.errors;conflicts+=result.conflicts;
  skip=skip.concat(result.attemptedIds);
  if(!result.processed||result.remaining===0)break;
 }
 assert.equal(processed,58,"Todos los registros deben ser intentados sin repetición");
 assert.equal(new Set(skip).size,58,"Cada nota debe procesarse una sola vez");
 assert.equal(conflicts,1,"No pisar un cambio remoto concurrente");
 assert.equal(errors,0);
 assert.equal(writes,57);
 assert.ok(maximumConcurrent>=2&&maximumConcurrent<=4,
  "Publicación de núcleos paralela pero con máximo de cuatro operaciones.");
 assert.equal(rows[0].estadoSync,"CONFLICTO");
 assert.equal(rows.filter(r=>r.estadoSync==="SINCRONIZADO").length,57);
 const denied=rows[1];
 denied.estadoSync="PENDIENTE";denied.remoteHash="";
 allowWrite=false;
 await assert.rejects(()=>publisher.push({periodoId:period,grupoInforme:"PRESENCIAL"}),/Sin rol institucional/);
 assert.equal(denied.estadoSync,"PENDIENTE");
 allowWrite=true;
 raceId="";
 const decision=await window.NcomplexNucleosResolver.resolve(rows[0],"local");
 assert.equal(decision.status,"PENDIENTE","Conservar BDLocal deja la nota lista para la próxima subida.");
 assert.equal(rows[0].remoteHash,other.dataHash);
 const reconciled=await publisher.push({periodoId:period,grupoInforme:"PRESENCIAL",limit:25});
 assert.equal(reconciled.published,1,"La subida directa escribe la versión elegida de BDLocal.");
 assert.equal(rows[0].estadoSync,"SINCRONIZADO");
 assert.equal(cloud.get(remoteId(rows[0])).data.evaluaciones[0],rows[0].evaluaciones[0],
  "Firebase queda igual a BDLocal.");
 // Elegir la versión de Firebase copia las notas verificadas sin sobrescribir cloud.
 const row=rows[2],changed={...publisher.remote(row),evaluaciones:[4,4,4,4],totalMoodle:4};
 changed.dataHash=publisher.hash({...changed,dataHash:undefined});
 changed.version=2;changed.createdAt="2026-11-05T14:00:00.000Z";
 cloud.set(remoteId(row),{data:changed});row.estadoSync="CONFLICTO";
 const retained=await window.NcomplexNucleosResolver.resolve(row,"firebase");
 assert.equal(retained.status,"SINCRONIZADO");
 assert.equal(row.evaluaciones[0],4);
 assert.equal(row.totalMoodle,4);
 assert.ok(guarded>0);
 assert.ok(reads>=57);
 const ui=src("Ncomplex/ncomplex.html"),center=src("Ncomplex/ncomplex.center.js");
 ["nc-show-conflicts","nc-firebase-login","nc-show-pending"].forEach(m=>assert.ok(ui.includes(m)));
 assert.ok(center.includes("moodlePeriodHint"));
 assert.ok(center.includes("parserN.match(relevant,selected,data.overrides)"),
  "Ncomplex concilia solo filas de matrículas habilitadas y aparta las excluidas.");
 assert.ok(center.includes("nineRequirements(s)"),"Requiere 9/9 requisitos CUMPLE para mostrar un estudiante.");
 const rules=src("firestore.rules");
 const nucleosRule=rules.slice(rules.indexOf("match /evaluaciones_nucleos/"),rules.indexOf("match /complexivo/{"));
 assert.ok(!nucleosRule.includes("request.auth"),"Subida directa sin login, igual que Carga.");
 assert.ok(src("BDLocal/conexiones/cone.inf.js").includes("evaluaciones_nucleos"));
 console.log("NCOMPLEX HARDENING: OK (58 notas, concurrencia 4, cambios concurrentes, conciliación, diferencias).");
};
run().catch(error=>{console.error(error);process.exitCode=1;});
