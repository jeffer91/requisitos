"use strict";

/* =========================================================
Archivo: verify-shared-cache-adapter.js
Ruta: /scripts/verify-shared-cache-adapter.js
Función:
- Verificar lectura inmediata desde la caché compartida.
- Confirmar que cada escritura publica la revisión a la ventana principal.
- Validar la actualización directa de una pantalla ya cargada.
- Proteger las APIs completas del Centro de datos.
========================================================= */

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const ROOT=path.resolve(__dirname,"..");
const SOURCE=fs.readFileSync(
  path.join(ROOT,"BDLocal/adapters/bdl.screen-deps.js"),
  "utf8"
);
const errors=[];
const checks=[];

function check(value,message){
  checks.push({ok:!!value,message});
  if(!value){
    errors.push(message);
    console.error("[verify-shared-cache-adapter] ERROR:",message);
  }else{
    console.log("[OK]",message);
  }
}

class FakeCustomEvent{
  constructor(type,options){
    this.type=type;
    this.detail=options&&options.detail;
  }
}

function createContext(options){
  options=options||{};
  const storage=Object.create(null);
  const listeners=Object.create(null);
  const parentMessages=[];
  const initial=options.initial||{
    meta:{revision:1,updatedAt:"2026-07-28T10:00:00.000Z"},
    periods:[{id:"2026-04__2026-11",label:"Abril 2026 a Noviembre 2026"}],
    students:[{cedula:"0100000001",periodoId:"2026-04__2026-11",Nombres:"UNO"}],
    requirements:[]
  };
  storage["REQ_BDLOCAL_CONEXIONES_CACHE_V1"]=JSON.stringify(initial);

  const document={
    currentScript:{src:"file:///app/BDLocal/adapters/bdl.screen-deps.js"},
    baseURI:"file:///app/BDLocal/adapters/bdl.screen-deps.js",
    scripts:[],
    head:{appendChild(){}},
    documentElement:{appendChild(){}},
    createElement(){return {setAttribute(){}};}
  };

  const windowObject={
    location:{href:"file:///app/Ficha/ficha.html"},
    localStorage:{
      getItem(key){return Object.prototype.hasOwnProperty.call(storage,key)?storage[key]:null;},
      setItem(key,value){storage[key]=String(value);}
    },
    structuredClone(value){return JSON.parse(JSON.stringify(value));},
    CustomEvent:FakeCustomEvent,
    URL,
    setTimeout,
    clearTimeout,
    addEventListener(name,handler){
      listeners[name]=listeners[name]||[];
      listeners[name].push(handler);
    },
    dispatchEvent(){return true;}
  };
  windowObject.window=windowObject;
  windowObject.parent=windowObject;

  if(options.fullHub){
    const hub={
      version:"1.5.0-v2-source-first",
      register(){return true;},
      get(){return null;},
      ready(){return Promise.resolve({ok:true,ready:true,source:"native"});},
      ensureCoreReady(){return Promise.resolve("native-core");},
      refreshCache(){return Promise.resolve("native-refresh");},
      status(){return {ok:true,ready:true,source:"native-hub"};}
    };
    windowObject.BDLocalConexiones=hub;
    windowObject.ExcelLocalRepo={getSnapshot(){return "native-excel";}};
    windowObject.BL2DataEngine={search(){return "native-engine";}};
    windowObject.BL2EstudiantesRepo={getStudents(){return "native-students";}};
    windowObject.BL2ReportesRepo={buildReportData(){return "native-report";}};
  }

  const context=vm.createContext({
    window:windowObject,
    document,
    CustomEvent:FakeCustomEvent,
    URL,
    Date,Math,JSON,Object,Array,String,Number,Boolean,Promise,Set,WeakSet,
    setTimeout,clearTimeout,console
  });
  new vm.Script(SOURCE,{filename:"bdl.screen-deps.js"}).runInContext(context);

  return {
    windowObject,
    storage,
    listeners,
    parentMessages,
    attachParent(){
      windowObject.parent={
        postMessage(message){parentMessages.push(message);}
      };
    }
  };
}

async function main(){
  const fast=createContext();
  await fast.windowObject.BDLScreenDepsReady;

  check(fast.windowObject.BDLocalScreenDeps.listPeriods().length===1,"La pantalla obtiene períodos desde la caché local compartida.");
  check(fast.windowObject.BDLocalScreenDeps.listStudents({matricula:""}).total===1,"La pantalla obtiene estudiantes sin abrir IndexedDB.");

  fast.attachParent();
  const saved=fast.windowObject.BDLocalConUtils.writeCache({
    meta:{revision:1},
    periods:[{id:"2026-04__2026-11"}],
    students:[
      {cedula:"0100000001",periodoId:"2026-04__2026-11",Nombres:"UNO"},
      {cedula:"0100000002",periodoId:"2026-04__2026-11",Nombres:"DOS"}
    ],
    requirements:[]
  },{
    source:"verify-shared-cache-adapter",
    sourceScreen:"ficha",
    operation:"update"
  });

  const publish=fast.parentMessages.find((message)=>message&&message.type==="requisitos:bdlocal-cache:publish");
  check(Boolean(publish),"Una escritura publica la nueva caché a la ventana principal.");
  check(publish&&publish.persisted===true,"La publicación informa si la caché quedó persistida.");
  check(publish&&publish.revision===saved.meta.revision,"La revisión publicada coincide con la revisión guardada.");
  check(saved.students.length===2,"La escritura conserva los dos estudiantes.");

  fast.windowObject.BDLocalScreenDeps.acceptSharedCache({
    meta:{revision:99,updatedAt:"2026-07-28T11:00:00.000Z"},
    periods:[{id:"2026-04__2026-11"}],
    students:[{cedula:"0100000099",periodoId:"2026-04__2026-11",Nombres:"NUEVO"}],
    requirements:[]
  },"test-direct",{emit:false,force:true});

  check(fast.windowObject.BDLocalScreenDeps.readCache().meta.revision===99,"La actualización directa reemplaza inmediatamente la revisión en memoria.");
  check(fast.windowObject.BDLocalScreenDeps.listStudents({matricula:""}).rows[0].Nombres==="NUEVO","La pantalla lee los datos de la revisión recién inyectada.");

  const full=createContext({fullHub:true});
  await full.windowObject.BDLScreenDepsReady;

  check(full.windowObject.BDLocalConexiones.status().source==="native-hub","Centro de datos conserva el orquestador completo.");
  check(full.windowObject.ExcelLocalRepo.getSnapshot()==="native-excel","Centro de datos conserva ExcelLocalRepo completo.");
  check(full.windowObject.BL2DataEngine.search()==="native-engine","Centro de datos conserva BL2DataEngine completo.");
  check(full.windowObject.BL2EstudiantesRepo.getStudents()==="native-students","Centro de datos conserva el repositorio completo de estudiantes.");
  check(full.windowObject.BL2ReportesRepo.buildReportData()==="native-report","Centro de datos conserva el repositorio completo de reportes.");

  if(errors.length){
    console.error(`\nVERIFICACIÓN CACHÉ COMPARTIDA: ERROR (${errors.length})`);
    process.exit(1);
  }
  console.log(`\nVERIFICACIÓN CACHÉ COMPARTIDA: OK (${checks.length} comprobaciones)`);
}

main().catch((error)=>{
  console.error(error&&error.stack||error);
  process.exit(1);
});
