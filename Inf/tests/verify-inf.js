/* Ejecute: node Inf/tests/verify-inf.js */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const context = vm.createContext({window: {}});
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
const w = context.window;
const report = w.InfReport.build();
assert.equal(report.coverage.chapters, 8, "Deben existir ocho capítulos.");
assert.equal(report.coverage.blocks, 41, "36 apartados iniciales más 5 de Base Legal.");
assert.equal(report.coverage.completed, 12, "Tres apartados en introducción y nueve en Base Legal.");
assert.equal(report.coverage.pending, 29);
assert.equal(report.canExport, false, "El borrador incompleto no debe emitirse.");
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
console.log("Inf: índice íntegro, ocho capítulos, 36 apartados pendientes, sin datos inventados.");
