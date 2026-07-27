"use strict";

/* =========================================================
Archivo: verify-external-connections.js
Ruta: /scripts/verify-external-connections.js
Función:
- Verificar la API oficial ConexionesExternas.
- Confirmar tres proveedores independientes y operación manual.
- Comprobar delegación segura, límite de lote y consumo no oficial.
- Rechazar acceso directo a la persistencia local desde el nuevo módulo.
========================================================= */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const errors = [];
const checks = [];
const calls = [];

const files = [
  "ConexionesExternas/core/conexiones.externas.contract.js",
  "ConexionesExternas/core/conexiones.externas.providers.js",
  "ConexionesExternas/usage/conexiones.externas.usage.js",
  "ConexionesExternas/providers/firebase/conexiones.externas.firebase.js",
  "ConexionesExternas/providers/supabase/conexiones.externas.supabase.js",
  "ConexionesExternas/providers/google-sheets/conexiones.externas.google-sheets.js",
  "ConexionesExternas/core/conexiones.externas.index.js"
];

function read(relative) {
  const target = path.join(ROOT, relative);
  if (!fs.existsSync(target)) {
    errors.push(`Falta el archivo: ${relative}`);
    return "";
  }
  return fs.readFileSync(target, "utf8");
}

function check(condition, message) {
  checks.push({ ok: Boolean(condition), message });
  if (!condition) errors.push(message);
}

class FakeCustomEvent {
  constructor(type, options) {
    this.type = type;
    this.detail = options && options.detail;
  }
}

const listeners = Object.create(null);
let paused = false;

const windowObject = {
  addEventListener(name, callback) {
    listeners[name] = listeners[name] || [];
    listeners[name].push(callback);
  },
  dispatchEvent(event) {
    (listeners[event.type] || []).slice().forEach((callback) => callback(event));
    return true;
  },
  BDLSyncTargets: {
    list: () => ["firebase", "google", "supabase"],
    get: (name) => ({ target: name, push: () => Promise.resolve({ ok: true }) })
  },
  BDLSyncOrchestrator: {
    syncTarget(target, options) {
      calls.push(["syncTarget", target, options]);
      return Promise.resolve({ ok: true, target, processedIds: ["1"] });
    }
  },
  BDLSyncV2: {
    status: () => Promise.resolve({ ok: true, manualOnly: true, running: false }),
    syncQueue(options) {
      calls.push(["syncQueue", options]);
      return Promise.resolve({ ok: true, results: [] });
    },
    pause(reason) { paused = true; calls.push(["pause", reason]); return reason; },
    resume() { paused = false; calls.push(["resume"]); return ""; },
    isPaused: () => paused,
    isRunning: () => false
  },
  BDLocalConfigStore: {
    getFirebaseQuotaStatus: () => ({ allowed: true, level: "ok", limit: 500, used: 12, remaining: 488, percent: 2 }),
    getSheetsConfig: () => ({ enabled: true, connected: true, status: "ok", spreadsheetId: "sheet-1", batchSize: 25, pendingCount: 2, lastSyncAt: "2026-07-27T00:00:00.000Z" }),
    getSupabaseConfig: () => ({ enabled: true, connected: true, status: "ok", url: "https://example.supabase.co", tableName: "app_records", lastSyncAt: "2026-07-27T00:00:00.000Z" })
  },
  RequisitosFirebaseRepository: {
    status: () => ({ reads: 4, writes: 2, queries: 1 })
  },
  RequisitosFirebaseControlCenter: {
    status: () => ({ bound: true, running: false, manualOnly: true }),
    refreshStatus: () => Promise.resolve({ sync: { running: false }, repository: { reads: 4 }, conflicts: [] }),
    pullPeriod(options) { calls.push(["firebasePull", options]); return Promise.resolve({ ok: true, downloaded: 1 }); },
    pullAllPeriods() { calls.push(["firebasePullAll"]); return Promise.resolve({ ok: true, downloaded: 3 }); }
  },
  BL2CloudPullSafe: {
    isPulling: () => false,
    pullSheetsToLocal(period, options) { calls.push(["googlePull", period, options]); return Promise.resolve({ ok: true, periodoId: period && period.id }); },
    pullAllSheetsToLocal(options) { calls.push(["googlePullAll", options]); return Promise.resolve({ ok: true, periodosProcesados: 2 }); }
  }
};
windowObject.window = windowObject;

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
  ["indexedDB", "window.BL2DB", "window.BL2Core", "window.BDLRepositories", "window.BDLRepo"].forEach((token) => {
    check(!source.includes(token), `${relative} no accede directamente a persistencia local: ${token}`);
  });
  try {
    new vm.Script(source, { filename: relative }).runInContext(context);
    check(true, `Sintaxis y carga ${relative}`);
  } catch (error) {
    check(false, `${relative}: ${error.message}`);
  }
}

async function main() {
  check(Boolean(windowObject.ConexionesExternasContract), "Expone ConexionesExternasContract");
  check(Boolean(windowObject.ConexionesExternasProviders), "Expone ConexionesExternasProviders");
  check(Boolean(windowObject.ConexionesExternasUsage), "Expone ConexionesExternasUsage");
  check(Boolean(windowObject.ConexionesExternasFirebase), "Expone proveedor Firebase");
  check(Boolean(windowObject.ConexionesExternasSupabase), "Expone proveedor Supabase");
  check(Boolean(windowObject.ConexionesExternasGoogleSheets), "Expone proveedor Google Sheets");
  check(Boolean(windowObject.ConexionesExternas), "Expone puerta principal ConexionesExternas");

  const providers = windowObject.ConexionesExternas.listProviders();
  check(providers.length === 3, "Registra exactamente tres proveedores externos");
  check(providers.map((item) => item.id).join(",") === "firebase,google,supabase", "Mantiene proveedores independientes y ordenados");

  const status = await windowObject.ConexionesExternas.status();
  check(status.manualOnly === true && status.automatic === false, "Conexiones externas opera únicamente de forma manual");
  check(status.maxBatchSize === 25, "El lote externo máximo es 25");

  const firebasePush = await windowObject.ConexionesExternas.push("firebase", { periodoId: "2026-04__2026-11", limit: 100 });
  check(firebasePush.ok === true, "Firebase delega la subida correctamente");
  const targetCall = calls.find((item) => item[0] === "syncTarget" && item[1] === "firebase");
  check(Boolean(targetCall), "La subida Firebase usa el orquestador existente");
  check(targetCall && targetCall[2].manual === true, "La subida Firebase fuerza solicitud manual");
  check(targetCall && targetCall[2].limit === 25, "La subida Firebase limita el lote a 25");

  const queue = await windowObject.ConexionesExternas.syncQueue({ periodoId: "2026-04__2026-11", limit: 80 });
  check(queue.ok === true, "La cola externa delega en BDLSyncV2");
  const queueCall = calls.find((item) => item[0] === "syncQueue");
  check(queueCall && queueCall[1].manual === true && queueCall[1].limit === 25, "La cola se ejecuta manualmente y con máximo 25");

  const googlePull = await windowObject.ConexionesExternas.pull("google", { periodoId: "2026-04__2026-11", periodoLabel: "Abril - Noviembre 2026" });
  check(googlePull.ok === true, "Google Sheets delega la descarga segura");
  check(calls.some((item) => item[0] === "googlePull" && item[1].id === "2026-04__2026-11"), "Google Sheets recibe el período seleccionado");

  const unsupported = await windowObject.ConexionesExternas.pull("supabase", {});
  check(unsupported.ok === false && unsupported.unsupported === true, "Supabase declara explícitamente la descarga no disponible");

  const firebaseUsage = windowObject.ConexionesExternas.usage("firebase");
  check(firebaseUsage.official === false, "La cuota Firebase no se presenta como oficial");
  check(firebaseUsage.source === "local_estimate", "Firebase identifica el consumo como estimación local");

  windowObject.ConexionesExternas.pause("Prueba");
  check(windowObject.ConexionesExternas.isPaused() === true, "La pausa se delega al motor existente");
  windowObject.ConexionesExternas.resume();
  check(windowObject.ConexionesExternas.isPaused() === false, "La reanudación se delega al motor existente");

  if (errors.length) {
    console.error("\nVERIFICACIÓN CONEXIONES EXTERNAS: ERROR\n");
    errors.forEach((error, index) => console.error(`${index + 1}. ${error}`));
    process.exit(1);
  }

  console.log(`VERIFICACIÓN CONEXIONES EXTERNAS: OK (${checks.length} comprobaciones)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
