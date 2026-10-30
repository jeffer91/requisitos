"use strict";
/* Verifica en memoria asignación atómica, recuperación del mismo número y ausencia de duplicados. */
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const source=fs.readFileSync(path.join(__dirname,"../Actas/actas.numbering.js"),"utf8");
const store=new Map(),versions=new Map();
const key=(type,id)=>type+"/"+id;
const documentRef=(collection,id)=>({collection,id,key:key(collection,id)});
const snapshot=ref=>({id:ref.id,exists:store.has(ref.key),data:()=>store.get(ref.key)||null});
const db={
 collection(name){return {doc(id){return { ...documentRef(name,id),async get(){return snapshot(this)}};},
  where(field,operator,value){assert.equal(operator,"==");return {async get(){return {docs:[...store].filter(([k,row])=>k.startsWith(name+"/")&&row[field]===value).map(([k,row])=>({id:k.slice(name.length+1),exists:true,data:()=>row}))}}}};},
 async runTransaction(fn,options){
  for(let attempt=0;attempt<16;attempt++){
   const reads=new Map(),writes=[];
   const tx={async get(ref){reads.set(ref.key,versions.get(ref.key)||0);return snapshot(ref);},
    set(ref,value){writes.push({ref,value});}};
   const result=await fn(tx);
   await new Promise(resolve=>setImmediate(resolve));
   if([...reads].some(([k,v])=>(versions.get(k)||0)!==v))continue;
   for(const {ref,value} of writes){store.set(ref.key,value);versions.set(ref.key,(versions.get(ref.key)||0)+1);}
   return result;
  }
  throw Error("Transacción agotó los reintentos");
 }
};
const context={window:{db},document:{baseURI:"https://ejemplo.test/Actas/actas.html"},Date,URL,Intl,Promise,Map,Set,console};
vm.createContext(context);vm.runInContext(source,context);
const api=context.window.ActasNumbering;
const period="2025-10__2026-03";
const input=(cedula,modalidad="EXAMEN_COMPLEXIVO")=>({cedula,periodoId:period,modalidad,nombre:"ESTUDIANTE PRUEBA",carrera:"ADMINISTRACIÓN"});
async function main(){
 const a=input("1313806919"),b=input("1313888877"),c=input("1724999911");
 const [one,two,oneAgain,three]=await Promise.all([api.getOrAssign(a),api.getOrAssign(b),api.getOrAssign(a),api.getOrAssign(c)]);
 assert.equal(one.numeroActa,oneAgain.numeroActa,"El mismo estudiante conserva su número al registrar simultáneamente");
 assert.equal(new Set([one.numeroActa,two.numeroActa,three.numeroActa]).size,3,"Dos equipos concurrentes no repiten números");
 assert.ok([one,two,three].every(x=>/^\d{4}-\d{4}-\d{2}-\d{4}$/.test(x.numeroActa)),"Formato año-cédula-mes-consecutivo");
 assert.equal((await api.lookup(a)).numeroActa,one.numeroActa);
 assert.equal((await api.list(period)).length,3);
 assert.equal(store.size,7,"Tres identidades, tres reservas y un contador central");
 await assert.rejects(()=>api.getOrAssign(input(a.cedula,"TRABAJO_TITULACION")),/otra modalidad/,"No se duplica la misma cédula/período cambiando modalidad");
 assert.equal(store.size,7);
 const offline={...a,cedula:"0999999999"};
 const before=store.size;
 const original=db.runTransaction;db.runTransaction=async()=>{throw Error("unavailable: offline");};
 await assert.rejects(()=>api.getOrAssign(offline),/offline/);
 assert.equal(store.size,before,"Sin conexión no se inventa un número oficial");
 db.runTransaction=original;
 const rules=fs.readFileSync(path.join(__dirname,"../firestore.rules"),"utf8");
 for(const collection of ["actas_registro","actas_numeros","actas_contadores"])assert.match(rules,new RegExp("match /"+collection+"/"),"Reglas centralizadas para "+collection);
 assert.match(rules,/getAfter\(/,"Escrituras asociadas atómicamente en reglas");
 assert.match(rules,/allow update, delete: if false/,"Actas registradas inmutables");
 const cover=fs.readFileSync(path.join(__dirname,"../Actas/actas.pdf.js"),"utf8");
 assert.match(cover,/N.º DE ACTA:/,"Número en el cuerpo de la segunda página");
 assert.match(fs.readFileSync(path.join(__dirname,"../Actas/actas.html"),"utf8"),/actas\.numbering\.js/,"Se carga la numeración");
 console.log("VERIFICACIÓN ACTAS NUMERACIÓN: OK (transacciones, concurrencia, idempotencia, reglas y desconexión)");
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
