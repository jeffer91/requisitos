"use strict";

/* =========================================================
Archivo: verify-main-menu.js
Ruta: /scripts/verify-main-menu.js
Función:
- Verificar que el menú superior use una sola entrada Centro de datos.
- Confirmar que la ruta compatible continúe siendo BDLocal/bl2.html.
- Excluir el grupo antiguo Títulos y validar sintaxis.
========================================================= */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const files = [
  "Maqueta/maq-config-service.js",
  "Maqueta/maq-modulos-registry.js",
  "Maqueta/maq-menu.js"
];
const forbidden = [
  "titulos_estudiante",
  "titulos_admin",
  "titulos_coordinador",
  'tipo:"grupo",id:"titulos"',
  'etiqueta:"Titulos"',
  'etiqueta:"Títulos"'
];
const errors = [];
const sources = {};

for (const relative of files) {
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) {
    errors.push(`Falta el archivo ${relative}`);
    continue;
  }

  const source = fs.readFileSync(target, "utf8");
  sources[relative] = source;
  if (relative !== "Maqueta/maq-modulos-registry.js") {
    for (const token of forbidden) {
      if (source.includes(token)) {
        errors.push(`${relative} todavía contiene ${token}`);
      }
    }
  }

  try {
    new vm.Script(source, { filename: relative });
  } catch (error) {
    errors.push(`${relative}: ${error.message}`);
  }
}

const config = sources["Maqueta/maq-config-service.js"] || "";
const registry = sources["Maqueta/maq-modulos-registry.js"] || "";

if (!config.includes('moduloId:"baselocal",etiqueta:"Centro de datos"')) {
  errors.push("El menú superior debe contener una sola entrada Centro de datos para baselocal.");
}
if ((config.match(/moduloId:"baselocal"/g) || []).length !== 1) {
  errors.push("baselocal debe aparecer exactamente una vez en el menú superior.");
}
if (!registry.includes('baselocal:{id:"baselocal",nombre:"Centro de datos",ruta:base+"/BDLocal/bl2.html"')) {
  errors.push("El registro baselocal debe conservar BDLocal/bl2.html y llamarse Centro de datos.");
}
if (!registry.includes('"centro de datos":"baselocal"')) {
  errors.push("Falta el alias Centro de datos para baselocal.");
}

if (errors.length) {
  console.error("\nVERIFICACIÓN DEL MENÚ: ERROR\n");
  errors.forEach((error, index) => console.error(`${index + 1}. ${error}`));
  process.exit(1);
}

console.log("VERIFICACIÓN DEL MENÚ: OK");
