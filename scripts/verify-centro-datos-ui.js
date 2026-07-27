"use strict";

/* =========================================================
Archivo: verify-centro-datos-ui.js
Ruta: /scripts/verify-centro-datos-ui.js
Función:
- Verificar la interfaz final del Centro de datos.
- Confirmar la división Base Local / Conexiones Externas.
- Evitar una aplicación externa, acceso directo a IndexedDB o red desde la UI.
========================================================= */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const files = [
  "BDLocal/centro-datos/centro-datos.ui.js",
  "BDLocal/centro-datos/centro-datos.ui.css",
  "BDLocal/diagnostics/bdl.diagnostics.index.js",
  "Maqueta/maq-config-service.js",
  "Maqueta/maq-modulos-registry.js"
];
const errors = [];
const sources = {};

function check(condition, message) {
  if (!condition) errors.push(message);
}

for (const relative of files) {
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) {
    errors.push(`Falta el archivo ${relative}`);
    continue;
  }
  sources[relative] = fs.readFileSync(target, "utf8");
}

for (const relative of files.filter((item) => item.endsWith(".js"))) {
  const source = sources[relative] || "";
  try {
    new vm.Script(source, { filename: relative });
  } catch (error) {
    errors.push(`${relative}: ${error.message}`);
  }
}

const ui = sources["BDLocal/centro-datos/centro-datos.ui.js"] || "";
const diagnostics = sources["BDLocal/diagnostics/bdl.diagnostics.index.js"] || "";
const menu = sources["Maqueta/maq-config-service.js"] || "";
const registry = sources["Maqueta/maq-modulos-registry.js"] || "";

[
  "Base Local",
  "Conexiones Externas",
  "Estado y rendimiento",
  "Resumen de sincronización",
  "Firebase",
  "Supabase",
  "Google Sheets",
  "Cola y reintentos",
  "Conflictos",
  "Cuotas y consumo"
].forEach((token) => check(ui.includes(token), `La interfaz debe incluir: ${token}`));

[
  'navButton("base-local"',
  'navButton("bases-externas"',
  'navButton("firebase"',
  'navButton("supabase"',
  'navButton("google"',
  'navButton("cola"',
  'navButton("conflictos"',
  'navButton("consumo"'
].forEach((token) => check(ui.includes(token), `Falta navegación jerárquica: ${token}`));

check(ui.includes("window.BDLocalPantallas"), "La UI debe leer Base Local mediante BDLocalPantallas.");
check(ui.includes("window.ConexionesExternas"), "La UI debe leer proveedores mediante ConexionesExternas.");
check(ui.includes("manuales"), "La UI debe explicar que las operaciones externas son manuales.");
check(!ui.includes("indexedDB.open("), "La UI no debe abrir IndexedDB directamente.");
check(!ui.includes("window.open("), "El Centro de datos no debe abrir una aplicación o ventana externa.");
check(!ui.includes("fetch("), "La UI no debe llamar servicios externos directamente.");
check(diagnostics.includes("startCentroDatosUI"), "Diagnóstico debe exponer startCentroDatosUI.");
check(diagnostics.includes("../centro-datos/centro-datos.ui.js"), "Diagnóstico debe cargar la UI final.");
check(menu.includes('etiqueta:"Centro de datos"'), "El menú superior debe mostrar Centro de datos.");
check(registry.includes('ruta:base+"/BDLocal/bl2.html"'), "La ruta compatible BDLocal/bl2.html debe conservarse.");

if (errors.length) {
  console.error("\nVERIFICACIÓN CENTRO DE DATOS: ERROR\n");
  errors.forEach((error, index) => console.error(`${index + 1}. ${error}`));
  process.exit(1);
}

console.log("VERIFICACIÓN CENTRO DE DATOS: OK");
