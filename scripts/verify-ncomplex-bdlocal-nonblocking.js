"use strict";
/* Ncomplex: comprobar que períodos, matrículas y núcleos se leen sin subir
 * la versión de IndexedDB ni alterar las tablas académicas existentes. */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const source=p=>fs.readFileSync(path.join(root,p),"utf8");

const tables={
 settings:new Map([["preferencia_interfaz",{key:"preferencia_interfaz",value:"oscuro"}]]),
 periodos:new Map([["2025-10__2026-03",{id:"2025-10__2026-03",label:"Octubre 2025 a Marzo 2026"}]]),
 matriculas_periodo:new Map([["A",{id:"A",periodoId:"2025-10__2026-03",cedula:"0100000001",NombreCarrera:"Administración"}]]),
 evaluaciones_titulacion:new Map(),
 notas_titulacion:new Map()
};
const record={
 id:"0100000001__2025-10__2026-03__N1",
 periodoId:"2025-10__2026-03",cedula:"0100000001",nucleo:1,codigoCarrera:"ADMIN",
 nombreCarrera:"Administración",grupoInforme:"PRESENCIAL",
 evaluaciones:[9,8,7,6],taller:8,prueba:9,totalMoodle:8,
 estadoSync:"PENDIENTE",sourceHash:"moodle_1",updatedAt:"2026-11-05T20:00:00.000Z"
};
let dbOpens=0,manualUpgrades=0,changedExisting=0;
function clone(v){return JSON.parse(JSON.stringify(v));}
function mockDb(){
 return {
  version:7,
  objectStoreNames:{contains:name=>!!tables[name]},
  close(){},
  transaction(names,mode){
   assert.ok(mode==="readonly"||mode==="readwrite");
   names=Array.isArray(names)?names:[names];
   let pending=0,scheduled=false;
   const tx={oncomplete:null,onerror:null,onabort:null,error:null};
   function finished(){
    pending--;
    if(pending===0&&!scheduled){
     scheduled=true;
     queueMicrotask(()=>{scheduled=false;if(pending===0)tx.oncomplete?.();});
    }
   }
   function request(callback){
    pending++;
    const req={result:null,onsuccess:null,onerror:null};
    queueMicrotask(()=>{try{req.result=callback();req.onsuccess?.();finished();}catch(e){tx.error=e;tx.onerror?.();}});
    return req;
   }
   tx.objectStore=function(name){
    if(!names.includes(name)||!tables[name])throw Error("No store "+name);
    return {
     getAll(){return request(()=>Array.from(tables[name].values()).map(clone));},
     get(key){return request(()=>tables[name].has(key)?clone(tables[name].get(key)):undefined);},
     put(v){
      assert.equal(mode,"readwrite");
      return request(()=>{
       const key=name==="settings"?v.key:v.id;
       if(key==="preferencia_interfaz")changedExisting++;
       tables[name].set(key,clone(v));return key;
      });
     }
    };
   };
   return tx;
  }
 };
}
const db=mockDb();
const window={
 BL2DB:{async open(options){dbOpens++;assert.equal(options.skipRepair,true);return db;}},
 indexedDB:{async databases(){return [{name:"REQUISITOS_BL2",version:7}]},
  open(name){
   manualUpgrades++;
   assert.equal(name,"REQUISITOS_BL2");
   const req={result:db};queueMicrotask(()=>req.onsuccess?.());return req;
  }},
 addEventListener(){}
};
const context=vm.createContext({window,console,Promise});
new vm.Script(source("Ncomplex/ncomplex.nucleos.store.js")).runInContext(context);
new vm.Script(source("BDLocal/conexiones/cone.inf.js")).runInContext(context);
const store=window.NcomplexNucleosStore;
async function run(){
 assert.equal((await store.ready()).mode,"settings");
 assert.deepEqual(Array.from(await store.list("2025-10__2026-03")),[]);
 assert.equal(manualUpgrades,0,"Abrir Ncomplex no debe migrar ni bloquear la base");
 await store.saveMany([record]);
 assert.equal((await store.list("2025-10__2026-03")).length,1);
 assert.equal(tables.settings.get("preferencia_interfaz").value,"oscuro");
 assert.equal(changedExisting,0,"No modificar otras preferencias");
 const updated=await store.update(record.id,{estadoSync:"SINCRONIZADO",remoteHash:"hash1"},
  {updatedAt:record.updatedAt,sourceHash:record.sourceHash});
 assert.equal(updated.estadoSync,"SINCRONIZADO");
 assert.equal((await store.list("2025-10__2026-03"))[0].remoteHash,"hash1");
 await assert.rejects(()=>store.update(record.id,{evaluaciones:[0,0,0,0]},
  {updatedAt:"old",sourceHash:"wrong"}),/cambiaron/);
 assert.deepEqual(Array.from((await store.list("2025-10__2026-03"))[0].evaluaciones),[9,8,7,6]);
 const read=await window.ConInf.read({periodoId:"2025-10__2026-03"});
 assert.equal(read.students.length,1);
 assert.equal(read.periods.length,1);
 assert.equal(read.nuclei.length,1,"Inf debe leer los núcleos de settings en modo readonly");
 assert.equal(read.nuclei[0].remoteHash,"hash1");
 assert.equal(manualUpgrades,1,"Inf solo puede abrir IndexedDB sin versión");
 assert.ok(dbOpens>=4);
 console.log("NCOMPLEX BDLOCAL SIN BLOQUEOS: OK (período, estudiante, guardado, lectura, Inf, sin migraciones)");
}
run().catch(e=>{console.error(e);process.exitCode=1;});
