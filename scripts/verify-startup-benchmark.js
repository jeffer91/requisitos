"use strict";

/* =========================================================
Archivo: verify-startup-benchmark.js
Ruta: /scripts/verify-startup-benchmark.js
Función:
- Verificar la instrumentación de arranque de Carga.
- Confirmar que la prueba PowerShell mide sin sincronizar fuentes externas.
- Validar la API local de CargaStartupMetrics en un entorno simulado.
- Verificar que el contador visible espere el renderizado real de Ficha.
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

const html=read("Carga/carga.html");
const metricsSource=read("Carga/carga.startup-metrics.js");
const runtime=read("scripts/medir-carga-base-runtime.js");
const powershell=read("scripts/medir-carga-base.ps1");
const mainHtml=read("Maqueta/maq-index.html");
const deliveryTimerSource=read("Maqueta/maq-bdlocal-delivery-timer.js");
const fichaBootstrap=read("Ficha/ficha.bootstrap.js");
const fichaReadySource=read("Ficha/ficha.render-ready.js");
const packageJson=JSON.parse(read("package.json"));

check(html.includes('src="./carga.startup-metrics.js"'),"Carga incluye las métricas de arranque.");
check(html.indexOf("carga.startup-metrics.js")<html.indexOf("carga.index.js"),"Las métricas se cargan antes del arranque del conector.");
check(metricsSource.includes('"carga:bdlocal-ready"'),"Se registra la confirmación de Base Local.");
check(metricsSource.includes('"carga:connection-ready"'),"Se registra la confirmación de ConCarga.");
check(metricsSource.includes('"carga:periods-refreshed"'),"Se registra la lectura inicial de períodos cuando está disponible.");
check(metricsSource.includes("window.CargaStartupMetrics"),"Se expone CargaStartupMetrics.");
check(runtime.includes('arg("startedAt"')&&powershell.includes("--startedAt=$StartedAt"),"La sonda recibe la hora real de apertura del proceso.");
check(runtime.includes("rendererAvailable"),"La sonda registra la disponibilidad del renderer.");
check(runtime.includes("indexedDBOpen"),"La sonda registra la apertura de IndexedDB.");
check(runtime.includes("baseLocalReady")&&runtime.includes("conCargaReady"),"La sonda exige Base Local y ConCarga listos.");
check(runtime.includes("periodsReady"),"La lectura de períodos queda como hito adicional.");
check(runtime.includes("report.milestones.baseLocalReady!=null&&report.milestones.conCargaReady!=null"),"El tiempo total no depende de tareas visuales secundarias.");
check(runtime.includes("127.0.0.1"),"La única consulta HTTP de la sonda apunta a DevTools local.");
check(powershell.includes("[int]$Repeticiones = 1"),"PowerShell permite repetir la medición.");
check(powershell.includes("--remote-debugging-port=$CurrentPort"),"PowerShell abre Electron con DevTools remoto.");
check(powershell.includes("Export-Csv"),"PowerShell guarda un resumen comparable.");
check(powershell.includes("Requisitos ya está abierto"),"La prueba protege una sesión ya abierta.");
check(packageJson.scripts["diagnostico:tiempo-base"],"package.json expone diagnostico:tiempo-base.");
check(packageJson.scripts["test:startup-benchmark"],"package.json expone la verificación del benchmark.");

check(mainHtml.includes('id="maq-bdlocal-delivery-time"'),"La ventana principal incluye el contador BDLocal hacia pantalla.");
check(mainHtml.includes("BDLocal → pantalla lista"),"La etiqueta aclara que se mide la pantalla lista.");
check(mainHtml.includes('src="maq-bdlocal-delivery-timer.js"'),"La ventana principal carga el controlador del contador.");
check(mainHtml.indexOf("maq-screen-fast-sync.js")<mainHtml.indexOf("maq-bdlocal-delivery-timer.js"),"El contador se carga después del sincronizador rápido.");
check(deliveryTimerSource.includes('current.bus.on("modulo:cambiado"'),"El contador inicia al cambiar de pantalla.");
check(deliveryTimerSource.includes('getElementById("maq-btn-refresh")'),"El contador reinicia al refrescar la pantalla activa.");
check(deliveryTimerSource.includes('READY_EVENT="maqueta:screen-render-complete"'),"El contador espera una confirmación de renderizado final.");
check(deliveryTimerSource.includes("markData"),"El contador separa llegada de datos y pantalla visible.");
check(deliveryTimerSource.includes("checkFichaReady"),"El contador verifica el estado visual específico de Ficha.");
check(deliveryTimerSource.includes("baselineActiveUpdates"),"El contador diferencia una entrega nueva de una anterior.");
check(deliveryTimerSource.includes("MAX_WAIT_MS=30000"),"El contador tiene un límite visible de espera de 30 segundos.");

check(fichaBootstrap.includes('load("ficha.render-ready.js"'),"Ficha carga su confirmación visual después de FichaApp.");
check(fichaReadySource.includes('READY_EVENT="maqueta:screen-render-complete"'),"Ficha publica el evento estándar de pantalla lista.");
check(fichaReadySource.includes('el("ficha-requisitos")')&&fichaReadySource.includes('el("ficha-notas")'),"Ficha espera requisitos y notas visibles.");
check(fichaReadySource.includes('el("ficha-modalidad-select")'),"Ficha espera la modalidad antes de declararse lista.");
check(fichaReadySource.includes("requestAnimationFrame"),"Ficha confirma el resultado después del pintado del navegador.");

const metricsForbidden=[
  /\bfetch\s*\(/,
  /firebase\.initialize/i,
  /supabase\.createClient/i,
  /google\.script/i,
  /BDLSyncV2\.request/i,
  /\.sync\s*\(/
];
for(const expression of metricsForbidden){
  check(!expression.test(metricsSource),`Las métricas no usan ${expression}.`);
  check(!expression.test(deliveryTimerSource),`El contador visible no usa ${expression}.`);
  check(!expression.test(fichaReadySource),`La confirmación visual de Ficha no usa ${expression}.`);
}

const runtimeForbidden=[
  /firebase\.initialize/i,
  /supabase\.createClient/i,
  /google\.script/i,
  /BDLSyncV2\.request/i,
  /ConexionesExternas.*(?:push|pull|sync)/i,
  /BDLSyncV2.*(?:push|pull|sync)/i
];
for(const expression of runtimeForbidden){
  check(!expression.test(runtime),`La sonda no ejecuta ${expression}.`);
  check(!expression.test(powershell),`PowerShell no ejecuta ${expression}.`);
}

class FakeCustomEvent{
  constructor(type,options){this.type=type;this.detail=options&&options.detail;}
}
const listeners=Object.create(null);
const documentObject={
  readyState:"loading",
  addEventListener(name,handler){listeners[name]=listeners[name]||[];listeners[name].push(handler);}
};
const windowObject={
  performance:{timeOrigin:1000},
  document:documentObject,
  addEventListener(name,handler){listeners[name]=listeners[name]||[];listeners[name].push(handler);},
  dispatchEvent(event){(listeners[event.type]||[]).forEach((handler)=>handler(event));},
  CustomEvent:FakeCustomEvent,
  BDLocalConUtils:{readCache(){return {meta:{revision:"r1"},periods:[{}],students:[{},{}],requirements:[{}]};}},
  BL2DB:{meta(){return {open:true,version:2};}},
  BL2Core:{},
  BDLocalScreenDeps:{status(){return {ready:true};}},
  BDLocalConexiones:{status(){return {ready:true};}},
  ConCarga:{status(){return {ok:true,ready:true};}}
};
windowObject.window=windowObject;

const context=vm.createContext({
  window:windowObject,
  document:documentObject,
  CustomEvent:FakeCustomEvent,
  Date,Object,Array,Number,String,Boolean,JSON,Math,Error,console
});
new vm.Script(metricsSource,{filename:"carga.startup-metrics.js"}).runInContext(context);

check(Boolean(windowObject.CargaStartupMetrics),"La API de métricas se ejecuta en un renderer aislado.");
windowObject.dispatchEvent(new FakeCustomEvent("carga:bdlocal-ready",{detail:{ok:true}}));
windowObject.dispatchEvent(new FakeCustomEvent("carga:connection-ready",{detail:{ok:true}}));
windowObject.dispatchEvent(new FakeCustomEvent("carga:periods-refreshed",{detail:{total:1,periods:[{}]}}));
const metricsStatus=windowObject.CargaStartupMetrics.status();
check(metricsStatus.bdlocalReadyAt>0,"La marca Base Local queda registrada.");
check(metricsStatus.connectionReadyAt>0,"La marca ConCarga queda registrada.");
check(metricsStatus.periodsReadyAt>0&&metricsStatus.periodCount===1,"La marca de períodos queda registrada.");
check(metricsStatus.database&&metricsStatus.database.open===true,"El estado informa que IndexedDB está abierta.");
check(metricsStatus.cache&&metricsStatus.cache.students===2,"El estado informa los conteos de la caché.");

class FakeEventTarget{
  constructor(){this.listeners=Object.create(null);}
  addEventListener(name,handler){this.listeners[name]=this.listeners[name]||[];this.listeners[name].push(handler);}
  removeEventListener(name,handler){this.listeners[name]=(this.listeners[name]||[]).filter((item)=>item!==handler);}
  dispatchEvent(event){(this.listeners[event.type]||[]).slice().forEach((handler)=>handler(event));}
}

const scheduled=[];
let timerId=0;
function schedule(fn,delay,kind){const item={id:++timerId,fn,delay:Number(delay||0),kind,cancelled:false};scheduled.push(item);return item.id;}
function cancel(id){const item=scheduled.find((entry)=>entry.id===id);if(item){item.cancelled=true;}}
function flush(maxDelay){
  let progressed=true;
  while(progressed){
    progressed=false;
    const item=scheduled.find((entry)=>!entry.cancelled&&!entry.ran&&entry.kind!=="interval"&&entry.delay<=maxDelay);
    if(item){item.ran=true;item.fn();progressed=true;}
  }
}

const child=new FakeEventTarget();
child.document={readyState:"complete"};
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
  getElementById(id){
    if(id==="maq-bdlocal-delivery-time"){return counter;}
    if(id==="maq-btn-refresh"){return refreshButton;}
    return null;
  },
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
deliveryWindow.MAQ_CORE={
  state:{moduloActivoId:"carga_excel"},
  bus:{on(name,handler){busHandlers[name]=handler;}},
  router:{buscarModulo(id){return {id,nombre:id==="ficha_estudiante"?"Ficha":"Carga"};}}
};
deliveryWindow.MAQ_SCREEN_FAST_SYNC={status(){return {activeUpdates:0,lastModuleId:""};}};

const deliveryContext=vm.createContext({
  window:deliveryWindow,
  document:deliveryDocument,
  CustomEvent:FakeCustomEvent,
  Date,Object,Array,Number,String,Boolean,JSON,Math,Error,Intl,console
});
new vm.Script(deliveryTimerSource,{filename:"maq-bdlocal-delivery-timer.js"}).runInContext(deliveryContext);
check(Boolean(deliveryWindow.MAQ_BDLOCAL_DELIVERY_TIMER),"El contador visible se ejecuta en un renderer aislado.");
check(typeof busHandlers["modulo:cambiado"]==="function","El contador quedó conectado al cambio de módulo.");

busHandlers["modulo:cambiado"]({moduloId:"carga_excel",modulo:{nombre:"Carga"}});
check(deliveryWindow.MAQ_BDLOCAL_DELIVERY_TIMER.status().running===true,"El contador empieza al abrir Carga.");
child.dispatchEvent(new FakeCustomEvent("carga:periods-refreshed",{detail:{total:2}}));
flush(1000);
let deliveryStatus=deliveryWindow.MAQ_BDLOCAL_DELIVERY_TIMER.status();
check(deliveryStatus.running===false&&deliveryStatus.completions===1,"Carga termina después de confirmar sus períodos visibles.");
check(deliveryStatus.lastModuleId==="carga_excel"&&counter.dataset.state==="ok","El resultado de Carga queda visible como correcto.");

frame.dataset.moduleId="ficha_estudiante";
deliveryWindow.MAQ_CORE.state.moduloActivoId="ficha_estudiante";
busHandlers["modulo:cambiado"]({moduloId:"ficha_estudiante",modulo:{nombre:"Ficha"}});
check(deliveryWindow.MAQ_BDLOCAL_DELIVERY_TIMER.status().running===true,"El contador empieza al abrir Ficha.");
child.dispatchEvent(new FakeCustomEvent("bdlocal:screen-data-updated",{detail:{targetModuleId:"ficha_estudiante"}}));
flush(1000);
deliveryStatus=deliveryWindow.MAQ_BDLOCAL_DELIVERY_TIMER.status();
check(deliveryStatus.running===true&&deliveryStatus.dataDurationMs>=0,"La señal de datos no detiene prematuramente el contador de Ficha.");
child.dispatchEvent(new FakeCustomEvent("maqueta:screen-render-complete",{detail:{moduleId:"ficha_estudiante",source:"FichaRenderReady"}}));
flush(1000);
deliveryStatus=deliveryWindow.MAQ_BDLOCAL_DELIVERY_TIMER.status();
check(deliveryStatus.running===false&&deliveryStatus.completions===2,"Ficha termina únicamente con la confirmación visual final.");
check(deliveryStatus.lastModuleId==="ficha_estudiante"&&counter.dataset.state==="ok","El resultado final queda asociado a Ficha.");

if(errors.length){
  console.error(`\nVERIFICACIÓN BENCHMARK DE ARRANQUE: ERROR (${errors.length})`);
  errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
  process.exit(1);
}
console.log(`\nVERIFICACIÓN BENCHMARK DE ARRANQUE: OK (${checks} comprobaciones)`);
