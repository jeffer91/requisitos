"use strict";
/* Contrato del Centro Ncomplex: pruebas sintéticas sin tocar datos reales ni Firebase. */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const source=p=>fs.readFileSync(path.join(root,p),"utf8");
const files=[
  "BDLocal/firebase/bdl.firebase.schema.v2.js",
  "BDLocal/firebase/bdl.firebase.identity.js",
  "BDLocal/firebase/bdl.firebase.validator.v2.js",
  "Ncomplex/ncomplex.nucleos.parser.js",
  "Ncomplex/ncomplex.nucleos.policy.js",
  "Ncomplex/ncomplex.nucleos.store.js",
  "Ncomplex/ncomplex.nucleos.firebase.js",
  "Ncomplex/ncomplex.center.js"
];
files.forEach(p=>assert.doesNotThrow(()=>new vm.Script(source(p),{filename:p})));
const window={
 BL2Config:{dbName:"REQUISITOS_BL2"},addEventListener(){},dispatchEvent(){},NcomplexCenter:null
};
const context=vm.createContext({window,console,CustomEvent:function(){},Promise,Map,Set});
for(const file of files.filter(p=>!p.endsWith("center.js"))){
  new vm.Script(source(file),{filename:file}).runInContext(context);
}
window.NcomplexFirebaseAuth={requireWriter:async()=>({email:"institucional@itsqmet.edu.ec"})};
const parser=window.NcomplexNucleosParser;
const moodle=[
"T-NUCLEO - GESTIÓN COMERCIAL [Mod 13, OCT-MAR26]",
"Nombre / Apellido(s)","Dirección de correo",
"CuestionarioEVALUACIÓN PARCIAL 1","CuestionarioEVALUACIÓN PARCIAL 2",
"CuestionarioEVALUACIÓN PARCIAL 3","CuestionarioEVALUACIÓN PARCIAL 4",
"TareaTALLER PRÁCTICO 1","CuestionarioPRUEBA","Media de calificacionesTotal del curso",
"ESTUDIANTE EJEMPLO UNO","alumno1@itsqmet.edu.ec",
"9,00","10,00","10,00","10,00","10,00","10,00","9,83",
"ESTUDIANTE EJEMPLO DOS","alumno2@itsqmet.edu.ec",
"-","-","-","-","0,00","-","0,00"
].join("\n");
const parsed=parser.parse(moodle);
assert.equal(parsed.ok,true);
assert.deepEqual(Array.from(parsed.headers),["e1","e2","e3","e4","taller","prueba","totalMoodle"]);
assert.deepEqual(Array.from(parsed.rows[0].evaluaciones),[9,10,10,10]);
assert.equal(parsed.rows[0].totalMoodle,9.83);
assert.deepEqual(Array.from(parsed.rows[1].evaluaciones),[null,null,null,null]);
assert.equal(parsed.rows[1].taller,0,"Cero no equivale a nota faltante");
assert.equal(parsed.rows[1].prueba,null);
const students=[
 {cedula:"0101010101",Nombres:"ESTUDIANTE EJEMPLO UNO",correoInstitucional:"alumno1@itsqmet.edu.ec"},
 {cedula:"0202020202",Nombres:"ESTUDIANTE EJEMPLO DOS",correoInstitucional:"alumno2@itsqmet.edu.ec"}
];
const matching=parser.match(parsed.rows,students);
assert.equal(matching.matched,2);
assert.equal(matching.review.length,0);
const duplicate=parser.match(parsed.rows.concat([parsed.rows[0]]),students);
assert.equal(duplicate.matched,1,"No guardar notas de identidad repetida sin elegir una fila.");
assert.equal(duplicate.review.length,2,"Ambas filas duplicadas requieren decisión.");
const period="2025-10__2026-03",cedula="0101010101",id=cedula+"__"+period+"__N4";
const record={
 id,periodoId:period,cedula,codigoCarrera:"550413A02-P-1701",
 nombreCarrera:"ADMINISTRACIÓN",grupoInforme:"PRESENCIAL",nucleo:4,nombreNucleo:"Gestión Comercial",
 cursoMoodle:parsed.course,evaluaciones:[9,10,10,10],taller:10,prueba:10,totalMoodle:9.83,
 estadoCarga:"CONCILIADO",habilitado:true,requisitosPendientes:[],observaciones:"",
 origen:"Ncomplex Moodle",sourceHash:"moodle_hash",importacionId:"import_1",
 createdAt:"2026-11-05T00:00:00.000Z",updatedAt:"2026-11-05T00:00:00.000Z",
 version:1,estadoSync:"PENDIENTE",remoteHash:""
};
const remote=window.NcomplexNucleosFirebase.remote(record);
const good={requirements:["academico","documentacion","financiero","practicas","vinculacion","seguimientograduados","ingles","actualizaciondatos","titulacion"].map(k=>({key:k,status:k==="titulacion"?"NO APLICA":"CUMPLE",label:k}))};
assert.equal(window.NcomplexNucleosPolicy.check(good,"nucleos").eligible,true);
assert.equal(window.NcomplexNucleosPolicy.check(good,"complexivo").eligible,false);
const explicit=parser.match(parsed.rows,students,{"1":"0101010101"});
assert.equal(explicit.matched,2);
const identity=window.RequisitosFirebaseIdentity;
const remoteId=identity.entityDocumentId("notas_nucleos",record);
assert.equal(remoteId,period+"__"+cedula+"__N4");
assert.equal(identity.entityLocalId("notas_nucleos",record),id);
const valid=window.RequisitosFirebaseValidator.validate("notas_nucleos",
 {...remote,version:1,createdAt:record.createdAt},{documentId:remoteId});
assert.equal(valid.ok,true,valid.errors.join("; "));
assert.equal(window.RequisitosFirebaseSchema.collections.notas_nucleos,"notas_nucleos");
const invalid=window.RequisitosFirebaseValidator.validate("notas_nucleos",
 {...remote,evaluaciones:[9,11,null,null],version:1},{documentId:remoteId});
assert.equal(invalid.ok,false,"No admitir calificaciones mayores de 10.");
let local={...record},cloud=new Map(),writes=0,updateCalls=0,concurrent=false;
window.NcomplexNucleosStore={
 async list(periodId){return periodId===period?[{...local}]:[];},
 async update(localId,fields){assert.equal(localId,id);local={...local,...fields};updateCalls++;return local;}
};
window.RequisitosFirebaseOperationCenter={async ensure(){}};
window.RequisitosFirebaseRepository={
 async getById(entity,key){assert.equal(entity,"notas_nucleos");return cloud.get(key)||null;},
 async writeChecked(entity,doc,opts){
   assert.equal(entity,"notas_nucleos");
   const key=period+"__"+doc.cedula+"__N"+doc.nucleo;
   const old=cloud.get(key),expected=opts.expected||{};
   if(old&&old.data.dataHash===doc.dataHash)return {ok:true,unchanged:true};
   // Igual que el repositorio real: solo escribe si el remoto sigue siendo el leído.
   const same=expected.exists===false?!old:!!old&&old.data.dataHash===expected.hash;
   if(!same||concurrent){const err=Error("Cambió en Firebase");err.code="FIREBASE_CONFLICT";throw err;}
   writes++;cloud.set(key,{data:{...doc}});return {ok:true,unchanged:false};
 }
};
async function run(){
 const sync=window.NcomplexNucleosFirebase;
 const first=await sync.push({periodoId:period,grupoInforme:"PRESENCIAL"});
 assert.equal(first.published,1);
 assert.equal(writes,1);
 assert.equal(local.estadoSync,"SINCRONIZADO");
 assert.equal(local.remoteHash,remote.dataHash);
 assert.equal(cloud.size,1);
 const second=await sync.push({periodoId:period,grupoInforme:"PRESENCIAL"});
 assert.equal(second.published,0);
 assert.equal(writes,1,"No duplicar sincronización idéntica");
 // Otra versión remota: BDLocal es la autoridad (igual que Carga) y se actualiza.
 local.estadoSync="PENDIENTE";local.totalMoodle=8.83;
 cloud.set(remoteId,{data:{dataHash:"otra_version",version:1}});
 const changed=await sync.push({periodoId:period,grupoInforme:"PRESENCIAL"});
 assert.equal(changed.published,1,"Actualiza la versión distinta con la nota local");
 assert.equal(writes,2);
 assert.equal(cloud.get(remoteId).data.totalMoodle,8.83);
 assert.equal(local.estadoSync,"SINCRONIZADO");
 // Cambio de otro equipo entre la lectura y la escritura: conflicto, sin pisar.
 local.estadoSync="PENDIENTE";local.totalMoodle=7.5;
 concurrent=true;
 const raced=await sync.push({periodoId:period,grupoInforme:"PRESENCIAL"});
 concurrent=false;
 assert.equal(raced.conflicts,1);
 assert.equal(writes,2);
 assert.equal(local.estadoSync,"CONFLICTO");
 // Un registro en conflicto se reintenta en la siguiente subida directa.
 const retried=await sync.push({periodoId:period,grupoInforme:"PRESENCIAL"});
 assert.equal(retried.published,1);
 assert.equal(local.estadoSync,"SINCRONIZADO");
 assert.ok(updateCalls>=2);
 const html=source("Ncomplex/ncomplex.html");
 for(const marker of ["nc-tab-nucleos","nc-tab-complexivo","nc-publish","nc-paste","nc-table","nc-legacy"]){
  assert.ok(html.includes(marker),"Falta control visual "+marker);
 }
 const rules=source("firestore.rules");
 assert.ok(rules.includes("match /notas_nucleos/{documentId}"));
 const block=rules.slice(rules.indexOf("match /notas_nucleos/{documentId}"));
 const nucleosRule=block.slice(0,block.indexOf("allow delete"));
 assert.ok(!nucleosRule.includes("request.auth"),"Subida directa sin login, igual que Carga");
 assert.ok(nucleosRule.includes("__N[1-4]$"),"Se valida la identidad del documento (período + cédula + núcleo)");
 console.log("NCOMPLEX CENTRO: OK; Moodle, ceros, identidades, Firebase, conflictos y UI.");
}
run().catch(err=>{console.error(err);process.exitCode=1;});
