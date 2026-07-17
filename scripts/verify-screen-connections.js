"use strict";

/* =========================================================
Archivo: verify-screen-connections.js
Ruta: /scripts/verify-screen-connections.js
Función:
- Verificar un conector exclusivo por pantalla activa.
- Rechazar accesos directos a BDLocal desde pantallas.
- Validar arranques, fuentes estrictas y sintaxis.
========================================================= */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const errors = [];
const checks = [];

function file(relative) { return path.join(ROOT, relative); }
function read(relative) {
  const target = file(relative);
  if (!fs.existsSync(target)) { errors.push(`Falta el archivo: ${relative}`); return ""; }
  return fs.readFileSync(target, "utf8");
}
function ok(condition, message) { checks.push({ ok: Boolean(condition), message }); if (!condition) errors.push(message); }
function contains(relative, token, message) { ok(read(relative).includes(token), message || `${relative} debe contener ${token}`); }
function excludes(relative, tokens) { const source = read(relative); for (const token of tokens) ok(!source.includes(token), `${relative} no debe contener ${token}`); }
function matches(relative, expression, message) { ok(expression.test(read(relative)), message || `${relative} no coincide con ${expression}`); }
function order(relative, before, after) {
  const source = read(relative); const first = source.indexOf(before); const second = source.indexOf(after);
  ok(first >= 0 && second >= 0 && first < second, `${relative}: ${before} debe aparecer antes de ${after}`);
}
function syntax(relative) {
  const source = read(relative); if (!source) return;
  try { new vm.Script(source, { filename: relative }); checks.push({ ok: true, message: `${relative}: sintaxis válida` }); }
  catch (error) { errors.push(`${relative}: ${error.message}`); }
}

const forbiddenScreenAccess = [
  "window.BL2Core", "window.BL2DB", "window.BDLRepo", "window.BDLService",
  "window.BL2EstudiantesRepo", "window.BL2DataEngine", "window.ExcelLocalRepo",
  "window.BLDivisionesService", "indexedDB.open("
];
const forbiddenInfrastructurePaths = [
  "BDLocal/bl2.", "BDLocal/rules/", "BDLocal/repositories/",
  "BDLocal/services/", "BDLocal/migrations/"
];

// Registro central uno-a-uno.
const registry = read("BDLocal/conexiones/cone.registry.js");
[
  ["carga", "ConCarga", "cone.carga.js"], ["baselocal", "ConBaseLocal", "cone.baselocal.js"],
  ["tabla", "ConTabla", "cone.tabla.js"], ["ficha", "ConFicha", "cone.ficha.js"],
  ["stats", "ConStats", "cone.stats.js"], ["coordi", "ConCoordi", "cone.coordi.js"],
  ["global", "ConGlobal", "cone.global.js"], ["reportes", "ConReportes", "cone.reportes.js"],
  ["defart", "ConDefart", "cone.defart.js"], ["ncomplex", "ConNcomplex", "cone.ncomplex.js"],
  ["cr_def", "ConCrDef", "cone.crdef.js"], ["inpvc", "ConInPVC", "cone.inpvc.js"]
].forEach(([id, globalName, connectorFile]) => {
  ok(registry.includes(`id:"${id}"`) && registry.includes(`global:"${globalName}"`) && registry.includes(`file:"${connectorFile}"`), `Registro incompleto para ${id} → ${globalName}`);
});
ok(!/id:"stats"[^\n]*\/inpvc\//.test(registry), "Stats no debe registrar rutas de InPVC");
ok(!/id:"defensas"[^\n]*\/defart\//.test(registry), "Defensas legacy no debe registrar Defart");
ok(!/id:"defensas"[^\n]*\/cr-def\//.test(registry), "Defensas legacy no debe registrar Cr-def");
matches("BDLocal/conexiones/cone.registry.js", /id:"defensas"[\s\S]*?enabled:false/, "El conector legacy defensas debe permanecer deshabilitado");

// Menú superior.
excludes("Maqueta/maq-config-service.js", ["titulos_estudiante", "titulos_admin", "titulos_coordinador", 'tipo:"grupo",id:"titulos"']);

// Carga.
contains("Carga/carga.html", "carga.app.connector.js");
contains("Carga/carga.index.js", "cone.carga.js");
contains("Carga/carga.index.js", "cone.carga.ops.js");
contains("Carga/process/carga.save.js", "preserveManualEnrollment", "Carga debe conservar el estado manual de matrícula");
contains("Carga/process/carga.save.js", "con.listStudents", "La protección manual debe consultar mediante ConCarga");
contains("Carga/process/carga.save.js", "con.saveStudents", "La carga debe guardar mediante ConCarga");
[
  "Carga/carga.norm-compat.js", "Carga/carga.app.connector.js", "Carga/carga.ui.connector.js",
  "Carga/process/carga.save.js", "Carga/carga.divisiones.popup.js", "Carga/carga.index.js"
].forEach((relative) => excludes(relative, forbiddenScreenAccess));

// Ficha.
contains("Ficha/ficha.html", "ficha.bootstrap.js");
contains("Ficha/ficha.bootstrap.js", "cone.ficha.js");
contains("Ficha/ficha.bootstrap.js", "cone.ficha.enrollment-lock.js");
order("Ficha/ficha.bootstrap.js", "cone.ficha.js", "cone.ficha.enrollment-lock.js");
order("Ficha/ficha.bootstrap.js", "cone.ficha.enrollment-lock.js", "ficha.connection-bridge.js");
contains("BDLocal/conexiones/cone.ficha.enrollment-lock.js", "estadoMatriculaManual:true");
contains("Ficha/ficha.modalidad.js", "con.updateGraduationModality");
contains("Ficha/ficha.matricula.js", "con.updateEnrollmentStatus");
[
  "Ficha/ficha.bootstrap.js", "Ficha/ficha.connection-bridge.js", "Ficha/ficha.modalidad.js",
  "Ficha/ficha.modalidad-ui.js", "Ficha/ficha.matricula.js"
].forEach((relative) => excludes(relative, forbiddenScreenAccess));

// Stats.
contains("Stats/stats.html", "stats.bootstrap.js");
contains("Stats/stats.bootstrap.js", "cone.stats.js");
contains("Stats/stats.bootstrap.js", "cone.stats.notes.js");
contains("Stats/stats.bootstrap.js", "stats.data.connector-patch.js");
excludes("Stats/stats.bootstrap.js", ["stats.data.patch.js"]);
contains("Stats/stats.data.connector-patch.js", "current.listNotes");
excludes("Stats/stats.data.connector-patch.js", ["BDLRepo", "repositories/", "BL2DB", "indexedDB"]);
["Stats/stats.bootstrap.js", "Stats/stats.data.connector-patch.js"].forEach((relative) => excludes(relative, forbiddenScreenAccess));

// Coordi.
contains("Coordi/coordi.html", "coordi.bootstrap.js");
contains("Coordi/coordi.bootstrap.js", "cone.coordi.js");
contains("Coordi/coo.data.js", "ConCoordi");
excludes("Coordi/coo.data.js", ["ConStats", "BDLocalStats", "BDLocalConUtils.readCache", "BL2DataEngine", "ExcelLocalRepo"]);
["Coordi/coordi.bootstrap.js", "Coordi/coo.data.js"].forEach((relative) => excludes(relative, forbiddenScreenAccess));

// Global.
contains("Global/global.html", "global.bootstrap.js");
contains("Global/global.bootstrap.js", "cone.global.js");
contains("Global/global.bootstrap.js", "global.connection-guard.js");
order("Global/global.bootstrap.js", "global.core.js", "global.connection-guard.js");
order("Global/global.bootstrap.js", "global.connection-guard.js", "global.app.js");
contains("Global/global.connection-guard.js", "ConGlobal");
excludes("Global/global.connection-guard.js", ["ExcelLocalRepo", "BL2DataEngine"]);
excludes("Global/global.bootstrap.js", forbiddenScreenAccess);

// Reportes.
contains("Reportes/repo.html", "repo.bootstrap.js");
contains("Reportes/repo.bootstrap.js", "cone.reportes.js");
contains("Reportes/repo.core.js", "ConReportes");
contains("Reportes/repo.app.js", "con.refresh");
["Reportes/repo.bootstrap.js", "Reportes/repo.core.js", "Reportes/repo.app.js"].forEach((relative) => excludes(relative, forbiddenScreenAccess));

// Defart.
contains("defart/defart.html", "defart.bootstrap.js");
excludes("defart/defart.html", forbiddenInfrastructurePaths.concat(["bdl.screen-deps.js", "cone.defart.js"]));
contains("defart/defart.bootstrap.js", "cone.defart.js");
excludes("defart/defart.bootstrap.js", ["repositories/", "services/", "migrations/", "bl2.db.js", "bdl.screen-deps.js"]);
contains("BDLocal/conexiones/cone.defart.js", "ensureDependencies");
contains("defart/defart.service-bridge.js", 'source:"ConDefart"');
contains("defart/defart.save-service-bridge.js", 'source:"ConDefart"');
excludes("defart/defart.service-bridge.js", ["originalSummary", "ExcelLocalRepo", "BL2DataEngine"]);
excludes("defart/defart.save-service-bridge.js", ["originalSave", "BL2Core", "BDLRepo"]);

// Ncomplex.
contains("Ncomplex/ncomplex.html", "ncomplex.bootstrap.js");
excludes("Ncomplex/ncomplex.html", forbiddenInfrastructurePaths.concat(["cone.ncomplex.js"]));
contains("Ncomplex/ncomplex.bootstrap.js", "cone.ncomplex.js");
excludes("Ncomplex/ncomplex.bootstrap.js", ["repositories/", "services/", "migrations/", "bl2.db.js", "bdl.screen-deps.js"]);
contains("BDLocal/conexiones/cone.ncomplex.js", "cone.ncomplex.api.js");
contains("BDLocal/conexiones/cone.ncomplex.api.js", "BDLServiceNcomplex");
contains("Ncomplex/ncomplex.save.js", "ConNcomplex");

// Cr-def.
contains("Cr-def/cr-def.html", "cone.crdef.js");
contains("Cr-def/cr-def.html", "cr-def.bootstrap.js");
order("Cr-def/cr-def.html", "cone.crdef.js", "cr-def.bootstrap.js");
contains("Cr-def/cr-def.bootstrap.js", "connectorReady");
contains("Cr-def/cr-def.data.js", "ConCrDef");
excludes("Cr-def/cr-def.data.js", forbiddenScreenAccess);

// InPVC.
contains("InPVC/inpvc.html", "cone.inpvc.js");
contains("InPVC/inpvc.html", "inpvc.bootstrap.js");
excludes("InPVC/inpvc.html", ['<script src="frontend/inpvc.app.js"></script>']);
contains("InPVC/frontend/inpvc.bootstrap.js", "connectorReady");
contains("InPVC/frontend/inpvc.bootstrap.js", "ConInPVC");
contains("InPVC/core/inpvc.model.js", "InPVCSections");
contains("InPVC/export/inpvc.zip.js", "folder(section.folder)");
excludes("InPVC/frontend/inpvc.bootstrap.js", forbiddenScreenAccess);
excludes("InPVC/frontend/inpvc.app.js", forbiddenScreenAccess);

// Sintaxis de archivos críticos.
[
  "BDLocal/conexiones/cone.registry.js", "BDLocal/conexiones/cone.defart.js",
  "BDLocal/conexiones/cone.ncomplex.js", "BDLocal/conexiones/cone.ncomplex.api.js",
  "BDLocal/conexiones/cone.stats.notes.js", "BDLocal/conexiones/cone.ficha.enrollment-lock.js",
  "Carga/process/carga.save.js", "Ficha/ficha.bootstrap.js", "Stats/stats.bootstrap.js",
  "Stats/stats.data.connector-patch.js", "Coordi/coordi.bootstrap.js", "Coordi/coo.data.js",
  "Global/global.bootstrap.js", "Global/global.connection-guard.js", "Reportes/repo.bootstrap.js",
  "Reportes/repo.core.js", "Reportes/repo.app.js", "defart/defart.bootstrap.js",
  "defart/defart.service-bridge.js", "defart/defart.save-service-bridge.js",
  "Ncomplex/ncomplex.bootstrap.js", "Ncomplex/ncomplex.save.js", "Cr-def/cr-def.bootstrap.js",
  "Cr-def/cr-def.data.js", "BDLocal/conexiones/cone.inpvc.js",
  "InPVC/frontend/inpvc.bootstrap.js", "InPVC/frontend/inpvc.app.js",
  "InPVC/core/inpvc.utils.js", "InPVC/core/inpvc.model.js",
  "InPVC/export/inpvc.word.js", "InPVC/export/inpvc.pdf.js", "InPVC/export/inpvc.zip.js"
].forEach(syntax);

if (errors.length) {
  console.error("\nVERIFICACIÓN DE CONEXIONES: ERROR\n");
  errors.forEach((error, index) => console.error(`${index + 1}. ${error}`));
  process.exit(1);
}
console.log(`VERIFICACIÓN DE CONEXIONES: OK (${checks.length} comprobaciones)`);
