"use strict";

/* =========================================================
Archivo: verify-base-local-pantallas.js
Ruta: /scripts/verify-base-local-pantallas.js
Función:
- Verificar la nueva API interna BDLocalPantallas.
- Confirmar compatibilidad con BDLocal/conexiones.
- Impedir dependencias de red o acceso directo a IndexedDB.
========================================================= */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const files = [
  "BDLocal/pantallas/bdl.pantallas.contract.js",
  "BDLocal/pantallas/bdl.pantallas.registry.js",
  "BDLocal/pantallas/bdl.pantallas.client.js",
  "BDLocal/pantallas/bdl.pantallas.monitor.js",
  "BDLocal/pantallas/bdl.pantallas.index.js"
];
const errors = [];
const checks = [];

function check(condition, message) {
  checks.push({ ok: Boolean(condition), message });
  if (!condition) errors.push(message);
}

function read(relative) {
  const target = path.join(ROOT, relative);
  check(fs.existsSync(target), `Existe ${relative}`);
  if (!fs.existsSync(target)) return "";
  const content = fs.readFileSync(target, "utf8");
  check(content.trim().length > 0, `No vacío ${relative}`);
  return content;
}

class FakeCustomEvent {
  constructor(type, options) {
    this.type = type;
    this.detail = options && options.detail ? options.detail : {};
  }
}

const listeners = Object.create(null);
const calls = [];
const definitions = [
  { id: "carga", label: "Carga", global: "ConCarga", file: "cone.carga.js" },
  { id: "ficha", label: "Ficha", global: "ConFicha", file: "cone.ficha.js" }
];

const windowObject = {
  addEventListener(name, callback) {
    listeners[name] = listeners[name] || [];
    listeners[name].push(callback);
  },
  dispatchEvent(event) {
    (listeners[event.type] || []).slice().forEach((callback) => callback(event));
    return true;
  }
};

windowObject.BDLocalConeContract = {
  version: "legacy-contract",
  EVENTS: {
    READY: "bdlocal:connections:ready",
    UPDATED: "bdlocal:connections:updated",
    ERROR: "bdlocal:connections:error",
    SCREEN_READY: "bdlocal:connections:screen-ready",
    MONITOR_UPDATED: "bdlocal:connections:monitor-updated"
  },
  OPERATIONS: { READ: "read", SAVE: "save" },
  STATES: { OK: "ok", ERROR: "error" },
  TABLES: { PERIODS: "periodos" },
  text: (value) => String(value == null ? "" : value).trim(),
  nowISO: () => new Date().toISOString(),
  array: (value) => Array.isArray(value) ? value : [],
  object: (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {},
  clone: (value) => JSON.parse(JSON.stringify(value)),
  makeId: () => "id",
  normalizeScreen: (value) => String(value || "").toLowerCase(),
  normalizeError: (error) => ({ message: error && error.message ? error.message : String(error || "") }),
  countData: () => ({}),
  success: (options) => Object.assign({ ok: true }, options || {}),
  failure: (options) => Object.assign({ ok: false }, options || {}),
  normalize: (value) => value,
  dispatch(name, detail) {
    return windowObject.dispatchEvent(new FakeCustomEvent(name, { detail }));
  }
};

windowObject.BDLocalConeRegistry = {
  register(name, definition) {
    definitions.push(Object.assign({ id: name }, definition || {}));
    return definition;
  },
  get(name) {
    return definitions.find((item) => item.id === name) || null;
  },
  list() {
    return definitions.slice();
  },
  resolve(name) {
    const item = this.get(name);
    return item ? windowObject[item.global] || { id: item.id } : null;
  },
  detect(fallback) {
    return fallback || "carga";
  },
  status() {
    return { ok: true, total: definitions.length, loaded: definitions.length, missing: [] };
  }
};

windowObject.BDLocalConnectionClient = {
  ready(screen) { calls.push(["ready", screen]); return Promise.resolve({ ok: true, screen }); },
  read(screen, filters) { calls.push(["read", screen, filters]); return Promise.resolve({ ok: true, screen, data: { rows: [] } }); },
  refresh(screen, options) { calls.push(["refresh", screen, options]); return Promise.resolve({ ok: true }); },
  invoke(screen, operation, payload) { calls.push(["invoke", screen, operation, payload]); return Promise.resolve({ ok: true }); },
  save(screen, payload) { calls.push(["save", screen, payload]); return Promise.resolve({ ok: true }); },
  update(screen, payload) { calls.push(["update", screen, payload]); return Promise.resolve({ ok: true }); },
  remove(screen, payload) { calls.push(["remove", screen, payload]); return Promise.resolve({ ok: true }); },
  diagnose(screen) { return Promise.resolve({ ok: true, screen }); },
  status(screen) { return { ok: true, screen: screen || "" }; },
  connector(screen) { return { id: screen }; },
  screen() { return "carga"; },
  setScreen(screen) { return screen; },
  listScreens() { return definitions.slice(); },
  onUpdated() { return function unsubscribe() {}; }
};

windowObject.BDLocalConnectionMonitor = {
  mount() { return true; },
  run() { return Promise.resolve({ ok: true, screens: [] }); },
  diagnoseScreen(screen) { return Promise.resolve({ ok: true, screen }); },
  render(report) { return report; },
  copyReport() { return Promise.resolve(true); },
  downloadReport() { return true; },
  getReport() { return { ok: true, screens: [] }; },
  status() { return { ok: true, running: false, mounted: false }; }
};

windowObject.BDLocalConexiones = {
  ready() { return Promise.resolve({ ok: true }); },
  status() { return { ok: true, ready: true, connectors: ["carga", "ficha"] }; },
  metrics() { return { requested: 1, executed: 1, failures: 0 }; }
};

const context = vm.createContext({
  window: windowObject,
  CustomEvent: FakeCustomEvent,
  Promise,
  Object,
  Array,
  Date,
  Error,
  String,
  Number,
  Boolean,
  JSON,
  Math,
  console
});

for (const relative of files) {
  const source = read(relative);
  if (!source) continue;
  ["indexedDB", "fetch(", "firebase", "supabase", "google sheets"].forEach((token) => {
    check(!source.toLowerCase().includes(token.toLowerCase()), `${relative} no contiene dependencia externa: ${token}`);
  });
  try {
    new vm.Script(source, { filename: relative }).runInContext(context);
    check(true, `Sintaxis y carga ${relative}`);
  } catch (error) {
    check(false, `${relative}: ${error.message}`);
  }
}

async function main() {
  check(Boolean(windowObject.BDLocalPantallasContract), "Expone BDLocalPantallasContract");
  check(Boolean(windowObject.BDLocalPantallasRegistry), "Expone BDLocalPantallasRegistry");
  check(Boolean(windowObject.BDLocalPantallasClient), "Expone BDLocalPantallasClient");
  check(Boolean(windowObject.BDLocalPantallasMonitor), "Expone BDLocalPantallasMonitor");
  check(Boolean(windowObject.BDLocalPantallas), "Expone BDLocalPantallas");

  const status = windowObject.BDLocalPantallas.status("carga");
  check(status.ok === true, "BDLocalPantallas reporta estado correcto");
  check(status.offlineCapable === true, "BDLocalPantallas declara operación sin internet");
  check(status.externalConnections === false, "BDLocalPantallas excluye conexiones externas");
  check(status.legacyPathActive === true, "BDLocalPantallas conserva compatibilidad temporal");
  check(status.totalScreens === 2, "BDLocalPantallas conserva el inventario de pantallas");

  await windowObject.BDLocalPantallas.ready("carga");
  await windowObject.BDLocalPantallas.read("carga", { periodoId: "2026" });
  await windowObject.BDLocalPantallas.save("carga", { id: "1" });
  const diagnostics = await windowObject.BDLocalPantallas.runDiagnostics({ screens: ["carga"] });

  check(calls.some((item) => item[0] === "ready" && item[1] === "carga"), "Ready delega en el cliente existente");
  check(calls.some((item) => item[0] === "read" && item[1] === "carga"), "Read delega en el cliente existente");
  check(calls.some((item) => item[0] === "save" && item[1] === "carga"), "Save delega en el cliente existente");
  check(diagnostics.ok === true, "El diagnóstico interno se ejecuta mediante el monitor existente");

  if (errors.length) {
    console.error("\nVERIFICACIÓN BASE LOCAL / PANTALLAS: ERROR\n");
    errors.forEach((error, index) => console.error(`${index + 1}. ${error}`));
    process.exit(1);
  }

  console.log(`VERIFICACIÓN BASE LOCAL / PANTALLAS: OK (${checks.length} comprobaciones)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
