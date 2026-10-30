"use strict";
/* Node: contrato de PDF/ZIP de Actas mediante motores simulados, sin datos personales reales. */
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,".."),source=fs.readFileSync(path.join(root,"Actas/actas.pdf.js"),"utf8"),html=fs.readFileSync(path.join(root,"Actas/actas.html"),"utf8");
new vm.Script(source);
let lastDoc=null,lastZip=null,downloads=[];
class Pdf{
 constructor(){this.pages=1;this.index=1;this.images=0;this.texts=[];this.rects=[];this.segments=[];this.fontSizes=[];lastDoc=this;}
 setDrawColor(){return this;}setLineWidth(){return this;}rect(x,y,w,h){this.rects.push({x,y,w,h,page:this.index});return this;}setFont(){return this;}setFontSize(v){this.fontSizes.push(v);return this;}
 setFillColor(){return this;}line(x1,y1,x2,y2){this.segments.push({x1,y1,x2,y2,page:this.index});return this;}
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
vm.runInNewContext(fs.readFileSync(path.join(root,"Actas/actas.evidence.js"),"utf8"),context,{filename:"actas.evidence.js"});
vm.runInNewContext(source,context,{filename:"actas.pdf.js"});
const api=context.window.ActasPDF;
function sample(cedula,mode){
 const work=mode==="TRABAJO_TITULACION";
 const ev=work?{modalidadTitulacion:mode,estadoEvaluacion:"APROBADO",notaEscrito:8,notaDefensaTrabajo:9,notaOficial:8.4}:{modalidadTitulacion:mode,estadoEvaluacion:"APROBADO",notaTeorica:8,notaPractica:9,notaOficial:8.6};
 const student={Nombres:"ESTUDIANTE DE PRUEBA",cedula,NombreCarrera:"ADMINISTRACIÓN",_ncomplexHasSavedEvaluation:true,_ncomplexEvaluation:ev};
 const keys=["academico","documentacion","practicasvinculacion","vinculacion","seguimientograduados","ingles","actualizaciondatos","financiero","titulacion","aprobaciontitulacion","aprobacioncomplexivoproyecto"];
 const reqs=Object.fromEntries(keys.map(k=>[k,"CUMPLE"]));
 return {student,mode,record:{codigo:"UTET-ACTA-01",periodId:"2025-10__2026-03",numeroActa:"2026-0000-10-0001"},periodLabel:"Octubre 2025 a Marzo 2026",issue:"2026-05-29",schedule:[],evidence:context.window.ActasEvidence.assess({student,mode,requirementValues:reqs})};
}
async function main(){
 const exam=sample("0000000001","EXAMEN_COMPLEXIVO"),work=sample("0000000002","TRABAJO_TITULACION");
 const one=await api.build(exam);assert.equal(one.type,"application/pdf");assert.ok(lastDoc.pages>=2,"Acta individual ocupa al menos dos páginas");assert.ok(lastDoc.images>=2,"Logo insertado en ambas páginas");
 assert.ok(lastDoc.texts.some(x=>x.includes("N.º DE ACTA: 2026-0000-10-0001")),"Número único al inicio del cuerpo, no en portada");
 assert.ok(lastDoc.rects.some(r=>r.page===1&&r.x===15&&r.y===15&&r.w===180&&r.h===30),"Encabezado ACT 18 cm y 3 cm de altura");
 assert.ok(lastDoc.rects.some(r=>r.page===1&&r.x===15&&r.y===225&&r.w===180&&r.h===42),"Bloque de firmas 18 x 4,2 cm");
 for(const coords of [[67,15,67,45],[143,15,143,45],[143,26.5,195,26.5],[15,34,195,34],[75,225,75,267],[135,225,135,267],[15,249,195,249],[15,256.5,195,256.5]])assert.ok(lastDoc.segments.some(l=>["x1","y1","x2","y2"].every((k,i)=>l[k]===coords[i])&&l.page===1),"Estructura de celdas ACT: "+coords.join(","));
 assert.ok(lastDoc.fontSizes.filter(n=>n===23).length>=2,"Título central y período académico deben usar ambos 23 pt");
 assert.ok(lastDoc.texts.some(t=>t.includes("Versión: 1.0")),"Versión en celda C2");
 assert.ok(lastDoc.texts.some(t=>t.startsWith("Página 1 de ")),"Paginación automática de portada");
 assert.ok(lastDoc.texts.some(t=>t.includes("Fecha de emisión: 29/05/2026")),"Fecha del período en portada");
assert.ok(lastDoc.texts.some(t=>t.includes("Unidad de Titulación y")),"Unidad institucional en mayúsculas iniciales");
assert.ok(lastDoc.texts.some(t=>t.includes("Acta de Titulación por Examen Complexivo")),"Título en mayúsculas iniciales");
 assert.ok(!lastDoc.texts.some(t=>t.includes("Nombre: ___")||t.includes("Cargo: ___")),"Nombres y cargos no deben quedar vacíos");
 for(const phrase of ["Culminación de la malla curricular","Verificación de requisitos institucionales","Prácticas preprofesionales","Núcleos formativos y requisito de Titulación","Resultado del examen complexivo","8,60/10"])assert.ok(lastDoc.texts.join(" ").includes(phrase),"Cuerpo del PDF: "+phrase);
 for(const signer of ["MSc, Jefferson Villarreal","Ing. Martha Tomalá","Dr. Alex León T.","Coordinador de Titulación y Eficiencia Terminal","Coordinadora General de Carreras","Vicerrector"])assert.ok(lastDoc.texts.join(" ").includes(signer),"PDF contiene nombre y cargo de "+signer);
 const draftStudent={Nombres:"ESTUDIANTE SIN NOTAS",cedula:"0000000010",NombreCarrera:"ADMINISTRACIÓN"};
 const draftEvidence=context.window.ActasEvidence.assess({student:draftStudent,mode:"EXAMEN_COMPLEXIVO",requirementValues:{aprobaciontitulacion:"CUMPLE",aprobacioncomplexivoproyecto:"CUMPLE"}});
 assert.equal(draftEvidence.eligible,false,"La evidencia pendiente no se convierte en aprobación definitiva");
 const draft={...exam,student:draftStudent,evidence:draftEvidence,record:{...exam.record,numeroActa:""}};
 const draftPdf=await api.build(draft);
 assert.equal(draftPdf.type,"application/pdf","Los borradores con ambas aprobaciones se pueden descargar");
 assert.ok(lastDoc.texts.some(t=>t.includes("PENDIENTE DE VALIDACIÓN")),"El PDF advierte que faltan evidencias");
 assert.ok(lastDoc.texts.some(t=>t.includes("BORRADOR SIN NÚMERO OFICIAL")),"No inventa número oficial sin transacción central");
 assert.ok(lastDoc.texts.some(t=>t.includes("NO REGISTRADA")),"El PDF no inventa calificaciones");
 const both=await api.build([exam,work]);assert.equal(both.type,"application/pdf");assert.ok(lastDoc.pages>=4,"PDF de seleccionados incluye ambas actas");
 const summary=[{cedula:"0000000001",nombre:"PRUEBA 1",carrera:"ADM",modalidad:"COMPLEX",estado:"EN_PROCESO"},{cedula:"0000000002",nombre:"PRUEBA 2",carrera:"ADM",modalidad:"TRAB",estado:"EN_PROCESO"},{cedula:"0000000003",nombre:"PENDIENTE",carrera:"ADM",modalidad:"COMPLEX",estado:"EXCLUIDO",motivo:"Requisitos incompletos"},{cedula:"0000000010",nombre:"BORRADOR SIN NOTAS",carrera:"ADM",modalidad:"COMPLEX",estado:"EN_PROCESO"}];
 const zip=await api.downloadZip([exam,work,draft],summary,"2025-10__2026-03");assert.equal(zip.generated,3);assert.equal(zip.drafts,1,"Se contabiliza el borrador con información faltante");assert.equal(zip.excluded,1,"No se contabiliza el borrador como excluido");
 assert.ok([...lastZip.files.keys()].some(f=>f.startsWith("COMPLEX/")&&f.endsWith(".pdf")));
 assert.ok([...lastZip.files.keys()].some(f=>f.startsWith("TRAB/")&&f.endsWith(".pdf")));
 assert.ok(lastZip.files.has("Resumen_exportacion.csv"));assert.ok(lastZip.files.get("Resumen_exportacion.csv").includes("BORRADOR_SIN_NUMERO"),"Resumen CSV distingue borradores sin numeración");
 assert.ok(downloads.length>=1,"ZIP dispara una descarga");
 ["actas-busqueda","actas-zip","actas-config-logo","actas-logo-modal","actas-logo-file","actas-logo-guardar"].forEach(id=>assert.match(html,new RegExp('id="'+id+'"')));
 assert.match(html,/actas\.pdf\.js/);assert.match(html,/actas\.brand\.js/);assert.match(html,/actas\.numbering\.js/);
 console.log("VERIFICACIÓN PDF/ZIP ACTAS: OK (PDF individual y múltiple, logo, dos carpetas, resumen y controles)");
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
