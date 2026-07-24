"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const ARTIFACTS = path.join(ROOT, "artifacts");
const mode = String(process.argv[2] || "static").trim().toLowerCase();

const MODES = {
  static: {
    label: "npm test",
    command: "npm run test:core",
    latest: "resultado-npm-test.txt",
    prefix: "resultado-npm-test"
  },
  electron: {
    label: "npm run test:electron",
    command: "npm run test:electron:core",
    latest: "resultado-test-electron.txt",
    prefix: "resultado-test-electron"
  }
};

function timestamp(date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function stripAnsi(value) {
  return String(value || "").replace(/[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g, "");
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function writeReport(file, content) {
  fs.writeFileSync(file, content, "utf8");
}

const selected = MODES[mode];
if (!selected) {
  console.error(`Modo de prueba no reconocido: ${mode}`);
  console.error(`Modos disponibles: ${Object.keys(MODES).join(", ")}`);
  process.exit(2);
}

ensureDirectory(ARTIFACTS);

const startedAt = new Date();
const chunks = [];
const header = [
  "============================================================",
  `RESULTADO AUTOMÁTICO: ${selected.label}`,
  `Inicio: ${startedAt.toISOString()}`,
  `Ruta: ${ROOT}`,
  `Comando interno: ${selected.command}`,
  "============================================================",
  ""
].join("\n");

chunks.push(header);
process.stdout.write(header);

const child = spawn(selected.command, {
  cwd: ROOT,
  shell: true,
  env: process.env,
  windowsHide: true
});

function capture(data, stream) {
  const raw = data.toString();
  chunks.push(stripAnsi(raw));
  stream.write(raw);
}

child.stdout.on("data", (data) => capture(data, process.stdout));
child.stderr.on("data", (data) => capture(data, process.stderr));

child.on("error", (error) => {
  const message = `\nERROR AL INICIAR LA PRUEBA: ${error.message}\n`;
  chunks.push(message);
  process.stderr.write(message);
});

child.on("close", (code, signal) => {
  const finishedAt = new Date();
  const exitCode = Number.isInteger(code) ? code : 1;
  const footer = [
    "",
    "============================================================",
    `Fin: ${finishedAt.toISOString()}`,
    `Duración: ${Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000)} segundos`,
    `Código de salida: ${exitCode}`,
    `Señal: ${signal || "ninguna"}`,
    `Resultado: ${exitCode === 0 ? "APROBADO" : "ERROR"}`,
    "============================================================",
    ""
  ].join("\n");

  chunks.push(footer);
  process.stdout.write(footer);

  const report = chunks.join("");
  const latestPath = path.join(ARTIFACTS, selected.latest);
  const datedPath = path.join(
    ARTIFACTS,
    `${selected.prefix}-${timestamp(finishedAt)}.txt`
  );

  try {
    writeReport(latestPath, report);
    writeReport(datedPath, report);
    console.log(`Resultado TXT: ${latestPath}`);
    console.log(`Copia fechada: ${datedPath}`);
  } catch (error) {
    console.error(`No se pudo guardar el resultado TXT: ${error.message}`);
    process.exit(1);
    return;
  }

  process.exit(exitCode);
});
