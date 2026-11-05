/* Ejecute: node Inf/tests/verify-inf.js */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const store = {};
const context = vm.createContext({window: {localStorage: {getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=String(v)}}}, document: {}});
function load(relative) {
  const code = fs.readFileSync(path.join(root, relative), "utf8");
  vm.runInContext(code, context, {filename: relative});
}
load("core/inf.catalog.js");
load("core/inf.registry.js");
[
  "01-introduccion", "02-base-legal", "03-metodologia", "04-resultados",
  "05-resumen-ejecutivo", "06-conclusiones", "07-recomendaciones", "08-referencias"
].forEach(function (folder) { load("sections/" + folder + "/section.js"); });
load("core/inf.report.js");
load("core/inf.nuclei.js");
load("core/inf.schedules.js");
load("core/inf.results.js");
load("export/inf.pdf.js");
const w = context.window;
const report = w.InfReport.build();
assert.equal(report.coverage.chapters, 8, "Deben existir ocho capítulos.");
assert.equal(report.coverage.blocks, 76, "Se preservan los subapartados numerados del capítulo 3.");
assert.equal(report.coverage.completed, 56, "Introducción, Base Legal, Metodología y apartado 4.2 cargados.");
assert.equal(report.coverage.pending, 20);
assert.equal(report.canExport, false, "No se permite un informe final oficial incompleto.");
assert.equal(report.canExportDraft, true, "Debe poder generarse un PDF de avance.");
const current = w.InfReport.buildAvailable();
assert.equal(current.canExportDraft, true);
assert.equal(current.partial, true);
assert.deepEqual(Array.from(current.includedChapters), ["1","2","3","4"]);
assert.deepEqual(Array.from(current.excludedChapters.map(c=>c.number)), ["5","6","7","8"]);
assert.equal(current.chapters.length, 4);
assert.ok(current.chapters.every(c=>c.content.trim() || c.sections.length));
function requireText(node) {
  assert.ok(node.content.trim() || node.sections.length);
  node.sections.forEach(requireText);
}
current.chapters.forEach(requireText);
assert.equal(report.dataConnected, false);
assert.equal(report.documentCode, null);
assert.deepEqual(Array.from(w.InfRegistry.registeredChapters()), ["1", "2", "3", "4", "5", "6", "7", "8"]);
assert.equal(w.InfCatalog.find("4.3.4").title, "Análisis de aprobados y estudiantes que requieren supletorio");
assert.equal(w.InfCatalog.find("8").title, "Referencias");
assert.equal(w.InfCatalog.find("2.9").title, "Aplicación normativa, seguimiento y trazabilidad institucional");
assert.ok(w.InfRegistry.textFor("1").includes("El proceso de titulación representa una etapa fundamental"));
assert.ok(w.InfRegistry.textFor("1.2").includes("### Objetivo general"));
assert.ok(w.InfRegistry.textFor("2.7").includes("Ley Orgánica de Protección de Datos Personales"));
assert.ok(w.InfRegistry.textFor("2.9").includes("### Consideraciones finales de la Base Legal"));
assert.equal(w.InfCatalog.find("3.5").title, "Metodología de evaluación del examen complexivo");
assert.equal(w.InfCatalog.find("3.7").title,"Cronogramas del proceso de titulación");
assert.equal(w.InfCatalog.find("3.4.4.16").title,"Procesamiento en Alimentos");
assert.equal(w.InfNuclei.careers().length,16);
assert.equal(w.InfNuclei.careers().reduce((n,c)=>n+c.nuclei.length,0),64);
assert.equal(w.InfNuclei.careers()[0].nuclei[0].name,"Gestión Estratégica");
const sample=w.InfSchedules.load("Octubre 2025 a Marzo 2026");
assert.equal(sample.complexivo.length,6);
assert.equal(sample.trabajo.length,20);
assert.equal(sample.trabajo[0].activity,"Inducción");
assert.equal(sample.complexivo[5].end,"4/5/2026");
assert.deepEqual(Array.from(w.InfSchedules.validate(sample)),[]);
assert.equal(w.InfSchedules.save(sample).saved,true);
assert.equal(w.InfSchedules.load("Abril 2026 a Septiembre 2026").complexivo.length,0);
assert.equal(w.InfSchedules.load("Abril 2026 a Septiembre 2026").trabajo.length,0);
assert.equal(w.InfSchedules.day("31/2/2026"),null);
assert.ok(w.InfSchedules.issue({activity:"x",start:"10/4/2026",end:"9/4/2026"}));
const noNuclei=w.InfResults.build({
  periodoId:"2025-10__2026-03",students:[{cedula:"0100000001",NombreCarrera:"Administración",Nombres:"Estudiante de prueba"}],
  notes:[{cedula:"0100000001",periodoId:"2025-10__2026-03",notaTeorica:8,notaPractica:9}]
},w.InfNuclei.careers());
assert.equal(noNuclei.missingGradeSource,true,"Las notas de Ncomplex no equivalen a núcleos.");
const valid=w.InfResults.build({
  periodoId:"2025-10__2026-03",
  students:[{cedula:"0100000001",NombreCarrera:"Administración",Nombres:"Estudiante de prueba"}],
  nuclei:[{cedula:"0100000001",periodoId:"2025-10__2026-03",
    nucleos:[{nucleo:1,evaluacion1:0,evaluacion2:7,evaluacion3:8,evaluacion4:9,casoEstudio:8,notaFinal:8}]}]
},w.InfNuclei.careers());
const first=valid.careers.find(c=>c.career==="Administración").nuclei[0];
assert.equal(first.rows.length,1);
assert.equal(first.rows[0].evaluations[0],0,"Conservar evaluación válida de cero.");
assert.equal(first.average,8);
// Prueba estructural del PDF sin instalar paquetes ni emitir documentos oficiales.
const linesRendered=[];
const mockPDF={
 pages:1, selected:1, badPositions:[],
 setFont(){},setFontSize(){},setTextColor(){},setDrawColor(){},setLineWidth(){},
 setFillColor(){},setLineDashPattern(){},line(){},rect(){},roundedRect(){},circle(){},addImage(){},
 splitTextToSize(value,width){
   const words=String(value||"").split(/\\s+/),max=Math.max(8,Math.floor(width/2.4));
   let output=[],line="";
   words.forEach(function(word){
     if((line+" "+word).trim().length>max&&line){output.push(line);line=word;}
     else line=(line+" "+word).trim();
   });
   if(line)output.push(line);
   return output;
 },
 text(value,x,y){
   if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>210||y<0||y>297){
     this.badPositions.push({value:String(value),x:x,y:y,page:this.selected});
   }
   linesRendered.push({value:String(value),page:this.selected});
 },
 addPage(){this.pages++;this.selected=this.pages;},
 setPage(page){this.selected=page;},
 internal:{getNumberOfPages(){return mockPDF.pages;}}
};
const sampleReport=w.InfReport.buildAvailable();
const audit=w.InfPDF.build(mockPDF,{
 report:sampleReport,schedule:sample,careers:w.InfNuclei.careers(),results:valid
},null);
assert.equal(audit.pages,mockPDF.pages);
assert.ok(audit.figures>=23,"Debe haber figuras por carrera y metodología.");
assert.equal(mockPDF.badPositions.length,0,"No dibujar fuera de la página.");
assert.equal(linesRendered.filter(x=>x.value==="Unidad de Titulación y").length,
 mockPDF.pages,"Encabezado institucional completo en cada página.");
assert.ok(linesRendered.some(x=>x.value.includes("PROCESO DE TITULACIÓN")));
assert.ok(linesRendered.some(x=>x.value.includes("4.2.3. Consolidado general")));
assert.ok(!linesRendered.some(x=>x.value.includes("BORRADOR DE AVANCE")));
console.log("Inf: índice, datos 4.2, 16 diagramas y PDF completo de prueba verificados.");
