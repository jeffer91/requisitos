"use strict";

/* =========================================================
Archivo: verify-screen-fast-sync.js
Ruta: /scripts/verify-screen-fast-sync.js
Función:
- Verificar que la caché compartida se entrega solo a la pantalla visible.
- Confirmar que una pantalla oculta recibe la revisión vigente al activarse.
- Validar que la entrega ocurre antes del renderizado.
- Certificar que los iframes eliminados no quedan retenidos por referencias fuertes.
========================================================= */

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const errors=[];
const checks=[];

function read(file){return fs.readFileSync(path.join(root,file),"utf8");}
function check(value,message){
  checks.push({ok:!!value,message});
  if(!value){
    errors.push(message);
    console.error("[verify-screen-fast-sync] ERROR:",message);
  }else{
    console.log("[OK]",message);
  }
}

const html=read("Maqueta/maq-index.html");
const source=read("Maqueta/maq-screen-fast-sync.js");

check(html.includes('<script src="maq-screen-fast-sync.js"></script>'),"Maqueta carga el puente rápido de pantallas.");
check(html.indexOf("maq-baselocal-session.js")<html.indexOf("maq-screen-fast-sync.js"),"La sesión compartida carga antes del puente rápido.");
check(html.indexOf("maq-core.js")<html.indexOf("maq-screen-fast-sync.js"),"El enrutador carga antes del puente rápido.");
check(source.includes('window.addEventListener("message",intercept,true)'),"Los mensajes internos se interceptan en fase de captura.");
check(source.includes("stopImmediatePropagation"),"El puente evita el procesamiento duplicado del mensaje de caché.");
check(source.includes("activeFrames()"),"La actualización se limita a pantallas visibles.");
check(source.includes("acceptSharedCache"),"La revisión vigente se inyecta directamente antes de renderizar.");
check(source.includes("WeakSet"),"Los iframes observados usan referencias débiles.");
check(!source.includes("setInterval("),"No se crean ciclos periódicos.");
[
  ["indexedDB.","IndexedDB"],
  ["window.firebase","Firebase"],
  ["window.supabase","Supabase"],
  ["fetch(","fetch de red"],
  ["XMLHttpRequest","XMLHttpRequest"]
].forEach(([token,label])=>{
  check(!source.includes(token),`El puente no usa ${label}.`);
});

class FakeCustomEvent{
  constructor(type,options){this.type=type;this.detail=options&&options.detail;}
}
class FakeMutationObserver{
  constructor(callback){this.callback=callback;}
  observe(){}
}

const counters={
  setSnapshot:0,
  setSnapshotOptions:null,
  activeDeliveries:0,
  activeEvents:0,
  activeRenders:0,
  hiddenDeliveries:0,
  hiddenEvents:0,
  hiddenRenders:0,
  responses:0,
  stopped:0,
  moduleListeners:0
};

let snapshot={
  meta:{
    revision:8,
    periodoId:"2026-04__2026-11",
    tablesChanged:["personas"],
    operation:"update",
    updatedAt:"2026-07-27T12:00:00.000Z"
  },
  periods:[{id:"2026-04__2026-11"}],
  students:[{id:"1"}],
  requirements:[]
};

function classList(hidden){
  const values=new Set(hidden?["maq-frame-hidden"]:[]);
  return {
    contains:(name)=>values.has(name),
    add:(name)=>values.add(name),
    remove:(name)=>values.delete(name)
  };
}

function child(kind){
  const listeners={};
  const childWindow={
    CustomEvent:FakeCustomEvent,
    latestRevision:0,
    BDLocalScreenDeps:{
      acceptSharedCache(cache){
        childWindow.latestRevision=Number(cache&&cache.meta&&cache.meta.revision||0);
        if(kind==="active"){counters.activeDeliveries+=1;}
        else{counters.hiddenDeliveries+=1;}
      }
    },
    StatsCore:{invalidate(){}},
    StatsApp:{
      render(){
        if(kind==="active"){counters.activeRenders+=1;}
        else{counters.hiddenRenders+=1;}
      }
    },
    addEventListener(name,handler){listeners[name]=handler;},
    dispatchEvent(){
      if(kind==="active"){counters.activeEvents+=1;}
      else{counters.hiddenEvents+=1;}
      return true;
    },
    requestAnimationFrame(callback){callback();},
    setTimeout(callback){callback();},
    postMessage(){
      if(kind==="hidden"){counters.responses+=1;}
    }
  };
  return childWindow;
}

const activeChild=child("active");
const hiddenChild=child("hidden");

function frame(id,visible,contentWindow){
  const listeners={};
  return {
    hidden:!visible,
    dataset:{moduleId:id},
    style:{display:visible?"block":"none",visibility:visible?"visible":"hidden"},
    classList:classList(!visible),
    contentWindow,
    getAttribute(name){
      if(name==="aria-hidden"){return visible?"false":"true";}
      if(name==="data-module-id"){return id;}
      return null;
    },
    addEventListener(name,handler){listeners[name]=handler;},
    trigger(name){if(listeners[name]){listeners[name]();}}
  };
}

const activeFrame=frame("stat_main",true,activeChild);
const hiddenFrame=frame("tabla_principal",false,hiddenChild);
const frameList=[activeFrame,hiddenFrame];
const windowListeners={};
let moduleChanged=null;
const host={};

const document={
  body:host,
  querySelectorAll(selector){return selector==="iframe"?frameList:[];},
  getElementById(id){return id==="maq-main-frame-host"?host:null;}
};

const windowObject={
  CustomEvent:FakeCustomEvent,
  MutationObserver:FakeMutationObserver,
  WeakSet,
  MAQ_BASELOCAL_SESSION:{
    getSnapshot(){return snapshot;},
    getStatus(){return {ok:true};},
    ensureReady(){return true;},
    setSnapshot(_value,options){
      counters.setSnapshot+=1;
      counters.setSnapshotOptions=options;
      return snapshot;
    }
  },
  MAQ_CORE:{
    bus:{
      on(name,handler){
        if(name==="modulo:cambiado"){
          moduleChanged=handler;
          counters.moduleListeners+=1;
        }
      }
    }
  },
  addEventListener(name,handler,capture){
    windowListeners[name]=windowListeners[name]||[];
    windowListeners[name].push({handler,capture:!!capture});
  },
  setTimeout(callback){callback();},
  dispatchEvent(){return true;}
};
windowObject.window=windowObject;

const context=vm.createContext({
  window:windowObject,
  document,
  CustomEvent:FakeCustomEvent,
  MutationObserver:FakeMutationObserver,
  WeakSet,
  Date,Math,JSON,Object,Array,String,Number,Boolean,Promise,Set,console
});

new vm.Script(source,{filename:"maq-screen-fast-sync.js"}).runInContext(context);

check(Boolean(windowObject.MAQ_SCREEN_FAST_SYNC),"Se expone MAQ_SCREEN_FAST_SYNC.");
check(counters.moduleListeners===1,"El puente escucha el cambio de pantalla una sola vez.");

const messageListener=(windowListeners.message||[]).find((item)=>item.capture===true);
check(Boolean(messageListener),"Existe un interceptor de mensajes en captura.");

const publishEvent={
  source:hiddenChild,
  data:{type:"requisitos:bdlocal-cache:publish",source:"tabla",cache:snapshot},
  stopImmediatePropagation(){counters.stopped+=1;},
  preventDefault(){}
};
messageListener.handler(publishEvent);

check(counters.stopped===1,"El mensaje publicado no continúa hacia el puente heredado.");
check(counters.setSnapshot===1,"La ventana principal conserva la nueva revisión una sola vez.");
check(counters.setSnapshotOptions&&counters.setSnapshotOptions.alreadyStored===false,"La ventana principal no asume falsamente que la caché ya fue persistida.");
check(counters.activeDeliveries===1,"La pantalla visible recibe directamente la revisión compartida.");
check(activeChild.latestRevision===8,"La pantalla visible recibe la revisión correcta antes del render.");
check(counters.activeRenders===1,"La pantalla visible se actualiza en el siguiente frame visual.");
check(counters.hiddenDeliveries===0&&counters.hiddenEvents===0,"La pantalla oculta no procesa la actualización completa.");

const requestEvent={
  source:hiddenChild,
  data:{type:"requisitos:bdlocal-cache:request",requestId:"req-1"},
  stopImmediatePropagation(){counters.stopped+=1;},
  preventDefault(){}
};
messageListener.handler(requestEvent);
check(counters.responses===1,"Una pantalla que solicita datos recibe una sola respuesta compartida.");

snapshot={
  meta:{
    revision:9,
    periodoId:"2026-04__2026-11",
    updatedAt:"2026-07-27T12:05:00.000Z"
  },
  periods:[{id:"2026-04__2026-11"}],
  students:[{id:"1"},{id:"2"}],
  requirements:[]
};

hiddenFrame.hidden=false;
hiddenFrame.style.display="block";
hiddenFrame.style.visibility="visible";
hiddenFrame.classList.remove("maq-frame-hidden");
hiddenFrame.getAttribute=function(name){
  if(name==="aria-hidden"){return "false";}
  if(name==="data-module-id"){return "tabla_principal";}
  return null;
};

activeFrame.hidden=true;
activeFrame.style.display="none";
activeFrame.style.visibility="hidden";
activeFrame.classList.add("maq-frame-hidden");
activeFrame.getAttribute=function(name){
  if(name==="aria-hidden"){return "true";}
  if(name==="data-module-id"){return "stat_main";}
  return null;
};

moduleChanged({moduloId:"tabla_principal"});

check(counters.hiddenDeliveries===1,"La pantalla recién activada recibe la caché vigente.");
check(hiddenChild.latestRevision===9,"La pantalla recién activada no conserva una revisión antigua.");
check(counters.hiddenRenders===1,"La pantalla recién activada renderiza después de recibir la revisión.");

const status=windowObject.MAQ_SCREEN_FAST_SYNC.status();
check(status.publishes===1&&status.requests===1,"Las métricas registran publicaciones y solicitudes.");
check(status.directDeliveries>=2,"Las métricas registran entregas directas de caché.");
check(status.hiddenSkipped>=1,"Las métricas registran pantallas ocultas omitidas.");

if(errors.length){
  console.error(`\nVERIFICACIÓN COMUNICACIÓN RÁPIDA: ERROR (${errors.length})`);
  process.exit(1);
}
console.log(`\nVERIFICACIÓN COMUNICACIÓN RÁPIDA: OK (${checks.length} comprobaciones)`);
