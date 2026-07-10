/* =========================================================
Nombre completo: smoke-main.js
Ruta o ubicación: /electron/smoke-main.js
Función o funciones:
- Abrir BDLocal en una ventana Electron oculta y aislada.
- Usar una carpeta temporal diferente a la base real del usuario.
- Esperar el arranque completo de módulos, conectores e IndexedDB.
- Ejecutar BL2Test en modo de solo lectura y sin red.
- Guardar un reporte JSON y devolver código de salida 0 o 1.
- Usar la firma moderna del evento console-message de Electron.
========================================================= */
"use strict";

const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname,"..");
const ENTRY = path.join(ROOT,"BDLocal","bl2.html");
const OUTPUT_DIR = path.join(ROOT,"artifacts");
const OUTPUT_FILE = path.join(OUTPUT_DIR,"bdlocal-electron-smoke.json");
const USER_DATA = path.join(os.tmpdir(),"requisitos-bdlocal-smoke-"+process.pid);
const TIMEOUT_MS = 60000;

let smokeWindow = null;
let finished = false;
let exitCode = 1;

function writeReport(report){
  fs.mkdirSync(OUTPUT_DIR,{recursive:true});
  fs.writeFileSync(OUTPUT_FILE,JSON.stringify(report,null,2),"utf8");
}

function finish(report,code){
  if(finished){return;}
  finished=true;
  exitCode=Number(code||0);
  try{writeReport(report);}catch(error){console.error("[Electron Smoke] No se pudo guardar reporte:",error);exitCode=1;}
  console.log("[Electron Smoke]",JSON.stringify(report));
  if(smokeWindow&&!smokeWindow.isDestroyed()){smokeWindow.destroy();}
  app.exit(exitCode);
}

function failure(message,error){
  finish({
    ok:false,
    smoke:true,
    isolated:true,
    readOnly:true,
    network:false,
    generatedAt:new Date().toISOString(),
    message:message,
    error:error&&error.stack||error&&error.message||String(error||"")
  },1);
}

function runnerScript(timeout){
  return `new Promise((resolve) => {
    const started = Date.now();
    function done(value){ resolve(value); }
    function tick(){
      try {
        const appState = window.BL2App && window.BL2App.getState ? window.BL2App.getState() : {};
        const connectors = window.BDLocalConexiones && window.BDLocalConexiones.status ? window.BDLocalConexiones.status() : {};
        const ready = !!(window.BL2Test && window.BL2Test.run && appState && appState.ready && appState.scriptsReady && connectors && connectors.ready);
        if (ready) {
          window.BL2Test.run({log:false}).then((report) => done({ready:true,report,appState,connectors})).catch((error) => done({ready:false,error:error && (error.stack || error.message) || String(error),appState,connectors}));
          return;
        }
        if (Date.now() - started >= ${Number(timeout)}) {
          done({ready:false,timeout:true,appState,connectors,globals:{BL2Test:!!window.BL2Test,BL2App:!!window.BL2App,BL2DB:!!window.BL2DB,BDLocalConexiones:!!window.BDLocalConexiones}});
          return;
        }
      } catch (error) {
        done({ready:false,error:error && (error.stack || error.message) || String(error)});
        return;
      }
      setTimeout(tick,250);
    }
    tick();
  })`;
}

async function run(){
  if(!fs.existsSync(ENTRY)){throw new Error("No existe BDLocal/bl2.html.");}
  app.setPath("userData",USER_DATA);

  smokeWindow=new BrowserWindow({
    width:1200,
    height:800,
    show:false,
    backgroundColor:"#ffffff",
    webPreferences:{
      contextIsolation:true,
      nodeIntegration:false,
      sandbox:true,
      webSecurity:true,
      allowRunningInsecureContent:false,
      navigateOnDragDrop:false,
      spellcheck:false
    }
  });

  smokeWindow.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  smokeWindow.webContents.on("will-attach-webview",(event)=>event.preventDefault());
  smokeWindow.webContents.setWindowOpenHandler(()=>({action:"deny"}));
  smokeWindow.webContents.on("will-navigate",(event,url)=>{
    if(url!==smokeWindow.webContents.getURL()){event.preventDefault();}
  });
  smokeWindow.webContents.on("console-message",(_event,details)=>{
    const level=Number(details&&details.level||0);
    const message=String(details&&details.message||"");
    const line=Number(details&&details.lineNumber||0);
    const sourceId=String(details&&details.sourceId||"");
    if(level>=2){console.error("[Renderer]",message,"@",sourceId+":"+line);}
    else{console.log("[Renderer]",message);}
  });
  smokeWindow.webContents.on("render-process-gone",(_event,details)=>failure("El renderer terminó inesperadamente.",new Error(JSON.stringify(details))));

  await smokeWindow.loadFile(ENTRY);
  const result=await smokeWindow.webContents.executeJavaScript(runnerScript(TIMEOUT_MS),true);
  const report=result&&result.report||null;
  const output={
    ok:!!(result&&result.ready&&report&&report.ok),
    smoke:true,
    isolated:true,
    readOnly:true,
    network:false,
    generatedAt:new Date().toISOString(),
    entry:"BDLocal/bl2.html",
    userDataTemporary:true,
    result:result
  };
  finish(output,output.ok?0:1);
}

app.whenReady().then(run).catch((error)=>failure("No se pudo ejecutar la prueba Electron.",error));
app.on("window-all-closed",()=>{if(!finished){failure("La ventana se cerró antes de terminar.",new Error("window-all-closed"));}});
process.on("uncaughtException",(error)=>failure("Excepción no controlada.",error));
process.on("unhandledRejection",(error)=>failure("Promesa rechazada sin control.",error));
process.on("exit",()=>{
  try{fs.rmSync(USER_DATA,{recursive:true,force:true});}catch(error){}
  process.exitCode=exitCode;
});
