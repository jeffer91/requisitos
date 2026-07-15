"use strict";

/* =========================================================
Archivo: verify-ficha-editors.js
Ruta: /scripts/verify-ficha-editors.js
Función:
- Verificar el editor ACTIVO/RETIRADO de Ficha.
- Verificar que la selección pendiente no se pierda al renderizar.
- Verificar las reglas de modalidad regular y PVC.
- Confirmar que la pantalla use ConFicha y no acceda directamente a BDLocal.
- Validar sintaxis y orden de carga.
========================================================= */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const errors = [];
const checks = [];

function read(relative) {
  const target = path.join(ROOT, relative);
  if (!fs.existsSync(target)) {
    errors.push(`Falta el archivo ${relative}`);
    return "";
  }
  return fs.readFileSync(target, "utf8");
}

function ok(condition, message) {
  checks.push({ ok: Boolean(condition), message });
  if (!condition) errors.push(message);
}

function contains(relative, token, message) {
  ok(read(relative).includes(token), message || `${relative} debe contener ${token}`);
}

function excludes(relative, tokens) {
  const source = read(relative);
  for (const token of tokens) {
    ok(!source.includes(token), `${relative} no debe contener ${token}`);
  }
}

function order(relative, before, after) {
  const source = read(relative);
  const a = source.indexOf(before);
  const b = source.indexOf(after);
  ok(a >= 0 && b >= 0 && a < b, `${relative}: ${before} debe cargarse antes de ${after}`);
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

const screenForbidden = [
  "window.BL2Core",
  "window.BL2DB",
  "window.BDLRepo",
  "window.BL2EstudiantesRepo",
  "window.BL2DataEngine",
  "window.ExcelLocalRepo",
  "indexedDB.open("
];

contains("Ficha/ficha.html", 'id="ficha-matricula-edit"', "Ficha debe mostrar el selector ACTIVO/RETIRADO");
contains("Ficha/ficha.html", 'id="ficha-matricula-save"', "Ficha debe mostrar Guardar estado");
contains("Ficha/ficha.html", 'id="ficha-modalidad-select"', "Ficha debe mantener el selector de modalidad");
contains("Ficha/ficha.html", 'id="ficha-modalidad-save"', "Ficha debe mantener Guardar modalidad");

contains("BDLocal/conexiones/cone.ficha.js", "updateEnrollmentStatus:updateEnrollmentStatus", "ConFicha debe exponer updateEnrollmentStatus");
contains("BDLocal/conexiones/cone.ficha.js", "updateGraduationModality:updateGraduationModality", "ConFicha debe exponer updateGraduationModality");
contains("BDLocal/conexiones/cone.ficha.js", 'active:"ACTIVO"', "ConFicha debe admitir ACTIVO");
contains("BDLocal/conexiones/cone.ficha.js", 'retired:"RETIRADO"', "ConFicha debe admitir RETIRADO");
contains("BDLocal/conexiones/cone.ficha.js", 'articulo:"ARTICULO_ACADEMICO"', "ConFicha debe definir Artículo Académico");
contains("BDLocal/conexiones/cone.ficha.js", 'if(type==="PVC")', "ConFicha debe forzar artículo en PVC");

contains("Ficha/ficha.matricula.js", "con.updateEnrollmentStatus", "El editor de matrícula debe usar ConFicha.updateEnrollmentStatus");
contains("Ficha/ficha.matricula.js", 'var pendingStudentId=""', "El editor debe identificar el estudiante con cambio pendiente");
contains("Ficha/ficha.matricula.js", 'var pendingStatus=""', "El editor debe conservar el estado pendiente");
contains("Ficha/ficha.matricula.js", 'select.addEventListener("change",handleSelectionChange)', "El selector debe registrar los cambios antes de guardar");
contains("Ficha/ficha.matricula.js", "pendingFor(row)?pendingStatus", "Los renderizados no deben reemplazar una selección pendiente");
contains("Ficha/ficha.matricula.js", "setPending(row,next)", "El cambio elegido debe conservarse hasta guardar o cancelar");
contains("Ficha/ficha.modalidad.js", "con.updateGraduationModality", "Modalidad debe usar ConFicha.updateGraduationModality");
contains("Ficha/ficha.modalidad.js", "return Promise.resolve", "Modalidad debe esperar una operación asincrónica");
contains("Ficha/ficha.modalidad-ui.js", "Artículo guardado", "La interfaz debe confirmar artículo en PVC");

order("Ficha/ficha.bootstrap.js", "ficha.app.js", "ficha.modalidad.js");
order("Ficha/ficha.bootstrap.js", "ficha.modalidad.js", "ficha.modalidad-ui.js");
order("Ficha/ficha.bootstrap.js", "ficha.modalidad-ui.js", "ficha.matricula.js");

[
  "Ficha/ficha.matricula.js",
  "Ficha/ficha.modalidad.js",
  "Ficha/ficha.modalidad-ui.js",
  "Ficha/ficha.bootstrap.js"
].forEach((relative) => excludes(relative, screenForbidden));

[
  "BDLocal/conexiones/cone.ficha.js",
  "Ficha/ficha.matricula.js",
  "Ficha/ficha.modalidad.js",
  "Ficha/ficha.modalidad-ui.js",
  "Ficha/ficha.bootstrap.js"
].forEach(syntax);

if (errors.length) {
  console.error("\nVERIFICACIÓN DE EDITORES DE FICHA: ERROR\n");
  errors.forEach((error, index) => console.error(`${index + 1}. ${error}`));
  process.exit(1);
}

console.log(`VERIFICACIÓN DE EDITORES DE FICHA: OK (${checks.length} comprobaciones)`);
