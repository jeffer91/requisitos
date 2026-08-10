/* =========================================================
Nombre completo: diagnostico-firebase-runtime.js
Ruta: /scripts/diagnostico-firebase-runtime.js
Función:
- Inspeccionar la aplicación Electron real mediante DevTools remoto.
- Leer BDLocal/IndexedDB sin escribir ni sincronizar.
- Comparar persona, contactos, matrícula, requisitos y cola Firebase.
- Detectar en qué capa se pierden correoPersonal, correoInstitucional y celular.
========================================================= */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

function argument(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => String(item).startsWith(prefix));
  return value ? String(value).slice(prefix.length) : fallback;
}

const port = Number(argument("port", "9333"));
const cedula = String(argument("cedula", "0102596566") || "").trim();
const output = path.resolve(argument("output", "artifacts/diagnostico-firebase.json"));
const endpoint = `http://127.0.0.1:${port}/json/list`;

function nowISO() {
  return new Date().toISOString();
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
  }

  connect() {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url);
      this.socket = socket;
      const timer = setTimeout(() => reject(new Error("DevTools no aceptó la conexión WebSocket.")), 10000);

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

        if (message.method === "Runtime.exceptionThrown" || message.method === "Log.entryAdded") {
          this.events.push({ at: nowISO(), method: message.method, params: message.params || null });
          if (this.events.length > 100) this.events.shift();
        }
      });
    });
  }

  send(method, params = {}, timeoutMs = 30000) {
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
    try { this.socket && this.socket.close(); } catch (error) {}
  }
}

function expressionFor(targetCedula) {
  const encodedCedula = JSON.stringify(targetCedula);
  return String.raw`
(async () => {
  const cedulaObjetivo = ${encodedCedula};
  const text = (value) => String(value == null ? "" : value).trim();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const normalizeCedula = (value) => text(value).replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  const rowCedula = (row) => normalizeCedula(row && (row.cedula || row.numeroIdentificacion || row.NumeroIdentificacion || row._cedula || ""));
  const clone = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch (error) { return value; }
  };
  const hasContact = (row) => !!row && !!(
    text(row.correoPersonal || row.CorreoPersonal) ||
    text(row.correoInstitucional || row.CorreoInstitucional) ||
    text(row.celular || row.Celular || row.telefono)
  );
  const contactView = (row) => row ? {
    correoPersonal: text(row.correoPersonal || row.CorreoPersonal),
    correoInstitucional: text(row.correoInstitucional || row.CorreoInstitucional),
    celular: text(row.celular || row.Celular || row.telefono),
    periodoId: text(row.periodoId || row.periodId),
    id: text(row.id || row.idEstudiantePeriodo || row.studentId),
    source: text(row.source || row.origen)
  } : null;

  if (window.MAQ_CORE && typeof window.MAQ_CORE.navigate === "function") {
    try { window.MAQ_CORE.navigate("carga_excel"); } catch (error) {}
  }

  let frame = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    frame = Array.from(document.querySelectorAll("iframe")).find((node) =>
      node.dataset && node.dataset.moduleId === "carga_excel" || /[\\/]Carga[\\/]carga\.html(?:$|[?#])/i.test(node.src || "")
    );
    if (frame && frame.contentWindow && frame.contentDocument && frame.contentDocument.readyState !== "loading") break;
    await sleep(250);
  }

  if (!frame || !frame.contentWindow) {
    return { ok:false, stage:"carga-frame", message:"No se pudo abrir la pantalla Carga." };
  }

  const win = frame.contentWindow;
  const doc = frame.contentDocument;

  for (let attempt = 0; attempt < 80 && !win.BDLocalConexiones; attempt += 1) {
    await sleep(250);
  }

  if (win.BDLocalConexiones && typeof win.BDLocalConexiones.ensureCoreReady === "function") {
    await win.BDLocalConexiones.ensureCoreReady();
  }

  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (win.BDLRepoPersonas && win.BDLRepoContactos && win.BDLRepoMatriculas && win.BDLRepoRequisitos) break;
    await sleep(250);
  }

  const select = doc && doc.getElementById("cargaPeriodoSelect");
  let periodoId = text(select && select.value);
  if (!periodoId) {
    try {
      const api = win.BDLPeriodoGlobal || win.RequisitosPeriodoGlobal;
      const globalValue = api && typeof api.get === "function" ? api.get() : null;
      periodoId = text(globalValue && (globalValue.id || globalValue.periodoId || globalValue.value));
    } catch (error) {}
  }

  const persona = win.BDLRepoPersonas && typeof win.BDLRepoPersonas.getByCedula === "function"
    ? await win.BDLRepoPersonas.getByCedula(cedulaObjetivo)
    : null;

  const contactos = win.BDLRepoContactos && typeof win.BDLRepoContactos.list === "function"
    ? await win.BDLRepoContactos.list({ periodoId, cedula:cedulaObjetivo })
    : [];

  const matricula = win.BDLRepoMatriculas && typeof win.BDLRepoMatriculas.getByPeriodoCedula === "function"
    ? await win.BDLRepoMatriculas.getByPeriodoCedula(periodoId, cedulaObjetivo)
    : null;

  const requisitos = win.BDLRepoRequisitos && typeof win.BDLRepoRequisitos.list === "function"
    ? await win.BDLRepoRequisitos.list({ periodoId, cedula:cedulaObjetivo })
    : [];

  const rawStores = {};
  const db = win.BL2DB;
  const storesToRead = ["personas","contactos","contactos_estudiante","estudiantes","matriculas_periodo","requisitos_estudiante","cambios_pendientes"];
  if (db && typeof db.getAll === "function") {
    for (const storeName of storesToRead) {
      try {
        const rows = await db.getAll(storeName);
        rawStores[storeName] = (Array.isArray(rows) ? rows : [])
          .filter((row) => rowCedula(row) === normalizeCedula(cedulaObjetivo))
          .slice(0, 30)
          .map(clone);
      } catch (error) {
        rawStores[storeName] = { error:error && error.message ? error.message : String(error) };
      }
    }
  }

  let queue = [];
  try {
    const repo = win.BDLRepositories && typeof win.BDLRepositories.get === "function"
      ? (win.BDLRepositories.get("cambios_pendientes") || win.BDLRepositories.get("cambios"))
      : null;
    if (repo && typeof repo.list === "function") {
      queue = await repo.list({ periodoId, includeLegacy:false, force:true });
    }
  } catch (error) {}

  const queueTypes = (Array.isArray(queue) ? queue : []).reduce((acc, row) => {
    const key = text(row.tabla || row.tipo || row.table || "SIN_TIPO");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const queueForStudent = (Array.isArray(queue) ? queue : [])
    .filter((row) => rowCedula(row) === normalizeCedula(cedulaObjetivo))
    .map((row) => ({
      id:text(row.id || row.cambioId),
      tabla:text(row.tabla || row.tipo),
      estadoFirebase:text(row.estadoFirebase || row.statusFirebase),
      ultimoErrorFirebase:text(row.ultimoErrorFirebase),
      payloadContact:contactView(row.payload || row.data || row.registro || {})
    }));

  const firstContact = Array.isArray(contactos) && contactos.length ? contactos[0] : null;
  const personaContact = contactView(persona);
  const repoContact = contactView(firstContact);
  const rawLegacyContacts = Array.isArray(rawStores.contactos) ? rawStores.contactos.map(contactView) : rawStores.contactos;
  const rawV2Contacts = Array.isArray(rawStores.contactos_estudiante) ? rawStores.contactos_estudiante.map(contactView) : rawStores.contactos_estudiante;

  let diagnosis = "";
  if (hasContact(firstContact)) {
    diagnosis = "CONTACTO_OK_EN_REPOSITORIO";
  } else if (Array.isArray(rawStores.contactos) && rawStores.contactos.some(hasContact)) {
    diagnosis = "CONTACTO_EN_LEGACY_PERO_NO_EN_REPOSITORIO";
  } else if (Array.isArray(rawStores.contactos_estudiante) && rawStores.contactos_estudiante.some(hasContact)) {
    diagnosis = "CONTACTO_EN_V2_PERO_NO_EN_REPOSITORIO";
  } else if (hasContact(persona)) {
    diagnosis = "CONTACTO_SOLO_EN_PERSONA";
  } else {
    diagnosis = "CONTACTO_NO_EXISTE_EN_BDLOCAL";
  }

  return {
    ok:true,
    observedAt:new Date().toISOString(),
    cedula:cedulaObjetivo,
    periodoId,
    globals:{
      BDLRepoPersonas:!!win.BDLRepoPersonas,
      BDLRepoContactos:!!win.BDLRepoContactos,
      BDLRepoMatriculas:!!win.BDLRepoMatriculas,
      BDLRepoRequisitos:!!win.BDLRepoRequisitos,
      BL2DB:!!win.BL2DB,
      BDLRepositories:!!win.BDLRepositories
    },
    persona:clone(persona),
    personaContact,
    contactos:(Array.isArray(contactos) ? contactos : []).map(clone),
    contactoNormalizado:repoContact,
    matricula:clone(matricula),
    requisitosEncontrados:Array.isArray(requisitos) ? requisitos.length : 0,
    raw:{
      contactos:rawLegacyContacts,
      contactosEstudiante:rawV2Contacts,
      personas:Array.isArray(rawStores.personas) ? rawStores.personas.map(clone) : rawStores.personas,
      estudiantes:Array.isArray(rawStores.estudiantes) ? rawStores.estudiantes.map(clone) : rawStores.estudiantes
    },
    cola:{
      total:Array.isArray(queue) ? queue.length : 0,
      tipos:queueTypes,
      estudiante:queueForStudent
    },
    diagnostico:diagnosis
  };
})()
`;
}

async function main() {
  const report = {
    ok:false,
    generatedAt:nowISO(),
    cedula,
    endpoint,
    result:null,
    events:[]
  };
  let client = null;

  try {
    const targets = await fetchTargets();
    const pages = targets.filter((item) => item.type === "page");
    const target = pages.find((item) => /maq-index\.html/i.test(item.url || "")) || pages[0];
    if (!target || !target.webSocketDebuggerUrl) {
      throw new Error("No se encontró una página Electron inspeccionable.");
    }

    client = new CDPClient(target.webSocketDebuggerUrl);
    await client.connect();
    await client.send("Runtime.enable");
    await client.send("Log.enable").catch(() => null);

    const evaluated = await client.send("Runtime.evaluate", {
      expression:expressionFor(cedula),
      awaitPromise:true,
      returnByValue:true
    }, 60000);

    if (evaluated && evaluated.exceptionDetails) {
      throw new Error(evaluated.exceptionDetails.text || "Runtime.evaluate falló.");
    }

    report.result = evaluated && evaluated.result ? evaluated.result.value : null;
    report.ok = !!(report.result && report.result.ok);
  } catch (error) {
    report.error = error && (error.stack || error.message) || String(error);
  } finally {
    if (client) {
      report.events = client.events;
      client.close();
    }
    fs.mkdirSync(path.dirname(output), { recursive:true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2), "utf8");
  }

  if (!report.ok) {
    process.exitCode = 1;
  }
}

main();
