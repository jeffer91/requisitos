"use strict";
/* Prueba real en Chromium de un borrador PDF de Actas sin notas ni folio.
 * Datos sintéticos, sin acceder a estudiantes, BDLocal o Firebase.
 */
const {app,BrowserWindow}=require("electron");
const fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const root=path.resolve(__dirname,".."),dir=path.join(root,"Actas");
const htmlPath=path.join(dir,".actas-pdf-smoke-"+process.pid+".html");
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),"actas-pdf-smoke-"));
const target=path.join(scratch,"Acta_Borrador_Complexivo.pdf");
let win=null,complete=false,timeout=null;
function cleanup(){
 if(timeout)clearTimeout(timeout);
 try{if(win&&!win.isDestroyed())win.destroy();}catch(_){}
 try{fs.rmSync(htmlPath,{force:true});}catch(_){}
 try{fs.rmSync(scratch,{recursive:true,force:true});}catch(_){}
}
function fail(error){
 if(complete)return;complete=true;
 console.error("VERIFICACIÓN PDF ACTAS REAL: ERROR",error&&error.stack||error);
 cleanup();app.exit(1);
}
async function run(){
 app.setPath("userData",path.join(scratch,"profile"));
 fs.writeFileSync(htmlPath,[
  "<!doctype html><html lang='es'><head><meta charset='utf-8'></head><body>",
  "<script src='../node_modules/jspdf/dist/jspdf.umd.min.js'></script>",
  "<script src='actas.catalog.js'></script>",
  "<script src='actas.issue-date.js'></script>",
  "<script src='actas.evidence.js'></script>",
  "<script src='actas.brand.js'></script>",
  "<script src='actas.pdf.js'></script>",
  "</body></html>"
 ].join(""),"utf8");
 timeout=setTimeout(()=>fail(Error("Tiempo agotado en exportación de actas")),120000);
 win=new BrowserWindow({show:false,width:1050,height:900,
  webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
 win.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
 win.webContents.session.on("will-download",(_event,item)=>item.setSavePath(target));
 win.webContents.on("render-process-gone",(_event,details)=>fail(Error("Renderer terminó: "+JSON.stringify(details))));
 await win.loadFile(htmlPath);
 const result=await win.webContents.executeJavaScript(`(async()=>{
  if(!window.jspdf||!window.jspdf.jsPDF)throw Error("jsPDF real no se cargó");
  if(!window.ActasIssueDate||!window.ActasEvidence||!window.ActasBrand||!window.ActasPDF)
   throw Error("Falta un módulo requerido para exportar Actas");
  const period="2025-10__2026-03";
  const student={
   cedula:"0100000001",Nombres:"ESTUDIANTE DE PRUEBA COMPLEXIVO",
   NombreCarrera:"ADMINISTRACION",periodoId:period,estadoMatricula:"ACTIVO"
  };
  const mode="EXAMEN_COMPLEXIVO";
  const evidence=window.ActasEvidence.assess({student,mode,requirementValues:{
   academico:"PENDIENTE",aprobaciontitulacion:"CUMPLE",
   aprobacioncomplexivoproyecto:"CUMPLE"
  }});
  if(evidence.eligible||!evidence.draftEligible)
    throw Error("Borrador sin requisitos debe estar permitido, pero no certificado");
  const record={
   codigo:"AT-ITSQMET-2026-11-01",periodId:period,numeroActa:"",status:"BORRADOR"
  };
  const document={
   student,mode,record,evidence,
   periodLabel:"Octubre 2025 a Marzo 2026",
   issue:window.ActasIssueDate.forPeriod(period).date,schedule:[]
  };
  const result=await window.ActasPDF.download(document);
  if(!result.ok||result.count!==1||result.bytes<4000)
   throw Error("ActasPDF no terminó correctamente: "+JSON.stringify(result));
  return result;
 })()`,true);
 let size=0;
 for(let i=0;i<100;i++){
  await new Promise(resolve=>setTimeout(resolve,200));
  try{size=fs.statSync(target).size;}catch(_){}
  if(size>4000)break;
 }
 if(size<4000)throw Error("No se descargó el PDF real: "+size+" bytes");
 const data=fs.readFileSync(target);
 if(data.subarray(0,5).toString("ascii")!=="%PDF-")
  throw Error("La descarga no tiene cabecera PDF");
 if(!data.subarray(Math.max(0,data.length-2048)).toString("latin1").includes("%%EOF"))
  throw Error("El PDF se encuentra incompleto (sin %%EOF)");
 const body=data.toString("latin1");
 const pages=(body.match(/\/Type\s*\/Page(?=\s|\/)/g)||[]).length;
 if(pages<2)throw Error("La portada y el cuerpo documental requieren 2 páginas: "+pages);
 if(!body.includes("/Subtype /Image"))throw Error("No se incrustó el logotipo institucional");
 console.log("VERIFICACIÓN PDF ACTAS REAL: OK (borrador sin notas, "+pages+" páginas, "+size+" bytes)");
 complete=true;cleanup();app.exit(0);
}
app.whenReady().then(run).catch(fail);
process.on("uncaughtException",fail);
process.on("unhandledRejection",fail);
app.on("window-all-closed",()=>{if(!complete)fail(Error("Ventana cerrada durante la prueba PDF"));});
