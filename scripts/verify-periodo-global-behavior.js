"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(ROOT,"BDLocal/shared/bdl.periodo-global.js"),"utf8");
const errors=[];
function check(value,message){if(!value){errors.push(message);}}

class Select{
  constructor(id,value){
    this.id=id;this.name="";this.tagName="SELECT";this.value=value||"";this.attributes={};this.listeners={};
    this.options=[
      {value:"",textContent:"Seleccione"},
      {value:"2026-04__2026-09",textContent:"Abril a septiembre 2026"},
      {value:"2025-10__2026-03",textContent:"Octubre 2025 a marzo 2026"}
    ];
  }
  getAttribute(name){return this.attributes[name]||"";}
  setAttribute(name,value){this.attributes[name]=String(value);}
  addEventListener(name,handler){(this.listeners[name]=this.listeners[name]||[]).push(handler);}
  dispatchEvent(event){event.target=this;(this.listeners[event.type]||[]).forEach((handler)=>handler(event));return true;}
}
function CustomEvent(type,options){this.type=type;this.detail=options&&options.detail||{};this.bubbles=options&&options.bubbles;}
class MutationObserver{constructor(handler){this.handler=handler;}observe(){}disconnect(){}}
class BroadcastChannel{constructor(){this.onmessage=null;}postMessage(){}close(){}}

function environment(pathname){
  const storage=Object.create(null);
  storage.REQ_PERIODO_GLOBAL_V1=JSON.stringify({id:"2026-04__2026-09",label:"Abril a septiembre 2026",source:"test"});
  const main=new Select("stats-periodo","");
  const second=new Select("tabla-periodo","");
  const from=new Select("global-periodo-desde","2025-10__2026-03");
  const to=new Select("global-periodo-hasta","2026-04__2026-09");
  const selects=[main,second,from,to];
  const events=[];
  const document={
    readyState:"complete",
    body:{getAttribute(){return "";}},
    documentElement:{},
    querySelectorAll(selector){return selector==="select"?selects:[];},
    addEventListener(){},
    createEvent(){return {type:"change",initEvent(type){this.type=type;}};}
  };
  const sandbox={
    console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Set,
    CustomEvent,MutationObserver,BroadcastChannel,document,
    location:{pathname,href:`file://${pathname}`},
    localStorage:{getItem(key){return storage[key]||null;},setItem(key,value){storage[key]=String(value);},removeItem(key){delete storage[key];}},
    setTimeout,clearTimeout,
    addEventListener(){},
    dispatchEvent(event){events.push(event);return true;}
  };
  sandbox.window=sandbox;
  return {sandbox,selects,main,second,from,to,events,storage};
}

async function wait(){return new Promise((resolve)=>setTimeout(resolve,30));}

(async()=>{
  const operational=environment("/Stats/stats.html");
  new vm.Script(source,{filename:"bdl.periodo-global.js"}).runInContext(vm.createContext(operational.sandbox));
  await wait();
  check(operational.sandbox.RequisitosPeriodoGlobal.status().enabled===true,"El período general debe estar activo en Stats");
  check(operational.main.value==="2026-04__2026-09","El selector principal debe adoptar el período guardado");
  check(operational.second.value==="2026-04__2026-09","Los demás selectores operativos deben adoptar el período guardado");
  check(operational.from.value==="2025-10__2026-03","El selector Desde debe permanecer independiente");
  check(operational.to.value==="2026-04__2026-09","El selector Hasta debe permanecer independiente");

  operational.main.value="2025-10__2026-03";
  operational.main.dispatchEvent(new CustomEvent("change",{bubbles:true}));
  await wait();
  check(operational.second.value==="2025-10__2026-03","Cambiar un selector operativo debe actualizar los demás");
  check(operational.sandbox.RequisitosPeriodoGlobal.get().id==="2025-10__2026-03","El estado general debe guardar el nuevo período");
  check(operational.events.some((event)=>event.type==="requisitos:periodo-global-cambiado"),"Debe emitirse el evento general de cambio");

  const global=environment("/Global/global.html");
  new vm.Script(source,{filename:"bdl.periodo-global.js"}).runInContext(vm.createContext(global.sandbox));
  await wait();
  check(global.sandbox.RequisitosPeriodoGlobal.status().enabled===false,"Global debe desactivar el período operativo");
  const before=global.from.value;
  global.main.value="2025-10__2026-03";
  global.main.dispatchEvent(new CustomEvent("change",{bubbles:true}));
  await wait();
  check(global.from.value===before,"Global no debe sincronizar sus filtros Desde/Hasta");

  if(errors.length){
    console.error("\nVERIFICACIÓN DEL PERÍODO GLOBAL: ERROR\n");
    errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
    process.exit(1);
  }
  console.log("VERIFICACIÓN DEL PERÍODO GLOBAL: OK");
})().catch((error)=>{
  console.error("VERIFICACIÓN DEL PERÍODO GLOBAL: ERROR",error);
  process.exit(1);
});
