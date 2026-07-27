"use strict";

/* =========================================================
Archivo: verify-global-baselocal.js
Ruta: /scripts/verify-global-baselocal.js
Función:
- Verificar que Global arranque desde la caché compartida sin esperar tareas secundarias.
- Confirmar que cambios_pendientes se prepare antes de la política Firebase.
- Comprobar la actualización visual inmediata y la eliminación de renders duplicados.
- Evitar regresiones en la ruta interna del repositorio de notas.
========================================================= */

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const errors=[];
const checks=[];

function read(file){return fs.readFileSync(path.join(root,file),"utf8");}
function check(value,message){checks.push({ok:!!value,message});if(!value){errors.push(message);console.error("[verify-global-baselocal] ERROR:",message);}else{console.log("[OK]",message);}}

const html=read("Global/global.html");
const bootstrap=read("Global/global.bootstrap.js");
const fastSource=read("Global/global.baselocal-fast.js");
const bridge=read("BDLocal/patches/bdl.changes.outbox-bridge.js");
const statsNotes=read("BDLocal/conexiones/cone.stats.notes.js");

check(html.indexOf("../BDLocal/adapters/bdl.screen-deps.js")<html.indexOf("global.bootstrap.js"),"Global carga el adaptador local antes del arranque.");
check(bootstrap.includes("startAdapterWarmup();"),"La preparación completa de Base Local se inicia en segundo plano.");
check(bootstrap.includes("Caché local disponible"),"Global comunica que la caché local ya está disponible.");
check(bootstrap.includes("GlobalBaseLocalFast"),"Global instala el puente local instantáneo.");
check(
  bootstrap.indexOf("cone.utils.js")<bootstrap.indexOf("cone.index.js")&&
  bootstrap.indexOf("cone.index.js")<bootstrap.indexOf("cone.global.js")&&
  bootstrap.indexOf("cone.global.js")<bootstrap.indexOf("global.baselocal-fast.js"),
  "El conector Global carga utilidades, orquestador, ConGlobal y puente rápido en orden."
);
check(!bootstrap.includes("return adapterReady().then"),"Global no espera el arranque completo del adaptador para mostrar datos.");

check(
  bridge.indexOf('../repositories/bdl.repo.cambios.js')<bridge.indexOf('bdl.changes.firebase-policy.js'),
  "El repositorio cambios_pendientes carga antes de la política Firebase."
);
check(bridge.includes("changesRepository:!!window.BDLRepoCambios"),"La arquitectura compartida valida el repositorio de cambios.");
check(bridge.includes('"changesRepository","activeCacheFilter"'),"El repositorio de cambios es requisito explícito de la arquitectura compartida.");

check(statsNotes.includes("var scriptBase=document.currentScript"),"El conector de notas captura su ruta mientras el script está activo.");
check(statsNotes.includes('new URL("../repositories/bdl.repo.notas.js",scriptBase)'),"El repositorio de notas se resuelve desde BDLocal/conexiones.");
check(!statsNotes.includes("function base()"),"La ruta de notas no depende de document.currentScript después de cargar.");

class FakeCustomEvent{
  constructor(type,options){this.type=type;this.detail=options&&options.detail;}
}

const listeners=Object.create(null);
const animationFrames=[];
const cache={
  meta:{revision:"rev-10",updatedAt:"2026-07-27T14:00:00.000Z"},
  periods:[{id:"2026-04__2026-11"}],
  students:[{cedula:"0102030405",periodoId:"2026-04__2026-11"}],
  requirements:[]
};
let originalReadyCalls=0;
let invalidations=0;
let renders=0;

const windowObject={
  CustomEvent:FakeCustomEvent,
  addEventListener(name,handler){listeners[name]=listeners[name]||[];listeners[name].push(handler);},
  dispatchEvent(event){(listeners[event.type]||[]).slice().forEach((handler)=>handler(event));return true;},
  requestAnimationFrame(callback){animationFrames.push(callback);return animationFrames.length;},
  setTimeout(callback){callback();return 1;},
  clearTimeout(){},
  BDLocalConUtils:{
    readCache(){return cache;},
    hasData(value){return Array.isArray(value.students)&&value.students.length>0;}
  },
  BDLocalConexiones:{
    ready(){return new Promise(()=>{});}
  },
  ConGlobal:{
    status(){return {ok:true,source:"ConGlobal",students:1};},
    ready(){originalReadyCalls+=1;return new Promise(()=>{});}
  }
};
windowObject.BDLocalGlobal=windowObject.ConGlobal;
windowObject.window=windowObject;

const context=vm.createContext({
  window:windowObject,
  CustomEvent:FakeCustomEvent,
  Promise,Object,Array,Date,Math,JSON,String,Number,Boolean,Error,console
});
new vm.Script(fastSource,{filename:"global.baselocal-fast.js"}).runInContext(context);

async function main(){
  const fast=windowObject.GlobalBaseLocalFast;
  check(Boolean(fast),"Se expone GlobalBaseLocalFast.");
  check(fast.prepareConnector()===true,"El puente prepara ConGlobal.");

  const immediate=await Promise.race([
    windowObject.ConGlobal.ready(),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error("ConGlobal.ready bloqueó la interfaz.")),60))
  ]);
  check(immediate&&immediate.instant===true,"ConGlobal.ready responde sin esperar la inicialización secundaria.");
  check(immediate&&immediate.cacheAvailable===true,"ConGlobal detecta inmediatamente la caché compartida.");
  check(originalReadyCalls>=1,"La preparación original continúa en segundo plano.");

  windowObject.GlobalCore={invalidate(){invalidations+=1;return true;}};
  windowObject.GlobalApp={render(){renders+=1;return Promise.resolve({ok:true});}};
  check(fast.installRuntime()===true,"El runtime instantáneo se instala sobre GlobalApp.");

  windowObject.dispatchEvent(new FakeCustomEvent("bdlocal:pantallas:updated",{detail:{revision:"rev-10"}}));
  windowObject.dispatchEvent(new FakeCustomEvent("bdlocal:conexiones-cache-updated",{detail:{revision:"rev-10"}}));
  check(animationFrames.length===1,"Dos avisos de la misma actualización se agrupan en un solo cuadro visual.");
  animationFrames.shift()();
  await Promise.resolve();
  await Promise.resolve();

  check(invalidations===1,"Global invalida su cálculo una sola vez.");
  check(renders===1,"Global renderiza la actualización una sola vez de forma inmediata.");

  await windowObject.GlobalApp.render();
  check(renders===1,"El render heredado posterior de la misma revisión se descarta.");
  const status=fast.status();
  check(status.coalesced>=1,"El diagnóstico registra eventos agrupados.");
  check(status.duplicatesSkipped>=1,"El diagnóstico registra el render duplicado evitado.");

  if(errors.length){
    console.error(`\nVERIFICACIÓN GLOBAL ↔ BASE LOCAL: ERROR (${errors.length})`);
    errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
    process.exit(1);
  }
  console.log(`\nVERIFICACIÓN GLOBAL ↔ BASE LOCAL: OK (${checks.length} comprobaciones)`);
}

main().catch((error)=>{
  console.error("VERIFICACIÓN GLOBAL ↔ BASE LOCAL: ERROR",error);
  process.exit(1);
});