"use strict";

/* =========================================================
Archivo: verify-main-menu.js
Ruta: /scripts/verify-main-menu.js
Función:
- Verificar que el menú superior no incluya el grupo antiguo Títulos.
- Revisar la configuración efectiva y el menú de respaldo.
- Validar la sintaxis de ambos archivos.
========================================================= */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const files = [
  "Maqueta/maq-config-service.js",
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

for (const relative of files) {
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) {
    errors.push(`Falta el archivo ${relative}`);
    continue;
  }

  const source = fs.readFileSync(target, "utf8");
  for (const token of forbidden) {
    if (source.includes(token)) {
      errors.push(`${relative} todavía contiene ${token}`);
    }
  }

  try {
    new vm.Script(source, { filename: relative });
  } catch (error) {
    errors.push(`${relative}: ${error.message}`);
  }
}

if (errors.length) {
  console.error("\nVERIFICACIÓN DEL MENÚ: ERROR\n");
  errors.forEach((error, index) => console.error(`${index + 1}. ${error}`));
  process.exit(1);
}

console.log("VERIFICACIÓN DEL MENÚ: OK");
