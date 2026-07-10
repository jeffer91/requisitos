/* =========================================================
Nombre completo: smoke-main.js
Ruta o ubicación: /electron/smoke-main.js
Función o funciones:
- Abrir BDLocal en una ventana Electron oculta y aislada.
- Usar una carpeta temporal diferente a la base real del usuario.
- Esperar el arranque de módulos, conectores e IndexedDB con tiempos máximos.
- Ejecutar BL2Test en modo de solo lectura y sin red.
- Guardar siempre un reporte JSON, incluso ante bloqueo o tiempo agotado.
- Usar la firma moderna del evento console-message de Electron.
========================================================= */
"use strict";

const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const ENTRY = path.join(ROOT, "BDLocal", "bl2.html");
const OUTPUT_DIR = path.join(ROOT, "artifacts");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "bdlocal-electron-smoke.json");
const USER_DATA = path.join(os.tmpdir(), "requisitos-bdlocal-smoke-" + process.pid);

const READY_TIMEOUT_MS = 45000;
const TEST_TIMEOUT_MS = 20000;
const HARD_TIMEOUT_MS = 75000;

let smokeWindow = null;
let finished = false;
let exitCode = 1;
let watchdog = null;
const rendererMessages = [];

function nowISO() {
  return new Date().toISOString();
}

function writeReport(report) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2), "utf8");
}

function finish(report, code) {
  if (finished) {
    return;
  }

  finished = true;
  exitCode = Number.isFinite(Number(code)) ? Number(code) : 1;

  if (watchdog) {
    clearTimeout(watchdog);
    watchdog = null;
  }

  const output = Object.assign({}, report || {}, {
    rendererMessages: rendererMessages.slice(-200)
  });

  try {
    writeReport(output);
  } catch (error) {
    console.error("[Electron Smoke] No se pudo guardar reporte:", error);
    exitCode = 1;
  }

  console.log("[Electron Smoke]", JSON.stringify(output));

  try {
    if (smokeWindow && !smokeWindow.isDestroyed()) {
      smokeWindow.destroy();
    }
  } catch (error) {}

  setImmediate(() => app.exit(exitCode));
}

function failure(message, error, extra) {
  finish(Object.assign({
    ok: false,
    smoke: true,
    isolated: true,
    readOnly: true,
    network: false,
    generatedAt: nowISO(),
    message: message,
    error: error && (error.stack || error.message) || String(error || "")
  }, extra || {}), 1);
}

function runnerScript(readyTimeout, testTimeout) {
  return `new Promise((resolve) => {
    const started = Date.now();
    let settled = false;

    function done(value) {
      if (settled) return;
      settled = true;
      resolve(value);
    }

    function snapshot() {
      try {
        const appState = window.BL2App && window.BL2App.getState
          ? window.BL2App.getState()
          : {};
        const connectors = window.BDLocalConexiones && window.BDLocalConexiones.status
          ? window.BDLocalConexiones.status()
          : {};
        const dbMeta = window.BL2DB && window.BL2DB.meta
          ? window.BL2DB.meta()
          : {};
        const pill = document.getElementById("bl2-db-pill");
        const view = document.getElementById("bl2-view-status");
        const logs = Array.from(document.querySelectorAll("#bl2-log .bl2-log-item"))
          .slice(0, 40)
          .map((node) => String(node.innerText || node.textContent || "").trim());

        return {
          appState,
          connectors,
          dbMeta,
          dbPill: pill ? String(pill.textContent || "").trim() : "",
          viewStatus: view ? String(view.textContent || "").trim() : "",
          logs,
          globals: {
            BL2Test: !!window.BL2Test,
            BL2App: !!window.BL2App,
            BL2DB: !!window.BL2DB,
            BL2Core: !!window.BL2Core,
            BDLocalConexiones: !!window.BDLocalConexiones
          }
        };
      } catch (error) {
        return {
          snapshotError: error && (error.stack || error.message) || String(error)
        };
      }
    }

    function runTest(current) {
      let testSettled = false;
      const timer = setTimeout(() => {
        if (testSettled) return;
        testSettled = true;
        done({
          ready: true,
          testTimeout: true,
          message: "BL2Test.run excedió el tiempo máximo.",
          snapshot: snapshot(),
          initial: current
        });
      }, ${Number(testTimeout)});

      Promise.resolve()
        .then(() => window.BL2Test.run({ log: false }))
        .then((report) => {
          if (testSettled) return;
          testSettled = true;
          clearTimeout(timer);
          done({
            ready: true,
            report,
            snapshot: snapshot(),
            initial: current
          });
        })
        .catch((error) => {
          if (testSettled) return;
          testSettled = true;
          clearTimeout(timer);
          done({
            ready: true,
            testError: error && (error.stack || error.message) || String(error),
            snapshot: snapshot(),
            initial: current
          });
        });
    }

    function tick() {
      const current = snapshot();
      const appState = current.appState || {};
      const connectors = current.connectors || {};
      const ready = !!(
        current.globals &&
        current.globals.BL2Test &&
        appState.ready &&
        appState.scriptsReady &&
        connectors.ready
      );

      if (ready) {
        runTest(current);
        return;
      }

      if (Date.now() - started >= ${Number(readyTimeout)}) {
        done({
          ready: false,
          readinessTimeout: true,
          message: "BDLocal no alcanzó estado listo dentro del tiempo máximo.",
          snapshot: current
        });
        return;
      }

      setTimeout(tick, 250);
    }

    tick();
  })`;
}

async function run() {
  if (!fs.existsSync(ENTRY)) {
    throw new Error("No existe BDLocal/bl2.html.");
  }

  app.setPath("userData", USER_DATA);

  watchdog = setTimeout(() => {
    failure(
      "El smoke test completo excedió el tiempo máximo.",
      new Error("HARD_TIMEOUT"),
      { hardTimeout: true }
    );
  }, HARD_TIMEOUT_MS);

  smokeWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: "#ffffff",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
      spellcheck: false
    }
  });

  smokeWindow.webContents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false)
  );
  smokeWindow.webContents.on("will-attach-webview", (event) => event.preventDefault());
  smokeWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  smokeWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== smokeWindow.webContents.getURL()) {
      event.preventDefault();
    }
  });

  smokeWindow.webContents.on("console-message", (_event, details) => {
    const level = Number(details && details.level || 0);
    const message = String(details && details.message || "");
    const line = Number(details && details.lineNumber || 0);
    const sourceId = String(details && details.sourceId || "");
    const row = { at: nowISO(), level, message, line, sourceId };
    rendererMessages.push(row);

    if (rendererMessages.length > 300) {
      rendererMessages.shift();
    }

    if (level >= 2) {
      console.error("[Renderer]", message, "@", sourceId + ":" + line);
    } else {
      console.log("[Renderer]", message);
    }
  });

  smokeWindow.webContents.on("render-process-gone", (_event, details) => {
    failure(
      "El renderer terminó inesperadamente.",
      new Error(JSON.stringify(details)),
      { renderProcessGone: details }
    );
  });

  smokeWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (isMainFrame) {
        failure(
          "BDLocal no pudo cargar en Electron.",
          new Error(errorDescription),
          { errorCode, validatedURL }
        );
      }
    }
  );

  await smokeWindow.loadFile(ENTRY);

  const result = await smokeWindow.webContents.executeJavaScript(
    runnerScript(READY_TIMEOUT_MS, TEST_TIMEOUT_MS),
    true
  );

  const report = result && result.report || null;
  const output = {
    ok: !!(
      result &&
      result.ready &&
      report &&
      report.ok &&
      !result.testTimeout &&
      !result.testError
    ),
    smoke: true,
    isolated: true,
    readOnly: true,
    network: false,
    generatedAt: nowISO(),
    entry: "BDLocal/bl2.html",
    userDataTemporary: true,
    timeouts: {
      readyMs: READY_TIMEOUT_MS,
      testMs: TEST_TIMEOUT_MS,
      hardMs: HARD_TIMEOUT_MS
    },
    result: result
  };

  finish(output, output.ok ? 0 : 1);
}

app.whenReady().then(run).catch((error) => {
  failure("No se pudo ejecutar la prueba Electron.", error);
});

app.on("window-all-closed", () => {
  if (!finished) {
    failure(
      "La ventana se cerró antes de terminar.",
      new Error("window-all-closed")
    );
  }
});

process.on("uncaughtException", (error) => {
  failure("Excepción no controlada.", error);
});

process.on("unhandledRejection", (error) => {
  failure("Promesa rechazada sin control.", error);
});

process.on("exit", () => {
  try {
    fs.rmSync(USER_DATA, { recursive: true, force: true });
  } catch (error) {}

  process.exitCode = exitCode;
});
