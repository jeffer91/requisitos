"use strict";
/* Node: contrato de PDF/ZIP de Actas mediante motores simulados, sin datos personales reales. */
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,".."),source=fs.readFileSync(path.join(root,"Actas/actas.pdf.js"),"utf8"),html=fs.readFileSync(path.join(root,"Actas/actas.html"),"utf8");
new vm.Script(source);
let lastDoc=null,lastZip=null,downloads=[];
class Pdf{
 constructor(){this.pages=1;this.index=1;this.images=0;this.texts=[];lastDoc=this;}
 setDrawColor(){return this;}setLineWidth(){return this;}rect(){return this;}setFont(){return this;}setFontSize(){return this;}
 setFillColor(){return this;}line(){return this;}
 text(value){assert.ok(value!==undefined);this.texts.push(Array.isArray(value)?value.join(" "):String(value));return this;}
 splitTextToSize(value){const content=String(value);return content.match(/.{1,95}/g)||[""];}
 addImage(value){assert.match(value,/^data:image\//);this.images++;return this;}
 addPage(){this.pages++;this.index=this.pages;return this;}
 getNumberOfPages(){return this.pages;}
 setPage(index){assert.ok(index>=1&&index<=this.pages);this.index=index;return this;}
 output(){return new Blob(["%PDF-1.4\n%%EOF"],{type:"application/pdf"});}
}
class Zip{
 constructor(){this.files=new Map();lastZip=this;}
 file(name,blob){this.files.set(name,blob);return this;}
 async generateAsync(){return new Blob(["PK\x03\x04mock-zip"],{type:"application/zip"});}
}
const image="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==";
const context={Blob,Promise,Date,Map,Set,console,URL:{createObjectURL:()=>"blob:local",revokeObjectURL(){}},setTimeout(){}};
context.window={jspdf:{jsPDF:Pdf},JSZip:Zip,ActasBrand:{resolve:async()=>({dataUrl:image,width:100,height:38,format:"PNG"})}};
context.document={baseURI:"https://example.test/Actas/actas.html",head:{appendChild(){}},body:{appendChild(){}},createElement:()=>({click(){downloads.push(true)},remove(){}})};
vm.runInNewContext(source,context,{filename:"actas.pdf.js"});
const api=context.window.ActasPDF;
function sample(cedula,mode){return {student:{Nombres:"ESTUDIANTE DE PRUEBA",cedula,NombreCarrera:"ADMINISTRACIÓN"},mode,record:{codigo:"UTET-ACTA-01",periodId:"2025-10__2026-03"},periodLabel:"Octubre 2025 a Marzo 2026",issue:"2026-10-30",schedule:[{actividades:[{id:"examen",nombre:"Examen Complexivo",inicio:"2026-04-16",fin:"2026-04-18"}]}]};}
async function main(){
 const exam=sample("0000000001","EXAMEN_COMPLEXIVO"),work=sample("0000000002","TRABAJO_TITULACION");
 const one=await api.build(exam);assert.equal(one.type,"application/pdf");assert.ok(lastDoc.pages>=2,"Acta individual ocupa al menos dos páginas");assert.ok(lastDoc.images>=2,"Logo insertado en ambas páginas");
 for(const signer of ["MSc, Jefferson Villarreal","Ing. Martha Tomalá","Dr. Alex León T.","Coordinador de Titulación y Eficiencia Terminal","Coordinadora General de Carreras","Vicerrector"])assert.ok(lastDoc.texts.join(" ").includes(signer),"PDF contiene nombre y cargo de "+signer);
 const both=await api.build([exam,work]);assert.equal(both.type,"application/pdf");assert.ok(lastDoc.pages>=4,"PDF de seleccionados incluye ambas actas");
 const summary=[{cedula:"0000000001",nombre:"PRUEBA 1",carrera:"ADM",modalidad:"COMPLEX",estado:"EN_PROCESO"},{cedula:"0000000002",nombre:"PRUEBA 2",carrera:"ADM",modalidad:"TRAB",estado:"EN_PROCESO"},{cedula:"0000000003",nombre:"PENDIENTE",carrera:"ADM",modalidad:"COMPLEX",estado:"EXCLUIDO",motivo:"Requisitos incompletos"}];
 const zip=await api.downloadZip([exam,work],summary,"2025-10__2026-03");assert.equal(zip.generated,2);
 assert.ok([...lastZip.files.keys()].some(f=>f.startsWith("COMPLEX/")&&f.endsWith(".pdf")));
 assert.ok([...lastZip.files.keys()].some(f=>f.startsWith("TRAB/")&&f.endsWith(".pdf")));
 assert.ok(lastZip.files.has("Resumen_exportacion.csv"));assert.equal(zip.excluded,1);
 assert.ok(downloads.length>=1,"ZIP dispara una descarga");
 ["actas-busqueda","actas-zip","actas-config-logo","actas-logo-modal","actas-logo-file","actas-logo-guardar"].forEach(id=>assert.match(html,new RegExp('id="'+id+'"')));
 assert.match(html,/actas\.pdf\.js/);assert.match(html,/actas\.brand\.js/);
 console.log("VERIFICACIÓN PDF/ZIP ACTAS: OK (PDF individual y múltiple, logo, dos carpetas, resumen y controles)");
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
