/* =========================================================
Nombre completo: diagnostico-runtime.js
Ruta o ubicación: /scripts/diagnostico-runtime.js
Función o funciones:
- Inspeccionar la aplicación Electron mediante DevTools remoto.
- Abrir BL y observar BL2App, IndexedDB, conectores y consola.
- Registrar cada script JavaScript analizado por Chromium.
- Guardar un reporte aun cuando Runtime.evaluate deje de responder.
- No ejecutar sincronizaciones externas.
========================================================= */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

function argument(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => String(item).startsWith(prefix));
  return value ? String(value).slice(prefix.length) : fallback;
}

const port = Number(argument("port", "9322"));
const seconds = Math.max(10, Number(argument("seconds", "35")));
const output = path.resolve(argument("output", "artifacts/bdlocal-runtime.json"));
const endpoint = `http://127.0.0.1:${port}/json/list`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowISO() {
  return new Date().toISOString();
}

function uniqueLast(values, limit) {
  const seen = new Set();
  const result = [];

  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = String(values[index] || "").trim();
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.unshift(value);

    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

async function fetchTargets() {
  const response = await fetch(endpoint);

  if (!response.ok) {
    throw new Error(`DevTools respondió HTTP ${response.status}.`);
  }

  return response.json();
}

class CDPClient {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.nextId = 0;
    this.pending = new Map();
    this.events = [];
    this.scripts = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url);
      this.socket = socket;

      const timer = setTimeout(() => {
        reject(new Error("DevTools no aceptó la conexión WebSocket."));
      }, 10000);

      socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      });

      socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("Falló la conexión WebSocket con DevTools."));
      });

      socket.addEventListener("message", (event) => {
        let message;

        try {
          message = JSON.parse(String(event.data));
        } catch (error) {
          return;
        }

        if (message.id && this.pending.has(message.id)) {
          const pending = this.pending.get(message.id);
          this.pending.delete(message.id);
          clearTimeout(pending.timer);

          if (message.error) {
            pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
          } else {
            pending.resolve(message.result);
          }

          return;
        }

        if (message.method === "Debugger.scriptParsed") {
          const url = String(message.params && message.params.url || "").trim();
          if (url) {
            this.scripts.push(url);
          }
        }

        if (
          message.method === "Runtime.consoleAPICalled" ||
          message.method === "Runtime.exceptionThrown" ||
          message.method === "Log.entryAdded" ||
          message.method === "Inspector.targetCrashed"
        ) {
          this.events.push({
            at: nowISO(),
            method: message.method || "",
            params: message.params || null
          });

          if (this.events.length > 400) {
            this.events.shift();
          }
        }
      });
    });
  }

  send(method, params = {}, timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`DevTools no respondió a ${method} dentro de ${timeoutMs} ms.`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    try {
      if (this.socket) {
        this.socket.close();
      }
    } catch (error) {}
  }
}

const inspectExpression = String.raw`
(async () => {
  const text = (value) => String(value == null ? "" : value).trim();
  const frames = Array.from(document.querySelectorAll("iframe"));
  let frame = frames.find((node) => /[\\/]BDLocal[\\/]bl2\.html(?:$|[?#])/i.test(node.src || ""));

  if (!frame) {
    const button = Array.from(document.querySelectorAll("button,a,[role='button']"))
      .find((node) => text(node.textContent).toUpperCase() === "BL");

    if (button) {
      try { button.click(); } catch (error) {}
    }

    return {
      observedAt: new Date().toISOString(),
      bl: null,
      action: button ? "Se pulsó BL." : "No se encontró el botón BL.",
      top: {
        title: document.title,
        href: location.href,
        readyState: document.readyState
      },
      frames: frames.map((node) => ({ id: node.id || "", src: node.src || "" }))
    };
  }

  try {
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    let databases = [];

    try {
      if (win.indexedDB && typeof win.indexedDB.databases === "function") {
        databases = await win.indexedDB.databases();
      }
    } catch (error) {
      databases = [{ error: error.message }];
    }

    return {
      observedAt: new Date().toISOString(),
      top: {
        title: document.title,
        href: location.href,
        readyState: document.readyState
      },
      bl: {
        src: frame.src || "",
        title: doc ? doc.title : "",
        documentReadyState: doc ? doc.readyState : "",
        dbPill: doc && doc.getElementById("bl2-db-pill")
          ? text(doc.getElementById("bl2-db-pill").textContent)
          : "",
        viewStatus: doc && doc.getElementById("bl2-view-status")
          ? text(doc.getElementById("bl2-view-status").textContent)
          : "",
        state: win.BL2App && typeof win.BL2App.getState === "function"
          ? win.BL2App.getState()
          : null,
        connectors: win.BDLocalConexiones && typeof win.BDLocalConexiones.status === "function"
          ? win.BDLocalConexiones.status()
          : null,
        dbMeta: win.BL2DB && typeof win.BL2DB.meta === "function"
          ? win.BL2DB.meta()
          : null,
        loaderState: win.__BL2_LOADER_STATE || null,
        databases,
        logs: doc
          ? Array.from(doc.querySelectorAll("#bl2-log .bl2-log-item"))
              .slice(0, 40)
              .map((node) => text(node.innerText || node.textContent))
          : [],
        globals: {
          BL2App: !!win.BL2App,
          BL2DB: !!win.BL2DB,
          BL2Core: !!win.BL2Core,
          BL2Test: !!win.BL2Test,
          BDLocalConexiones: !!win.BDLocalConexiones,
          BDLSyncOutbox: !!win.BDLSyncOutbox,
          BDLSyncUIBridge: !!win.BDLSyncUIBridge,
          BDLocalConfigUI: !!win.BDLocalConfigUI
        }
      }
    };
  } catch (error) {
    return {
      observedAt: new Date().toISOString(),
      bl: null,
      error: error && (error.stack || error.message) || String(error)
    };
  }
})()
`;

async function main() {
  const report = {
    ok: false,
    generatedAt: nowISO(),
    endpoint,
    target: null,
    snapshots: [],
    events: [],
    parsedScripts: [],
    lastParsedScripts: [],
    evaluationFailure: ""
  };

  let client = null;

  try {
    const targets = await fetchTargets();
    const pages = targets.filter((item) => item.type === "page");
    const target =
      pages.find((item) => /maq-index\.html/i.test(item.url || "")) ||
      pages[0];

    if (!target || !target.webSocketDebuggerUrl) {
      throw new Error("No se encontró una página Electron inspeccionable.");
    }

    report.target = {
      id: target.id,
      title: target.title,
      url: target.url
    };

    client = new CDPClient(target.webSocketDebuggerUrl);
    await client.connect();
    await client.send("Runtime.enable");
    await client.send("Log.enable").catch(() => null);
    await client.send("Debugger.enable").catch(() => null);

    const iterations = Math.ceil(seconds / 2);

    for (let index = 0; index < iterations; index += 1) {
      try {
        const evaluated = await client.send(
          "Runtime.evaluate",
          {
            expression: inspectExpression,
            awaitPromise: true,
            returnByValue: true
          },
          6000
        );

        const snapshot = evaluated &&
          evaluated.result &&
          Object.prototype.hasOwnProperty.call(evaluated.result, "value")
            ? evaluated.result.value
            : {
                observedAt: nowISO(),
                evaluationError: evaluated && evaluated.exceptionDetails
                  ? evaluated.exceptionDetails
                  : evaluated
              };

        snapshot.lastParsedScripts = uniqueLast(client.scripts, 25);
        report.snapshots.push(snapshot);

        const bl = snapshot && snapshot.bl;
        const state = bl && bl.state;
        const loader = bl && bl.loaderState;

        console.log(
          `[${index + 1}/${iterations}] ` +
          `estado=${bl ? bl.dbPill : "sin-BL"} ` +
          `ready=${state ? state.ready : false} ` +
          `booting=${state ? state.booting : false} ` +
          `scripts=${state ? state.scriptsReady : false} ` +
          `actual=${loader && loader.current ? loader.current : ""}`
        );
      } catch (error) {
        report.evaluationFailure = error && error.message
          ? error.message
          : String(error);

        report.snapshots.push({
          observedAt: nowISO(),
          bl: null,
          evaluationTimeout: true,
          error: report.evaluationFailure,
          lastParsedScripts: uniqueLast(client.scripts, 40)
        });

        console.error(report.evaluationFailure);
        break;
      }

      await wait(2000);
    }

    report.ok = report.snapshots.length > 0;
  } catch (error) {
    report.error = error && (error.stack || error.message) || String(error);
    console.error(report.error);
  } finally {
    if (client) {
      report.events = client.events;
      report.parsedScripts = uniqueLast(client.scripts, 300);
      report.lastParsedScripts = uniqueLast(client.scripts, 50);
      client.close();
    }

    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2), "utf8");
  }

  if (!report.ok) {
    process.exitCode = 1;
  }
}

main();
