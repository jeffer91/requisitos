/* =========================================================
Nombre completo: updater.js
Ruta: /electron/updater.js
Función:
- Gestionar actualizaciones de la aplicación instalada mediante GitHub Releases.
- Descargar actualizaciones en segundo plano.
- Pedir confirmación antes de reiniciar e instalar.
- Delegar la comprobación de seguridad de cierre a main-safe.js.
- No interferir con el modo desarrollo ni con GitHub Pages.
========================================================= */
"use strict";

const { app, dialog } = require("electron");

let autoUpdater = null;
let updaterLoadError = "";
let mainWindow = null;
let prepareInstall = null;
let listenersInstalled = false;
let startupCheckScheduled = false;
let promptOpen = false;
let manualCheck = false;

const state = {
  supported: process.platform === "win32",
  dependencyAvailable: false,
  packaged: app.isPackaged,
  checking: false,
  updateAvailable: false,
  downloaded: false,
  currentVersion: app.getVersion(),
  availableVersion: "",
  progressPercent: 0,
  lastCheckedAt: "",
  error: "",
  message: "Actualizador listo."
};

function cloneState(){
  return Object.assign({}, state);
}

function getWindow(){
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
}

function loadAutoUpdater(){
  if(autoUpdater){return autoUpdater;}
  if(updaterLoadError){return null;}
  try{
    ({ autoUpdater } = require("electron-updater"));
    state.dependencyAvailable = true;
    return autoUpdater;
  }catch(error){
    updaterLoadError = error && error.message ? error.message : String(error);
    state.dependencyAvailable = false;
    state.error = updaterLoadError;
    state.message = "electron-updater todavía no está instalado.";
    return null;
  }
}

function configure(options={}){
  if(typeof options.prepareInstall === "function"){
    prepareInstall = options.prepareInstall;
  }
  if(options.mainWindow && !options.mainWindow.isDestroyed()){
    mainWindow = options.mainWindow;
  }
  return cloneState();
}

async function showMessage(options){
  const win = getWindow();
  try{
    return win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
  }catch(error){
    return { response: 1 };
  }
}

async function promptDownloadedUpdate(){
  if(promptOpen || !state.downloaded){return;}
  promptOpen = true;
  try{
    const result = await showMessage({
      type: "info",
      title: "Actualización lista",
      message: `Requisitos ${state.availableVersion || "nueva versión"} ya está descargado.`,
      detail: "Puede instalarla ahora. Antes de cerrar, Requisitos comprobará que no queden cambios pendientes de sincronización.",
      buttons: ["Actualizar y reiniciar", "Más tarde"],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });
    if(result.response === 0){
      await installDownloadedUpdate();
    }
  }finally{
    promptOpen = false;
  }
}

function installListeners(){
  const updater = loadAutoUpdater();
  if(!updater || listenersInstalled){return !!updater;}
  listenersInstalled = true;

  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = false;
  updater.allowPrerelease = false;

  updater.on("checking-for-update",()=>{
    state.checking = true;
    state.error = "";
    state.message = "Buscando actualizaciones...";
  });

  updater.on("update-available",(info)=>{
    state.checking = false;
    state.updateAvailable = true;
    state.downloaded = false;
    state.availableVersion = String(info && info.version || "");
    state.progressPercent = 0;
    state.lastCheckedAt = new Date().toISOString();
    state.message = state.availableVersion
      ? `Descargando Requisitos ${state.availableVersion}...`
      : "Descargando actualización...";
  });

  updater.on("update-not-available",async()=>{
    state.checking = false;
    state.updateAvailable = false;
    state.downloaded = false;
    state.availableVersion = "";
    state.progressPercent = 0;
    state.lastCheckedAt = new Date().toISOString();
    state.message = "Requisitos está actualizado.";
    if(manualCheck){
      manualCheck = false;
      await showMessage({
        type: "info",
        title: "Actualizaciones",
        message: "Requisitos está actualizado.",
        detail: `Versión instalada: ${app.getVersion()}`,
        buttons: ["Aceptar"],
        defaultId: 0,
        noLink: true
      });
    }
  });

  updater.on("download-progress",(progress)=>{
    const percent = Number(progress && progress.percent || 0);
    state.progressPercent = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
    state.message = `Descargando actualización: ${state.progressPercent.toFixed(0)}%`;
  });

  updater.on("update-downloaded",async(info)=>{
    state.checking = false;
    state.updateAvailable = true;
    state.downloaded = true;
    state.availableVersion = String(info && info.version || state.availableVersion || "");
    state.progressPercent = 100;
    state.lastCheckedAt = new Date().toISOString();
    state.message = "Actualización descargada y lista para instalar.";
    manualCheck = false;
    await promptDownloadedUpdate();
  });

  updater.on("error",async(error)=>{
    const detail = error && error.message ? error.message : String(error || "Error desconocido");
    state.checking = false;
    state.error = detail;
    state.message = "No se pudo comprobar o descargar la actualización.";
    state.lastCheckedAt = new Date().toISOString();
    const shouldShow = manualCheck;
    manualCheck = false;
    if(shouldShow){
      await showMessage({
        type: "warning",
        title: "Actualizaciones",
        message: "No se pudo comprobar la actualización.",
        detail,
        buttons: ["Aceptar"],
        defaultId: 0,
        noLink: true
      });
    }
  });

  return true;
}

function attachWindow(browserWindow){
  if(browserWindow && !browserWindow.isDestroyed()){
    mainWindow = browserWindow;
  }

  state.packaged = app.isPackaged;
  state.currentVersion = app.getVersion();

  if(!state.supported){
    state.message = "Las actualizaciones automáticas están configuradas para Windows.";
    return cloneState();
  }

  if(!app.isPackaged){
    state.message = "Actualizaciones automáticas desactivadas en modo desarrollo.";
    loadAutoUpdater();
    return cloneState();
  }

  if(!installListeners()){
    return cloneState();
  }

  if(!startupCheckScheduled){
    startupCheckScheduled = true;
    setTimeout(()=>{
      checkForUpdates({ manual: false }).catch((error)=>{
        console.warn("[Requisitos Updater] Comprobación inicial:", error && error.message ? error.message : error);
      });
    }, 7000);
  }

  return cloneState();
}

async function checkForUpdates(options={}){
  manualCheck = options.manual === true;

  if(!state.supported){
    state.message = "Las actualizaciones automáticas están disponibles en Windows.";
    return cloneState();
  }

  if(!app.isPackaged){
    state.packaged = false;
    state.message = "La búsqueda de actualizaciones solo funciona en la aplicación instalada.";
    if(manualCheck){
      manualCheck = false;
      await showMessage({
        type: "info",
        title: "Actualizaciones",
        message: "Está ejecutando Requisitos en modo desarrollo.",
        detail: "La búsqueda de actualizaciones se habilita en el instalador de Windows.",
        buttons: ["Aceptar"],
        defaultId: 0,
        noLink: true
      });
    }
    return cloneState();
  }

  const updater = loadAutoUpdater();
  if(!updater || !installListeners()){
    const detail = updaterLoadError || "electron-updater no está disponible.";
    if(manualCheck){
      manualCheck = false;
      await showMessage({
        type: "warning",
        title: "Actualizaciones",
        message: "El componente de actualización no está instalado.",
        detail,
        buttons: ["Aceptar"],
        defaultId: 0,
        noLink: true
      });
    }
    return cloneState();
  }

  try{
    state.checking = true;
    state.error = "";
    state.message = "Buscando actualizaciones...";
    await updater.checkForUpdates();
  }catch(error){
    const detail = error && error.message ? error.message : String(error);
    state.checking = false;
    state.error = detail;
    state.message = "No se pudo comprobar la actualización.";
    const shouldShow = manualCheck;
    manualCheck = false;
    if(shouldShow){
      await showMessage({
        type: "warning",
        title: "Actualizaciones",
        message: "No se pudo comprobar la actualización.",
        detail,
        buttons: ["Aceptar"],
        defaultId: 0,
        noLink: true
      });
    }
  }

  return cloneState();
}

async function installDownloadedUpdate(){
  const updater = loadAutoUpdater();
  if(!updater || !app.isPackaged){
    return { ok:false, installed:false, state:cloneState(), message:"No hay una actualización instalable en este entorno." };
  }
  if(!state.downloaded){
    return { ok:false, installed:false, state:cloneState(), message:"Todavía no se ha descargado una actualización." };
  }

  let safety = { ok:true, canInstall:true };
  if(typeof prepareInstall === "function"){
    try{
      safety = await prepareInstall();
    }catch(error){
      safety = { ok:false, canInstall:false, message:error && error.message ? error.message : String(error) };
    }
  }

  if(!safety || safety.canInstall !== true){
    const detail = safety && safety.message
      ? String(safety.message)
      : "Existen cambios pendientes o la sincronización no pudo confirmarse.";
    await showMessage({
      type: "warning",
      title: "Actualización pendiente",
      message: "La actualización no se instalará todavía.",
      detail,
      buttons: ["Aceptar"],
      defaultId: 0,
      noLink: true
    });
    return { ok:false, installed:false, blocked:true, state:cloneState(), message:detail };
  }

  state.message = "Reiniciando para instalar la actualización...";
  setImmediate(()=>{
    try{
      updater.quitAndInstall(false, true);
    }catch(error){
      console.error("[Requisitos Updater] No se pudo ejecutar quitAndInstall:", error);
    }
  });

  return { ok:true, installed:true, state:cloneState(), message:"Actualización preparada para instalar." };
}

module.exports = {
  configure,
  attachWindow,
  checkForUpdates,
  installDownloadedUpdate,
  getStatus: cloneState
};
