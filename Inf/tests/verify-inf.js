/* Ejecute: node Inf/tests/verify-inf.js */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const store = {};
const context = vm.createContext({window: {localStorage: {getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=String(v)}}}});
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
const w = context.window;
const report = w.InfReport.build();
assert.equal(report.coverage.chapters, 8, "Deben existir ocho capítulos.");
assert.equal(report.coverage.blocks, 76, "Se preservan los subapartados numerados del capítulo 3.");
assert.equal(report.coverage.completed, 53, "Introducción, Base Legal y Metodología cargadas.");
assert.equal(report.coverage.pending, 23);
assert.equal(report.canExport, false, "No se permite un informe final oficial incompleto.");
assert.equal(report.canExportDraft, true, "Debe poder generarse un PDF de avance.");
const current = w.InfReport.buildAvailable();
assert.equal(current.canExportDraft, true);
assert.equal(current.partial, true);
assert.deepEqual(Array.from(current.includedChapters), ["1","2","3"]);
assert.deepEqual(Array.from(current.excludedChapters.map(c=>c.number)), ["4","5","6","7","8"]);
assert.equal(current.chapters.length, 3);
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
console.log("Inf: 8 capítulos, 53 apartados con texto, 16 diagramas/64 núcleos, cronogramas editables.");
