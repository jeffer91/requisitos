/* =========================================================
Nombre completo: main.js
Ruta o ubicación: /electron/main.js
Función o funciones:
- Abrir Requisitos desde Maqueta/maq-index.html.
- Ejecutar la ventana principal con aislamiento, sandbox y seguridad web.
- Mostrar el menú nativo de la aplicación en la ventana principal.
- Permitir abrir la consola desde el menú, F12, Ctrl+Shift+I o Ctrl+Shift+J.
- Limitar navegación y ventanas nuevas a archivos internos controlados.
- Validar remitentes y argumentos de todos los canales IPC.
- Abrir enlaces externos seguros fuera de la aplicación.
- Permitir correos extensos únicamente para Outlook Web.
- Mantener SISACAD en una ventana aislada y de lectura controlada.
========================================================= */
"use strict";

const { app, BrowserWindow, Menu, shell, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const snSisacadAutomation = require("./sn-sisacad-automation");

const APP_ROOT = path.resolve(__dirname,"..");
const PRELOAD_FILE = path.join(__dirname,"preload.js");
const SN_SISACAD_URL = "https://sisacad.itsqmet.edu.ec/";
const MAX_EXTERNAL_URL_LENGTH = 4096;
const MAX_OUTLOOK_COMPOSE_URL_LENGTH = 120000;
const MAX_VISIBLE_TEST_STUDENTS = 3;

let mainWindow = null;
let snSisacadWindow = null;

function normalizeFilePath(fileUrl){
  try{
    if(!fileUrl||!String(fileUrl).startsWith("file://")){return "";}
    const parsed = new URL(fileUrl);
    let pathname = decodeURIComponent(parsed.pathname || "");
    if(process.platform === "win32" && /^\/[A-Za-z]:\//.test(pathname)){pathname = pathname.slice(1);}
    return path.normalize(pathname);
  }catch(error){return "";}
}

function isPathInside(root,candidate){
  const relative = path.relative(path.resolve(root),path.resolve(candidate));
  return relative === "" || (!relative.startsWith(".."+path.sep) && relative !== ".." && !path.isAbsolute(relative));
}

function isInsideApp(url){
  if(url === "about:blank"){return true;}
  const filePath = normalizeFilePath(url);
  return !!filePath && isPathInside(APP_ROOT,filePath);
}

function isOutlookComposeUrl(parsed){
  return !!parsed &&
    parsed.protocol === "https:" &&
    parsed.hostname === "outlook.office.com" &&
    parsed.pathname === "/mail/deeplink/compose" &&
    !parsed.username &&
    !parsed.password;
}

function parsedExternalUrl(value){
  const raw = String(value || "").trim();
  if(!raw || raw.length > MAX_OUTLOOK_COMPOSE_URL_LENGTH){return null;}
  try{
    const parsed = new URL(raw);
    const maxLength = isOutlookComposeUrl(parsed) ? MAX_OUTLOOK_COMPOSE_URL_LENGTH : MAX_EXTERNAL_URL_LENGTH;
    if(raw.length > maxLength){return null;}
    if(parsed.protocol === "mailto:"){return parsed;}
    if((parsed.protocol === "https:" || parsed.protocol === "http:") && !parsed.username && !parsed.password){return parsed;}
    return null;
  }catch(error){return null;}
}

function isOpenableExternal(url){return !!parsedExternalUrl(url);}

function isSisacadUrl(url){
  try{
    if(!url || url === "about:blank"){return true;}
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "sisacad.itsqmet.edu.ec";
  }catch(error){return false;}
}

function findEntryFile(){
  const candidates=[path.join(APP_ROOT,"Maqueta","maq-index.html"),path.join(APP_ROOT,"index.html")];
  for(const candidate of candidates){if(fs.existsSync(candidate) && isPathInside(APP_ROOT,candidate)){return candidate;}}
  throw new Error("No se encontró Maqueta/maq-index.html ni index.html para iniciar Requisitos.");
}

function wait(ms){return new Promise((resolve)=>setTimeout(resolve,ms));}

function secureWebPreferences(options={}){
  return Object.assign({
    contextIsolation:true,
    nodeIntegration:false,
    sandbox:true,
    webSecurity:true,
    allowRunningInsecureContent:false,
    navigateOnDragDrop:false,
    spellcheck:false,
    devTools:true
  },options);
}

function toggleDevTools(browserWindow){
  if(!browserWindow || browserWindow.isDestroyed()){return;}
  const contents=browserWindow.webContents;
  if(!contents || contents.isDestroyed()){return;}
  if(contents.isDevToolsOpened()){
    contents.closeDevTools();
  }else{
    contents.openDevTools({mode:"detach"});
  }
}

function installApplicationMenu(){
  const template=[
    {
      label:"Archivo",
      submenu:[
        {
          label:"Salir",
          accelerator:"Alt+F4",
          click:()=>app.quit()
        }
      ]
    },
    {
      label:"Ver",
      submenu:[
        {
          label:"Recargar",
          accelerator:"Ctrl+R",
          click:()=>{
            if(mainWindow&&!mainWindow.isDestroyed()){mainWindow.webContents.reload();}
          }
        },
        {
          label:"Recargar sin caché",
          accelerator:"Ctrl+Shift+R",
          click:()=>{
            if(mainWindow&&!mainWindow.isDestroyed()){mainWindow.webContents.reloadIgnoringCache();}
          }
        },
        {type:"separator"},
        {
          label:"Abrir o cerrar consola",
          click:()=>toggleDevTools(mainWindow)
        },
        {type:"separator"},
        {role:"resetZoom",label:"Restablecer zoom"},
        {role:"zoomIn",label:"Acercar"},
        {role:"zoomOut",label:"Alejar"},
        {type:"separator"},
        {role:"togglefullscreen",label:"Pantalla completa"}
      ]
    },
    {
      label:"Ventana",
      submenu:[
        {role:"minimize",label:"Minimizar"},
        {role:"close",label:"Cerrar"}
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function installDeveloperShortcuts(browserWindow){
  if(!browserWindow || browserWindow.isDestroyed()){return;}
  browserWindow.webContents.on("before-input-event",(event,input)=>{
    if(!input || input.type!=="keyDown"){return;}
    const key=String(input.key||"").toUpperCase();
    const control=!!(input.control||input.meta);
    const requested=key==="F12" || (control&&input.shift&&(key==="I"||key==="J"));
    if(!requested){return;}
    event.preventDefault();
    toggleDevTools(browserWindow);
  });
}

function blockPermissions(browserWindow){
  if(!browserWindow || browserWindow.isDestroyed()){return;}
  const currentSession = browserWindow.webContents.session;
  if(currentSession && typeof currentSession.setPermissionRequestHandler === "function"){
    currentSession.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
  }
  if(currentSession && typeof currentSession.setPermissionCheckHandler === "function"){
    currentSession.setPermissionCheckHandler(()=>false);
  }
}

function installInternalNavigationGuards(browserWindow){
  browserWindow.webContents.on("will-attach-webview",(event)=>event.preventDefault());
  browserWindow.webContents.setWindowOpenHandler(({url})=>{
    if(isOpenableExternal(url)){
      shell.openExternal(String(url)).catch(()=>{});
      return {action:"deny"};
    }
    if(isInsideApp(url)){
      return {
        action:"allow",
        overrideBrowserWindowOptions:{
          show:true,
          autoHideMenuBar:true,
          webPreferences:secureWebPreferences({preload:PRELOAD_FILE})
        }
      };
    }
    return {action:"deny"};
  });
  browserWindow.webContents.on("will-navigate",(event,url)=>{
    if(isInsideApp(url)){return;}
    event.preventDefault();
    if(isOpenableExternal(url)){shell.openExternal(String(url)).catch(()=>{});}
  });
}

function getSisacadWindowStatus(){
  const open=!!(snSisacadWindow&&!snSisacadWindow.isDestroyed());
  return {
    ok:true,
    abierta:open,
    url:open?snSisacadWindow.webContents.getURL():"",
    titulo:open?snSisacadWindow.getTitle():"",
    visible:open?snSisacadWindow.isVisible():false,
    enfocada:open?snSisacadWindow.isFocused():false,
    sesionPersistente:true,
    soloLectura:true,
    guardaContrasena:false
  };
}

async function openSisacadWindow(){
  if(snSisacadWindow&&!snSisacadWindow.isDestroyed()){
    if(snSisacadWindow.isMinimized()){snSisacadWindow.restore();}
    snSisacadWindow.show();
    snSisacadWindow.focus();
    return getSisacadWindowStatus();
  }

  snSisacadWindow=new BrowserWindow({
    width:1280,
    height:850,
    minWidth:1000,
    minHeight:650,
    show:false,
    autoHideMenuBar:true,
    backgroundColor:"#ffffff",
    title:"SISACAD - Sacar N",
    webPreferences:secureWebPreferences({partition:"persist:requisitos-sacar-n-sisacad"})
  });

  blockPermissions(snSisacadWindow);
  installDeveloperShortcuts(snSisacadWindow);
  snSisacadWindow.once("ready-to-show",()=>{if(snSisacadWindow&&!snSisacadWindow.isDestroyed()){snSisacadWindow.show();}});
  snSisacadWindow.on("closed",()=>{snSisacadWindow=null;});
  snSisacadWindow.webContents.on("will-attach-webview",(event)=>event.preventDefault());
  snSisacadWindow.webContents.setWindowOpenHandler(({url})=>{
    if(isSisacadUrl(url)){
      return {action:"allow",overrideBrowserWindowOptions:{autoHideMenuBar:true,webPreferences:secureWebPreferences({partition:"persist:requisitos-sacar-n-sisacad"})}};
    }
    if(isOpenableExternal(url)){shell.openExternal(String(url)).catch(()=>{});}
    return {action:"deny"};
  });
  snSisacadWindow.webContents.on("will-navigate",(event,url)=>{
    if(isSisacadUrl(url)){return;}
    event.preventDefault();
    if(isOpenableExternal(url)){shell.openExternal(String(url)).catch(()=>{});}
  });
  snSisacadWindow.webContents.on("did-fail-load",(_event,errorCode,errorDescription,validatedURL)=>{
    console.error("[Sacar N SISACAD] Error de carga:",errorCode,errorDescription,validatedURL);
  });

  await snSisacadWindow.loadURL(SN_SISACAD_URL);
  return getSisacadWindowStatus();
}

function focusSisacadWindow(){
  if(snSisacadWindow&&!snSisacadWindow.isDestroyed()){
    if(snSisacadWindow.isMinimized()){snSisacadWindow.restore();}
    snSisacadWindow.show();
    snSisacadWindow.focus();
  }
  return getSisacadWindowStatus();
}

function closeSisacadWindow(){
  if(snSisacadWindow&&!snSisacadWindow.isDestroyed()){snSisacadWindow.close();}
  return getSisacadWindowStatus();
}

function ensureSisacadOpen(){
  if(snSisacadWindow&&!snSisacadWindow.isDestroyed()){
    focusSisacadWindow();
    return Promise.resolve(getSisacadWindowStatus());
  }
  return openSisacadWindow();
}

function pageStatusScript(){
  return `(() => {
    const normalize = (value) => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/\\s+/g, ' ').trim();
    const bodyText = normalize(document.body ? document.body.innerText : '');
    const title = document.title || '';
    const url = location.href;
    const hasAny = (terms) => terms.some((term) => bodyText.includes(normalize(term)));
    const hasUser = hasAny(['usuario','user','correo']);
    const hasPassword = hasAny(['contraseña','contrasena','password','clave']);
    const necesitaLogin = (hasUser && hasPassword) || hasAny(['iniciar sesion','iniciar sesión','login']);
    const enRegistro = hasAny(['registro notas proyecto','registro de notas proyecto','notas proyecto','promedio trabajo escrito','promedio defensa oral del proyecto de titulacion','promedio defensa oral del proyecto de titulación','calificacion final del proyecto de titulacion','calificación final del proyecto de titulación']);
    return {ok:true,url,title,necesitaLogin,enRegistro,textoMuestra:bodyText.slice(0,1200)};
  })()`;
}

function clickTextScript(texts){
  const safeTexts=(Array.isArray(texts)?texts:[]).map((value)=>String(value||"").slice(0,120)).slice(0,20);
  return `(() => {
    const wanted = ${JSON.stringify(safeTexts)};
    const normalize = (value) => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/\\s+/g, ' ').trim();
    const terms = wanted.map(normalize).filter(Boolean);
    const nodes = Array.from(document.querySelectorAll('a,button,input[type="button"],input[type="submit"],[role="button"],[onclick],li,span,div'));
    const candidates = [];
    for (const node of nodes) {
      const raw = node.innerText || node.textContent || node.value || node.title || node.getAttribute('aria-label') || '';
      const label = normalize(raw);
      if (!label || label.length > 180) continue;
      for (const term of terms) {
        if (label === term || label.includes(term)) { candidates.push({node,label,exact:label === term}); break; }
      }
    }
    candidates.sort((a,b)=>Number(b.exact)-Number(a.exact)||a.label.length-b.label.length);
    const found = candidates[0];
    if (!found) return {ok:false,clicked:false,reason:'texto_no_encontrado',buscado:wanted};
    const target = found.node.closest('a,button,[role="button"],[onclick],li') || found.node;
    try { target.scrollIntoView({block:'center',inline:'center'}); } catch (error) {}
    try { target.click(); } catch (error) { return {ok:false,clicked:false,reason:'click_error',error:error.message,label:found.label}; }
    return {ok:true,clicked:true,label:found.label,buscado:wanted};
  })()`;
}

async function executeInSisacad(script){
  if(!snSisacadWindow||snSisacadWindow.isDestroyed()){return {ok:false,error:"SISACAD no está abierto."};}
  try{return await snSisacadWindow.webContents.executeJavaScript(script,true);}catch(error){return {ok:false,error:error.message};}
}

async function checkRegistroNotasProyecto(){
  await ensureSisacadOpen();
  const page=await executeInSisacad(pageStatusScript());
  return Object.assign({},getSisacadWindowStatus(),page||{});
}

async function navigateRegistroNotasProyecto(){
  await ensureSisacadOpen();
  await wait(800);
  let page=await executeInSisacad(pageStatusScript());
  if(page&&page.necesitaLogin){return Object.assign({},getSisacadWindowStatus(),page,{ok:false,necesitaLogin:true,mensaje:"SISACAD necesita inicio de sesión manual. Ingrese en la ventana visible y vuelva a intentar."});}
  if(page&&page.enRegistro){return Object.assign({},getSisacadWindowStatus(),page,{ok:true,enRegistro:true,mensaje:"SISACAD ya está en Registro Notas Proyecto."});}

  const ingreso=await executeInSisacad(clickTextScript(["Ingreso"]));
  await wait(1200);
  page=await executeInSisacad(pageStatusScript());
  if(page&&page.necesitaLogin){return Object.assign({},getSisacadWindowStatus(),page,{ok:false,necesitaLogin:true,paso:"Ingreso",mensaje:"SISACAD necesita inicio de sesión manual. Ingrese en la ventana visible y vuelva a intentar."});}

  let registro=await executeInSisacad(clickTextScript(["Registro Notas Proyecto","Registro de Notas Proyecto","Registro Notas Proyecto de Titulación","Notas Proyecto","Notas Proyecto de Titulación"]));
  await wait(1500);
  page=await executeInSisacad(pageStatusScript());
  if(page&&page.enRegistro){return Object.assign({},getSisacadWindowStatus(),page,{ok:true,enRegistro:true,paso:"Registro Notas Proyecto",clickIngreso:ingreso,clickRegistro:registro,mensaje:"SISACAD está en Registro Notas Proyecto."});}

  registro=await executeInSisacad(clickTextScript(["Registro Notas Proyecto","Registro de Notas Proyecto","Notas Proyecto"]));
  await wait(1500);
  page=await executeInSisacad(pageStatusScript());
  return Object.assign({},getSisacadWindowStatus(),page||{}, {
    ok:!!(page&&page.enRegistro),
    enRegistro:!!(page&&page.enRegistro),
    clickIngreso:ingreso,
    clickRegistro:registro,
    mensaje:page&&page.enRegistro?"SISACAD está en Registro Notas Proyecto.":"No se pudo llegar automáticamente a Registro Notas Proyecto. Navegue manualmente en la ventana visible."
  });
}

function sanitizeStudents(value){
  return (Array.isArray(value)?value:[]).slice(0,MAX_VISIBLE_TEST_STUDENTS).map((row,index)=>({
    id:String(row&&row.id||row&&row.cedula||`sn-${index+1}`).slice(0,120),
    orden:index+1,
    cedula:String(row&&row.cedula||"").replace(/[^0-9]/g,"").slice(0,20),
    nombres:String(row&&row.nombres||"").replace(/\s+/g," ").trim().slice(0,180),
    carrera:String(row&&row.carrera||"").replace(/\s+/g," ").trim().slice(0,180),
    periodo:String(row&&row.periodo||"").replace(/\s+/g," ").trim().slice(0,120),
    modalidad:String(row&&row.modalidad||"").replace(/\s+/g," ").trim().slice(0,80)
  }));
}

async function runPruebaVisible(estudiantes){
  return snSisacadAutomation.runPruebaVisible(sanitizeStudents(estudiantes),{
    getWindow:()=>snSisacadWindow,
    ensureOpen:ensureSisacadOpen,
    status:getSisacadWindowStatus
  });
}

function createMainWindow(){
  const entryFile=findEntryFile();
  mainWindow=new BrowserWindow({
    width:1380,
    height:860,
    minWidth:1100,
    minHeight:680,
    show:false,
    autoHideMenuBar:false,
    backgroundColor:"#f8fafc",
    title:"Requisitos",
    webPreferences:secureWebPreferences({preload:PRELOAD_FILE})
  });

  installApplicationMenu();
  mainWindow.setAutoHideMenuBar(false);
  mainWindow.setMenuBarVisibility(true);
  installDeveloperShortcuts(mainWindow);
  blockPermissions(mainWindow);
  installInternalNavigationGuards(mainWindow);
  mainWindow.once("ready-to-show",()=>{if(mainWindow&&!mainWindow.isDestroyed()){mainWindow.show();}});
  mainWindow.on("closed",()=>{mainWindow=null;});
  mainWindow.webContents.on("did-fail-load",(_event,errorCode,errorDescription,validatedURL)=>{
    console.error("[Requisitos Electron] Error de carga:",errorCode,errorDescription,validatedURL);
  });
  mainWindow.loadFile(entryFile);
}

function trustedSender(event){
  try{
    const frame=event&&event.senderFrame;
    const sender=event&&event.sender;
    return !!frame && !!sender && !!mainWindow && !mainWindow.isDestroyed() && sender === mainWindow.webContents && isInsideApp(frame.url);
  }catch(error){return false;}
}

function secureHandle(channel,handler){
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel,async(event,...args)=>{
    if(!trustedSender(event)){throw new Error("Solicitud IPC rechazada por origen no autorizado.");}
    return handler(...args);
  });
}

function registerIpc(){
  secureHandle("requisitos:get-app-info",()=>({
    appName:"Requisitos",
    appVersion:app.getVersion(),
    runtime:"electron",
    electron:process.versions.electron,
    chrome:process.versions.chrome,
    platform:process.platform
  }));
  secureHandle("requisitos:open-external",async(url)=>{
    const parsed=parsedExternalUrl(url);
    if(!parsed){return {ok:false,opened:false,error:"Enlace externo no permitido o demasiado extenso."};}
    await shell.openExternal(parsed.toString());
    return {ok:true,opened:true,method:isOutlookComposeUrl(parsed)?"outlook-web":"external"};
  });
  secureHandle("sn:sisacad-open",()=>openSisacadWindow());
  secureHandle("sn:sisacad-status",()=>getSisacadWindowStatus());
  secureHandle("sn:sisacad-focus",()=>focusSisacadWindow());
  secureHandle("sn:sisacad-close",()=>closeSisacadWindow());
  secureHandle("sn:sisacad-check-registro",()=>checkRegistroNotasProyecto());
  secureHandle("sn:sisacad-navigate-registro",()=>navigateRegistroNotasProyecto());
  secureHandle("sn:sisacad-prueba-visible",(estudiantes)=>runPruebaVisible(estudiantes));
}

app.whenReady().then(()=>{
  registerIpc();
  createMainWindow();
}).catch((error)=>{
  console.error("[Requisitos Electron] No se pudo iniciar:",error);
  app.quit();
});

app.on("window-all-closed",()=>{if(process.platform!=="darwin"){app.quit();}});
app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0){createMainWindow();}});
