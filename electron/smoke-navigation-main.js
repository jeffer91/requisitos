/* =========================================================
Nombre completo: smoke-navigation-main.js
Ruta: /electron/smoke-navigation-main.js
Función:
- Abrir la maqueta principal en Electron con datos temporales.
- Sembrar datos controlados en la sesión compartida e IndexedDB.
- Navegar por Carga, Centro de datos y todas las pantallas operativas.
- Detectar errores de dependencias, APIs ausentes y cargas bloqueadas.
- Verificar que el período global se reaplique al abrir cada pantalla.
- Confirmar que los conectores especializados leen estudiantes reales.
- Verificar el límite de tres iframes y generar un reporte JSON completo.
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
const HARD_TIMEOUT_MS=420000;
const SCREEN_TIMEOUT_MS=24000;
const TEST_PERIOD_ID="2026-05__2026-11";
const TEST_PERIOD_LABEL="Mayo 2026 a Noviembre 2026";
const EXPECTED_STUDENTS=2;

const MODULES=[
  {id:"baselocal",label:"Centro de datos",url:"/BDLocal/bl2.html",seedDatabase:true},
  {id:"carga_excel",label:"Carga",url:"/Carga/carga.html",periodSelector:"cargaPeriodoSelect"},
  {id:"tabla_principal",label:"Tabla",url:"/Gestion/Tabla/tabla.html"},
  {id:"ficha_estudiante",label:"Ficha",url:"/Ficha/ficha.html"},
  {id:"stat_main",label:"Estadísticas",url:"/Stats/stats.html"},
  {id:"coordi",label:"Coordi",url:"/Coordi/coordi.html"},
  {id:"global",label:"Global",url:"/Global/global.html"},
  {id:"modulo_reporte",label:"Reportes",url:"/Reportes/repo.html"},
  {id:"defart",label:"Defensas",url:"/defart/defart.html",connector:"ConDefart",expectedStudents:EXPECTED_STUDENTS,periodSelector:"def-filter-periodo"},
  {id:"ncomplex",label:"Ncomplex",url:"/Ncomplex/ncomplex.html",connector:"ConNcomplex",expectedStudents:EXPECTED_STUDENTS},
  {id:"cr_def",label:"Cr-def",url:"/Cr-def/cr-def.html",connector:"ConCrDef",expectedStudents:EXPECTED_STUDENTS},
  {id:"titulacion",label:"InPVC",url:"/InPVC/inpvc.html",connector:"ConInPVC",expectedStudents:EXPECTED_STUDENTS}
];

let mainWindow=null;
let watchdog=null;
let finished=false;
const consoleMessages=[];

function nowISO(){return new Date().toISOString();}
function sleep(ms){return new Promise((resolve)=>setTimeout(resolve,ms));}
function normalizeUrl(value){return String(value||"").replace(/\\/g,"/");}
function canonicalPeriodId(value){value=String(value||"").trim();const match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);return match?`${match[1]}-${match[2]}__${match[3]}-${match[4]}`:value.replace(/_+/g,"__");}
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

function buildFixture(){
  const updatedAt=nowISO();
  const period={id:TEST_PERIOD_ID,periodoId:TEST_PERIOD_ID,value:TEST_PERIOD_ID,label:TEST_PERIOD_LABEL,periodoLabel:TEST_PERIOD_LABEL,activo:true,updatedAt};
  const students=[
    {id:"0100000001__"+TEST_PERIOD_ID,idEstudiantePeriodo:"0100000001__"+TEST_PERIOD_ID,studentId:"0100000001__"+TEST_PERIOD_ID,cedula:"0100000001",numeroIdentificacion:"0100000001",periodoId:TEST_PERIOD_ID,periodId:TEST_PERIOD_ID,Nombres:"ESTUDIANTE PRUEBA UNO",nombres:"ESTUDIANTE PRUEBA UNO",nombreCompleto:"ESTUDIANTE PRUEBA UNO",NombreCarrera:"ADMINISTRACIÓN DE EMPRESAS",carrera:"ADMINISTRACIÓN DE EMPRESAS",division:"Prueba",Sede:"Matriz",estadoMatricula:"ACTIVO",Academico:"CUMPLE",Documentacion:"CUMPLE",Financiero:"CUMPLE",Titulacion:"CUMPLE",Vinculacion:"CUMPLE",Ingles:"CUMPLE",updatedAt},
    {id:"0100000002__"+TEST_PERIOD_ID,idEstudiantePeriodo:"0100000002__"+TEST_PERIOD_ID,studentId:"0100000002__"+TEST_PERIOD_ID,cedula:"0100000002",numeroIdentificacion:"0100000002",periodoId:TEST_PERIOD_ID,periodId:TEST_PERIOD_ID,Nombres:"ESTUDIANTE PRUEBA DOS",nombres:"ESTUDIANTE PRUEBA DOS",nombreCompleto:"ESTUDIANTE PRUEBA DOS",NombreCarrera:"REDES Y TELECOMUNICACIONES",carrera:"REDES Y TELECOMUNICACIONES",division:"Prueba",Sede:"Matriz",estadoMatricula:"ACTIVO",Academico:"CUMPLE",Documentacion:"CUMPLE",Financiero:"CUMPLE",Titulacion:"CUMPLE",Vinculacion:"CUMPLE",Ingles:"CUMPLE",updatedAt}
  ];
  const personas=students.map((row)=>({cedula:row.cedula,numeroIdentificacion:row.cedula,nombreCompleto:row.Nombres,nombres:row.Nombres,Nombres:row.Nombres,updatedAt}));
  const matriculas=students.map((row)=>({id:row.idEstudiantePeriodo,idEstudiantePeriodo:row.idEstudiantePeriodo,studentId:row.idEstudiantePeriodo,cedula:row.cedula,numeroIdentificacion:row.cedula,periodoId:TEST_PERIOD_ID,periodId:TEST_PERIOD_ID,carrera:row.NombreCarrera,NombreCarrera:row.NombreCarrera,division:row.division,Sede:row.Sede,estadoMatricula:"ACTIVO",updatedAt}));
  const requirements=students.map((row,index)=>({id:`req_${index+1}_${row.cedula}_${TEST_PERIOD_ID}`,idEstudiantePeriodo:row.idEstudiantePeriodo,studentId:row.idEstudiantePeriodo,cedula:row.cedula,numeroIdentificacion:row.cedula,periodoId:TEST_PERIOD_ID,periodId:TEST_PERIOD_ID,requisitoKey:"academico",requisitoLabel:"Académico",estado:"CUMPLE",estadoKey:"cumple",valor:"CUMPLE",updatedAt}));
  const notes=[
    {id:"0100000001__"+TEST_PERIOD_ID,idEstudiantePeriodo:"0100000001__"+TEST_PERIOD_ID,studentId:"0100000001__"+TEST_PERIOD_ID,cedula:"0100000001",numeroIdentificacion:"0100000001",periodoId:TEST_PERIOD_ID,periodId:TEST_PERIOD_ID,Notart:8.5,Notdef:8,Notafinal:8.35,updatedAt},
    {id:"0100000002__"+TEST_PERIOD_ID,idEstudiantePeriodo:"0100000002__"+TEST_PERIOD_ID,studentId:"0100000002__"+TEST_PERIOD_ID,cedula:"0100000002",numeroIdentificacion:"0100000002",periodoId:TEST_PERIOD_ID,periodId:TEST_PERIOD_ID,Notart:9,Notdef:8.5,Notafinal:8.85,updatedAt}
  ];
  const snapshot={
    meta:{source:"navigation-smoke",revision:1,updatedAt,periodoId:TEST_PERIOD_ID,periodoLabel:TEST_PERIOD_LABEL,totalPeriods:1,totalStudents:students.length,totalRequirements:requirements.length},
    periods:[period],students,requirements,summaries:{},diagnostics:[]
  };
  return {period,students,personas,matriculas,requirements,notes,snapshot};
}

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

async function seedTemporaryData(fixture){
  const script=`(() => {
    const snapshot=${JSON.stringify(fixture.snapshot)};
    const period=${JSON.stringify(fixture.period)};
    localStorage.setItem("REQ_BDLOCAL_CONEXIONES_CACHE_V1",JSON.stringify(snapshot));
    localStorage.setItem("REQ_PERIODO_GLOBAL_V1",JSON.stringify(period));
    if(window.MAQ_BASELOCAL_SESSION&&typeof window.MAQ_BASELOCAL_SESSION.setSnapshot==="function"){
      window.MAQ_BASELOCAL_SESSION.setSnapshot(snapshot,{source:"navigation-smoke",allowEmpty:false,alreadyStored:true,clone:false});
    }
    return true;
  })()`;
  return mainWindow.webContents.executeJavaScript(script,true);
}

async function seedIndexedDb(fixture){
  const frame=frameBySuffix("/BDLocal/bl2.html");
  if(!frame){return {ok:false,error:"No se encontró el iframe de Centro de datos para sembrar IndexedDB."};}
  const script=`(async () => {
    const fixture=${JSON.stringify(fixture)};
    const db=window.BL2DB;
    const config=window.BL2Config||{};
    const stores=config.stores||{};
    if(!db||typeof db.open!=="function"||typeof db.bulkPut!=="function"){
      return {ok:false,error:"BL2DB no expone open y bulkPut."};
    }
    await db.open();
    const entries=[
      [stores.periodos||"periodos",[fixture.period]],
      [stores.estudiantes||"estudiantes",fixture.students],
      [stores.personas||"personas",fixture.personas],
      [stores.matriculasPeriodo||"matriculas_periodo",fixture.matriculas],
      [stores.requisitos||"requisitos",fixture.requirements],
      [stores.requisitosEstudiante||"requisitos_estudiante",fixture.requirements],
      [stores.notas||"notas",fixture.notes],
      [stores.notasTitulacion||"notas_titulacion",fixture.notes]
    ];
    const saved=[];
    for(const entry of entries){
      await db.bulkPut(entry[0],entry[1]);
      const count=typeof db.count==="function"?await db.count(entry[0]):entry[1].length;
      saved.push({store:entry[0],expected:entry[1].length,count});
    }
    if(window.BL2Core&&typeof window.BL2Core.setActivePeriod==="function"){
      await window.BL2Core.setActivePeriod(fixture.period.id,fixture.period.label).catch(()=>null);
    }
    const invalid=saved.filter((item)=>item.count<item.expected);
    return {ok:invalid.length===0,saved,invalid};
  })()`;
  return frame.executeJavaScript(script,true).catch((error)=>({ok:false,error:error.stack||error.message||String(error)}));
}

function inspectScript(connectorName,moduleId,expectedStudents){
  return `(async () => {
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
    const moduleId=${JSON.stringify(moduleId||"")};
    const expectedStudents=${Number(expectedStudents||0)};
    const connector=connectorName?window[connectorName]:null;
    let connectorStatus=null;
    try{connectorStatus=connector&&typeof connector.status==="function"?connector.status():null;}catch(error){connectorStatus={ok:false,error:error.message};}
    let connectorData={checked:false,ok:expectedStudents===0,count:null,error:""};
    if(expectedStudents>0&&connector&&connectorStatus&&connectorStatus.ready===true&&connectorStatus.loading!==true){
      connectorData.checked=true;
      try{
        let value=null;
        const options={periodoId:${JSON.stringify(TEST_PERIOD_ID)},periodId:${JSON.stringify(TEST_PERIOD_ID)},matricula:""};
        if(typeof connector.listStudents==="function"){value=await connector.listStudents(options);}
        else if(typeof connector.getStudents==="function"){value=await connector.getStudents(options);}
        else if(typeof connector.read==="function"){value=await connector.read(options);}
        let rows=[];
        if(Array.isArray(value)){rows=value;}
        else if(value&&Array.isArray(value.rows)){rows=value.rows;}
        else if(value&&value.data&&Array.isArray(value.data.students)){rows=value.data.students;}
        connectorData.count=rows.length;
        connectorData.ok=rows.length>=expectedStudents;
        if(!connectorData.ok){connectorData.error="El conector devolvió "+rows.length+" estudiantes; se esperaban "+expectedStudents+".";}
      }catch(error){connectorData.ok=false;connectorData.error=error&&error.message||String(error);}
    }
    const periodApi=window.BDLPeriodoGlobal||window.RequisitosPeriodoGlobal;
    let periodStatus=null;
    try{periodStatus=periodApi&&typeof periodApi.status==="function"?periodApi.status():null;}catch(error){periodStatus={ok:false,error:error.message};}
    const selects=Array.from(document.querySelectorAll("select")).map((select)=>({id:select.id||select.name||"",value:select.value||"",options:select.options?select.options.length:0}));
    return {
      moduleId,
      readyState:document.readyState,
      title:document.title,
      textLength:text.length,
      errors,
      connectorPresent:connectorName?!!connector:true,
      connectorStatus,
      connectorData,
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
  const ready=!!result.connectorPresent&&status.loading!==true&&status.ready===true&&status.ok!==false&&!String(status.error||"").trim();
  if(!ready){return false;}
  if(Number(module.expectedStudents||0)>0){
    const data=result&&result.connectorData||{};
    return data.checked===true&&data.ok===true&&Number(data.count||0)>=Number(module.expectedStudents);
  }
  return true;
}
function periodReady(result,module){
  if(!result||!result.periodPresent){return false;}
  const status=result.periodStatus||{};
  if(status.ok===false||String(status.error||"").trim()){return false;}
  if(module.id==="global"){return status.globalIndependent===true&&status.enabled===false;}
  const period=status.period||{};
  const id=canonicalPeriodId(period.id||period.periodoId||period.value||"");
  return status.enabled!==false&&id===TEST_PERIOD_ID;
}
function selectedPeriodReady(result,module){
  if(!module.periodSelector){return true;}
  const select=(result&&result.selects||[]).find((item)=>item.id===module.periodSelector);
  return !!select&&select.options>1&&canonicalPeriodId(select.value)===TEST_PERIOD_ID;
}
function resultReady(result,module){
  if(!result||result.readyState!=="complete"||result.textLength<20){return false;}
  if(result.errors&&result.errors.length){return false;}
  if(!periodReady(result,module)){return false;}
  if(!selectedPeriodReady(result,module)){return false;}
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
      try{last=await frame.executeJavaScript(inspectScript(module.connector,module.id,module.expectedStudents),true);}catch(error){last={errors:[error.message],readyState:"error",textLength:0};}
      if(resultReady(last,module)){
        const pool=await mainWindow.webContents.executeJavaScript("window.MAQ_CORE.performance.poolStatus()",true).catch(()=>[]);
        return {id:module.id,label:module.label,ok:true,durationMs:Date.now()-started,poolSize:Array.isArray(pool)?pool.length:null,inspection:last};
      }
    }
    await sleep(120);
  }
  const pool=await mainWindow.webContents.executeJavaScript("window.MAQ_CORE.performance.poolStatus()",true).catch(()=>[]);
  let error="La pantalla no alcanzó un estado funcional dentro del límite.";
  if(last&&last.connectorData&&last.connectorData.error){error=last.connectorData.error;}
  else if(last&&last.periodStatus&&last.periodStatus.error){error=last.periodStatus.error;}
  return {id:module.id,label:module.label,ok:false,durationMs:Date.now()-started,poolSize:Array.isArray(pool)?pool.length:null,error,inspection:last};
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
  const fixture=buildFixture();
  await seedTemporaryData(fixture);

  const screens=[];
  let databaseSeed=null;
  for(const module of MODULES){
    const screen=await inspectModule(module);
    if(module.seedDatabase&&screen.ok){
      databaseSeed=await seedIndexedDb(fixture);
      screen.databaseSeed=databaseSeed;
      if(!databaseSeed||databaseSeed.ok!==true){screen.ok=false;screen.error=databaseSeed&&databaseSeed.error||"No se pudieron sembrar los datos de prueba en IndexedDB.";}
    }
    screens.push(screen);
  }
  const badConsole=consoleMessages.filter((row)=>row.level>=2&&/(no expuso la api esperada|no se pudo cargar|uncaught|referenceerror|typeerror)/i.test(row.message));
  const failed=screens.filter((screen)=>!screen.ok||Number(screen.poolSize||0)>3);
  const output={
    ok:failed.length===0&&badConsole.length===0&&databaseSeed&&databaseSeed.ok===true,
    smoke:true,
    isolated:true,
    network:false,
    generatedAt:nowISO(),
    fixture:{periodoId:TEST_PERIOD_ID,students:fixture.students.length,requirements:fixture.requirements.length,notes:fixture.notes.length},
    databaseSeed,
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