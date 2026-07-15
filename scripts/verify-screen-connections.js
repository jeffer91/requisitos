"use strict";

/* =========================================================
Archivo: verify-screen-connections.js
Ruta: /scripts/verify-screen-connections.js
Función:
- Verificar que Carga y Ficha usen conectores exclusivos.
- Rechazar controladores activos con accesos directos a BDLocal.
- Validar orden de scripts y sintaxis JavaScript.
========================================================= */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const errors = [];
const checks = [];

function file(relative) {
  return path.join(ROOT, relative);
}

function read(relative) {
  const target = file(relative);
  if (!fs.existsSync(target)) {
    errors.push(`Falta el archivo: ${relative}`);
    return "";
  }
  return fs.readFileSync(target, "utf8");
}

function ok(condition, message) {
  checks.push({ ok: Boolean(condition), message });
  if (!condition) errors.push(message);
}

function contains(relative, token, message) {
  const source = read(relative);
  ok(source.includes(token), message || `${relative} debe contener ${token}`);
}

function excludes(relative, tokens) {
  const source = read(relative);
  for (const token of tokens) {
    ok(!source.includes(token), `${relative} no debe contener ${token}`);
  }
}

function order(relative, before, after) {
  const source = read(relative);
  const first = source.indexOf(before);
  const second = source.indexOf(after);
  ok(first >= 0 && second >= 0 && first < second, `${relative}: ${before} debe cargarse antes de ${after}`);
}

function syntax(relative) {
  const source = read(relative);
  if (!source) return;
  try {
    new vm.Script(source, { filename: relative });
    checks.push({ ok: true, message: `${relative}: sintaxis válida` });
  } catch (error) {
    errors.push(`${relative}: ${error.message}`);
  }
}

const forbiddenScreenAccess = [
  "window.BL2Core",
  "window.BL2DB",
  "window.BDLRepo",
  "window.BL2EstudiantesRepo",
  "window.BL2DataEngine",
  "window.ExcelLocalRepo",
  "window.BLDivisionesService",
  "indexedDB.open("
];

// Carga
contains("Carga/carga.html", "carga.norm-compat.js", "Carga debe preparar sus normalizadores");
contains("Carga/carga.html", "carga.app.connector.js", "Carga debe activar carga.app.connector.js");
contains("Carga/carga.html", "carga.ui.connector.js", "Carga debe activar carga.ui.connector.js");
order("Carga/carga.html", "carga.norm-compat.js", "mapping/carga.field-map.js");
contains("Carga/carga.index.js", "cone.carga.js", "Carga debe preparar cone.carga.js");
contains("Carga/carga.index.js", "cone.carga.ops.js", "Carga debe preparar las operaciones de ConCarga");
contains("BDLocal/conexiones/cone.carga.ops.js", "api.listStudents=students", "ConCarga debe exponer listStudents");
contains("BDLocal/conexiones/cone.carga.ops.js", "api.saveDivisions=saveDivisions", "ConCarga debe exponer saveDivisions");

const cargaHtml = read("Carga/carga.html");
ok(!/src=["']\.\/carga\.app\.js["']/.test(cargaHtml), "Carga no debe activar carga.app.js heredado");
ok(!/src=["']\.\/carga\.ui\.js["']/.test(cargaHtml), "Carga no debe activar carga.ui.js heredado");

[
  "Carga/carga.norm-compat.js",
  "Carga/carga.app.connector.js",
  "Carga/carga.ui.connector.js",
  "Carga/process/carga.save.js",
  "Carga/carga.divisiones.popup.js",
  "Carga/carga.index.js"
].forEach((relative) => excludes(relative, forbiddenScreenAccess));

// Ficha
contains("Ficha/ficha.html", "ficha.bootstrap.js", "Ficha debe activar el arranque secuencial");
contains("Ficha/ficha.bootstrap.js", "../BDLocal/conexiones/cone.ficha.js", "El bootstrap debe cargar cone.ficha.js");
contains("Ficha/ficha.bootstrap.js", "ficha.connection-bridge.js", "El bootstrap debe instalar el puente de ConFicha");
order("Ficha/ficha.bootstrap.js", "../BDLocal/conexiones/cone.ficha.js", "ficha.connection-bridge.js");
order("Ficha/ficha.bootstrap.js", "ficha.connection-bridge.js", "ficha.app.js");
contains("Ficha/ficha.connection-bridge.js", "Core.source=function(){return \"ConFicha\";};", "FichaCore debe declarar ConFicha como fuente");
contains("Ficha/ficha.modalidad.js", "con.updateStudent", "La modalidad debe guardarse mediante ConFicha.updateStudent");

const fichaHtml = read("Ficha/ficha.html");
ok(!fichaHtml.includes("ficha.contact-hydration.js"), "Ficha no debe cargar el hidratador directo antiguo");
ok(!fichaHtml.includes("ficha.divisiones.fast.js"), "Ficha no debe cargar el parche directo de divisiones");
ok(!fichaHtml.includes("bdl.divisiones.fast-cache.js"), "Ficha no debe cargar una ruta paralela de divisiones");

[
  "Ficha/ficha.bootstrap.js",
  "Ficha/ficha.connection-bridge.js",
  "Ficha/ficha.modalidad.js"
].forEach((relative) => excludes(relative, forbiddenScreenAccess));

// Sintaxis de todos los archivos incorporados en el bloque.
[
  "BDLocal/conexiones/cone.carga.ops.js",
  "Carga/carga.norm-compat.js",
  "Carga/carga.app.connector.js",
  "Carga/carga.ui.connector.js",
  "Carga/carga.index.js",
  "Carga/process/carga.save.js",
  "Carga/carga.divisiones.popup.js",
  "Ficha/ficha.bootstrap.js",
  "Ficha/ficha.connection-bridge.js",
  "Ficha/ficha.modalidad.js"
].forEach(syntax);

if (errors.length) {
  console.error("\nVERIFICACIÓN DE CONEXIONES: ERROR\n");
  errors.forEach((error, index) => console.error(`${index + 1}. ${error}`));
  process.exit(1);
}

console.log(`VERIFICACIÓN DE CONEXIONES: OK (${checks.length} comprobaciones)`);
