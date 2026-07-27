"use strict";

/* =========================================================
Archivo: verify-startup-benchmark.js
Ruta: /scripts/verify-startup-benchmark.js
Función:
- Verificar la instrumentación de arranque de Carga.
- Confirmar que la prueba PowerShell mide sin sincronizar fuentes externas.
- Validar la API local de CargaStartupMetrics en un entorno simulado.
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
const packageJson=JSON.parse(read("package.json"));

check(html.includes('src="./carga.startup-metrics.js"'),"Carga incluye las métricas de arranque.");
check(
  html.indexOf("carga.startup-metrics.js")<html.indexOf("carga.index.js"),
  "Las métricas se cargan antes del arranque del conector."
);
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
const status=windowObject.CargaStartupMetrics.status();
check(status.bdlocalReadyAt>0,"La marca Base Local queda registrada.");
check(status.connectionReadyAt>0,"La marca ConCarga queda registrada.");
check(status.periodsReadyAt>0&&status.periodCount===1,"La marca de períodos queda registrada.");
check(status.database&&status.database.open===true,"El estado informa que IndexedDB está abierta.");
check(status.cache&&status.cache.students===2,"El estado informa los conteos de la caché.");

if(errors.length){
  console.error(`\nVERIFICACIÓN BENCHMARK DE ARRANQUE: ERROR (${errors.length})`);
  errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
  process.exit(1);
}
console.log(`\nVERIFICACIÓN BENCHMARK DE ARRANQUE: OK (${checks} comprobaciones)`);
