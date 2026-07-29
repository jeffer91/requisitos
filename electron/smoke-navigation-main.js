/* =========================================================
Nombre completo: smoke-navigation-main.js
Ruta: /electron/smoke-navigation-main.js
Función:
- Abrir la maqueta principal en Electron con datos temporales.
- Navegar por todas las pantallas operativas.
- Detectar errores de dependencias, APIs ausentes y cargas bloqueadas.
- Verificar conectores especializados y el límite de tres iframes.
- Generar un reporte JSON con tiempos y estados por pantalla.
========================================================= */
"use strict";

const {app,BrowserWindow}=require("electron");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"..");
const ENTRY=path.join(ROOT,"Maqueta","maq-index.html");
const OUTPUT_DIR=path.join(ROOT,"artifacts");
const OUTPUT_FILE=path.join(OUTPUT_DIR,"navigation-electron-smoke.json");
const USER_DATA=path.join(os.tmpdir(),"requisitos-navigation-smoke-"+process.pid);
const HARD_TIMEOUT_MS=210000;
const SCREEN_TIMEOUT_MS=22000;

const MODULES=[
  {id:"tabla_principal",label:"Tabla",url:"/Gestion/Tabla/tabla.html"},
  {id:"ficha_estudiante",label:"Ficha",url:"/Ficha/ficha.html"},
  {id:"stat_main",label:"Estadísticas",url:"/Stats/stats.html"},
  {id:"coordi",label:"Coordi",url:"/Coordi/coordi.html"},
  {id:"global",label:"Global",url:"/Global/global.html"},
  {id:"modulo_reporte",label:"Reportes",url:"/Reportes/repo.html"},
  {id:"defart",label:"Defensas",url:"/defart/defart.html",connector:"ConDefart"},
  {id:"ncomplex",label:"Ncomplex",url:"/Ncomplex/ncomplex.html",connector:"ConNcomplex"},
  {id:"cr_def",label:"Cr-def",url:"/Cr-def/cr-def.html",connector:"ConCrDef"},
  {id:"titulacion",label:"InPVC",url:"/InPVC/inpvc.html",connector:"ConInPVC"}
];

let mainWindow=null;
let watchdog=null;
let finished=false;
const consoleMessages=[];

function nowISO(){return new Date().toISOString();}
function sleep(ms){return new Promise((resolve)=>setTimeout(resolve,ms));}
function normalizeUrl(value){return String(value||"").replace(/\\/g,"/");}
function writeReport(report){fs.mkdirSync(OUTPUT_DIR,{recursive:true});fs.writeFileSync(OUTPUT_FILE,JSON.stringify(report,null,2),"utf8");}
function finish(report,code){
  if(finished){return;}
  finished=true;
  if(watchdog){clearTimeout(watchdog);watchdog=null;}
  const output=Object.assign({},report||{},{rendererMessages:consoleMessages.slice(-300)});
  try{writeReport(output);}catch(error){output.ok=false;output.reportError=error.stack||error.message||String(error);code=1;}
  console.log("[Navigation Smoke]",JSON.stringify(output));
  try{if(mainWindow&&!mainWindow.isDestroyed()){mainWindow.destroy();}}catch(error){}
  setImmediate(()=>app.exit(code));
}
function fail(message,error,extra){finish(Object.assign({ok:false,smoke:true,generatedAt:nowISO(),message,error:error&&(error.stack||error.message)||String(error||"")},extra||{}),1);}

function frameBySuffix(suffix){
  if(!mainWindow||mainWindow.isDestroyed()){return null;}
  const frames=mainWindow.webContents.mainFrame.framesInSubtree||[];
  const wanted=normalizeUrl(suffix).toLowerCase();
  return frames.find((frame)=>normalizeUrl(frame.url).toLowerCase().endsWith(wanted))||null;
}

async function waitMainReady(){
  const started=Date.now();
  while(Date.now()-started<20000){
    const ready=await mainWindow.webContents.executeJavaScript("Boolean(window.MAQ_CORE&&window.MAQ_CORE.router&&window.MAQ_BASELOCAL_SESSION)",true).catch(()=>false);
    if(ready){return true;}
    await sleep(100);
  }
  return false;
}

async function seedTemporaryData(){
  const snapshot={
    meta:{source:"navigation-smoke",revision:1,updatedAt:new Date().toISOString(),periodoId:"2026-05__2026-11",periodoLabel:"Mayo 2026 a Noviembre 2026",totalPeriods:1,totalStudents:2,totalRequirements:2},
    periods:[{id:"2026-05__2026-11",periodoId:"2026-05__2026-11",value:"2026-05__2026-11",label:"Mayo 2026 a Noviembre 2026",periodoLabel:"Mayo 2026 a Noviembre 2026",activo:true}],
    students:[
      {idEstudiantePeriodo:"0100000001__2026-05__2026-11",cedula:"0100000001",numeroIdentificacion:"0100000001",periodoId:"2026-05__2026-11",Nombres:"ESTUDIANTE PRUEBA UNO",NombreCarrera:"ADMINISTRACIÓN DE EMPRESAS",division:"Prueba",estadoMatricula:"ACTIVO",Academico:"CUMPLE",Documentacion:"CUMPLE",Financiero:"CUMPLE",Vinculacion:"CUMPLE",Ingles:"CUMPLE"},
      {idEstudiantePeriodo:"0100000002__2026-05__2026-11",cedula:"0100000002",numeroIdentificacion:"0100000002",periodoId:"2026-05__2026-11",Nombres:"ESTUDIANTE PRUEBA DOS",NombreCarrera:"REDES Y TELECOMUNICACIONES",division:"Prueba",estadoMatricula:"ACTIVO",Academico:"CUMPLE",Documentacion:"CUMPLE",Financiero:"CUMPLE",Vinculacion:"CUMPLE",Ingles:"CUMPLE"}
    ],
    requirements:[
      {id:"req1",cedula:"0100000001",periodoId:"2026-05__2026-11",requisitoKey:"academico",valor:"CUMPLE"},
      {id:"req2",cedula:"0100000002",periodoId:"2026-05__2026-11",requisitoKey:"academico",valor:"CUMPLE"}
    ],
    summaries:{},diagnostics:[]
  };
  const period={id:"2026-05__2026-11",periodoId:"2026-05__2026-11",value:"2026-05__2026-11",label:"Mayo 2026 a Noviembre 2026",periodoLabel:"Mayo 2026 a Noviembre 2026",source:"navigation-smoke",updatedAt:new Date().toISOString()};
  const script=`(() => {
    const snapshot=${JSON.stringify(snapshot)};
    const period=${JSON.stringify(period)};
    localStorage.setItem("REQ_BDLOCAL_CONEXIONES_CACHE_V1",JSON.stringify(snapshot));
    localStorage.setItem("REQ_PERIODO_GLOBAL_V1",JSON.stringify(period));
    if(window.MAQ_BASELOCAL_SESSION&&typeof window.MAQ_BASELOCAL_SESSION.setSnapshot==="function"){
      window.MAQ_BASELOCAL_SESSION.setSnapshot(snapshot,{source:"navigation-smoke",allowEmpty:false,alreadyStored:true,clone:false});
    }
    return true;
  })()`;
  return mainWindow.webContents.executeJavaScript(script,true);
}

function inspectScript(connectorName){
  return `(() => {
    const text=String(document.body&&document.body.innerText||"").replace(/\\s+/g," ").trim();
    const badPatterns=[
      /no expuso la api esperada/i,
      /no se pudo cargar/i,
      /no está disponible para/i,
      /no qued[oó] disponible/i,
      /error de dependencia/i,
      /uncaught (?:typeerror|referenceerror|error)/i
    ];
    const errors=badPatterns.filter((pattern)=>pattern.test(text)).map((pattern)=>pattern.source);
    const connectorName=${JSON.stringify(connectorName||"")};
    const connector=connectorName?window[connectorName]:null;
    let connectorStatus=null;
    try{connectorStatus=connector&&typeof connector.status==="function"?connector.status():null;}catch(error){connectorStatus={ok:false,error:error.message};}
    const periodApi=window.BDLPeriodoGlobal;
    let periodStatus=null;
    try{periodStatus=periodApi&&typeof periodApi.status==="function"?periodApi.status():null;}catch(error){periodStatus={ok:false,error:error.message};}
    const selects=Array.from(document.querySelectorAll("select")).map((select)=>({id:select.id||select.name||"",value:select.value||"",options:select.options?select.options.length:0}));
    return {
      readyState:document.readyState,
      title:document.title,
      textLength:text.length,
      errors,
      connectorPresent:connectorName?!!connector:true,
      connectorStatus,
      periodPresent:!!periodApi,
      periodStatus,
      selects,
      bodySample:text.slice(0,1200)
    };
  })()`;
}

function connectorReady(result,module){
  if(!module.connector){return true;}
  const status=result&&result.connectorStatus||{};
  return !!result.connectorPresent&&status.loading!==true&&status.ready===true&&status.ok!==false&&!String(status.error||"").trim();
}
function resultReady(result,module){
  if(!result||result.readyState!=="complete"||result.textLength<20){return false;}
  if(result.errors&&result.errors.length){return false;}
  if(!connectorReady(result,module)){return false;}
  return true;
}

async function inspectModule(module){
  const started=Date.now();
  const navigated=await mainWindow.webContents.executeJavaScript(`window.MAQ_CORE.router.navegarPorModuloId(${JSON.stringify(module.id)})`,true);
  if(!navigated){return {id:module.id,label:module.label,ok:false,error:"No se pudo navegar al módulo."};}
  let last=null;
  while(Date.now()-started<SCREEN_TIMEOUT_MS){
    const frame=frameBySuffix(module.url);
    if(frame){
      try{last=await frame.executeJavaScript(inspectScript(module.connector),true);}catch(error){last={errors:[error.message],readyState:"error",textLength:0};}
      if(resultReady(last,module)){
        const pool=await mainWindow.webContents.executeJavaScript("window.MAQ_CORE.performance.poolStatus()",true).catch(()=>[]);
        return {id:module.id,label:module.label,ok:true,durationMs:Date.now()-started,poolSize:Array.isArray(pool)?pool.length:null,inspection:last};
      }
    }
    await sleep(120);
  }
  const pool=await mainWindow.webContents.executeJavaScript("window.MAQ_CORE.performance.poolStatus()",true).catch(()=>[]);
  return {id:module.id,label:module.label,ok:false,durationMs:Date.now()-started,poolSize:Array.isArray(pool)?pool.length:null,error:"La pantalla no alcanzó un estado funcional dentro del límite.",inspection:last};
}

async function run(){
  if(!fs.existsSync(ENTRY)){throw new Error("No existe Maqueta/maq-index.html.");}
  app.setPath("userData",USER_DATA);
  watchdog=setTimeout(()=>fail("La navegación completa excedió el tiempo máximo.",new Error("HARD_TIMEOUT")),HARD_TIMEOUT_MS);

  mainWindow=new BrowserWindow({
    width:1500,height:900,show:false,backgroundColor:"#ffffff",
    webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,navigateOnDragDrop:false,spellcheck:false}
  });
  mainWindow.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  mainWindow.webContents.on("will-attach-webview",(event)=>event.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(()=>({action:"deny"}));
  mainWindow.webContents.on("console-message",(_event,details)=>{
    const row={at:nowISO(),level:Number(details&&details.level||0),message:String(details&&details.message||""),line:Number(details&&details.lineNumber||0),sourceId:String(details&&details.sourceId||"")};
    consoleMessages.push(row);if(consoleMessages.length>500){consoleMessages.shift();}
  });
  mainWindow.webContents.on("render-process-gone",(_event,details)=>fail("El renderer terminó inesperadamente.",new Error(JSON.stringify(details)),{renderProcessGone:details}));

  await mainWindow.loadFile(ENTRY);
  if(!await waitMainReady()){throw new Error("La maqueta principal no quedó lista.");}
  await seedTemporaryData();

  const screens=[];
  for(const module of MODULES){screens.push(await inspectModule(module));}
  const badConsole=consoleMessages.filter((row)=>row.level>=2&&/(no expuso la api esperada|no se pudo cargar|uncaught|referenceerror|typeerror)/i.test(row.message));
  const failed=screens.filter((screen)=>!screen.ok||Number(screen.poolSize||0)>3);
  const output={
    ok:failed.length===0&&badConsole.length===0,
    smoke:true,
    isolated:true,
    network:false,
    generatedAt:nowISO(),
    timeouts:{screenMs:SCREEN_TIMEOUT_MS,hardMs:HARD_TIMEOUT_MS},
    screens,
    failedScreens:failed.map((screen)=>screen.id),
    criticalConsole:badConsole
  };
  finish(output,output.ok?0:1);
}

app.whenReady().then(run).catch((error)=>fail("No se pudo ejecutar la navegación completa.",error));
app.on("window-all-closed",()=>{if(!finished){fail("La ventana se cerró antes de terminar.",new Error("window-all-closed"));}});
process.on("uncaughtException",(error)=>fail("Excepción no controlada.",error));
process.on("unhandledRejection",(error)=>fail("Promesa rechazada sin control.",error));
process.on("exit",()=>{try{fs.rmSync(USER_DATA,{recursive:true,force:true});}catch(error){}});
