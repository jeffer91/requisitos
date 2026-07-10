/* =========================================================
Nombre completo: verify-bdlocal.js
Ruta o ubicación: /scripts/verify-bdlocal.js
Función o funciones:
- Verificar archivos críticos y sintaxis JavaScript.
- Certificar separación Firebase y estrategias de ID.
- Confirmar que Telegram solo lee Estudiantes/{cedula}.
- Comprobar límites, mantenimientos y ausencia de escrituras automáticas.
- Ejecutarse con Node.js sin abrir Electron, IndexedDB ni internet.
========================================================= */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const root = path.resolve(__dirname, "..");
const checks = [];

function relative(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function add(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: String(detail || "") });
}

function absolute(filePath) {
  return path.resolve(root, filePath);
}

function exists(filePath) {
  return fs.existsSync(absolute(filePath)) && fs.statSync(absolute(filePath)).isFile();
}

function read(filePath) {
  return fs.readFileSync(absolute(filePath), "utf8");
}

function requireFile(filePath) {
  const ok = exists(filePath);
  add(`Existe ${filePath}`, ok, ok ? "OK" : "No encontrado");
  if (ok) {
    const size = fs.statSync(absolute(filePath)).size;
    add(`No vacío ${filePath}`, size > 0, `${size} bytes`);
  }
}

function contains(filePath, fragment, label) {
  if (!exists(filePath)) {
    add(label, false, `No existe ${filePath}`);
    return;
  }
  const ok = read(filePath).includes(fragment);
  add(label, ok, ok ? "Encontrado" : `Falta: ${fragment}`);
}

function notContains(filePath, fragment, label) {
  if (!exists(filePath)) {
    add(label, false, `No existe ${filePath}`);
    return;
  }
  const ok = !read(filePath).includes(fragment);
  add(label, ok, ok ? "Ausente, correcto" : `Referencia no permitida: ${fragment}`);
}

function walk(directory, extension, output = []) {
  const full = absolute(directory);
  if (!fs.existsSync(full)) return output;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const current = path.join(full, entry.name);
    if (entry.isDirectory()) {
      walk(relative(current), extension, output);
    } else if (!extension || entry.name.endsWith(extension)) {
      output.push(current);
    }
  }
  return output;
}

function syntaxCheck(filePath) {
  const result = childProcess.spawnSync(process.execPath, ["--check", filePath], {
    cwd: root,
    encoding: "utf8"
  });
  const ok = result.status === 0;
  const detail = ok ? "OK" : (result.stderr || result.stdout || `Código ${result.status}`).trim();
  add(`Sintaxis ${relative(filePath)}`, ok, detail);
}

function checkPackage() {
  if (!exists("package.json")) return;
  try {
    const pkg = JSON.parse(read("package.json"));
    add("package.json válido", true, pkg.name || "sin nombre");
    add("Script test:bdlocal", pkg.scripts && pkg.scripts["test:bdlocal"] === "node scripts/verify-bdlocal.js", pkg.scripts && pkg.scripts["test:bdlocal"] || "faltante");
    add("Script test", pkg.scripts && pkg.scripts.test === "node scripts/verify-bdlocal.js", pkg.scripts && pkg.scripts.test || "faltante");
  } catch (error) {
    add("package.json válido", false, error.message);
  }
}

console.log("\n=== Certificación estática BDLocal ===");
console.log(`Ruta: ${root}`);
console.log("No abre IndexedDB, Electron ni conexiones externas.\n");

const criticalFiles = [
  "package.json",
  "electron/main.js",
  "Maqueta/maq-index.html",
  "BDLocal/bl2.html",
  "BDLocal/bl2.config.js",
  "BDLocal/bl2.config.v2.js",
  "BDLocal/bl2.db.js",
  "BDLocal/bl2.core.js",
  "BDLocal/bl2.app.js",
  "BDLocal/bl2.test.js",
  "BDLocal/rules/bdl.rules.persona.js",
  "BDLocal/rules/bdl.rules.matricula.js",
  "BDLocal/rules/bdl.rules.requisitos.js",
  "BDLocal/rules/bdl.rules.notas.js",
  "BDLocal/sync/bdl.firebase.telegram-pull.js",
  "BDLocal/sync/targets/bdl.sync.target.firebase.js",
  "BDLocal/maintenance/bdl.firebase.identity-repair.js",
  "BDLocal/maintenance/bdl.local.identity-repair.js",
  "BDLocal/maintenance/bdl.legacy.cleanup.js",
  "BDLocal/migrations/bdl.migration.legacy-v2.js",
  "BDLocal/diagnostics/bdl.diagnostics.ui-bridge.js",
  "js/bdlocal-config/bdlocal-sync-fixups.js",
  "tools/bdl-smoke-test.ps1",
  "scripts/verify-bdlocal.js",
  ".github/workflows/bdlocal-integrity.yml"
];
criticalFiles.forEach(requireFile);

contains("BDLocal/bl2.config.js", 'collection:"EstudiantesPeriodo"', "Configuración inicial académica = EstudiantesPeriodo");
contains("BDLocal/bl2.config.js", 'personCollection:"Estudiantes"', "Configuración inicial personal = Estudiantes");
contains("BDLocal/bl2.config.js", 'personDocumentIdStrategy:"cedula"', "Estudiantes usa solo cédula como ID");
contains("BDLocal/bl2.config.js", 'academicDocumentIdStrategy:"periodoId__cedula"', "EstudiantesPeriodo usa período y cédula");
contains("BDLocal/bl2.config.js", 'manualOnly:true', "Sincronización externa manual");
contains("BDLocal/bl2.config.js", 'syncOnIdle:false', "Sin sincronización externa por inactividad");
contains("BDLocal/bl2.config.js", 'syncOnClose:false', "Sin sincronización externa al cerrar");
contains("BDLocal/bl2.config.js", 'maxBatchSize:25', "Lote externo máximo 25");

contains("BDLocal/bl2.config.v2.js", 'personDocumentIdStrategy:"cedula"', "V2 mantiene ID personal por cédula");
contains("BDLocal/bl2.config.v2.js", 'academicDocumentIdStrategy:"periodoId__cedula"', "V2 mantiene ID académico separado");

contains("BDLocal/rules/bdl.rules.matricula.js", 'cedula + "__" + periodoId', "Matrícula usa cedula__periodoId");
contains("BDLocal/rules/bdl.rules.requisitos.js", 'cedula + "__" + periodoId', "Requisitos usan cedula__periodoId");
contains("BDLocal/rules/bdl.rules.notas.js", 'cedula + "__" + periodoId', "Notas usan cedula__periodoId");
contains("BDLocal/rules/bdl.rules.persona.js", "isValidEcuadorianCedula", "Identidad valida dígito verificador");

contains("BDLocal/sync/bdl.firebase.telegram-pull.js", 'var COLLECTION="Estudiantes"', "Telegram consulta Estudiantes");
contains("BDLocal/sync/bdl.firebase.telegram-pull.js", "var MAX_READS=25", "Telegram limita lecturas a 25");
contains("BDLocal/sync/bdl.firebase.telegram-pull.js", "writesFirebase:false", "Telegram declara cero escrituras Firebase");
contains("BDLocal/sync/bdl.firebase.telegram-pull.js", "createsOutbox:false", "Telegram no crea cola");
notContains("BDLocal/sync/bdl.firebase.telegram-pull.js", "batch.commit", "Telegram no ejecuta batch remoto");
notContains("BDLocal/sync/bdl.firebase.telegram-pull.js", "runTransaction", "Telegram no ejecuta transacciones remotas");

contains("BDLocal/sync/targets/bdl.sync.target.firebase.js", '"EstudiantesPeriodo"', "Target académico apunta a EstudiantesPeriodo");
contains("BDLocal/sync/targets/bdl.sync.target.firebase.js", "stripTelegramFields", "Target académico elimina Telegram");
contains("BDLocal/sync/targets/bdl.sync.target.firebase.js", "MAX_BATCH_SIZE = 25", "Target académico limita lote a 25");

contains("BDLocal/maintenance/bdl.firebase.identity-repair.js", "writesAutomatic:false", "Corrección Firebase no es automática");
contains("BDLocal/maintenance/bdl.firebase.identity-repair.js", "createsOutbox:false", "Corrección Firebase no crea cola");
contains("BDLocal/maintenance/bdl.firebase.identity-repair.js", "runTransaction", "Corrección Firebase usa transacción");
contains("BDLocal/maintenance/bdl.local.identity-repair.js", 'canonicalLocalId:"cedula__periodoId"', "Corrección local declara clave canónica");
contains("BDLocal/maintenance/bdl.local.identity-repair.js", "writesExternal:false", "Corrección local no escribe externamente");
contains("BDLocal/maintenance/bdl.local.identity-repair.js", "createsOutbox:false", "Corrección local no crea cola");
contains("BDLocal/maintenance/bdl.local.identity-repair.js", 'current.tx(storeNames,"readwrite")', "Corrección local usa transacción IndexedDB");

contains("BDLocal/bl2.test.js", "network:false", "Certificación interna no usa internet");
contains("BDLocal/bl2.test.js", "checkIdentityRules", "Certificación interna revisa identidad");
contains("BDLocal/bl2.test.js", "checkTelegramPull", "Certificación interna revisa Telegram");
contains("BDLocal/bl2.test.js", "checkMaintenanceSafety", "Certificación interna revisa mantenimiento");
contains("js/bdlocal-config/bdlocal-sync-fixups.js", "loadLocalIdentityRepairModule", "Cargador incluye mantenimiento local");
contains("js/bdlocal-config/bdlocal-sync-fixups.js", "loadFirebaseIdentityRepairModule", "Cargador incluye mantenimiento Firebase");
contains("js/bdlocal-config/bdlocal-sync-fixups.js", "loadTelegramModule", "Cargador incluye Telegram");

contains("BDLocal/bl2.html", "bdlocal:bl2-html-scripts-loaded", "HTML declara fin de carga ordenada");
notContains("BDLocal/bl2.html", "bdlocal-modal.js", "HTML no carga modal antiguo");
notContains("BDLocal/bl2.html", "bdl.migration.legacy-v2.ui.js", "HTML no carga migración visual duplicada");

checkPackage();

const javascriptDirectories = ["BDLocal", "js/bdlocal-config", "electron", "scripts"];
const javascriptFiles = javascriptDirectories.flatMap((directory) => walk(directory, ".js"));
for (const filePath of [...new Set(javascriptFiles)].sort()) {
  syntaxCheck(filePath);
}

const emptyFiles = walk("BDLocal", null).filter((filePath) => fs.statSync(filePath).size === 0);
add("Sin archivos vacíos en BDLocal", emptyFiles.length === 0, emptyFiles.length ? emptyFiles.map(relative).join(", ") : "OK");

const passed = checks.filter((check) => check.ok).length;
const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "[OK]   " : "[FALLO]"} ${check.name} - ${check.detail}`);
}

console.log(`\nResumen: ${passed} / ${checks.length} controles correctos.`);

if (failed.length) {
  console.error(`Hay ${failed.length} problema(s). No realice una sincronización real hasta corregirlos.`);
  process.exit(1);
}

console.log("Certificación estática aprobada. Ejecute también Diagnóstico y salud dentro de Electron.");
process.exit(0);
