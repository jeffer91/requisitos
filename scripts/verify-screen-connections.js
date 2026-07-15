"use strict";

/* =========================================================
Archivo: verify-screen-connections.js
Ruta: /scripts/verify-screen-connections.js
Función:
- Verificar los conectores exclusivos de las pantallas activas.
- Rechazar accesos directos desde controladores de pantalla.
- Comprobar que el grupo antiguo Títulos no aparezca en el menú.
- Validar orden de arranque y sintaxis JavaScript.
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

// Menú superior
excludes("Maqueta/maq-config-service.js", [
  "titulos_estudiante",
  "titulos_admin",
  "titulos_coordinador",
  'tipo:"grupo",id:"titulos"'
]);

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

// Stats
contains("Stats/stats.html", "stats.bootstrap.js", "Stats debe activar stats.bootstrap.js");
contains("Stats/stats.bootstrap.js", "../BDLocal/conexiones/cone.stats.js", "StatsBootstrap debe cargar cone.stats.js");
order("Stats/stats.bootstrap.js", "../BDLocal/conexiones/cone.stats.js", "stats.core.js");
order("Stats/stats.bootstrap.js", "stats.core.js", "stats.app.js");
const statsHtml = read("Stats/stats.html");
ok(!statsHtml.includes("bdl.divisiones.fast-cache.js"), "Stats no debe cargar el adaptador paralelo de divisiones");
ok(!statsHtml.includes("stats.divisiones.fast.js"), "Stats no debe cargar el parche directo de divisiones");
excludes("Stats/stats.bootstrap.js", forbiddenScreenAccess);

// Coordi
contains("Coordi/coordi.html", "coordi.bootstrap.js", "Coordi debe activar coordi.bootstrap.js");
contains("Coordi/coordi.bootstrap.js", "../BDLocal/conexiones/cone.coordi.js", "CoordiBootstrap debe cargar cone.coordi.js");
order("Coordi/coordi.bootstrap.js", "../BDLocal/conexiones/cone.coordi.js", "coo.data.js");
order("Coordi/coordi.bootstrap.js", "coo.data.js", "coordi.app.js");
contains("Coordi/coo.data.js", "ConCoordi", "COOData debe usar ConCoordi");
excludes("Coordi/coo.data.js", [
  "ConStats",
  "BDLocalStats",
  "BDLocalScreenDeps.readCache",
  "BDLocalConUtils.readCache",
  "BLDivisionesService",
  "BL2DataEngine",
  "ExcelLocalRepo"
]);
const coordiHtml = read("Coordi/coordi.html");
ok(!coordiHtml.includes("bdl.divisiones.fast-cache.js"), "Coordi no debe cargar el adaptador paralelo de divisiones");
[
  "Coordi/coordi.bootstrap.js",
  "Coordi/coo.data.js"
].forEach((relative) => excludes(relative, forbiddenScreenAccess));

// Global
contains("Global/global.html", "global.bootstrap.js", "Global debe activar global.bootstrap.js");
contains("Global/global.bootstrap.js", "../BDLocal/conexiones/cone.global.js", "GlobalBootstrap debe cargar cone.global.js");
order("Global/global.bootstrap.js", "../BDLocal/conexiones/cone.global.js", "global.core.js");
order("Global/global.bootstrap.js", "global.core.js", "global.app.js");
const globalHtml = read("Global/global.html");
ok(!globalHtml.includes("bdl.divisiones.fast-cache.js"), "Global no debe cargar el adaptador paralelo de divisiones");
excludes("Global/global.bootstrap.js", forbiddenScreenAccess);

// Reportes
contains("Reportes/repo.html", "repo.bootstrap.js", "Reportes debe activar repo.bootstrap.js");
contains("Reportes/repo.bootstrap.js", "../BDLocal/conexiones/cone.reportes.js", "RepoBootstrap debe cargar cone.reportes.js");
order("Reportes/repo.bootstrap.js", "../BDLocal/conexiones/cone.reportes.js", "repo.core.js");
order("Reportes/repo.bootstrap.js", "repo.core.js", "repo.app.js");
contains("Reportes/repo.core.js", "ConReportes", "RepoCore debe usar ConReportes");
contains("Reportes/repo.app.js", "con.refresh", "RepoApp debe actualizar mediante ConReportes");
const reportesHtml = read("Reportes/repo.html");
ok(!reportesHtml.includes("bdl.divisiones.fast-cache.js"), "Reportes no debe cargar el adaptador paralelo de divisiones");
[
  "Reportes/repo.bootstrap.js",
  "Reportes/repo.core.js",
  "Reportes/repo.app.js"
].forEach((relative) => excludes(relative, forbiddenScreenAccess));
excludes("Reportes/repo.app.js", ["BDLocalConexiones.refreshCache"]);

// Sintaxis de todos los archivos incorporados o modificados en los bloques.
[
  "Maqueta/maq-config-service.js",
  "BDLocal/conexiones/cone.carga.ops.js",
  "Carga/carga.norm-compat.js",
  "Carga/carga.app.connector.js",
  "Carga/carga.ui.connector.js",
  "Carga/carga.index.js",
  "Carga/process/carga.save.js",
  "Carga/carga.divisiones.popup.js",
  "Ficha/ficha.bootstrap.js",
  "Ficha/ficha.connection-bridge.js",
  "Ficha/ficha.modalidad.js",
  "Stats/stats.bootstrap.js",
  "Coordi/coordi.bootstrap.js",
  "Coordi/coo.data.js",
  "Global/global.bootstrap.js",
  "Reportes/repo.bootstrap.js",
  "Reportes/repo.core.js",
  "Reportes/repo.app.js"
].forEach(syntax);

if (errors.length) {
  console.error("\nVERIFICACIÓN DE CONEXIONES: ERROR\n");
  errors.forEach((error, index) => console.error(`${index + 1}. ${error}`));
  process.exit(1);
}

console.log(`VERIFICACIÓN DE CONEXIONES: OK (${checks.length} comprobaciones)`);
