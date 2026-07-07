/************************************************************
 * REQUISITOS_BDLOCAL_SYNC - APPS SCRIPT MULTI-TABLA ROBUSTO
 * Versión: 2.2.0-pull-compact
 *
 * Acciones soportadas:
 * - ping
 * - sync_bl2
 * - pull_bl2 / export_bl2 / get_bl2 / read_bl2 / traer_bl2
 * - compact_bl2 / limpiar_duplicados / dedupe_bl2
 * - ensure_schema
 ************************************************************/

const APP_NAME = "requisitos";
const APP_VERSION = "2.2.0-pull-compact";
const MAX_CELL_CHARS = 45000;
const WRITE_BATCH_SIZE = 500;

const SHEET_SCHEMA = {
  Config: ["clave", "valor", "descripcion"],
  Periodos: ["fechaRegistro", "periodoId", "periodoLabel", "mesInicio", "anioInicio", "mesFin", "anioFin", "estado", "payloadJson"],
  Carreras: ["fechaRegistro", "CodigoCarrera", "NombreCarrera", "estado", "updatedAt", "payloadJson"],
  PeriodosCarreras: ["fechaRegistro", "id", "periodoId", "CodigoCarrera", "NombreCarrera", "estado", "payloadJson"],
  PeriodosDivisiones: ["fechaRegistro", "id", "periodoId", "division", "estado", "totalEstudiantes", "payloadJson"],
  Estudiantes: ["fechaRegistro", "cedula", "numeroIdentificacion", "Nombres", "CorreoInstitucional", "CorreoPersonal", "Celular", "createdAt", "updatedAt", "payloadJson"],
  MatriculasPeriodo: ["fechaRegistro", "id", "periodoId", "periodoLabel", "cedula", "CodigoCarrera", "NombreCarrera", "Sede", "HorarioComplexivo", "estadoMatricula", "division", "ultimoPeriodoId", "retiradoEn", "ultimaEdicionLocal", "ultimaSincronizacion", "forceUploadedAt", "updatedAt", "payloadJson"],
  Requisitos: ["fechaRegistro", "id", "periodoId", "cedula", "requisitoKey", "requisitoNombre", "estado", "origen", "updatedAt", "payloadJson"],
  Notas: ["fechaRegistro", "id", "periodoId", "cedula", "Notart", "Notdef", "Notafinal", "fechaRegistroNotas", "origen", "updatedAt", "payloadJson"],
  DivisionesEstudiantes: ["fechaRegistro", "id", "periodoId", "cedula", "division", "esActual", "divisionActualizadaEn", "payloadJson"],
  Cambios: ["fechaRegistro", "origen", "tipo", "accion", "periodoId", "cedula", "estadoSync", "payloadJson"],
  Log: ["fechaRegistro", "origen", "nivel", "mensaje", "payloadJson"]
};

const REQUISITO_KEYS = [
  "Academico", "Académico", "ActualizaciónDatos", "ActualizacionDatos",
  "AprobacionComplexivoProyecto", "AprobaciónComplexivoProyecto",
  "AprobacionTitulacion", "AprobaciónTitulacion", "Documentacion", "Documentación",
  "Financiero", "Ingles", "Inglés", "PracticasVinculacion", "PrácticasVinculacion",
  "SeguimientoGraduados", "Titulacion", "Titulación", "Vinculacion", "Vinculación"
];

const COMPACT_KEY_COLUMNS = {
  Periodos: 2,
  Carreras: 2,
  PeriodosCarreras: 2,
  PeriodosDivisiones: 2,
  Estudiantes: 2,
  MatriculasPeriodo: 2,
  Requisitos: 2,
  Notas: 2,
  DivisionesEstudiantes: 2
};

const PERIOD_FILTERED_SHEETS = {
  Periodos: true,
  PeriodosCarreras: true,
  PeriodosDivisiones: true,
  MatriculasPeriodo: true,
  Requisitos: true,
  Notas: true,
  DivisionesEstudiantes: true
};

function doGet(e) {
  return json_({
    ok: true,
    app: APP_NAME,
    version: APP_VERSION,
    message: "Apps Script BDLocal activo.",
    supportedActions: ["ping", "sync_bl2", "pull_bl2", "export_bl2", "get_bl2", "read_bl2", "compact_bl2", "ensure_schema"],
    at: now_()
  });
}

function doPost(e) {
  let body = {};
  let ss = null;
  let lock = null;

  try {
    body = parseBody_(e);
    const action = normalizeAction_(body.action || body.accion || body.tipoAccion);
    ss = getSpreadsheet_(body);

    lock = LockService.getScriptLock();
    if (!lock.tryLock(25000)) {
      return json_({ ok: false, error: "SCRIPT_OCUPADO", message: "Google Sheets está ocupado con otra sincronización. Intenta nuevamente en unos segundos.", at: now_() });
    }

    if (action === "ping" || action === "test" || action === "probar") return handlePing_(ss, body);
    if (action === "sync_bl2" || action === "sync" || action === "sincronizar") return handleSyncBL2_(ss, body);
    if (["pull_bl2", "export_bl2", "get_bl2", "read_bl2", "traer_bl2"].indexOf(action) >= 0) return handlePullBL2_(ss, body);
    if (["compact_bl2", "limpiar_duplicados", "dedupe_bl2", "compactar_bl2"].indexOf(action) >= 0) return handleCompactBL2_(ss, body);

    if (action === "ensure_schema" || action === "preparar_estructura") {
      validarToken_(ss, body.token);
      ensureAllSheets_(ss);
      log_(ss, "Apps Script", "OK", "Estructura verificada correctamente.", { action: action });
      return json_({ ok: true, message: "Estructura verificada correctamente.", sheets: Object.keys(SHEET_SCHEMA), at: now_() });
    }

    log_(ss, "Apps Script", "ERROR", "Acción no reconocida.", { actionRecibida: body.action || body.accion || body.tipoAccion || "", bodyKeys: Object.keys(body || {}) });
    return json_({ ok: false, error: "ACCION_NO_RECONOCIDA", message: "Apps Script recibió una acción no reconocida.", actionReceived: body.action || body.accion || body.tipoAccion || "", supportedActions: ["ping", "sync_bl2", "pull_bl2", "compact_bl2", "ensure_schema"], version: APP_VERSION, at: now_() });

  } catch (error) {
    safeLog_(ss, "Apps Script", "ERROR", "Error general en doPost.", { error: error.message || String(error), stack: error.stack || "", bodyKeys: Object.keys(body || {}) });
    return json_({ ok: false, error: error.message || String(error), stack: error.stack || "", version: APP_VERSION, at: now_() });
  } finally {
    try { if (lock) lock.releaseLock(); } catch (releaseError) {}
  }
}

function handlePing_(ss, body) {
  validarToken_(ss, body.token);
  ensureAllSheets_(ss);
  log_(ss, "BDLocal", "OK", "Ping recibido correctamente.", { action: "ping", source: body.source || "", spreadsheetId: body.spreadsheetId || "", sheetName: body.sheetName || "", version: APP_VERSION, at: now_() });
  return json_({ ok: true, code: "PING_OK", message: "Conexión correcta con Google Sheets.", app: APP_NAME, version: APP_VERSION, receivedAt: now_() });
}

function handleSyncBL2_(ss, body) {
  validarToken_(ss, body.token);
  ensureAllSheets_(ss);

  const startedAt = new Date();
  const periodoId = normalizePeriodIdScript_(body.periodoId);
  const periodoLabel = clean_(body.periodoLabel);
  const mode = clean_(body.mode || "changes");

  if (!periodoId) throw new Error("Falta periodoId en el envío.");

  const tables = body.tables || {};
  const changes = getArray_(body.changes);
  const periodos = getArray_(tables.periodos);
  const estudiantesRaw = getArray_(tables.estudiantes);
  const contactos = getArray_(tables.contactos);
  const requisitos = getArray_(tables.requisitos);
  const notas = getArray_(tables.notas);
  const cambiosLocales = getArray_(tables.cambios);
  const estudiantes = mergeStudents_(estudiantesRaw, contactos, notas, periodoId);

  const result = {
    ok: true,
    code: "SYNC_BL2_OK",
    mode: mode,
    periodoId: periodoId,
    periodoLabel: periodoLabel,
    received: { estudiantes: estudiantesRaw.length, contactos: contactos.length, requisitos: requisitos.length, notas: notas.length, cambiosLocales: cambiosLocales.length, changes: changes.length },
    written: {}
  };

  result.written.Periodos = upsertPeriodos_(ss, periodos, periodoId, periodoLabel);
  result.written.Estudiantes = upsertEstudiantes_(ss, estudiantes);
  result.written.MatriculasPeriodo = upsertMatriculasPeriodo_(ss, estudiantes, periodoId, periodoLabel);
  result.written.Requisitos = upsertRequisitos_(ss, estudiantes, requisitos, periodoId);
  result.written.Notas = upsertNotas_(ss, estudiantes, notas, periodoId);
  result.written.DivisionesEstudiantes = upsertDivisionesEstudiantes_(ss, estudiantes, periodoId);
  result.written.Carreras = upsertCarreras_(ss, estudiantes);
  result.written.PeriodosCarreras = upsertPeriodosCarreras_(ss, estudiantes, periodoId);
  result.written.PeriodosDivisiones = upsertPeriodosDivisiones_(ss, estudiantes, periodoId);
  result.written.Cambios = appendCambios_(ss, changes, body, result);
  result.durationMs = new Date().getTime() - startedAt.getTime();

  log_(ss, "BDLocal", "OK", "Sincronización multi-tabla recibida y procesada.", result);
  SpreadsheetApp.flush();

  return json_({ ok: true, code: "SYNC_BL2_OK", message: "Sincronización recibida y distribuida en hojas.", result: result, version: APP_VERSION, at: now_() });
}

function handlePullBL2_(ss, body) {
  validarToken_(ss, body.token);
  ensureAllSheets_(ss);

  const startedAt = new Date();
  const periodoId = normalizePeriodIdScript_(body.periodoId || body.periodId || "");
  const periodoLabel = clean_(body.periodoLabel || "");
  const rawTables = readAllTablesForPull_(ss, periodoId);
  const estudiantes = buildPullStudents_(rawTables, periodoId, periodoLabel);

  rawTables.Estudiantes = estudiantes;

  const counts = {};
  Object.keys(rawTables).forEach(name => { counts[name] = getArray_(rawTables[name]).length; });

  const result = { ok: true, code: "PULL_BL2_OK", action: body.action || body.accion || "pull_bl2", periodoId: periodoId, periodoLabel: periodoLabel, tables: rawTables, counts: counts, durationMs: new Date().getTime() - startedAt.getTime(), version: APP_VERSION, at: now_() };

  log_(ss, "BDLocal", "OK", "Datos leídos desde Google Sheets para Base Local.", { periodoId: periodoId, counts: counts, durationMs: result.durationMs });
  return json_(result);
}

function handleCompactBL2_(ss, body) {
  validarToken_(ss, body.token);
  ensureAllSheets_(ss);

  const result = { ok: true, code: "COMPACT_BL2_OK", sheets: {}, startedAt: now_(), version: APP_VERSION };

  Object.keys(COMPACT_KEY_COLUMNS).forEach(sheetName => {
    result.sheets[sheetName] = compactSheetByKey_(ss, sheetName, COMPACT_KEY_COLUMNS[sheetName]);
  });

  result.finishedAt = now_();
  log_(ss, "BDLocal", "OK", "Duplicados compactados en Google Sheets.", result);
  return json_({ ok: true, code: "COMPACT_BL2_OK", message: "Duplicados compactados correctamente.", result: result, version: APP_VERSION, at: now_() });
}

function readAllTablesForPull_(ss, periodoId) {
  const out = {};
  Object.keys(SHEET_SCHEMA).forEach(name => {
    const rows = readSheetObjects_(ss, name);
    out[name] = filterRowsForPull_(name, rows, periodoId);
  });
  return out;
}

function filterRowsForPull_(sheetName, rows, periodoId) {
  rows = getArray_(rows);
  const pId = normalizePeriodIdScript_(periodoId);
  if (!pId || !PERIOD_FILTERED_SHEETS[sheetName]) return rows;

  if (sheetName === "Periodos") {
    return rows.filter(row => normalizePeriodIdScript_(row.periodoId || row.id || row.periodoCanonicoId || "") === pId);
  }

  return rows.filter(row => normalizePeriodIdScript_(row.periodoId || row.periodoCanonicoId || row.periodId || "") === pId);
}

function readSheetObjects_(ss, sheetName) {
  ensureSheet_(ss, sheetName);
  const sheet = ss.getSheetByName(sheetName);
  const lastRow = sheet.getLastRow();
  const headers = SHEET_SCHEMA[sheetName] || [];
  if (lastRow < 2 || !headers.length) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(row => {
    const obj = {};
    headers.forEach((header, index) => { obj[header] = row[index]; });
    const payload = parsePayloadJson_(obj.payloadJson);
    return Object.assign({}, payload, obj);
  }).filter(row => Object.keys(row).some(key => clean_(row[key]) !== ""));
}

function parsePayloadJson_(value) {
  const raw = clean_(value);
  if (!raw || raw === "{}") return {};
  try { return JSON.parse(raw); } catch (error) { return {}; }
}

function buildPullStudents_(tables, periodoFiltro, periodoLabelFiltro) {
  const estudiantesBase = getArray_(tables.Estudiantes);
  const matriculas = getArray_(tables.MatriculasPeriodo);
  const notas = getArray_(tables.Notas);
  const requisitos = getArray_(tables.Requisitos);
  const divisiones = getArray_(tables.DivisionesEstudiantes);
  const pFiltro = normalizePeriodIdScript_(periodoFiltro);

  const baseByCedula = {};
  estudiantesBase.forEach(row => {
    const cedula = cedula_(row);
    if (!cedula) return;
    baseByCedula[cedula] = Object.assign({}, baseByCedula[cedula] || {}, row, { cedula: cedula, numeroIdentificacion: clean_(row.numeroIdentificacion || row.NumeroIdentificacion || cedula) });
  });

  const notasByStudentPeriod = {};
  notas.forEach(row => {
    const cedula = cedula_(row);
    const pId = normalizePeriodIdScript_(row.periodoId || row.periodoCanonicoId || pFiltro);
    if (!cedula || !pId) return;
    notasByStudentPeriod[pId + "__" + cedula] = row;
  });

  const requisitosByStudentPeriod = {};
  requisitos.forEach(row => {
    const cedula = cedula_(row);
    const pId = normalizePeriodIdScript_(row.periodoId || row.periodoCanonicoId || pFiltro);
    const reqKey = normalizeRequisitoKey_(row.requisitoKey || row.requisitoNombre || row.key || row.nombre || "");
    const estado = clean_(row.estado || row.valor || row.value || "");
    if (!cedula || !pId || !reqKey || !estado) return;
    const id = pId + "__" + cedula;
    if (!requisitosByStudentPeriod[id]) requisitosByStudentPeriod[id] = {};
    requisitosByStudentPeriod[id][reqKey] = estado;
  });

  const divisionesByStudentPeriod = {};
  divisiones.forEach(row => {
    const cedula = cedula_(row);
    const pId = normalizePeriodIdScript_(row.periodoId || row.periodoCanonicoId || pFiltro);
    const division = clean_(row.division || row.Division || row["División"] || "");
    if (!cedula || !pId || !division) return;
    const id = pId + "__" + cedula;
    if (!divisionesByStudentPeriod[id]) divisionesByStudentPeriod[id] = [];
    if (divisionesByStudentPeriod[id].indexOf(division) === -1) divisionesByStudentPeriod[id].push(division);
  });

  const out = [];
  matriculas.forEach(row => {
    const cedula = cedula_(row);
    const pId = normalizePeriodIdScript_(row.periodoId || row.periodoCanonicoId || pFiltro);
    if (!cedula || !pId) return;
    if (pFiltro && pFiltro !== pId) return;

    const id = pId + "__" + cedula;
    const base = baseByCedula[cedula] || {};
    const note = notasByStudentPeriod[id] || {};
    const reqs = requisitosByStudentPeriod[id] || {};
    const divs = divisionesByStudentPeriod[id] || [];

    out.push(Object.assign({}, base, row, note, reqs, {
      id: id,
      cedula: cedula,
      numeroIdentificacion: clean_(base.numeroIdentificacion || row.numeroIdentificacion || row.NumeroIdentificacion || cedula),
      periodoId: pId,
      periodoCanonicoId: pId,
      periodoLabel: clean_(row.periodoLabel || periodoLabelFiltro || pId),
      periodoCanonicoLabel: clean_(row.periodoLabel || periodoLabelFiltro || pId),
      Nombres: clean_(base.Nombres || base.nombres || row.Nombres || row.nombres || ""),
      CorreoInstitucional: clean_(base.CorreoInstitucional || base.correoInstitucional || row.CorreoInstitucional || ""),
      CorreoPersonal: clean_(base.CorreoPersonal || base.correoPersonal || row.CorreoPersonal || ""),
      Celular: clean_(base.Celular || base.celular || row.Celular || ""),
      CodigoCarrera: clean_(row.CodigoCarrera || row.codigoCarrera || base.CodigoCarrera || ""),
      NombreCarrera: clean_(row.NombreCarrera || row.nombreCarrera || base.NombreCarrera || ""),
      Sede: clean_(row.Sede || row.sede || ""),
      HorarioComplexivo: clean_(row.HorarioComplexivo || row.horarioComplexivo || ""),
      estadoMatricula: clean_(row.estadoMatricula || "ACTIVO"),
      division: clean_(row.division || row.Division || divs[0] || ""),
      divisiones: divs.length ? divs : getDivisiones_(row),
      Notart: value_(note.Notart || note.notart || row.Notart || ""),
      Notdef: value_(note.Notdef || note.notdef || row.Notdef || ""),
      Notafinal: value_(note.Notafinal || note.notafinal || row.Notafinal || ""),
      fechaRegistroNotas: clean_(note.fechaRegistroNotas || row.fechaRegistroNotas || ""),
      updatedAt: clean_(row.updatedAt || base.updatedAt || note.updatedAt || now_()),
      source: "google_sheets_pull"
    }));
  });

  if (!out.length) {
    estudiantesBase.forEach(row => {
      const cedula = cedula_(row);
      const pId = normalizePeriodIdScript_(row.periodoId || row.periodoCanonicoId || pFiltro);
      if (!cedula || !pId) return;
      if (pFiltro && pFiltro !== pId) return;
      out.push(Object.assign({}, row, { id: pId + "__" + cedula, cedula: cedula, periodoId: pId, periodoCanonicoId: pId, periodoLabel: clean_(row.periodoLabel || periodoLabelFiltro || pId), periodoCanonicoLabel: clean_(row.periodoLabel || periodoLabelFiltro || pId), source: "google_sheets_pull" }));
    });
  }

  return out;
}

function upsertPeriodos_(ss, periodos, periodoId, periodoLabel) {
  const rows = [];
  if (periodos.length) {
    periodos.forEach(p => {
      const pId = normalizePeriodIdScript_(p.periodoId || p.id || periodoId);
      if (!pId) return;
      rows.push({ key: pId, row: [now_(), pId, clean_(p.periodoLabel || p.label || p.nombre || periodoLabel), clean_(p.mesInicio || p.inicioMes || p.inicio || ""), clean_(p.anioInicio || p.añoInicio || p.inicioAnio || ""), clean_(p.mesFin || p.finMes || p.fin || ""), clean_(p.anioFin || p.añoFin || p.finAnio || ""), clean_(p.estado || "ACTIVO"), jsonText_(p)] });
    });
  }
  if (!rows.length && periodoId) rows.push({ key: periodoId, row: [now_(), periodoId, periodoLabel, "", "", "", "", "ACTIVO", jsonText_({ periodoId: periodoId, periodoLabel: periodoLabel })] });
  return upsertRows_(ss, "Periodos", rows, 2);
}

function upsertEstudiantes_(ss, estudiantes) {
  const rows = estudiantes.map(e => {
    const cedula = cedula_(e);
    if (!cedula) return null;
    return { key: cedula, row: [now_(), cedula, clean_(e.numeroIdentificacion || e.NumeroIdentificacion || e.cedula || ""), clean_(e.Nombres || e.nombres || e.nombreCompleto || ""), clean_(e.CorreoInstitucional || e.correoInstitucional || ""), clean_(e.CorreoPersonal || e.correoPersonal || ""), clean_(e.Celular || e.celular || ""), clean_(e.createdAt || ""), clean_(e.updatedAt || e.ultimaSincronizacion || ""), jsonText_(e)] };
  }).filter(Boolean);
  return upsertRows_(ss, "Estudiantes", rows, 2);
}

function upsertMatriculasPeriodo_(ss, estudiantes, periodoId, periodoLabel) {
  const rows = estudiantes.map(e => {
    const cedula = cedula_(e);
    const pId = normalizePeriodIdScript_(e.periodoId || e.periodoCanonicoId || periodoId);
    if (!cedula || !pId) return null;
    const id = pId + "__" + cedula;
    return { key: id, row: [now_(), id, pId, clean_(e.periodoLabel || periodoLabel), cedula, clean_(e.CodigoCarrera || e.codigoCarrera || ""), clean_(e.NombreCarrera || e.nombreCarrera || ""), clean_(e.Sede || e.sede || ""), clean_(e.HorarioComplexivo || e.horarioComplexivo || ""), clean_(e.estadoMatricula || "ACTIVO"), clean_(e.division || e.Division || ""), clean_(e.ultimoPeriodoId || ""), clean_(e.retiradoEn || ""), clean_(e.ultimaEdicionLocal || ""), clean_(e.ultimaSincronizacion || ""), clean_(e.forceUploadedAt || ""), clean_(e.updatedAt || ""), jsonText_(e)] };
  }).filter(Boolean);
  return upsertRows_(ss, "MatriculasPeriodo", rows, 2);
}

function upsertRequisitos_(ss, estudiantes, requisitosExtra, periodoId) {
  const rows = [];
  const extras = getArray_(requisitosExtra);

  if (extras.length) {
    extras.forEach(r => {
      const cedula = cedula_(r);
      const pId = normalizePeriodIdScript_(r.periodoId || r.periodoCanonicoId || periodoId);
      const requisitoKey = normalizeRequisitoKey_(r.requisitoKey || r.key || r.nombre || r.requisitoNombre || r.campo || "");
      const estado = clean_(r.estado || r.valor || r.value || "");
      if (!cedula || !pId || !requisitoKey || !estado) return;
      const id = clean_(r.id || (pId + "__" + cedula + "__" + requisitoKey));
      rows.push({ key: id, row: [now_(), id, pId, cedula, requisitoKey, clean_(r.requisitoNombre || r.nombre || normalizarNombreRequisito_(requisitoKey)), estado, clean_(r.origen || "BDLocal"), clean_(r.updatedAt || r.actualizadoEn || ""), jsonText_(r)] });
    });
    return upsertRows_(ss, "Requisitos", rows, 2);
  }

  estudiantes.forEach(e => {
    const cedula = cedula_(e);
    const pId = normalizePeriodIdScript_(e.periodoId || e.periodoCanonicoId || periodoId);
    if (!cedula || !pId) return;
    REQUISITO_KEYS.forEach(reqKeyRaw => {
      const value = e[reqKeyRaw];
      if (!isRequisitoValue_(value)) return;
      const requisitoKey = normalizeRequisitoKey_(reqKeyRaw);
      const id = pId + "__" + cedula + "__" + requisitoKey;
      rows.push({ key: id, row: [now_(), id, pId, cedula, requisitoKey, normalizarNombreRequisito_(requisitoKey), clean_(value), "BDLocal", clean_(e.updatedAt || e.ultimaSincronizacion || ""), jsonText_({ requisitoKey: requisitoKey, estado: clean_(value), origenCampo: reqKeyRaw })] });
    });
  });

  return upsertRows_(ss, "Requisitos", rows, 2);
}

function upsertNotas_(ss, estudiantes, notasExtra, periodoId) {
  const rows = [];
  estudiantes.forEach(e => {
    const cedula = cedula_(e);
    const pId = normalizePeriodIdScript_(e.periodoId || e.periodoCanonicoId || periodoId);
    const tieneNotas = hasValue_(e.Notart) || hasValue_(e.Notdef) || hasValue_(e.Notafinal);
    if (!cedula || !pId || !tieneNotas) return;
    const id = pId + "__" + cedula;
    rows.push({ key: id, row: [now_(), id, pId, cedula, value_(e.Notart), value_(e.Notdef), value_(e.Notafinal), clean_(e.fechaRegistroNotas || ""), "BDLocal", clean_(e.updatedAt || e.ultimaSincronizacion || ""), jsonText_({ Notart: e.Notart, Notdef: e.Notdef, Notafinal: e.Notafinal })] });
  });
  getArray_(notasExtra).forEach(n => {
    const cedula = cedula_(n);
    const pId = normalizePeriodIdScript_(n.periodoId || n.periodoCanonicoId || periodoId);
    if (!cedula || !pId) return;
    const id = clean_(n.id || (pId + "__" + cedula));
    rows.push({ key: id, row: [now_(), id, pId, cedula, value_(n.Notart || n.notart), value_(n.Notdef || n.notdef), value_(n.Notafinal || n.notafinal), clean_(n.fechaRegistroNotas || ""), clean_(n.origen || "BDLocal"), clean_(n.updatedAt || n.actualizadoEn || ""), jsonText_(n)] });
  });
  return upsertRows_(ss, "Notas", rows, 2);
}

function upsertDivisionesEstudiantes_(ss, estudiantes, periodoId) {
  const rows = [];
  estudiantes.forEach(e => {
    const cedula = cedula_(e);
    const pId = normalizePeriodIdScript_(e.periodoId || e.periodoCanonicoId || periodoId);
    if (!cedula || !pId) return;
    const divisionActual = clean_(e.division || e.Division || "");
    const divisiones = getDivisiones_(e);
    divisiones.forEach(division => {
      if (!division) return;
      const id = pId + "__" + cedula + "__" + division;
      rows.push({ key: id, row: [now_(), id, pId, cedula, division, division === divisionActual ? "SI" : "NO", clean_(e.divisionActualizadaEn || ""), jsonText_(e)] });
    });
  });
  return upsertRows_(ss, "DivisionesEstudiantes", rows, 2);
}

function upsertCarreras_(ss, estudiantes) {
  const rowsByKey = {};
  estudiantes.forEach(e => {
    const codigo = clean_(e.CodigoCarrera || e.codigoCarrera || "");
    if (!codigo) return;
    rowsByKey[codigo] = { key: codigo, row: [now_(), codigo, clean_(e.NombreCarrera || e.nombreCarrera || ""), "ACTIVA", clean_(e.updatedAt || e.ultimaSincronizacion || ""), jsonText_({ CodigoCarrera: codigo, NombreCarrera: clean_(e.NombreCarrera || e.nombreCarrera || "") })] };
  });
  return upsertRows_(ss, "Carreras", Object.values(rowsByKey), 2);
}

function upsertPeriodosCarreras_(ss, estudiantes, periodoId) {
  const rowsByKey = {};
  estudiantes.forEach(e => {
    const pId = normalizePeriodIdScript_(e.periodoId || e.periodoCanonicoId || periodoId);
    const codigo = clean_(e.CodigoCarrera || e.codigoCarrera || "");
    if (!pId || !codigo) return;
    const id = pId + "__" + codigo;
    rowsByKey[id] = { key: id, row: [now_(), id, pId, codigo, clean_(e.NombreCarrera || e.nombreCarrera || ""), "ACTIVA", jsonText_({ periodoId: pId, CodigoCarrera: codigo, NombreCarrera: clean_(e.NombreCarrera || e.nombreCarrera || "") })] };
  });
  return upsertRows_(ss, "PeriodosCarreras", Object.values(rowsByKey), 2);
}

function upsertPeriodosDivisiones_(ss, estudiantes, periodoId) {
  const map = {};
  estudiantes.forEach(e => {
    const pId = normalizePeriodIdScript_(e.periodoId || e.periodoCanonicoId || periodoId);
    if (!pId) return;
    getDivisiones_(e).forEach(division => {
      if (!division) return;
      const id = pId + "__" + division;
      if (!map[id]) map[id] = { id: id, periodoId: pId, division: division, total: 0 };
      map[id].total += 1;
    });
  });
  const rows = Object.values(map).map(item => ({ key: item.id, row: [now_(), item.id, item.periodoId, item.division, "ACTIVA", item.total, jsonText_(item)] }));
  return upsertRows_(ss, "PeriodosDivisiones", rows, 2);
}

function appendCambios_(ss, changes, body, result) {
  const rows = [];
  getArray_(changes).forEach(c => rows.push([now_(), clean_(c.origen || c.source || "BDLocal"), clean_(c.tipo || c.type || "CHANGE"), clean_(c.accion || c.action || "UPSERT"), normalizePeriodIdScript_(c.periodoId || body.periodoId || ""), clean_(c.cedula || c.numeroIdentificacion || ""), clean_(c.estadoSync || "SINCRONIZADO"), jsonText_(c)]));
  rows.push([now_(), "BDLocal", "SYNC_BL2", "MULTITABLA", normalizePeriodIdScript_(body.periodoId || ""), "", "SINCRONIZADO", jsonText_({ mode: body.mode || "", generatedAt: body.generatedAt || "", received: result.received, written: result.written })]);
  appendRows_(ss, "Cambios", rows);
  return rows.length;
}

function upsertRows_(ss, sheetName, items, keyColumn) {
  ensureSheet_(ss, sheetName);
  if (!items || !items.length) return { total: 0, inserted: 0, updated: 0 };

  const sheet = ss.getSheetByName(sheetName);
  const headers = SHEET_SCHEMA[sheetName];
  const colCount = headers.length;
  const unique = {};

  items.forEach(item => {
    const rowKey = clean_(item && item.key);
    if (!rowKey) return;
    unique[rowKey] = normalizeRow_(item.row || [], colCount);
  });

  const keys = Object.keys(unique);
  if (!keys.length) return { total: 0, inserted: 0, updated: 0 };

  const existingMap = getExistingKeyMap_(sheet, keyColumn);
  const updates = [];
  const appends = [];

  keys.forEach(rowKey => {
    if (existingMap[rowKey]) updates.push({ rowIndex: existingMap[rowKey], row: unique[rowKey] });
    else appends.push(unique[rowKey]);
  });

  batchUpdateRows_(sheet, updates, colCount);
  appendRowsRaw_(sheet, appends, colCount);
  return { total: keys.length, inserted: appends.length, updated: updates.length };
}

function batchUpdateRows_(sheet, updates, colCount) {
  if (!updates || !updates.length) return;
  updates.sort((a, b) => a.rowIndex - b.rowIndex);

  let groupStart = null;
  let groupRows = [];
  let previousRow = null;

  updates.forEach(update => {
    if (groupStart === null) {
      groupStart = update.rowIndex;
      previousRow = update.rowIndex;
      groupRows = [normalizeRow_(update.row, colCount)];
      return;
    }
    if (update.rowIndex === previousRow + 1) {
      groupRows.push(normalizeRow_(update.row, colCount));
      previousRow = update.rowIndex;
      return;
    }
    sheet.getRange(groupStart, 1, groupRows.length, colCount).setValues(groupRows);
    groupStart = update.rowIndex;
    previousRow = update.rowIndex;
    groupRows = [normalizeRow_(update.row, colCount)];
  });

  if (groupRows.length) sheet.getRange(groupStart, 1, groupRows.length, colCount).setValues(groupRows);
}

function appendRows_(ss, sheetName, rows) {
  ensureSheet_(ss, sheetName);
  const sheet = ss.getSheetByName(sheetName);
  const colCount = SHEET_SCHEMA[sheetName].length;
  appendRowsRaw_(sheet, rows, colCount);
}

function appendRowsRaw_(sheet, rows, colCount) {
  if (!rows || !rows.length) return;
  const normalized = rows.map(row => normalizeRow_(row, colCount));
  for (let i = 0; i < normalized.length; i += WRITE_BATCH_SIZE) {
    const batch = normalized.slice(i, i + WRITE_BATCH_SIZE);
    sheet.getRange(sheet.getLastRow() + 1, 1, batch.length, colCount).setValues(batch);
  }
}

function getExistingKeyMap_(sheet, keyColumn) {
  const map = {};
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return map;
  const values = sheet.getRange(2, keyColumn, lastRow - 1, 1).getValues();
  values.forEach((row, index) => {
    const rowKey = clean_(row[0]);
    if (rowKey) map[rowKey] = index + 2;
  });
  return map;
}

function compactSheetByKey_(ss, sheetName, keyColumn) {
  ensureSheet_(ss, sheetName);
  const sheet = ss.getSheetByName(sheetName);
  const headers = SHEET_SCHEMA[sheetName];
  const colCount = headers.length;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { before: 0, after: 0, removed: 0 };

  const rows = sheet.getRange(2, 1, lastRow - 1, colCount).getValues();
  const map = {};
  const order = [];

  rows.forEach(row => {
    const rowKey = clean_(row[keyColumn - 1]);
    const isEmpty = row.every(cell => clean_(cell) === "");
    if (!rowKey || isEmpty) return;
    if (!map[rowKey]) order.push(rowKey);
    map[rowKey] = normalizeRow_(row, colCount);
  });

  const finalRows = order.map(rowKey => map[rowKey]);
  sheet.getRange(2, 1, Math.max(lastRow - 1, 1), colCount).clearContent();
  if (finalRows.length) sheet.getRange(2, 1, finalRows.length, colCount).setValues(finalRows);
  return { before: rows.length, after: finalRows.length, removed: rows.length - finalRows.length };
}

function normalizeRow_(row, colCount) {
  const out = Array.isArray(row) ? row.slice(0, colCount) : [];
  while (out.length < colCount) out.push("");
  return out.map(value => {
    if (typeof value === "object" && value !== null) return jsonText_(value);
    return value === null || value === undefined ? "" : value;
  });
}

function ensureAllSheets_(ss) {
  Object.keys(SHEET_SCHEMA).forEach(name => ensureSheet_(ss, name));
  ensureConfigDefaults_(ss);
}

function ensureSheet_(ss, name) {
  const headers = SHEET_SCHEMA[name];
  if (!headers) throw new Error("No existe esquema para la hoja: " + name);

  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const currentText = current.map(clean_).join("|");
  const expectedText = headers.map(clean_).join("|");
  if (currentText !== expectedText) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight("bold").setBackground("#d9e2f3").setFontColor("#000000");
  try { sheet.setFrozenRows(1); } catch (error) {}
  return sheet;
}

function ensureConfigDefaults_(ss) {
  const sheet = ss.getSheetByName("Config");
  const values = sheet.getDataRange().getValues();
  const existing = {};
  for (let i = 1; i < values.length; i++) {
    const clave = clean_(values[i][0]);
    if (clave) existing[clave] = true;
  }

  const rows = [];
  if (!existing.app) rows.push(["app", APP_NAME, "Nombre interno de la app"]);
  if (!existing.version) rows.push(["version", APP_VERSION, "Versión de conexión Google Sheets"]);
  if (!existing.token) rows.push(["token", generarToken_(), "Clave simple para validar envíos desde la app"]);
  if (!existing.estado) rows.push(["estado", "ACTIVO", "Estado de la conexión"]);
  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
}

function getSpreadsheet_(body) {
  const id = clean_(body && body.spreadsheetId);
  if (id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error("No llegó spreadsheetId y no hay hoja activa.");
  return active;
}

function validarToken_(ss, tokenRecibido) {
  const token = clean_(tokenRecibido);
  const tokenReal = obtenerConfig_(ss, "token");
  if (!tokenReal) throw new Error("TOKEN_NO_CONFIGURADO");
  if (!token) throw new Error("TOKEN_NO_RECIBIDO");
  if (token !== tokenReal) throw new Error("TOKEN_INVALIDO");
  return true;
}

function obtenerConfig_(ss, claveBuscada) {
  const sheet = ss.getSheetByName("Config");
  if (!sheet) return "";
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const clave = clean_(values[i][0]);
    const valor = clean_(values[i][1]);
    if (clave === claveBuscada) return valor;
  }
  return "";
}

function generarToken_() {
  return "REQ_JEFF_" + Utilities.getUuid().replace(/-/g, "").slice(0, 24).toUpperCase();
}

function mergeStudents_(estudiantes, contactos, notas, periodoId) {
  const map = {};
  estudiantes.forEach(e => {
    const cedula = cedula_(e);
    if (!cedula) return;
    map[cedula] = Object.assign({}, map[cedula] || {}, e, { cedula: cedula, periodoId: normalizePeriodIdScript_(e.periodoId || e.periodoCanonicoId || periodoId) });
  });
  contactos.forEach(c => {
    const cedula = cedula_(c);
    if (!cedula) return;
    map[cedula] = Object.assign({}, map[cedula] || {}, c, { cedula: cedula, periodoId: normalizePeriodIdScript_(c.periodoId || c.periodoCanonicoId || periodoId) });
  });
  notas.forEach(n => {
    const cedula = cedula_(n);
    if (!cedula) return;
    map[cedula] = Object.assign({}, map[cedula] || {}, n, { cedula: cedula, periodoId: normalizePeriodIdScript_(n.periodoId || n.periodoCanonicoId || periodoId) });
  });
  return Object.values(map);
}

function getDivisiones_(row) {
  const out = [];
  if (Array.isArray(row.divisiones)) {
    row.divisiones.forEach(item => { const division = clean_(item); if (division && out.indexOf(division) === -1) out.push(division); });
  }
  const actual = clean_(row.division || row.Division || "");
  if (actual && out.indexOf(actual) === -1) out.push(actual);
  return out;
}

function isRequisitoValue_(value) {
  const v = clean_(value).toUpperCase();
  return v === "CUMPLE" || v === "NO CUMPLE" || v === "PENDIENTE";
}

function normalizeRequisitoKey_(requisitoKey) {
  const clean = clean_(requisitoKey);
  const map = { "Académico": "Academico", "ActualizacionDatos": "ActualizaciónDatos", "AprobaciónComplexivoProyecto": "AprobacionComplexivoProyecto", "AprobaciónTitulacion": "AprobacionTitulacion", "Documentación": "Documentacion", "Inglés": "Ingles", "PracticasVinculacion": "PrácticasVinculacion", "SeguimientoGraduados": "SeguimientoGraduados", "Titulación": "Titulacion", "Vinculación": "Vinculacion" };
  return map[clean] || clean;
}

function normalizarNombreRequisito_(requisitoKey) {
  const map = { Academico: "Académico", "ActualizaciónDatos": "Actualización de datos", AprobacionComplexivoProyecto: "Aprobación Complexivo / Proyecto", AprobacionTitulacion: "Aprobación Titulación", Documentacion: "Documentación", Financiero: "Financiero", Ingles: "Inglés", "PrácticasVinculacion": "Prácticas / Vinculación", SeguimientoGraduados: "Seguimiento a graduados", Titulacion: "Titulación", Vinculacion: "Vinculación" };
  return map[requisitoKey] || requisitoKey;
}

function log_(ss, origen, nivel, mensaje, payload) {
  ensureSheet_(ss, "Log");
  ss.getSheetByName("Log").appendRow([now_(), origen, nivel, mensaje, jsonText_(payload || {})]);
}

function safeLog_(ss, origen, nivel, mensaje, payload) {
  try { if (ss) log_(ss, origen, nivel, mensaje, payload); } catch (error) {}
}

function parseBody_(e) {
  if (!e) return {};
  if (e.postData && e.postData.contents) {
    const raw = String(e.postData.contents || "").trim();
    if (!raw) return {};
    try { return JSON.parse(raw); } catch (jsonError) {
      const params = {};
      raw.split("&").forEach(part => {
        const pair = part.split("=");
        if (pair.length >= 2) params[decodeURIComponent(pair[0])] = decodeURIComponent(pair.slice(1).join("="));
      });
      return params;
    }
  }
  return e.parameter || {};
}

function normalizeAction_(value) { return clean_(value).toLowerCase(); }
function json_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
function now_() { return new Date().toISOString(); }
function clean_(value) { return String(value === null || value === undefined ? "" : value).trim(); }
function value_(value) { return value === null || value === undefined ? "" : value; }
function hasValue_(value) { return value !== null && value !== undefined && String(value).trim() !== ""; }
function getArray_(value) { return Array.isArray(value) ? value : []; }

function cedula_(row) {
  row = row || {};
  return clean_(row.cedula || row.numeroIdentificacion || row.NumeroIdentificacion || row.identificacion || row.Identificacion || "");
}

function jsonText_(value) {
  try {
    let text = JSON.stringify(value || {});
    if (text.length > MAX_CELL_CHARS) text = text.slice(0, MAX_CELL_CHARS - 20) + "...[TRUNCADO]";
    return text;
  } catch (error) { return "{}"; }
}

function normalizePeriodIdScript_(value) {
  const raw = clean_(value);
  if (!raw) return "";
  const match = raw.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
  return match ? match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4] : raw.replace(/_+/g, "__");
}

function prepararEstructuraSinBorrar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Abre este Apps Script desde el Google Sheet.");
  ensureAllSheets_(ss);
  log_(ss, "Apps Script", "OK", "Estructura verificada manualmente sin borrar datos.", { sheets: Object.keys(SHEET_SCHEMA), version: APP_VERSION });
}

function probarLocalSinBDLocal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Abre este Apps Script desde el Google Sheet.");
  ensureAllSheets_(ss);
  const token = obtenerConfig_(ss, "token");
  return handleSyncBL2_(ss, {
    action: "sync_bl2",
    token: token,
    spreadsheetId: ss.getId(),
    periodoId: "TEST-LOCAL",
    periodoLabel: "Test local",
    mode: "test",
    tables: { periodos: [{ id: "TEST-LOCAL", periodoLabel: "Test local", estado: "ACTIVO" }], estudiantes: [{ cedula: "9999999999", numeroIdentificacion: "9999999999", Nombres: "ESTUDIANTE DE PRUEBA", periodoId: "TEST-LOCAL", periodoLabel: "Test local", CodigoCarrera: "TEST-CARRERA", NombreCarrera: "CARRERA DE PRUEBA", estadoMatricula: "ACTIVO", Academico: "CUMPLE", Financiero: "NO CUMPLE", Ingles: "PENDIENTE", Notart: 8, Notdef: 7, Notafinal: 7.5, updatedAt: now_() }], contactos: [], requisitos: [], notas: [], cambios: [] },
    changes: []
  });
}

function probarPullBL2Local() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Abre este Apps Script desde el Google Sheet.");
  ensureAllSheets_(ss);
  const token = obtenerConfig_(ss, "token");
  return handlePullBL2_(ss, { action: "pull_bl2", token: token, spreadsheetId: ss.getId(), periodoId: "", periodoLabel: "" });
}

function compactarDuplicadosManual() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Abre este Apps Script desde el Google Sheet.");
  ensureAllSheets_(ss);
  const result = {};
  Object.keys(COMPACT_KEY_COLUMNS).forEach(sheetName => { result[sheetName] = compactSheetByKey_(ss, sheetName, COMPACT_KEY_COLUMNS[sheetName]); });
  log_(ss, "Apps Script", "OK", "Duplicados compactados manualmente.", result);
  return result;
}
