"use strict";

/* =========================================================
Archivo: verify-startup-benchmark.js
Ruta: /scripts/verify-startup-benchmark.js
Función:
- Verificar las métricas locales de arranque de Carga.
- Verificar que el contador espere la pantalla realmente lista.
- Cubrir Carga, Tabla, Ficha, Stats y Coordi sin usar servicios externos.
========================================================= */

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const errors=[];
let checks=0;

function read(file){return fs.readFileSync(path.join(root,file),"utf8");}
function check(value,message){
  checks+=1;
  if(value){console.log("[OK]",message);return;}
  errors.push(message);
  console.error("[verify-startup-benchmark] ERROR:",message);
}

const cargaHtml=read("Carga/carga.html");
const metricsSource=read("Carga/carga.startup-metrics.js");
const runtime=read("scripts/medir-carga-base-runtime.js");
const powershell=read("scripts/medir-carga-base.ps1");
const mainHtml=read("Maqueta/maq-index.html");
const timerSource=read("Maqueta/maq-bdlocal-delivery-timer.js");
const fichaBootstrap=read("Ficha/ficha.bootstrap.js");
const fichaReady=read("Ficha/ficha.render-ready.js");
const statsReady=read("Stats/stats.render-ready.js");
const coordiReady=read("Coordi/coordi.render-ready.js");
const tablaReady=read("Gestion/Tabla/core/tabla.render-ready.js");
const packageJson=JSON.parse(read("package.json"));

check(cargaHtml.includes('src="./carga.startup-metrics.js"'),"Carga incluye las métricas de arranque.");
check(cargaHtml.indexOf("carga.startup-metrics.js")<cargaHtml.indexOf("carga.index.js"),"Las métricas se cargan antes del conector de Carga.");
check(metricsSource.includes('"carga:bdlocal-ready"')&&metricsSource.includes('"carga:periods-refreshed"'),"Carga registra Base Local y períodos visibles.");
check(runtime.includes("rendererAvailable")&&runtime.includes("indexedDBOpen"),"La sonda registra renderer e IndexedDB.");
check(runtime.includes("127.0.0.1"),"La sonda solo consulta DevTools local.");
check(powershell.includes("--remote-debugging-port=$CurrentPort")&&powershell.includes("Export-Csv"),"PowerShell ejecuta y exporta la medición.");
check(packageJson.scripts["diagnostico:tiempo-base"]&&packageJson.scripts["test:startup-benchmark"],"package.json expone diagnóstico y prueba.");

check(mainHtml.includes("BDLocal → pantalla lista"),"La interfaz aclara que mide la pantalla lista.");
check(mainHtml.includes('src="maq-bdlocal-delivery-timer.js"'),"La ventana principal carga el contador.");
check(timerSource.includes('READY_EVENT="maqueta:screen-render-complete"'),"El contador usa el evento estándar de pantalla lista.");
check(timerSource.includes("EXPLICIT_READY_MODULES"),"El contador distingue pantallas con confirmación explícita.");
check(timerSource.includes("tabla_principal:true")&&timerSource.includes("stat_main:true")&&timerSource.includes("coordi:true"),"Tabla, Stats y Coordi no usan el cierre genérico.");
check(timerSource.includes('path:"core/tabla.render-ready.js"')&&timerSource.includes('path:"stats.render-ready.js"')&&timerSource.includes('path:"coordi.render-ready.js"'),"El contador instala las sondas visuales correctas.");
check(timerSource.includes("generic-dom-stable"),"Las demás pantallas esperan estabilidad del DOM.");
check(timerSource.includes("MAX_WAIT_MS=30000"),"La espera máxima es visible y limitada.");

check(fichaBootstrap.includes('load("ficha.render-ready.js"'),"Ficha carga su sonda visual.");
check(fichaReady.includes('moduleId:"ficha_estudiante"')&&fichaReady.includes('el("ficha-requisitos")')&&fichaReady.includes('el("ficha-notas")'),"Ficha espera detalle, requisitos y notas.");
check(statsReady.includes('moduleId:"stat_main"')&&statsReady.includes('el("stats-notes")')&&statsReady.includes('el("stats-estudiantes")'),"Stats espera notas y estudiantes renderizados.");
check(statsReady.includes("current.rendering===true")&&statsReady.includes("current.pendingRender"),"Stats no confirma durante un render pendiente.");
check(coordiReady.includes('moduleId:"coordi"')&&coordiReady.includes('el("coordi-email-preview")')&&coordiReady.includes('el("coordi-mail-subject")'),"Coordi espera el correo completamente visible.");
check(coordiReady.includes("current.loading===true")&&coordiReady.includes("current.pendingRender"),"Coordi no confirma durante otro reporte.");
check(tablaReady.includes('moduleId:"tabla_principal"')&&tablaReady.includes('"tabla:rendered"'),"Tabla usa su evento interno de render final.");
check(tablaReady.includes('getElementById("tabla-table-wrap")'),"Tabla comprueba las filas visibles.");

const localSources=[metricsSource,timerSource,fichaReady,statsReady,coordiReady,tablaReady];
const forbidden=[/\bfetch\s*\(/,/firebase\.initialize/i,/supabase\.createClient/i,/google\.script/i,/BDLSyncV2\.request/i,/\.sync\s*\(/];
for(const expression of forbidden){
  for(const source of localSources){check(!expression.test(source),`Las métricas visuales no usan ${expression}.`);}
}

class FakeCustomEvent{
  constructor(type,options){this.type=type;this.detail=options&&options.detail;}
}
class FakeEventTarget{
  constructor(){this.listeners=Object.create(null);}
  addEventListener(name,handler){this.listeners[name]=this.listeners[name]||[];this.listeners[name].push(handler);}
  removeEventListener(name,handler){this.listeners[name]=(this.listeners[name]||[]).filter((item)=>item!==handler);}
  dispatchEvent(event){(this.listeners[event.type]||[]).slice().forEach((handler)=>handler(event));}
}

const metricListeners=Object.create(null);
const metricDocument={readyState:"loading",addEventListener(name,handler){metricListeners[name]=metricListeners[name]||[];metricListeners[name].push(handler);}};
const metricWindow={
  performance:{timeOrigin:1000},document:metricDocument,CustomEvent:FakeCustomEvent,
  addEventListener(name,handler){metricListeners[name]=metricListeners[name]||[];metricListeners[name].push(handler);},
  dispatchEvent(event){(metricListeners[event.type]||[]).forEach((handler)=>handler(event));},
  BDLocalConUtils:{readCache(){return {meta:{revision:"r1"},periods:[{}],students:[{},{}],requirements:[{}]};}},
  BL2DB:{meta(){return {open:true,version:2};}},BL2Core:{},BDLocalScreenDeps:{status(){return {ready:true};}},BDLocalConexiones:{status(){return {ready:true};}},ConCarga:{status(){return {ok:true};}}
};
metricWindow.window=metricWindow;
new vm.Script(metricsSource,{filename:"carga.startup-metrics.js"}).runInContext(vm.createContext({window:metricWindow,document:metricDocument,CustomEvent:FakeCustomEvent,Date,Object,Array,Number,String,Boolean,JSON,Math,Error,console}));
metricWindow.dispatchEvent(new FakeCustomEvent("carga:bdlocal-ready",{detail:{ok:true}}));
metricWindow.dispatchEvent(new FakeCustomEvent("carga:connection-ready",{detail:{ok:true}}));
metricWindow.dispatchEvent(new FakeCustomEvent("carga:periods-refreshed",{detail:{total:1,periods:[{}]}}));
const metricStatus=metricWindow.CargaStartupMetrics.status();
check(metricStatus.bdlocalReadyAt>0&&metricStatus.connectionReadyAt>0,"Las marcas de Base Local y ConCarga quedan registradas.");
check(metricStatus.periodsReadyAt>0&&metricStatus.periodCount===1,"La llegada de períodos queda registrada.");

const scheduled=[];
let timerId=0;
function schedule(fn,delay,kind){const item={id:++timerId,fn,delay:Number(delay||0),kind,cancelled:false,ran:false};scheduled.push(item);return item.id;}
function cancel(id){const item=scheduled.find((entry)=>entry.id===id);if(item){item.cancelled=true;}}
function flush(maxDelay){
  let item;
  while((item=scheduled.find((entry)=>!entry.cancelled&&!entry.ran&&entry.kind!=="interval"&&entry.delay<=maxDelay))){item.ran=true;item.fn();}
}

const child=new FakeEventTarget();
child.document={readyState:"complete"};
child.location={href:"about:blank"};
child.requestAnimationFrame=function(fn){fn();return 1;};
child.CargaStartupMetrics={status(){return {periodsReadyAt:0};}};
child.FichaRenderReady={status(){return {ready:false,emissions:0};}};
const frame=new FakeEventTarget();
frame.dataset={moduleId:"carga_excel"};
frame.contentWindow=child;
const counter={textContent:"",dataset:{},title:""};
const refreshButton=new FakeEventTarget();
const busHandlers=Object.create(null);
const deliveryDocument={
  readyState:"complete",
  getElementById(id){if(id==="maq-bdlocal-delivery-time"){return counter;}if(id==="maq-btn-refresh"){return refreshButton;}return null;},
  querySelectorAll(selector){return selector==="iframe"?[frame]:[];},
  addEventListener(){}
};
const deliveryWindow=new FakeEventTarget();
deliveryWindow.window=deliveryWindow;
deliveryWindow.document=deliveryDocument;
deliveryWindow.performance={now(){return Date.now();}};
deliveryWindow.CustomEvent=FakeCustomEvent;
deliveryWindow.setInterval=function(fn,delay){return schedule(fn,delay,"interval");};
deliveryWindow.clearInterval=cancel;
deliveryWindow.setTimeout=function(fn,delay){return schedule(fn,delay,"timeout");};
deliveryWindow.clearTimeout=cancel;
deliveryWindow.MAQ_CORE={state:{moduloActivoId:"carga_excel"},bus:{on(name,handler){busHandlers[name]=handler;}},router:{buscarModulo(id){return {id,nombre:id};}}};
deliveryWindow.MAQ_SCREEN_FAST_SYNC={status(){return {activeUpdates:0,lastModuleId:""};}};

new vm.Script(timerSource,{filename:"maq-bdlocal-delivery-timer.js"}).runInContext(vm.createContext({window:deliveryWindow,document:deliveryDocument,CustomEvent:FakeCustomEvent,URL,Date,Object,Array,Number,String,Boolean,JSON,Math,Error,Intl,console}));
check(typeof busHandlers["modulo:cambiado"]==="function","El contador queda conectado al cambio de módulo.");

busHandlers["modulo:cambiado"]({moduloId:"carga_excel",modulo:{nombre:"Carga"}});
child.dispatchEvent(new FakeCustomEvent("carga:periods-refreshed",{detail:{total:2}}));
flush(1000);
let result=deliveryWindow.MAQ_BDLOCAL_DELIVERY_TIMER.status();
check(result.running===false&&result.completions===1,"Carga termina con sus períodos visibles.");

function verifyExplicitModule(moduleId,label,source,expectedCompletions){
  frame.dataset.moduleId=moduleId;
  deliveryWindow.MAQ_CORE.state.moduloActivoId=moduleId;
  busHandlers["modulo:cambiado"]({moduloId:moduleId,modulo:{nombre:label}});
  child.dispatchEvent(new FakeCustomEvent("bdlocal:screen-data-updated",{detail:{targetModuleId:moduleId}}));
  flush(1000);
  let current=deliveryWindow.MAQ_BDLOCAL_DELIVERY_TIMER.status();
  check(current.running===true,`La señal técnica no detiene ${label}.`);
  child.dispatchEvent(new FakeCustomEvent("maqueta:screen-render-complete",{detail:{moduleId:moduleId,source:source}}));
  flush(1000);
  current=deliveryWindow.MAQ_BDLOCAL_DELIVERY_TIMER.status();
  check(current.running===false&&current.completions===expectedCompletions,`${label} termina con su confirmación visual.`);
}

verifyExplicitModule("ficha_estudiante","Ficha","FichaRenderReady",2);
verifyExplicitModule("tabla_principal","Tabla","TablaRenderReady",3);
verifyExplicitModule("stat_main","Stats","StatsRenderReady",4);
verifyExplicitModule("coordi","Coordi","CoordiRenderReady",5);

if(errors.length){
  console.error(`\nVERIFICACIÓN BENCHMARK DE ARRANQUE: ERROR (${errors.length})`);
  errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
  process.exit(1);
}
console.log(`\nVERIFICACIÓN BENCHMARK DE ARRANQUE: OK (${checks} comprobaciones)`);
