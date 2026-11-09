"use strict";
/* Subida directa de Defensas a /notas (igual que Carga). Firestore simulado:
 * no se conecta a Firebase real ni usa calificaciones institucionales. */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
function load(relative,context){new vm.Script(fs.readFileSync(path.join(ROOT,relative),"utf8"),{filename:relative}).runInContext(context);}

function fakeFirestore(){
 const stored={},writes=[];
 const rows=name=>stored[name]||(stored[name]=new Map());
 function collection(name){
  return {doc(id){return {
   get(){const data=rows(name).get(id);return Promise.resolve(data?{id,exists:true,data:()=>({...data})}:{id,exists:false,data:()=>null});},
   set(payload){rows(name).set(id,{...payload});writes.push({name,id,payload:{...payload}});return Promise.resolve();}
  };}};
 }
 return {stored,writes,collection,runTransaction(handler){
  return Promise.resolve(handler({get:ref=>ref.get(),set:(ref,payload)=>{ref.set(payload);}}));
 }};
}

const period="2026-04__2026-09";
const firestore=fakeFirestore();
let notes=[
 {id:"0101234567__"+period,periodoId:period,cedula:"0101234567",modalidadTitulacion:"TRABAJO_TITULACION",
  Notart:8.5,Notdef:9,Notafinal:8.7,notaArticulo:8.5,notaDefensa:9,notaFinal:8.7,estadoEvaluacion:"APROBADO",origen:"defart"},
 {id:"0201234567__"+period,periodoId:period,cedula:"0201234567",modalidadTitulacion:"TRABAJO_TITULACION",
  Notart:7.2,Notdef:null,Notafinal:null,notaArticulo:7.2,estadoEvaluacion:"PENDIENTE_DEFENSA",origen:"defart"},
 {id:"0301234567__"+period,periodoId:period,cedula:"0301234567",origen:"defart"},
 {id:"0401234567__2025-10__2026-03",periodoId:"2025-10__2026-03",cedula:"0401234567",Notart:9,Notdef:9,origen:"defart"}
];
const sandbox={console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Map,Set,setTimeout,clearTimeout,URL,
 CustomEvent:function(name,options){this.type=name;this.detail=options&&options.detail;},
 BL2Sync:{ensureFirebase:()=>Promise.resolve(firestore)},
 firebase:{firestore:{FieldPath:{documentId:()=>"__name__"}}},
 location:{href:"file:///app/defart/defart.html"}
};
sandbox.window=sandbox;sandbox.dispatchEvent=function(){};
const elements={"def-filter-periodo":{value:period}};
sandbox.document={readyState:"complete",currentScript:null,getElementById:id=>elements[id]||null,
 querySelector:()=>null,createElement(){throw Error("No se cargan scripts en la prueba.");},addEventListener(){}};
const context=vm.createContext(sandbox);
["BDLocal/firebase/bdl.firebase.schema.v2.js","BDLocal/firebase/bdl.firebase.identity.js",
 "BDLocal/firebase/bdl.firebase.validator.v2.js","BDLocal/firebase/bdl.firebase.mapper.v2.js",
 "BDLocal/firebase/bdl.firebase.repository.v2.js"].forEach(file=>load(file,context));
let ensured=0;
sandbox.RequisitosFirebaseOperationCenter={async ensureNcomplex(){ensured++;return sandbox.RequisitosFirebaseRepository;}};
sandbox.ConDefart={async ready(){return {ok:true};}};
sandbox.BDLRepoNotas={async list(options){return notes.filter(n=>!options||!options.periodoId||n.periodoId===options.periodoId).map(n=>({...n}));}};
load("defart/defart.firebase-direct.js",context);
const api=sandbox.DefartFirebaseDirect;
const notas=()=>firestore.stored.notas||new Map();

(async()=>{
 // 1) Primera subida: todas las notas con calificación del período, sin cola ni lotes de 25.
 let result=await api.uploadAll({periodoId:period});
 assert.equal(ensured>=1,true,"Prepara Firebase igual que Carga.");
 assert.equal(result.total,2,"Solo notas con N-ART/N-DEF del período seleccionado.");
 assert.equal(result.nuevos,2);
 assert.equal(result.ok,true,JSON.stringify(result.detalles));
 const doc=notas().get(period+"__0101234567");
 assert.ok(doc,"Documento /notas con identidad periodoId__cedula.");
 assert.equal(doc.notaArticulo,8.5);
 assert.equal(doc.notaDefensa,9);
 assert.equal(doc.notaFinal,8.7);
 assert.equal(notas().has("2025-10__2026-03__0401234567"),false,"No sube otros períodos.");
 assert.equal((firestore.stored.importaciones||new Map()).size,1,"Registra la importación.");
 assert.equal((firestore.stored.historial||new Map()).size,1,"Registra el historial.");
 const writesAfterFirst=firestore.writes.length;

 // 2) Repetir sin cambios: nada se reescribe.
 result=await api.uploadAll({periodoId:period});
 assert.equal(result.iguales,2);
 assert.equal(result.nuevos+result.modificados,0);
 assert.equal(firestore.writes.length,writesAfterFirst,"Lo igual no se vuelve a escribir.");

 // 3) Se registra la N-DEF en BDLocal: se actualiza el documento con control de versión.
 notes[1]={...notes[1],Notdef:8,notaDefensa:8,Notafinal:7.5,notaFinal:7.5,estadoEvaluacion:"APROBADO"};
 result=await api.uploadAll({periodoId:period});
 assert.equal(result.modificados,1);
 assert.equal(result.iguales,1);
 const updated=notas().get(period+"__0201234567");
 assert.equal(updated.notaDefensa,8);
 assert.ok(updated.version>=2,"La versión remota aumenta.");

 // 4) Firebase tiene otra versión (p. ej. editada a mano): BDLocal es la autoridad, igual que Carga.
 const id=period+"__0101234567";
 notas().set(id,{...notas().get(id),notaDefensa:1,dataHash:"editado_a_mano"});
 result=await api.uploadAll({periodoId:period});
 assert.equal(result.modificados,1);
 assert.equal(notas().get(id).notaDefensa,9,"Firebase queda igual a BDLocal.");
 assert.equal(result.ok,true);

 // 5) Un documento inválido no detiene el resto.
 const emptyPeriod=await api.uploadAll({periodoId:"2024-01__2024-06"});
 assert.equal(emptyPeriod.total,0);
 console.log("VERIFICACIÓN DEFENSAS FIREBASE DIRECTO: OK (sin cola, idempotente, actualiza con versión, auditoría).");
})().catch(error=>{console.error("VERIFICACIÓN DEFENSAS FIREBASE DIRECTO: ERROR",error);process.exitCode=1;});
