/* =========================================================
Nombre completo: main-safe.js
Ruta o ubicación: /electron/main-safe.js
Función o funciones:
- Ser la entrada segura de Electron antes de electron/main.js.
- Impedir que se ejecuten dos instancias de Requisitos al mismo tiempo.
- Exponer un puente limitado hacia el iframe de Base Local.
- Consultar inactividad del sistema sin exponer Node al navegador.
- Interceptar el cierre y exigir sincronización confirmada.
- Mantener la aplicación abierta cuando existan pendientes o errores.
Con qué se conecta:
- electron/main.js
- electron/preload.js
- Maqueta/maq-baselocal-background-sync.js
- BDLocal/bl2.html
========================================================= */
"use strict";

const path=require("node:path");
const {app,BrowserWindow,dialog,ipcMain,powerMonitor}=require("electron");

const RENDERER_CLOSE_TIMEOUT_MS=6*60*1000;
const BRIDGE_REQUEST_TIMEOUT_MS=150000;
const BRIDGE_STATUS_TIMEOUT_MS=15000;
const ALLOWED_TARGETS=new Set(["google","firebase","supabase"]);
const originalLoadFile=BrowserWindow.prototype.loadFile;
const guardedWindows=new WeakSet();
const closeState=new WeakMap();
let mainWindow=null;

function isMainEntry(filePath){
  try{
    const resolved=path.resolve(String(filePath||""));
    return resolved.endsWith(path.join("Maqueta","maq-index.html"))||path.basename(resolved)==="maq-index.html";
  }catch(error){return false;}
}

function normalizeFilePath(fileUrl){
  try{
    if(!fileUrl||!String(fileUrl).startsWith("file://")){return "";}
    const parsed=new URL(fileUrl);
    let pathname=decodeURIComponent(parsed.pathname||"");
    if(process.platform==="win32"&&/^\/[A-Za-z]:\//.test(pathname)){pathname=pathname.slice(1);}
    return path.normalize(pathname);
  }catch(error){return "";}
}

function isMainRendererUrl(url){
  const filePath=normalizeFilePath(url);
  return !!filePath&&isMainEntry(filePath);
}

function rendererCloseScript(){
  return `(() => {
    const api = window.MAQ_BASELOCAL_BACKGROUND_SYNC;
    if (!api || typeof api.handleCloseRequest !== "function") {
      return Promise.resolve({
        ok: false,
        canClose: false,
        message: "El protector de sincronización todavía no está disponible. Espere unos segundos y vuelva a intentar."
      });
    }
    return Promise.resolve(api.handleCloseRequest()).then((result) => result || {
      ok: false,
      canClose: false,
      message: "La comprobación de cierre no devolvió un resultado válido."
    });
  })()`;
}

function withTimeout(promise,timeoutMs){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const timer=setTimeout(()=>{
      if(settled){return;}
      settled=true;
      reject(new Error("La operación excedió el tiempo de seguridad."));
    },timeoutMs);

    Promise.resolve(promise).then((value)=>{
      if(settled){return;}
      settled=true;
      clearTimeout(timer);
      resolve(value);
    }).catch((error)=>{
      if(settled){return;}
      settled=true;
      clearTimeout(timer);
      reject(error);
    });
  });
}

function focusMainWindow(){
  if(!mainWindow||mainWindow.isDestroyed()){return;}
  if(mainWindow.isMinimized()){mainWindow.restore();}
  mainWindow.show();
  mainWindow.focus();
}

function frameList(rootFrame){
  if(!rootFrame){return [];}
  if(Array.isArray(rootFrame.framesInSubtree)&&rootFrame.framesInSubtree.length){return rootFrame.framesInSubtree.slice();}
  const output=[];
  const visit=(frame)=>{
    if(!frame){return;}
    output.push(frame);
    const children=Array.isArray(frame.frames)?frame.frames:[];
    children.forEach(visit);
  };
  visit(rootFrame);
  return output;
}

function isBaseLocalUrl(url){
  try{
    const parsed=new URL(String(url||""));
    const pathname=decodeURIComponent(parsed.pathname||"").replace(/\\/g,"/").toLowerCase();
    return pathname.endsWith("/bdlocal/bl2.html");
  }catch(error){return false;}
}

function findBaseLocalFrame(){
  if(!mainWindow||mainWindow.isDestroyed()||mainWindow.webContents.isDestroyed()){return null;}
  const frames=frameList(mainWindow.webContents.mainFrame);
  return frames.find((frame)=>isBaseLocalUrl(frame.url))||null;
}

function trustedSyncSender(event){
  try{
    return !!event&&
      !!event.sender&&
      !!event.senderFrame&&
      !!mainWindow&&
      !mainWindow.isDestroyed()&&
      event.sender===mainWindow.webContents&&
      isMainRendererUrl(event.senderFrame.url);
  }catch(error){return false;}
}

function cleanText(value,maxLength=180){return String(value==null?"":value).trim().slice(0,maxLength);}
function safeLimit(value){value=Math.floor(Number(value||5));return Math.min(25,Math.max(1,value||5));}
function safeTarget(value){value=cleanText(value,20).toLowerCase();return ALLOWED_TARGETS.has(value)?value:"";}
function safePeriod(value){return cleanText(value,120).replace(/[^0-9A-Za-z_-]/g,"");}

async function baseLocalBridgeRuntime(action,input){
  "use strict";
  input=input||{};

  function text(value){return String(value==null?"":value).trim();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function num(value,fallback){value=Number(value);return Number.isFinite(value)?value:Number(fallback||0);}
  function rowId(row){return text(row&&(row.id||row.cambioId));}
  function payloadOf(row){return row&&(row.payload||row.data||row.registro)||{};}
  function stable(value){
    if(value==null){return String(value);}
    if(typeof value!=="object"){return JSON.stringify(value);}
    if(Array.isArray(value)){return "["+value.map(stable).join(",")+"]";}
    return "{"+Object.keys(value).sort().map(function(key){return JSON.stringify(key)+":"+stable(value[key]);}).join(",")+"}";
  }
  function sameRevision(sent,current){
    sent=sent||{};
    current=current||{};
    var sentHash=text(sent.contentHash);
    var currentHash=text(current.contentHash);
    if(sentHash||currentHash){return !!sentHash&&sentHash===currentHash;}
    var sentRevision=num(sent.payloadRevision,0);
    var currentRevision=num(current.payloadRevision,0);
    if(sentRevision||currentRevision){return sentRevision>0&&sentRevision===currentRevision;}
    return stable(payloadOf(sent))===stable(payloadOf(current));
  }
  function config(){
    var store=window.BDLocalConfigStore;
    var current=store&&typeof store.loadConfig==="function"?store.loadConfig()||{}:{};
    return {
      firebaseEnabled:!current.firebase||current.firebase.enabled!==false,
      sheetsEnabled:!!(current.sheets&&current.sheets.enabled===true),
      supabaseEnabled:!!(current.supabase&&current.supabase.enabled===true),
      sheetsConfigured:!!(current.sheets&&current.sheets.appsScriptUrlProtected&&current.sheets.tokenProtected&&current.sheets.spreadsheetId),
      supabaseConfigured:!!(current.supabase&&current.supabase.url&&current.supabase.anonKeyProtected&&current.supabase.tableName)
    };
  }
  function installGuard(){
    var outbox=window.BDLSyncOutbox;
    if(!outbox||typeof outbox.markSynced!=="function"){return {ok:false,installed:false,message:"BDLSyncOutbox no está disponible."};}
    if(outbox.markSynced.__revisionGuard){return {ok:true,installed:true,alreadyInstalled:true};}
    var original=outbox.markSynced.bind(outbox);

    function repository(){
      var repositories=window.BDLRepositories;
      return repositories&&typeof repositories.get==="function"
        ?repositories.get("cambios_pendientes")||repositories.get("cambios")
        :window.BDLRepoCambios||null;
    }
    function readCurrent(ids){
      var repo=repository();
      if(repo&&typeof repo.getByIds==="function"){return repo.getByIds(ids);}
      return outbox.list({force:true}).then(function(rows){
        var wanted=Object.create(null);
        ids.forEach(function(id){wanted[id]=true;});
        return (rows||[]).filter(function(row){return !!wanted[rowId(row)];});
      });
    }
    function guarded(rows,target,details){
      rows=Array.isArray(rows)?rows:[];
      var snapshots=Object.create(null);
      rows.forEach(function(row){var id=rowId(row);if(id){snapshots[id]=clone(row);}});
      var ids=Object.keys(snapshots);
      if(!ids.length){return original([],target,details||{});}
      return readCurrent(ids).then(function(currentRows){
        var currentMap=Object.create(null);
        (currentRows||[]).forEach(function(row){var id=rowId(row);if(id){currentMap[id]=row;}});
        var safe=[];
        var stale=[];
        ids.forEach(function(id){
          var current=currentMap[id];
          if(current&&sameRevision(snapshots[id],current)){safe.push(current);}else{stale.push(id);}
        });
        if(!safe.length){
          return {ok:true,updated:0,target:target,status:"PENDIENTE",staleIds:stale,revisionGuard:true,message:"La confirmación corresponde a una revisión anterior; el cambio actual continúa pendiente."};
        }
        return original(safe,target,details||{}).then(function(result){
          return Object.assign({},result||{}, {staleIds:stale,revisionGuard:true,confirmedRevisionSafe:safe.map(rowId)});
        });
      });
    }
    guarded.__revisionGuard=true;
    guarded.__original=original;
    outbox.markSynced=guarded;
    window.__REQ_SYNC_CONFIRMATION_GUARD="4.1.0";
    return {ok:true,installed:true};
  }

  if(action==="status"){
    return {
      ok:true,
      ready:!!window.BDLSyncV2&&!!window.BDLSyncOutbox&&!!window.BDLocalConfigStore,
      config:config(),
      versions:{sync:window.BDLSyncV2&&window.BDLSyncV2.version||"",outbox:window.BDLSyncOutbox&&window.BDLSyncOutbox.version||""},
      message:window.BDLSyncV2&&window.BDLSyncOutbox?"Base Local lista.":"Base Local todavía está cargando."
    };
  }

  if(action==="install-guard"){
    return installGuard();
  }

  if(action==="snapshot"){
    var outbox=window.BDLSyncOutbox;
    if(!outbox||typeof outbox.list!=="function"){return {ok:false,total:0,detail:{},invalid:[],message:"BDLSyncOutbox no está disponible."};}
    var targets=Array.isArray(input.targets)?input.targets.filter(function(target){return ["google","firebase","supabase"].indexOf(text(target).toLowerCase())>=0;}):[];
    var forceRetry=input.forceRetry===true;
    var rows=await outbox.list({force:true,includeLegacy:true});
    rows=Array.isArray(rows)?rows:[];
    var detail={};
    var invalid=[];
    var total=0;
    var latestPendingMs=0;
    rows.forEach(function(row){
      var at=Date.parse(text(row&&(row.updatedAt||row.createdAt)))||0;
      if(at>latestPendingMs){latestPendingMs=at;}
    });

    targets.forEach(function(target){
      target=text(target).toLowerCase();
      var periods=Object.create(null);
      var eligible=0;
      var allPending=0;
      var blocked=0;
      var waitingRetry=0;
      rows.forEach(function(row){
        var done=typeof outbox.isDone==="function"&&outbox.isDone(row,target);
        if(done){return;}
        allPending+=1;
        var isBlocked=typeof outbox.isBlocked==="function"&&outbox.isBlocked(row,target,{});
        var retryDue=typeof outbox.retryDue!=="function"||outbox.retryDue(row,target,{});
        if(!forceRetry&&isBlocked){blocked+=1;return;}
        if(!forceRetry&&!retryDue){waitingRetry+=1;return;}
        var period=text(row.periodoId||row.periodId);
        if(!period||period==="global"){
          invalid.push({id:rowId(row),target:target,reason:"Cambio sin período válido."});
          return;
        }
        periods[period]=(periods[period]||0)+1;
        eligible+=1;
      });
      detail[target]={open:eligible,allPending:allPending,blocked:blocked,waitingRetry:waitingRetry,periods:periods};
      total+=eligible;
    });

    return {ok:true,total:total,detail:detail,invalid:invalid,targets:targets,latestPendingAt:latestPendingMs?new Date(latestPendingMs).toISOString():"",at:new Date().toISOString()};
  }

  if(action==="request"){
    installGuard();
    if(!window.BDLSyncV2||typeof window.BDLSyncV2.request!=="function"){return {ok:false,message:"BDLSyncV2 no está disponible."};}
    return window.BDLSyncV2.request({
      manual:true,
      automatic:false,
      source:text(input.source||"MAQAutoSync.bridge"),
      targets:[text(input.target).toLowerCase()],
      periodoId:text(input.periodoId),
      periodoLabel:text(input.periodoLabel||input.periodoId),
      limit:Math.min(25,Math.max(1,Math.floor(num(input.limit,5)))),
      batchSize:Math.min(25,Math.max(1,Math.floor(num(input.limit,5)))),
      forceRetry:input.forceRetry===true,
      ignoreRetry:input.forceRetry===true
    });
  }

  return {ok:false,message:"Acción del puente no reconocida."};
}

function bridgeScript(action,payload){
  return `(${baseLocalBridgeRuntime.toString()})(${JSON.stringify(action)},${JSON.stringify(payload||{})})`;
}

async function executeBaseLocal(action,payload,timeoutMs){
  const frame=findBaseLocalFrame();
  if(!frame){return {ok:false,ready:false,message:"El iframe de Base Local todavía no está cargado."};}
  try{
    return await withTimeout(frame.executeJavaScript(bridgeScript(action,payload),true),timeoutMs);
  }catch(error){
    return {ok:false,ready:false,message:error&&error.message?error.message:String(error)};
  }
}

function registerSyncBridge(){
  const secure=(channel,handler)=>{
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel,async(event,...args)=>{
      if(!trustedSyncSender(event)){throw new Error("Solicitud de sincronización rechazada por origen no autorizado.");}
      return handler(...args);
    });
  };

  secure("requisitos:sync-status",()=>executeBaseLocal("status",{},BRIDGE_STATUS_TIMEOUT_MS));
  secure("requisitos:sync-install-guard",()=>executeBaseLocal("install-guard",{},BRIDGE_STATUS_TIMEOUT_MS));
  secure("requisitos:sync-snapshot",(options)=>{
    options=options&&typeof options==="object"?options:{};
    const targets=(Array.isArray(options.targets)?options.targets:[]).map(safeTarget).filter(Boolean).slice(0,3);
    return executeBaseLocal("snapshot",{targets,forceRetry:options.forceRetry===true},BRIDGE_STATUS_TIMEOUT_MS);
  });
  secure("requisitos:sync-request",(options)=>{
    options=options&&typeof options==="object"?options:{};
    const target=safeTarget(options.target);
    const periodoId=safePeriod(options.periodoId);
    if(!target){return {ok:false,message:"Destino no permitido."};}
    if(!periodoId){return {ok:false,message:"Período no válido."};}
    return executeBaseLocal("request",{
      target,
      periodoId,
      periodoLabel:safePeriod(options.periodoLabel||periodoId),
      source:cleanText(options.source||"MAQAutoSync.bridge",120),
      limit:safeLimit(options.limit),
      forceRetry:options.forceRetry===true
    },BRIDGE_REQUEST_TIMEOUT_MS);
  });
  secure("requisitos:sync-idle-state",()=>({
    ok:true,
    focused:!!(mainWindow&&!mainWindow.isDestroyed()&&mainWindow.isFocused()),
    visible:!!(mainWindow&&!mainWindow.isDestroyed()&&mainWindow.isVisible()),
    minimized:!!(mainWindow&&!mainWindow.isDestroyed()&&mainWindow.isMinimized()),
    systemIdleSeconds:powerMonitor.getSystemIdleTime()
  }));
}

async function requestProtectedClose(browserWindow){
  if(!browserWindow||browserWindow.isDestroyed()){
    return {ok:false,canClose:false,message:"La ventana principal ya no está disponible."};
  }
  if(browserWindow.webContents.isDestroyed()){
    return {ok:false,canClose:false,message:"La pantalla principal no está disponible para comprobar la sincronización."};
  }

  try{
    return await withTimeout(
      browserWindow.webContents.executeJavaScript(rendererCloseScript(),true),
      RENDERER_CLOSE_TIMEOUT_MS
    );
  }catch(error){
    return {ok:false,canClose:false,message:error&&error.message?error.message:String(error)};
  }
}

async function showBlockedDialog(browserWindow,result){
  const detail=result&&result.message
    ?String(result.message)
    :"Todavía existen cambios pendientes o un destino no confirmó la sincronización.";

  return dialog.showMessageBox(browserWindow,{
    type:"warning",
    title:"Cierre bloqueado por sincronización",
    message:"Requisitos permanecerá abierto para proteger la información.",
    detail:detail,
    buttons:["Reintentar sincronización","Volver a la aplicación"],
    defaultId:0,
    cancelId:1,
    noLink:true
  });
}

function installCloseGuard(browserWindow){
  if(!browserWindow||browserWindow.isDestroyed()||guardedWindows.has(browserWindow)){return;}
  guardedWindows.add(browserWindow);
  closeState.set(browserWindow,{allowClose:false,checking:false});

  if(browserWindow.webContents&&typeof browserWindow.webContents.setBackgroundThrottling==="function"){
    browserWindow.webContents.setBackgroundThrottling(false);
  }

  browserWindow.on("close",(event)=>{
    const state=closeState.get(browserWindow)||{allowClose:false,checking:false};
    if(state.allowClose){return;}

    event.preventDefault();
    if(state.checking){focusMainWindow();return;}

    state.checking=true;
    closeState.set(browserWindow,state);
    focusMainWindow();

    (async()=>{
      let result=await requestProtectedClose(browserWindow);
      while(browserWindow&&!browserWindow.isDestroyed()&&(!result||result.canClose!==true)){
        const response=await showBlockedDialog(browserWindow,result||{});
        if(response.response!==0){
          try{
            await browserWindow.webContents.executeJavaScript(
              'window.MAQ_BASELOCAL_BACKGROUND_SYNC && window.MAQ_BASELOCAL_BACKGROUND_SYNC.removeCloseOverlay && window.MAQ_BASELOCAL_BACKGROUND_SYNC.removeCloseOverlay()',
              true
            );
          }catch(error){}
          focusMainWindow();
          return;
        }
        result=await requestProtectedClose(browserWindow);
      }

      if(browserWindow&&!browserWindow.isDestroyed()&&result&&result.canClose===true){
        state.allowClose=true;
        closeState.set(browserWindow,state);
        app.quit();
      }
    })().catch(async(error)=>{
      await showBlockedDialog(browserWindow,{message:error&&error.message?error.message:String(error)});
      focusMainWindow();
    }).finally(()=>{
      if(!state.allowClose){state.checking=false;closeState.set(browserWindow,state);}
    });
  });
}

BrowserWindow.prototype.loadFile=function(filePath,...args){
  const result=originalLoadFile.call(this,filePath,...args);
  if(isMainEntry(filePath)){
    mainWindow=this;
    installCloseGuard(this);
  }
  return result;
};

const hasSingleInstanceLock=app.requestSingleInstanceLock();

if(!hasSingleInstanceLock){
  app.quit();
}else{
  registerSyncBridge();
  app.on("second-instance",()=>focusMainWindow());
  require("./main");
}
