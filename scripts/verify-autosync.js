/* =========================================================
Nombre completo: verify-autosync.js
Ruta: /scripts/verify-autosync.js
Función:
- Verificar la entrada protegida de Electron.
- Certificar que el módulo de fondo quedó como compatibilidad manual.
- Comprobar que abrir, esperar y cerrar no consultan ni escriben fuentes externas.
- Evitar que una edición futura reactive AutoSync o sincronización al cerrar.
========================================================= */
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const errors=[];

function read(file){return fs.readFileSync(path.join(root,file),"utf8");}
function check(value,message){if(!value){errors.push(message);console.error("[verify-autosync] ERROR:",message);}else{console.log("[OK]",message);}}

const pkg=JSON.parse(read("package.json"));
const main=read("electron/main-safe.js");
const preload=read("electron/preload.js");
const source=read("Maqueta/maq-baselocal-background-sync.js");

check(pkg.main==="electron/main-safe.js","Electron inicia mediante main-safe.js.");
[
  "app.requestSingleInstanceLock()",
  'browserWindow.on("close"',
  "event.preventDefault()",
  "handleCloseRequest",
  "result.canClose===true",
  "findBaseLocalFrame",
  "installGuard",
  "sameRevision",
  "contentHash",
  "payloadRevision",
  "powerMonitor.getSystemIdleTime()"
].forEach((fragment)=>check(main.includes(fragment),"main-safe conserva "+fragment));

[
  "baseLocalSync",
  "requisitos:sync-status",
  "requisitos:sync-snapshot",
  "requisitos:sync-request",
  "requisitos:sync-idle-state"
].forEach((fragment)=>check(preload.includes(fragment),"preload conserva "+fragment));

check(source.includes('VERSION="5.0.0-manual-only-no-background-io"'),"El módulo declara la política manual sin E/S de fondo.");
check(source.includes("manualOnly:true")&&source.includes("automatic:false"),"AutoSync está desactivada de forma explícita.");
check(source.includes("externalReads:0")&&source.includes("externalWrites:0"),"El contrato reporta cero operaciones externas automáticas.");
check(source.includes("function handleCloseRequest()")&&source.includes("canClose:true"),"El cierre se autoriza sin sincronizar.");
check(source.includes("function autoEnabled(){forceManualFlags();return false;}"),"La bandera automática no puede activarse.");
check(!source.includes("setInterval("),"No existe temporizador periódico de sincronización.");
check(!source.includes("ensureBaseFrame("),"No se abre Base Local en segundo plano.");
check(!source.includes("getIdleState("),"No se consulta la inactividad del sistema para sincronizar.");
check(!source.includes("api.request("),"El módulo de fondo no solicita lotes externos.");

const storage=new Map();
const nodes={};
const document={
  readyState:"complete",
  getElementById(id){return nodes[id]||null;},
  addEventListener(){}
};
const sandbox={
  console,Date,Math,JSON,Object,Array,String,Boolean,Number,Promise,
  document,
  localStorage:{
    getItem(key){return storage.has(key)?storage.get(key):null;},
    setItem(key,value){storage.set(key,String(value));},
    removeItem(key){storage.delete(key);}
  }
};
sandbox.window=sandbox;
vm.runInNewContext(source,sandbox,{filename:"maq-baselocal-background-sync.js"});

(async()=>{
  const api=sandbox.MAQ_BASELOCAL_BACKGROUND_SYNC;
  check(!!api,"Se expone la fachada de compatibilidad.");
  check(api.status().automatic===false,"El estado de ejecución permanece manual.");
  const idle=await api.run();
  check(idle.skipped===true&&idle.externalReads===0&&idle.externalWrites===0,"Esperar inactividad no produce E/S externa.");
  const close=await api.handleCloseRequest();
  check(close.canClose===true&&close.externalReads===0&&close.externalWrites===0,"Cerrar no produce E/S externa.");
  const enabled=api.enable();
  check(enabled.blocked===true&&api.status().automatic===false,"No se puede reactivar AutoSync desde la API.");

  if(errors.length){
    console.error("VERIFICACIÓN AUTOSYNC MANUAL: ERROR");
    process.exit(1);
  }
  console.log("[verify-autosync] OK: apertura, espera y cierre mantienen cero lecturas y escrituras externas.");
})().catch((error)=>{
  console.error("VERIFICACIÓN AUTOSYNC MANUAL: ERROR",error);
  process.exit(1);
});
