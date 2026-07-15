"use strict";

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
function contains(relative, token, message) { const source = read(relative); ok(source.includes(token), message || `${relative} debe contener ${token}`); }
function excludes(relative, tokens) { const source = read(relative); for (const token of tokens) ok(!source.includes(token), `${relative} no debe contener ${token}`); }
function order(relative, before, after) {
  const source = read(relative); const first = source.indexOf(before); const second = source.indexOf(after);
  ok(first >= 0 && second >= 0 && first < second, `${relative}: ${before} debe cargarse antes de ${after}`);
}
function syntax(relative) {
  const source = read(relative); if (!source) return;
  try { new vm.Script(source, { filename: relative }); checks.push({ ok: true, message: `${relative}: sintaxis válida` }); }
  catch (error) { errors.push(`${relative}: ${error.message}`); }
}

const forbiddenScreenAccess = [
  "window.BL2Core", "window.BL2DB", "window.BDLRepo", "window.BL2EstudiantesRepo",
  "window.BL2DataEngine", "window.ExcelLocalRepo", "window.BLDivisionesService", "indexedDB.open("
];

// Registro central: una pantalla, un conector.
contains("BDLocal/conexiones/cone.registry.js", 'id:"infor"', "El registro debe declarar Infor");
contains("BDLocal/conexiones/cone.registry.js", 'global:"ConInfor"', "Infor debe resolver ConInfor");
contains("BDLocal/conexiones/cone.registry.js", 'id:"cr_def"', "El registro debe declarar Cr-def");
contains("BDLocal/conexiones/cone.registry.js", 'global:"ConCrDef"', "Cr-def debe resolver ConCrDef");
contains("BDLocal/conexiones/cone.registry.js", 'id:"defart"', "El registro debe declarar Defart");
contains("BDLocal/conexiones/cone.registry.js", 'global:"ConDefart"', "Defart debe resolver ConDefart");

// Menú superior.
excludes("Maqueta/maq-config-service.js", ["titulos_estudiante", "titulos_admin", "titulos_coordinador", 'tipo:"grupo",id:"titulos"']);

// Carga.
contains("Carga/carga.html", "carga.norm-compat.js");
contains("Carga/carga.html", "carga.app.connector.js");
contains("Carga/carga.html", "carga.ui.connector.js");
order("Carga/carga.html", "carga.norm-compat.js", "mapping/carga.field-map.js");
contains("Carga/carga.index.js", "cone.carga.js");
contains("Carga/carga.index.js", "cone.carga.ops.js");
contains("BDLocal/conexiones/cone.carga.ops.js", "api.listStudents=students");
contains("BDLocal/conexiones/cone.carga.ops.js", "api.saveDivisions=saveDivisions");
const cargaHtml = read("Carga/carga.html");
ok(!/src=["']\.\/carga\.app\.js["']/.test(cargaHtml), "Carga no debe activar carga.app.js heredado");
ok(!/src=["']\.\/carga\.ui\.js["']/.test(cargaHtml), "Carga no debe activar carga.ui.js heredado");
[
  "Carga/carga.norm-compat.js", "Carga/carga.app.connector.js", "Carga/carga.ui.connector.js",
  "Carga/process/carga.save.js", "Carga/carga.divisiones.popup.js", "Carga/carga.index.js"
].forEach((relative) => excludes(relative, forbiddenScreenAccess));

// Ficha.
contains("Ficha/ficha.html", "ficha.bootstrap.js");
contains("Ficha/ficha.bootstrap.js", "../BDLocal/conexiones/cone.ficha.js");
contains("Ficha/ficha.bootstrap.js", "ficha.connection-bridge.js");
contains("Ficha/ficha.bootstrap.js", "ficha.matricula.js");
contains("Ficha/ficha.bootstrap.js", "ficha.modalidad-ui.js");
order("Ficha/ficha.bootstrap.js", "../BDLocal/conexiones/cone.ficha.js", "ficha.connection-bridge.js");
order("Ficha/ficha.bootstrap.js", "ficha.connection-bridge.js", "ficha.app.js");
contains("Ficha/ficha.modalidad.js", "con.updateGraduationModality");
contains("Ficha/ficha.matricula.js", "con.updateEnrollmentStatus");
const fichaHtml = read("Ficha/ficha.html");
ok(!fichaHtml.includes("ficha.contact-hydration.js"), "Ficha no debe cargar el hidratador directo antiguo");
ok(!fichaHtml.includes("ficha.divisiones.fast.js"), "Ficha no debe cargar el parche directo de divisiones");
ok(!fichaHtml.includes("bdl.divisiones.fast-cache.js"), "Ficha no debe cargar una ruta paralela de divisiones");
[
  "Ficha/ficha.bootstrap.js", "Ficha/ficha.connection-bridge.js", "Ficha/ficha.modalidad.js",
  "Ficha/ficha.modalidad-ui.js", "Ficha/ficha.matricula.js"
].forEach((relative) => excludes(relative, forbiddenScreenAccess));

// Stats.
contains("Stats/stats.html", "stats.bootstrap.js");
contains("Stats/stats.bootstrap.js", "../BDLocal/conexiones/cone.stats.js");
order("Stats/stats.bootstrap.js", "../BDLocal/conexiones/cone.stats.js", "stats.core.js");
order("Stats/stats.bootstrap.js", "stats.core.js", "stats.app.js");
contains("Stats/stats.data.patch.js", 'source:"ConStats"', "El parche de notas debe declarar ConStats como fuente");
excludes("Stats/stats.data.patch.js", ["BDLRepoNotas", "repositories/bdl.repo.notas.js", "indexedDB.open("]);
const statsHtml = read("Stats/stats.html");
ok(!statsHtml.includes("bdl.divisiones.fast-cache.js"), "Stats no debe cargar el adaptador paralelo de divisiones");
ok(!statsHtml.includes("stats.divisiones.fast.js"), "Stats no debe cargar el parche directo de divisiones");
excludes("Stats/stats.bootstrap.js", forbiddenScreenAccess);

// Coordi.
contains("Coordi/coordi.html", "coordi.bootstrap.js");
contains("Coordi/coordi.bootstrap.js", "../BDLocal/conexiones/cone.coordi.js");
order("Coordi/coordi.bootstrap.js", "../BDLocal/conexiones/cone.coordi.js", "coo.data.js");
contains("Coordi/coo.data.js", "ConCoordi");
excludes("Coordi/coo.data.js", ["ConStats", "BDLocalStats", "BDLocalScreenDeps.readCache", "BDLocalConUtils.readCache", "BLDivisionesService", "BL2DataEngine", "ExcelLocalRepo"]);

// Global.
contains("Global/global.html", "global.bootstrap.js");
contains("Global/global.bootstrap.js", "../BDLocal/conexiones/cone.global.js");
order("Global/global.bootstrap.js", "../BDLocal/conexiones/cone.global.js", "global.core.js");
order("Global/global.bootstrap.js", "global.core.js", "global.app.js");
const globalHtml = read("Global/global.html");
ok(!globalHtml.includes("bdl.divisiones.fast-cache.js"), "Global no debe cargar el adaptador paralelo de divisiones");
excludes("Global/global.bootstrap.js", forbiddenScreenAccess);

// Reportes.
contains("Reportes/repo.html", "repo.bootstrap.js");
contains("Reportes/repo.bootstrap.js", "../BDLocal/conexiones/cone.reportes.js");
order("Reportes/repo.bootstrap.js", "../BDLocal/conexiones/cone.reportes.js", "repo.core.js");
contains("Reportes/repo.core.js", "ConReportes");
contains("Reportes/repo.app.js", "con.refresh");
[
  "Reportes/repo.bootstrap.js", "Reportes/repo.core.js", "Reportes/repo.app.js"
].forEach((relative) => excludes(relative, forbiddenScreenAccess));

// Defart.
contains("defart/defart.html", "defart.bootstrap.js", "Defart debe iniciar mediante su bootstrap");
contains("defart/defart.bootstrap.js", "cone.defart.js", "DefartBootstrap debe cargar ConDefart");
excludes("defart/defart.html", ["bl2.db.js", "bdl.repo.", "bdl.service.", "bdl.divisiones.fast-cache.js"]);

// Ncomplex.
contains("Ncomplex/ncomplex.html", "ncomplex.bootstrap.js", "Ncomplex debe iniciar mediante su bootstrap");
contains("Ncomplex/ncomplex.bootstrap.js", "cone.ncomplex.js", "NcomplexBootstrap debe cargar ConNcomplex");
excludes("Ncomplex/ncomplex.html", ["bl2.db.js", "bdl.repo.", "bdl.service.", "bdl.migration."]);

// Cr-def.
contains("Cr-def/cr-def.html", "cr-def.bootstrap.js", "Cr-def debe iniciar mediante su bootstrap");
contains("Cr-def/cr-def.bootstrap.js", "ConCrDef", "Cr-defBootstrap debe esperar ConCrDef");
ok(!read("Cr-def/cr-def.html").includes('<script src="cr-def.js"></script>'), "Cr-def no debe iniciar cr-def.js antes de confirmar ConCrDef");
excludes("Cr-def/cr-def.data.js", forbiddenScreenAccess);

// Infor.
contains("Infor/frontend/titulacion.html", "infor.bootstrap.js", "Infor debe iniciar mediante su bootstrap");
contains("Infor/frontend/infor.bootstrap.js", "ConInfor", "InforBootstrap debe esperar ConInfor");
ok(!read("Infor/frontend/titulacion.html").includes('<script src="titulacion.app.js"></script>'), "Infor no debe iniciar la aplicación antes de InforPeriodo.ready");
excludes("Infor/core/infor.periodo.js", forbiddenScreenAccess);

[
  "Maqueta/maq-config-service.js", "BDLocal/conexiones/cone.registry.js", "BDLocal/conexiones/cone.carga.ops.js",
  "BDLocal/conexiones/cone.ficha.js", "Carga/carga.norm-compat.js", "Carga/carga.app.connector.js",
  "Carga/carga.ui.connector.js", "Carga/carga.index.js", "Carga/process/carga.save.js",
  "Carga/carga.divisiones.popup.js", "Ficha/ficha.bootstrap.js", "Ficha/ficha.connection-bridge.js",
  "Ficha/ficha.modalidad.js", "Ficha/ficha.modalidad-ui.js", "Ficha/ficha.matricula.js",
  "Stats/stats.bootstrap.js", "Stats/stats.data.patch.js", "Coordi/coordi.bootstrap.js", "Coordi/coo.data.js",
  "Global/global.bootstrap.js", "Reportes/repo.bootstrap.js", "Reportes/repo.core.js", "Reportes/repo.app.js",
  "defart/defart.bootstrap.js", "Ncomplex/ncomplex.bootstrap.js", "Cr-def/cr-def.bootstrap.js",
  "Cr-def/cr-def.data.js", "Infor/frontend/infor.bootstrap.js", "Infor/core/infor.periodo.js"
].forEach(syntax);

if (errors.length) {
  console.error("\nVERIFICACIÓN DE CONEXIONES: ERROR\n");
  errors.forEach((error, index) => console.error(`${index + 1}. ${error}`));
  process.exit(1);
}

console.log(`VERIFICACIÓN DE CONEXIONES: OK (${checks.length} comprobaciones)`);
