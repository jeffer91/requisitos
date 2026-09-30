"use strict";

/* =========================================================
Archivo: verify-installer-config.js
Ruta: /scripts/verify-installer-config.js
Función:
- Validar que Requisitos esté preparado para generar el instalador NSIS.
- Verificar identidad estable, icono, autoactualizador y publicación GitHub.
========================================================= */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const errors = [];

function check(condition, message){
  if(!condition){errors.push(message);}
}

function exists(relative){
  return fs.existsSync(path.join(root, relative));
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const build = pkg.build || {};
const win = build.win || {};
const nsis = build.nsis || {};
const publish = Array.isArray(build.publish) ? build.publish[0] || {} : build.publish || {};

check(pkg.productName === "Requisitos", "productName debe ser Requisitos.");
check(pkg.main === "electron/main-safe.js", "La entrada debe seguir siendo electron/main-safe.js.");
check(!!(pkg.dependencies && pkg.dependencies["electron-updater"]), "Falta electron-updater en dependencies.");
check(!!(pkg.devDependencies && pkg.devDependencies["electron-builder"]), "Falta electron-builder en devDependencies.");
check(build.appId === "ec.itsqmet.requisitos", "appId debe permanecer estable: ec.itsqmet.requisitos.");
check(build.productName === "Requisitos", "build.productName debe ser Requisitos.");
check(build.asar === true, "ASAR debe estar habilitado.");
check(win.icon === "electron/assets/icon.svg", "El icono de Windows debe ser electron/assets/icon.svg.");
check(Array.isArray(win.target) && win.target.some((item)=>item && item.target === "nsis"), "Windows debe generar un destino NSIS.");
check(nsis.deleteAppDataOnUninstall === false, "El desinstalador no debe borrar los datos locales.");
check(nsis.createDesktopShortcut === true, "Debe crearse acceso directo de escritorio.");
check(publish.provider === "github", "El proveedor de actualizaciones debe ser GitHub.");
check(publish.owner === "jeffer91" && publish.repo === "requisitos", "GitHub publish debe apuntar a jeffer91/requisitos.");

[
  "electron/updater.js",
  "electron/main-safe.js",
  "electron/main.js",
  "electron/preload.js",
  "electron/assets/icon.svg",
  ".github/workflows/release-windows.yml"
].forEach((file)=>check(exists(file), `Falta ${file}.`));

if(exists("electron/main-safe.js")){
  const source = fs.readFileSync(path.join(root, "electron/main-safe.js"), "utf8");
  check(source.includes('require("./updater")'), "main-safe.js no carga el actualizador.");
  check(source.includes('STABLE_USER_DATA_NAME="requisitos-desktop"'), "No está fijada la ruta histórica de userData.");
  check(source.includes("prepareUpdaterInstall"), "Falta protección de sincronización antes de actualizar.");
}

if(exists("electron/updater.js")){
  const source = fs.readFileSync(path.join(root, "electron/updater.js"), "utf8");
  check(source.includes("autoInstallOnAppQuit = false"), "El actualizador no debe instalar silenciosamente al cerrar.");
  check(source.includes("quitAndInstall(false, true)"), "Falta la instalación controlada de la actualización descargada.");
}

if(errors.length){
  console.error("\nVERIFICACIÓN DEL INSTALADOR: ERROR\n");
  errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
  process.exit(1);
}

console.log("VERIFICACIÓN DEL INSTALADOR: OK");
console.log(`Versión: ${pkg.version}`);
console.log("Destino: Windows x64 / NSIS");
console.log("Actualizaciones: GitHub Releases");
