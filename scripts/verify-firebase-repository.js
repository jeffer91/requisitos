"use strict";
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const errors=[];
function load(relative,context){new vm.Script(fs.readFileSync(path.join(ROOT,relative),"utf8"),{filename:relative}).runInContext(context);}
function check(condition,message){if(!condition){errors.push(message);}}
function fakeFirestore(){
const writes=[];const queries=[];
const same="2026-07-23T12:00:00.000Z";
const stored={matriculas:[
{id:"2026-04__2026-09__1000000001",data:{id:"2026-04__2026-09__1000000001",periodoId:"2026-04__2026-09",cedula:"1000000001",nombreCarrera:"ENFERMERÍA",estadoMatricula:"ACTIVO",retirado:false,createdAt:same,updatedAt:same,version:1,dataHash:"haaaaaaaa",eliminado:false,eliminadoEn:""}},
{id:"2026-04__2026-09__1000000002",data:{id:"2026-04__2026-09__1000000002",periodoId:"2026-04__2026-09",cedula:"1000000002",nombreCarrera:"ENFERMERÍA",estadoMatricula:"ACTIVO",retirado:false,createdAt:same,updatedAt:same,version:1,dataHash:"hbbbbbbbb",eliminado:false,eliminadoEn:""}},
{id:"2026-04__2026-09__1000000003",data:{id:"2026-04__2026-09__1000000003",periodoId:"2026-04__2026-09",cedula:"1000000003",nombreCarrera:"ENFERMERÍA",estadoMatricula:"ACTIVO",retirado:false,createdAt:same,updatedAt:same,version:1,dataHash:"hcccccccc",eliminado:false,eliminadoEn:""}},
{id:"2025-10__2026-03__2000000001",data:{id:"2025-10__2026-03__2000000001",periodoId:"2025-10__2026-03",cedula:"2000000001",nombreCarrera:"OTRA",estadoMatricula:"ACTIVO",retirado:false,createdAt:same,updatedAt:same,version:1,dataHash:"hdddddddd",eliminado:false,eliminadoEn:""}}
]};
function rows(name){return stored[name]||(stored[name]=[]);}
function snapshot(name,id){const found=rows(name).find(item=>item.id===id);return found?{id,exists:true,data:()=>({...found.data})}:{id,exists:false,data:()=>null};}
function collection(name){
const q={name,where:[],orderBy:[],startAfter:null,limit:null};
const api={
where(field,operator,value){q.where.push([field,operator,value]);return api;},
orderBy(field,direction){q.orderBy.push([field,direction]);return api;},
startAfter(updatedAt,documentId){q.startAfter=[updatedAt,documentId];return api;},
limit(value){q.limit=value;return api;},
get(){
queries.push(JSON.parse(JSON.stringify(q)));
let result=rows(name).slice();
q.where.forEach(([field,operator,value])=>{
if(operator==="=="){result=result.filter(item=>item.data[field]===value);}
if(operator===">="){result=result.filter(item=>String(item.data[field]||"")>=String(value));}
});
result.sort((a,b)=>String(a.data.updatedAt).localeCompare(String(b.data.updatedAt))||a.id.localeCompare(b.id));
if(q.startAfter){result=result.filter(item=>String(item.data.updatedAt)>q.startAfter[0]||(String(item.data.updatedAt)===q.startAfter[0]&&item.id>q.startAfter[1]));}
result=result.slice(0,q.limit||999);
return Promise.resolve({docs:result.map(item=>({id:item.id,data:()=>({...item.data})}))});
},
doc(id){
return {
id,
get(){return Promise.resolve(snapshot(name,id));},
set(payload,options){
const index=rows(name).findIndex(item=>item.id===id);const item={id,data:{...payload}};
if(index>=0){rows(name)[index]=item;}else{rows(name).push(item);}writes.push({name,id,payload:{...payload},options});return Promise.resolve();
},
_name:name
};
}
};
return api;
}
return {
writes,queries,stored,collection,
runTransaction(handler){
const tx={
get(reference){return reference.get();},
set(reference,payload,options){reference.set(payload,options);}
};
return Promise.resolve(handler(tx));
}
};
}
(async()=>{
const firestore=fakeFirestore();
const sandbox={console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,setTimeout,clearTimeout,
CustomEvent:function(name,options){this.type=name;this.detail=options&&options.detail;},
BL2Sync:{ensureFirebase:()=>Promise.resolve(firestore)},
firebase:{firestore:{FieldPath:{documentId:()=>"__name__"}}}
};
sandbox.window=sandbox;sandbox.dispatchEvent=function(){};
const context=vm.createContext(sandbox);
["BDLocal/firebase/bdl.firebase.schema.v2.js","BDLocal/firebase/bdl.firebase.identity.js","BDLocal/firebase/bdl.firebase.validator.v2.js","BDLocal/firebase/bdl.firebase.mapper.v2.js","BDLocal/firebase/bdl.firebase.reverse-mapper.v2.js","BDLocal/firebase/bdl.firebase.repository.v2.js"].forEach(file=>load(file,context));
const repo=sandbox.RequisitosFirebaseRepository;
check(repo&&typeof repo.writeChecked==="function","Falta writeChecked");
const first=await repo.list("matriculas",{periodoId:"2026-04__2026-09",limit:2,includeDeleted:true});
check(first.total===2,"La primera página debe contener dos documentos");
check(first.cursorAfter.documentId.endsWith("1000000002"),"El cursor debe guardar el documentId del segundo documento");
const second=await repo.list("matriculas",{periodoId:"2026-04__2026-09",cursor:first.cursorAfter,limit:2,includeDeleted:true});
check(second.total===1&&second.documents[0].documentId.endsWith("1000000003"),"La segunda página debe recuperar el empate restante");
check(firestore.queries[0].where.some(item=>item[0]==="periodoId"&&item[1]==="=="),"La consulta debe filtrar por período");
check(firestore.queries[1].startAfter&&firestore.queries[1].startAfter[1]===first.cursorAfter.documentId,"La segunda página debe usar startAfter compuesto");
const remote=firestore.stored.matriculas[0].data;
let conflict=false;
try{
await repo.writeChecked("matriculas",{...remote,nombreCarrera:"CAMBIADA",dataHash:"hlocal000",version:1},{expected:{exists:true,hash:"hash_antiguo",version:1,updatedAt:remote.updatedAt}});
}catch(error){conflict=error.code==="FIREBASE_CONFLICT";}
check(conflict,"Una base remota distinta debe producir conflicto");
const same=await repo.writeChecked("matriculas",{...remote},{expected:{exists:true,hash:remote.dataHash,version:remote.version,updatedAt:remote.updatedAt}});
check(same.unchanged===true,"El mismo dataHash no debe volver a escribirse");
const status=repo.status();
check(status.readDocuments>=3,"El estado debe contar documentos leídos, no solo consultas");
check(status.queries>=2,"El estado debe contar consultas");
check(status.conflicts>=1,"El estado debe contar conflictos");
if(errors.length){console.error("\nVERIFICACIÓN FIREBASE REPOSITORY: ERROR\n");errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));process.exit(1);}
console.log("VERIFICACIÓN FIREBASE REPOSITORY: OK");
})().catch(error=>{console.error("VERIFICACIÓN FIREBASE REPOSITORY: ERROR",error);process.exit(1);});
