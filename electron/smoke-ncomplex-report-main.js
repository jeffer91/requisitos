"use strict";
/* Prueba de extremo a extremo: Chromium/Electron genera un PDF real con el logo.
 * Datos ficticios. La base de datos institucional no se abre ni se modifica.
 */
const {app,BrowserWindow}=require("electron");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const ROOT=path.resolve(__dirname,".."),dir=path.join(ROOT,"Ncomplex");
const htmlPath=path.join(dir,".ncomplex-report-smoke-"+process.pid+".html");
const work=fs.mkdtempSync(path.join(os.tmpdir(),"ncomplex-report-smoke-"));
const target=path.join(work,"Informe_Complexivos_Prueba.pdf");
let win=null,done=false,deadline=null;
function fail(error){
 if(done)return;done=true;
 console.error("NCOMPLEX PDF SMOKE: ERROR",error&&error.stack||error);
 cleanup();app.exit(1);
}
function cleanup(){
 if(deadline)clearTimeout(deadline);
 try{if(win&&!win.isDestroyed())win.destroy();}catch(_){}
 try{fs.rmSync(htmlPath,{force:true});}catch(_){}
 try{fs.rmSync(work,{recursive:true,force:true});}catch(_){}
}
async function run(){
 app.setPath("userData",path.join(work,"profile"));
 const body=[
 "<!doctype html><html lang='es'><head><meta charset='utf-8'>",
 "<link rel='stylesheet' href='ncomplex.report.css'>",
 "<link rel='stylesheet' href='ncomplex.report.document.css'>",
 "</head><body>",
 "<div id='ncomplex-report-status'></div>",
 "<script src='../node_modules/html2pdf.js/dist/html2pdf.bundle.min.js'></script>",
 "<script src='ncomplex.report.model.js'></script>",
 "<script src='ncomplex.report.document.js'></script>",
 "<script src='ncomplex.report.pdf.js'></script>",
 "</body></html>"
 ].join("");
 fs.writeFileSync(htmlPath,body,"utf8");
 deadline=setTimeout(()=>fail(Error("Tiempo agotado en prueba PDF")),180000);
 win=new BrowserWindow({show:false,width:1100,height:1200,backgroundColor:"#ffffff",
  webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
 win.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
 win.webContents.session.on("will-download",(_event,item)=>{
   item.setSavePath(target);
 });
 win.webContents.setWindowOpenHandler(()=>({action:"deny"}));
 win.webContents.on("render-process-gone",(_event,details)=>fail(Error("Renderer terminó: "+JSON.stringify(details))));
 await win.loadFile(htmlPath);
 const result=await win.webContents.executeJavaScript(`(async()=>{
  if(typeof window.html2pdf!=="function")throw Error("html2pdf.js local no cargó");
  if(!window.NcomplexReportModel||!window.NcomplexReportDocument||!window.NcomplexReportPDF)
   throw Error("Módulos del informe no cargaron");
  const req={eligible:true,complete:9,total:9,
   requirements:["Académico","Documentación","Financiero","Prácticas","Vinculación","Seguimiento","Inglés","Actualización","Titulación"]
    .map(label=>({label,status:"CUMPLE"}))};
  const period="2026-04__2026-09";
  const rows=[{periodoId:period,cedula:"0100000001",Nombres:"ALUMNA DEMOSTRATIVA",
   NombreCarrera:"EDUCACIÓN INICIAL",estadoMatricula:"ACTIVO",
   modalidadTitulacion:"EXAMEN_COMPLEXIVO",_ncomplexRequirements:req,
   _ncomplexHasSavedEvaluation:true,notaTeorica:9.7,notaPractica:9,
   notaOficial:9.28,oportunidadAplicada:"ORDINARIA"}];
  const report=window.NcomplexReportModel.build(rows,period);
  const pages=window.NcomplexReportPDF.contentPages(report,"Abril 2026 - Septiembre 2026","Prueba automática");
  if(pages[0].kind!=="cover"||pages[1].title!=="Resumen ejecutivo")
    throw Error("El PDF no contiene la portada y el resumen ejecutivo en el orden solicitado");
  if(!pages.some(p=>p.title.indexOf(" · consolidado")>0))
    throw Error("Falta el consolidado de resultados por carrera");
  return await window.NcomplexReportPDF.renderPDF(report,{period:"Abril 2026 - Septiembre 2026",date:"Prueba automática"});
 })()`,true);
 let size=0;
 for(let i=0;i<150;i++){
  await new Promise(resolve=>setTimeout(resolve,200));
  try{size=fs.statSync(target).size;}catch(_){}
  if(size>12000)break;
 }
 if(size<12000)throw Error("El PDF no se descargó o es demasiado pequeño: "+size+" bytes");
 const data=fs.readFileSync(target);
 if(data.subarray(0,5).toString("ascii")!=="%PDF-")throw Error("La exportación no tiene cabecera PDF");
 if(!data.subarray(Math.max(0,data.length-2048)).toString("latin1").includes("%%EOF"))
  throw Error("La exportación PDF está incompleta (sin %%EOF)");
 if(result.pages<8)throw Error("Faltan secciones o páginas: "+result.pages);
 console.log("VERIFICACIÓN NCOMPLEX PDF REAL: OK; páginas="+result.pages+"; bytes="+size);
 done=true;cleanup();app.exit(0);
}
app.whenReady().then(run).catch(fail);
process.on("uncaughtException",fail);
process.on("unhandledRejection",fail);
app.on("window-all-closed",()=>{if(!done)fail(Error("Ventana cerrada antes de generar PDF"));});
