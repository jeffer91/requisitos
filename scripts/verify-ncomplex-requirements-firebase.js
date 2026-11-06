"use strict";
/* No se conecta a Firebase real ni altera calificaciones institucionales. */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const load=p=>fs.readFileSync(path.join(root,p),"utf8");
const window={};
const env={window,console,Date,Math,Promise,Map,Set};
vm.createContext(env);
vm.runInContext(load("BDLocal/rules/bdl.rules.evaluaciones-titulacion.js"),env);
const rules=window.BDLRulesEvaluacionesTitulacion;
const status={"Académico":"CUMPLE","Documentación":"CUMPLE","Financiero":"CUMPLE",
"Prácticas":"CUMPLE","Vinculación":"CUMPLE","Seguimiento graduados":"CUMPLE",
"Inglés":"CUMPLE","Actualización de datos":"CUMPLE","Titulación":"CUMPLE"};
const full=rules.evaluateRequirements(status,[]);
assert.equal(full.eligible,true);assert.equal(full.complete,9);
const blocked=rules.evaluateRequirements({...status,Financiero:"PENDIENTE"},[]);
assert.equal(blocked.eligible,false);assert.equal(blocked.complete,8);
assert.match(blocked.reason,/Financiero/);
assert.equal(rules.evaluateRequirements({...status,Titulación:undefined},[]).eligible,false);
assert.equal(rules.evaluateRequirements({},[{valores:{...status}}]).eligible,true);
const period="2026-04__2026-09",id="0101234567";
let cloudWrites=[],confirmations=0,requirements=full,remote=new Map();
const note={periodoId:period,cedula:id,modalidadTitulacion:"EXAMEN_COMPLEXIVO",
 notaTeorica:9.7,notaPractica:9,notaComplexivo:9.28,notaOficial:9.28,
 estadoEvaluacion:"APROBADO",oportunidadAplicada:"ORDINARIA",notaMinimaAprobacion:7};
const student={periodoId:period,cedula:id,Nombres:"ESTUDIANTE EJEMPLO",modalidad:"presencial"};
const el={
 "ncomplex-filter-periodo":{value:period},
 "ncomplex-complexivo-grupo":{value:"PRESENCIAL"},
 "ncomplex-btn-complexivo-sync":{disabled:false},
 "ncomplex-firebase-status":{textContent:"",className:""}
};
window.confirm=()=>{confirmations++;return true;};
window.NcomplexState={get:()=>({dirty:{}})};
window.NcomplexFirebaseAuth={async requireWriter(){return {uid:"test-user"};}};
window.ConNcomplex={
 async listEvaluations(){return [note];},
 async listStudents(){return [student];},
 async checkRequirements(){return requirements;}
};
window.RequisitosFirebaseOperationCenter={async ensure(){}};
window.RequisitosFirebaseRepository={
 async getById(entity,key){assert.equal(entity,"complexivo");return remote.get(key)||null;},
 async writeChecked(entity,doc,option){
  assert.equal(entity,"complexivo");assert.equal(option.expected.exists,false);
  const key=period+"__"+doc.cedula;
  assert.equal(remote.has(key),false);
  cloudWrites.push(doc);remote.set(key,{data:doc});return {ok:true};
 }
};
const document={readyState:"loading",getElementById:id=>el[id]||null,addEventListener(){}};
const publisherEnv={window,document,console,Map,Set,Math,Date,Number,Object,Promise};
vm.createContext(publisherEnv);
vm.runInContext(load("Ncomplex/ncomplex.firebase-complexivo.js"),publisherEnv);
async function run(){
 requirements=blocked;
 let result=await window.NcomplexFirebaseComplexivo.publish();
 assert.equal(result.published,0);
 assert.equal(cloudWrites.length,0,"Ningún documento sin 9/9 requisitos");
 assert.match(el["ncomplex-firebase-status"].textContent,/Financiero/);
 requirements=full;
 result=await window.NcomplexFirebaseComplexivo.publish();
 assert.equal(result.published,1,"La primera publicación crea el documento");
 assert.equal(cloudWrites.length,1);
 result=await window.NcomplexFirebaseComplexivo.publish();
 assert.equal(result.published,0,"Repetir no duplica documentos");
 assert.equal(cloudWrites.length,1);
 el["ncomplex-complexivo-grupo"].value="";
 result=await window.NcomplexFirebaseComplexivo.publish();
 assert.equal(result.ok,false);
 assert.match(el["ncomplex-firebase-status"].textContent,/Grupo/);
 console.log("VERIFICACIÓN NCOMPLEX FIREBASE 9/9: OK (sin requisitos, creación, idempotencia, grupo)");
}
run().catch(e=>{console.error(e);process.exitCode=1;});
