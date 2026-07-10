/**
 * =========================================================
 * Archivo: apps-script-sync-bl2-v2.gs
 * Ruta: /integraciones/google-apps-script/apps-script-sync-bl2-v2.gs
 * Función:
 * - Recibir cambios_pendientes desde BDLocal.
 * - Soportar schemaVersion 2.
 * - Guardar notas_titulacion en Google Sheets.
 * - Responder con processedIds para que BDLocal marque solo lo enviado.
 * Uso:
 * - Copiar este archivo completo en Google Apps Script.
 * - Publicar como Web App.
 * - Usar la URL en la configuración de Google Sheets de la app.
 * =========================================================
 */

const BL2_SYNC_VERSION = '0.1.0-block24';
const DEFAULT_NOTAS_SHEET = 'notas_titulacion';

function doGet() {
  return jsonResponse({
    ok: true,
    service: 'BL2 Sync V2',
    version: BL2_SYNC_VERSION,
    message: 'Apps Script activo. Use POST para sincronizar.'
  });
}

function doPost(e) {
  try {
    const payload = parsePayload(e);
    validateToken(payload);

    const action = String(payload.action || '').trim();
    const table = String(payload.table || '').trim();
    const mode = String(payload.mode || '').trim();

    if (action !== 'sync_bl2') {
      throw new Error('Acción no soportada: ' + action);
    }

    if (mode !== 'changes_pendientes') {
      return jsonResponse({
        ok: true,
        skipped: true,
        version: BL2_SYNC_VERSION,
        message: 'Modo recibido pero no procesado por V2: ' + mode,
        processedIds: []
      });
    }

    if (table !== 'notas_titulacion') {
      return jsonResponse({
        ok: true,
        skipped: true,
        version: BL2_SYNC_VERSION,
        message: 'Tabla omitida por V2: ' + table,
        processedIds: []
      });
    }

    const result = syncNotasTitulacion(payload);
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({
      ok: false,
      version: BL2_SYNC_VERSION,
      error: String(error && error.message ? error.message : error)
    });
  }
}

function parsePayload(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Solicitud POST vacía.');
  }
  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error('JSON inválido: ' + error.message);
  }
}

function validateToken(payload) {
  const expected = String(PropertiesService.getScriptProperties().getProperty('BL2_SYNC_TOKEN') || '').trim();
  const received = String(payload.token || '').trim();
  if (!expected) {
    throw new Error('Configura BL2_SYNC_TOKEN en Propiedades del script.');
  }
  if (!received || received !== expected) {
    throw new Error('Token inválido.');
  }
}

function openSpreadsheet(payload) {
  const id = String(payload.spreadsheetId || '').trim();
  if (!id) {
    throw new Error('Falta spreadsheetId.');
  }
  return SpreadsheetApp.openById(id);
}

function getOrCreateSheet(ss, name, headers) {
  const sheetName = String(name || DEFAULT_NOTAS_SHEET).trim() || DEFAULT_NOTAS_SHEET;
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const currentHeaders = sheet.getLastRow() >= 1
    ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0]
    : [];

  const needsHeaders = currentHeaders.filter(String).length === 0;
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function syncNotasTitulacion(payload) {
  const ss = openSpreadsheet(payload);
  const notes = extractNotas(payload);
  const changes = Array.isArray(payload.changes) ? payload.changes : [];
  const sheetName = String(payload.sheetNotasName || payload.notasSheetName || DEFAULT_NOTAS_SHEET).trim() || DEFAULT_NOTAS_SHEET;

  const headers = [
    'idEstudiantePeriodo',
    'periodoId',
    'cedula',
    'Notart',
    'Notdef',
    'Notafinal',
    'estadoNota',
    'origen',
    'updatedAt',
    'syncSource',
    'syncTarget',
    'lastGoogleSyncAt'
  ];

  const sheet = getOrCreateSheet(ss, sheetName, headers);
  const index = buildIndex(sheet, 'idEstudiantePeriodo');
  const processedIds = [];
  const skippedIds = [];

  notes.forEach(function(note, i) {
    const change = changes[i] || {};
    const changeId = String(change.id || change.cambioId || '').trim();
    const idEP = String(note.idEstudiantePeriodo || change.registroId || '').trim();

    if (!idEP) {
      if (changeId) skippedIds.push(changeId);
      return;
    }

    const rowObject = normalizeNota(note);
    const values = headers.map(function(key) { return rowObject[key] == null ? '' : rowObject[key]; });
    const targetRow = index[idEP] || 0;

    if (targetRow > 0) {
      sheet.getRange(targetRow, 1, 1, headers.length).setValues([values]);
    } else {
      sheet.appendRow(values);
      index[idEP] = sheet.getLastRow();
    }

    if (changeId) processedIds.push(changeId);
  });

  return {
    ok: true,
    version: BL2_SYNC_VERSION,
    table: 'notas_titulacion',
    sheet: sheetName,
    received: notes.length,
    processed: processedIds.length,
    skipped: skippedIds.length,
    processedIds: processedIds,
    skippedIds: skippedIds,
    outboxProcessed: false,
    partial: true,
    message: 'notas_titulacion sincronizadas: ' + processedIds.length
  };
}

function extractNotas(payload) {
  if (payload.tables && Array.isArray(payload.tables.notas_titulacion)) {
    return payload.tables.notas_titulacion;
  }
  if (Array.isArray(payload.notas_titulacion)) {
    return payload.notas_titulacion;
  }
  if (Array.isArray(payload.changes)) {
    return payload.changes.map(function(change) {
      return change && change.payload ? change.payload : change;
    });
  }
  return [];
}

function normalizeNota(note) {
  note = note || {};
  const nart = cleanNumber(firstValue(note, ['Notart', 'Nart', 'notart']));
  const ndef = cleanNumber(firstValue(note, ['Notdef', 'Ndef', 'notdef']));
  let nfin = cleanNumber(firstValue(note, ['Notafinal', 'Nfinal', 'notafinal']));
  if (nfin === '' && nart !== '' && ndef !== '' && Number(nart) >= 7) {
    nfin = Math.round(((Number(nart) * 0.70) + (Number(ndef) * 0.30)) * 100) / 100;
  }

  return {
    idEstudiantePeriodo: String(note.idEstudiantePeriodo || note.studentId || '').trim(),
    periodoId: String(note.periodoId || '').trim(),
    cedula: String(note.cedula || '').trim(),
    Notart: nart,
    Notdef: ndef,
    Notafinal: nfin,
    estadoNota: String(note.estadoNota || '').trim(),
    origen: String(note.origen || note.source || 'bdlocal').trim(),
    updatedAt: String(note.updatedAt || '').trim(),
    syncSource: String(note.syncSource || 'cambios_pendientes').trim(),
    syncTarget: 'google_sheets',
    lastGoogleSyncAt: new Date().toISOString()
  };
}

function buildIndex(sheet, keyHeader) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const index = {};
  if (lastRow < 2 || lastCol < 1) return index;

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const keyCol = headers.indexOf(keyHeader) + 1;
  if (keyCol <= 0) return index;

  const values = sheet.getRange(2, keyCol, lastRow - 1, 1).getValues();
  values.forEach(function(row, i) {
    const key = String(row[0] || '').trim();
    if (key) index[key] = i + 2;
  });
  return index;
}

function firstValue(obj, keys) {
  for (let i = 0; i < keys.length; i++) {
    if (obj[keys[i]] !== undefined && obj[keys[i]] !== null && String(obj[keys[i]]).trim() !== '') {
      return obj[keys[i]];
    }
  }
  return '';
}

function cleanNumber(value) {
  const raw = String(value == null ? '' : value).replace(',', '.').trim();
  if (!raw) return '';
  const n = Number(raw);
  if (!isFinite(n)) return '';
  return Math.max(0, Math.min(10, Math.round(n * 100) / 100));
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj || {}))
    .setMimeType(ContentService.MimeType.JSON);
}
