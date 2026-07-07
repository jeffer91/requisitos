/*
  Archivo: bdlocal-sync.manager.js
  Ruta: js/bdlocal-config/bdlocal-sync.manager.js

  Función:
  - Controlar sincronización BDLocal con Firebase, Supabase y Google Sheets.
  - Google Sheets usa una sola ruta multi-tabla.
  - Envía token, spreadsheetId, sheetName, tables y changes.
  - Usa text/plain para evitar preflight CORS de Apps Script.
  - Tiene timeout para que la pantalla no quede congelada.
*/
(function (window, document) {
  'use strict';

  var tokenUiReady = false;
  var FETCH_TIMEOUT_MS = 60000;

  function text(value) {
    return String(value === null || value === undefined ? '' : value).trim();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function getStore() {
    return window.BDLocalConfigStore || null;
  }

  function getCore() {
    return window.BL2Core || null;
  }

  function getSync() {
    return window.BL2Sync || null;
  }

  function clone(value) {
    if (value === undefined) return undefined;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value;
    }
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function modal(level, title, message, data) {
    if (window.BDLocalModal && typeof window.BDLocalModal.add === 'function') {
      window.BDLocalModal.add(level || 'info', title || 'BDLocal', message || '', data || {});
    }
  }

  function log(scope, message, level, data) {
    var store = getStore();

    if (store && typeof store.addLog === 'function') {
      store.addLog(scope || 'sync', message || '', level || 'info', data || {});
    }

    modal(level || 'info', scope || 'sync', message || '', data || {});

    if (window.BL2Core && typeof window.BL2Core.log === 'function') {
      return window.BL2Core
        .log(level === 'error' ? 'ERROR' : level === 'warning' ? 'WARN' : 'INFO', message || '', data || {})
        .catch(function () {});
    }

    return Promise.resolve();
  }

  function uiProgress(active, percent, message) {
    if (window.BDLocalConfigUI && typeof window.BDLocalConfigUI.setProgress === 'function') {
      window.BDLocalConfigUI.setProgress(active, percent, message || '');
    }
  }

  function dispatchProgress(target, percent, detail) {
    var cleanPercent = Math.max(0, Math.min(100, Number(percent || 0)));

    try {
      window.dispatchEvent(new CustomEvent('bl2:sync-progress', {
        detail: {
          target: target,
          percent: cleanPercent,
          detail: detail || '',
          at: nowIso()
        }
      }));
    } catch (error) {}

    uiProgress(cleanPercent > 0 && cleanPercent < 100, cleanPercent, detail || '');
  }

  function requireModules() {
    if (!getStore()) return Promise.reject(new Error('BDLocalConfigStore no está cargado.'));
    if (!getCore()) return Promise.reject(new Error('BL2Core no está cargado.'));
    return Promise.resolve(true);
  }

  function getActivePeriod() {
    if (window.BL2App && typeof window.BL2App.getState === 'function') {
      var state = window.BL2App.getState() || {};

      if (state.activePeriod && text(state.activePeriod.id)) {
        return Promise.resolve({
          id: text(state.activePeriod.id),
          label: text(state.activePeriod.label || state.activePeriod.id)
        });
      }
    }

    if (getCore() && typeof getCore().getActivePeriod === 'function') {
      return getCore().getActivePeriod().then(function (period) {
        if (!period || !text(period.id)) return null;

        return {
          id: text(period.id),
          label: text(period.label || period.periodoLabel || period.id)
        };
      });
    }

    return Promise.resolve(null);
  }

  function getStudentsForPeriod(periodoId) {
    var core = getCore();

    if (!core || typeof core.getStudents !== 'function') {
      return Promise.resolve([]);
    }

    return core.getStudents({ periodoId: periodoId, matricula: '' }).then(function (students) {
      return Array.isArray(students) ? students : [];
    }).catch(function () {
      return [];
    });
  }

  function getStudentsForActivePeriod() {
    return requireModules().then(getActivePeriod).then(function (period) {
      if (!period || !period.id) {
        throw new Error('Seleccione un período activo antes de sincronizar.');
      }

      return getStudentsForPeriod(period.id).then(function (students) {
        return {
          period: period,
          students: students
        };
      });
    });
  }

  function refreshCounts() {
    var store = getStore();
    var core = getCore();

    if (!store || !core) return Promise.resolve(null);

    return getActivePeriod().then(function (period) {
      if (!period || !period.id || typeof core.getSummary !== 'function') return null;

      return core.getSummary(period.id).then(function (summary) {
        store.patchConfig({
          bdlocal: {
            totalRegistros: Number(summary.totalEstudiantes || 0),
            status: 'ok',
            connected: true,
            lastTestAt: nowIso(),
            lastError: ''
          },
          sheets: {
            pendingCount: Number(summary.pendientesGoogle || 0)
          }
        });

        return summary;
      });
    }).catch(function () {
      return null;
    });
  }

  function input(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function enhanceSheetsTokenUI() {
    var store = getStore();
    if (!store || tokenUiReady) return;

    tokenUiReady = true;

    function apply() {
      var sheetName = document.getElementById('bdlc-sheets-name');
      if (!sheetName || document.getElementById('bdlc-sheets-token')) return;

      var config = store.getSheetsConfig({ includeSecret: true });
      var wrapper = document.createElement('div');
      wrapper.className = 'bdlc-field';
      wrapper.innerHTML =
        '<label class="bdlc-label" for="bdlc-sheets-token">Token de Apps Script</label>' +
        '<input id="bdlc-sheets-token" class="bdlc-input" type="password" autocomplete="off" value="' + escapeHtml(config.token || '') + '">' +
        '<div class="bdlc-help">Es el valor de la fila token en la pestaña Config. Ejemplo: REQ_JEFF_...</div>';

      var parent = sheetName.closest ? sheetName.closest('.bdlc-field') : sheetName.parentNode;
      if (parent && parent.parentNode) parent.parentNode.insertBefore(wrapper, parent.nextSibling);
    }

    document.addEventListener('click', function (event) {
      var target = event.target;

      while (target && target !== document) {
        if (target.getAttribute && target.getAttribute('data-bdlc-action') === 'saveSheetsConfig') {
          var token = input('bdlc-sheets-token');
          if (token) store.patchConfig({ sheets: { tokenProtected: store.protectValue(token) } });
          break;
        }
        target = target.parentNode;
      }
    }, true);

    if (window.MutationObserver) {
      var observer = new MutationObserver(apply);
      observer.observe(document.body, { childList: true, subtree: true });
    }

    apply();
  }

  function syncGoogleUrlToBL2() {
    var store = getStore();
    var sync = getSync();

    if (!store || !sync || typeof sync.setGoogleScriptUrl !== 'function') {
      return Promise.resolve('');
    }

    var config = store.getSheetsConfig({ includeSecret: true });
    var url = text(config.appsScriptUrl);

    if (!url) return Promise.resolve('');

    return sync.setGoogleScriptUrl(url).then(function () {
      return url;
    });
  }

  function postJson(url, payload, timeoutMs) {
    timeoutMs = Number(timeoutMs || FETCH_TIMEOUT_MS);

    var controller = window.AbortController ? new AbortController() : null;
    var timer = null;

    if (controller) {
      timer = window.setTimeout(function () {
        controller.abort();
      }, timeoutMs);
    }

    return fetch(url, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload || {}),
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      return response.text().then(function (raw) {
        var data = {};

        try {
          data = raw ? JSON.parse(raw) : {};
        } catch (error) {
          data = { ok: response.ok, raw: raw };
        }

        if (!response.ok) {
          throw new Error(data.message || data.error || ('HTTP ' + response.status));
        }

        if (data && data.ok === false) {
          throw new Error(data.message || data.error || 'Apps Script respondió ok=false.');
        }

        return data;
      });
    }).catch(function (error) {
      if (error && error.name === 'AbortError') {
        throw new Error('Tiempo agotado al comunicarse con Apps Script. Revisa implementación, token, permisos o tamaño del envío.');
      }
      throw error;
    }).finally(function () {
      if (timer) window.clearTimeout(timer);
    });
  }

  function getPendingGoogleChanges(periodoId) {
    var sync = getSync();
    var core = getCore();

    if (sync && typeof sync.getPendingChangesFor === 'function') {
      return sync.getPendingChangesFor('google', periodoId);
    }

    if (core && typeof core.getPendingChanges === 'function') {
      return core.getPendingChanges('google', periodoId);
    }

    return Promise.resolve([]);
  }

  function markGoogleChanges(changes, response) {
    var sync = getSync();

    if (sync && typeof sync.markChanges === 'function') {
      return sync.markChanges(changes || [], 'google', 'SINCRONIZADO', response || {});
    }

    return Promise.resolve(0);
  }

  function samePeriod(row, periodoId) {
    row = row || {};
    return text(row.periodoId || row.periodoCanonicoId || row.id) === text(periodoId);
  }

  function getRawRows(tableName, periodoId, fullPeriod) {
    var core = getCore();
    var stores = (window.BL2Config && window.BL2Config.stores) || {};

    if (!core || typeof core.getRawTable !== 'function') {
      return Promise.resolve([]);
    }

    return core.getRawTable(tableName).then(function (rows) {
      rows = Array.isArray(rows) ? rows : [];

      if (tableName === (stores.syncMeta || 'sync_meta')) return rows;

      if (tableName === (stores.periodos || 'periodos')) {
        return rows.filter(function (row) {
          return text(row.id || row.periodoId) === text(periodoId);
        });
      }

      return rows.filter(function (row) {
        return samePeriod(row, periodoId);
      });
    }).catch(function () {
      return [];
    });
  }

  function getTableRowsForPeriod(periodoId, fullPeriod) {
    var stores = (window.BL2Config && window.BL2Config.stores) || {};
    var result = {};
    var tableNames = [
      stores.periodos || 'periodos',
      stores.requisitos || 'requisitos',
      stores.contactos || 'contactos',
      stores.notas || 'notas',
      stores.cambios || 'cambios',
      stores.logs || 'logs',
      stores.resumen || 'resumen',
      stores.errores || 'errores',
      stores.syncMeta || 'sync_meta'
    ];

    return getStudentsForPeriod(periodoId).then(function (students) {
      result[stores.estudiantes || 'estudiantes'] = students;

      var chain = Promise.resolve();
      tableNames.forEach(function (tableName) {
        chain = chain.then(function () {
          return getRawRows(tableName, periodoId, fullPeriod).then(function (rows) {
            result[tableName] = rows;
          });
        });
      });

      return chain.then(function () {
        return result;
      });
    });
  }

  function requireSheetsConfig() {
    var store = getStore();
    var config = store ? store.getSheetsConfig({ includeSecret: true }) : {};
    var url = text(config.appsScriptUrl);
    var token = text(config.token);
    var spreadsheetId = text(config.spreadsheetId);

    if (!store) throw new Error('BDLocalConfigStore no está cargado.');
    if (!config.enabled) throw new Error('Google Sheets está desactivado en la configuración.');
    if (!url) throw new Error('Falta configurar la URL de Apps Script.');
    if (!token) throw new Error('Falta el token de Apps Script. Copia el valor de Config → token.');
    if (!spreadsheetId) throw new Error('Falta el ID del Google Sheet.');

    return {
      store: store,
      config: config,
      url: url,
      token: token,
      spreadsheetId: spreadsheetId,
      sheetName: text(config.sheetName || 'Requisitos')
    };
  }

  function buildSheetsPayload(period, options) {
    options = options || {};
    var sheets = requireSheetsConfig();
    var firstFull = !!options.firstFull;

    return Promise.all([
      getPendingGoogleChanges(period.id),
      getTableRowsForPeriod(period.id, firstFull)
    ]).then(function (values) {
      var changes = values[0] || [];
      var tables = values[1] || {};

      return {
        action: 'sync_bl2',
        target: 'google_sheets',
        source: options.source || 'BDLocalSyncManager',
        token: sheets.token,
        spreadsheetId: sheets.spreadsheetId,
        sheetName: sheets.sheetName,
        mode: firstFull ? 'full_period' : 'changes',
        periodoId: period.id,
        periodoLabel: period.label,
        generatedAt: nowIso(),
        commonFields: (window.BL2Config && window.BL2Config.google && window.BL2Config.google.commonFields) || ['periodoId', 'cedula', 'updatedAt'],
        changes: changes,
        tables: tables
      };
    });
  }

  function testSheets() {
    var store = getStore();

    try {
      var sheets = requireSheetsConfig();
      dispatchProgress('google', 15, 'Probando Google Sheets...');
      modal('info', 'Google Sheets', 'Enviando ping a Apps Script.', { url: sheets.url, spreadsheetId: sheets.spreadsheetId });

      return syncGoogleUrlToBL2().then(function () {
        return postJson(sheets.url, {
          action: 'ping',
          source: 'BDLocalConfig',
          token: sheets.token,
          spreadsheetId: sheets.spreadsheetId,
          sheetName: sheets.sheetName,
          at: nowIso()
        }, 30000);
      }).then(function (response) {
        store.updateConnectionStatus('sheets', { connected: true, status: 'ok', lastError: '' });
        dispatchProgress('google', 100, 'Google Sheets conectado.');
        modal('success', 'Google Sheets conectado', 'Apps Script respondió correctamente.', response);
        return { ok: true, message: 'Google Sheets / Apps Script respondió correctamente.', response: response };
      }).catch(function (error) {
        store.updateConnectionStatus('sheets', { connected: false, status: 'error', lastError: error.message || String(error) });
        dispatchProgress('google', 0, 'Google Sheets con error.');
        modal('error', 'Google Sheets falló', error.message || String(error), {});
        return { ok: false, message: 'Google Sheets falló: ' + (error.message || String(error)) };
      });
    } catch (error) {
      if (store) {
        store.updateConnectionStatus('sheets', { connected: false, status: 'sin_configurar', lastError: error.message || String(error) });
      }
      modal('error', 'Configuración Google Sheets incompleta', error.message || String(error), {});
      return Promise.resolve({ ok: false, message: error.message || String(error) });
    }
  }

  function pushLocalToSheets(options) {
    options = options || {};

    var store = getStore();
    var sheets;

    try {
      sheets = requireSheetsConfig();
    } catch (error) {
      modal('error', 'Configuración Google Sheets incompleta', error.message || String(error), {});
      return Promise.resolve({ ok: false, message: error.message || String(error) });
    }

    dispatchProgress('google', 10, 'Preparando Google Sheets...');

    return getActivePeriod().then(function (period) {
      if (!period || !period.id) throw new Error('Seleccione un período activo.');

      var config = sheets.config;
      var firstFull = typeof options.fullPeriod === 'boolean' ? !!options.fullPeriod : !config.firstFullUploadDone;
      if (options.mode === 'full_period') firstFull = true;

      dispatchProgress('google', 15, firstFull ? 'Armando primera subida completa...' : 'Armando cambios pendientes...');

      return buildSheetsPayload(period, {
        firstFull: firstFull,
        source: options.source || 'BDLocalSyncManager'
      }).then(function (payload) {
        var tableSummary = {};
        Object.keys(payload.tables || {}).forEach(function (key) {
          tableSummary[key] = Array.isArray(payload.tables[key]) ? payload.tables[key].length : 0;
        });

        modal('info', 'Payload Google Sheets preparado', 'Se enviará el paquete multi-tabla a Apps Script.', {
          periodoId: payload.periodoId,
          mode: payload.mode,
          changes: payload.changes.length,
          tables: tableSummary
        });

        dispatchProgress('google', 35, 'Enviando a Apps Script...');

        return postJson(sheets.url, payload, FETCH_TIMEOUT_MS).then(function (response) {
          dispatchProgress('google', 75, 'Apps Script respondió. Marcando cambios...');

          return markGoogleChanges(payload.changes, response).then(function () {
            var patch = {
              sheets: {
                connected: true,
                status: 'ok',
                lastSyncAt: nowIso(),
                lastError: ''
              }
            };

            if (firstFull) {
              patch.sheets.firstFullUploadDone = true;
              patch.sheets.lastFullUploadAt = nowIso();
            } else {
              patch.sheets.lastDeltaUploadAt = nowIso();
            }

            store.patchConfig(patch);

            return refreshCounts().then(function () {
              dispatchProgress('google', 100, 'Google Sheets sincronizado.');
              modal('success', 'Google Sheets sincronizado', firstFull ? 'Primera subida completa finalizada.' : 'Cambios enviados a Google Sheets.', response);

              return {
                ok: true,
                target: 'google',
                periodoId: period.id,
                changes: payload.changes.length,
                response: response,
                message: firstFull ? 'Primera subida completa a Google Sheets finalizada.' : 'Cambios enviados a Google Sheets.'
              };
            });
          });
        });
      });
    }).catch(function (error) {
      if (store) {
        store.updateConnectionStatus('sheets', { connected: false, status: 'error', lastError: error.message || String(error) });
      }
      dispatchProgress('google', 0, 'Google Sheets con error: ' + (error.message || String(error)));
      modal('error', 'No se pudo subir a Google Sheets', error.message || String(error), {});
      return { ok: false, message: 'No se pudo subir a Google Sheets: ' + (error.message || String(error)) };
    });
  }

  function testFirebase() {
    var store = getStore();
    var sync = getSync();

    if (!store) return Promise.reject(new Error('Store no disponible.'));

    if (!sync || typeof sync.ensureFirebase !== 'function') {
      store.updateConnectionStatus('firebase', { connected: false, status: 'error', lastError: 'BL2Sync.ensureFirebase no disponible.' });
      return Promise.resolve({ ok: false, message: 'Firebase no está disponible todavía.' });
    }

    dispatchProgress('firebase', 15, 'Probando Firebase...');

    return sync.ensureFirebase().then(function () {
      store.updateConnectionStatus('firebase', { connected: true, status: 'ok', lastError: '' });
      store.registerFirebaseUsage({ reads: 1, label: 'Prueba de conexión Firebase.' });
      dispatchProgress('firebase', 100, 'Firebase conectado.');
      return { ok: true, message: 'Firebase conectado correctamente.' };
    }).catch(function (error) {
      store.updateConnectionStatus('firebase', { connected: false, status: 'error', lastError: error.message || String(error) });
      dispatchProgress('firebase', 0, 'Firebase con error.');
      return { ok: false, message: 'Firebase falló: ' + (error.message || String(error)) };
    });
  }

  function pullFirebaseToLocal() {
    var store = getStore();
    var sync = getSync();

    if (!sync || typeof sync.syncFirebase !== 'function') {
      return Promise.resolve({ ok: false, message: 'BL2Sync.syncFirebase no está disponible.' });
    }

    dispatchProgress('firebase', 10, 'Traer Firebase → BDLocal...');

    return getActivePeriod().then(function (period) {
      if (!period || !period.id) throw new Error('Seleccione un período activo.');

      var quota = store.getFirebaseQuotaStatus(20);
      if (!quota.allowed) throw new Error('Firebase bloqueado por cuota manual: ' + quota.used + ' / ' + quota.limit + '.');

      return sync.syncFirebase({ periodoId: period.id, periodoLabel: period.label, action: 'download', force: true });
    }).then(function (result) {
      var count = Number(result.downloaded || 0);
      store.registerFirebaseUsage({ reads: Math.max(count, 1), label: 'Descarga Firebase → BDLocal.' });
      store.updateConnectionStatus('firebase', { connected: !!result.ok, status: result.ok ? 'ok' : 'error', lastError: result.ok ? '' : (result.error || '') });

      return refreshCounts().then(function () {
        dispatchProgress('firebase', 100, 'Firebase descargado.');
        return { ok: !!result.ok, message: result.ok ? ('Firebase → BDLocal completado. Registros: ' + count) : ('Firebase no completó: ' + (result.error || 'sin detalle')) };
      });
    }).catch(function (error) {
      store.updateConnectionStatus('firebase', { connected: false, status: 'error', lastError: error.message || String(error) });
      dispatchProgress('firebase', 0, 'Error al traer Firebase.');
      return { ok: false, message: 'No se pudo traer Firebase: ' + (error.message || String(error)) };
    });
  }

  function pushLocalToFirebase() {
    var store = getStore();
    var sync = getSync();

    if (!sync || typeof sync.syncFirebase !== 'function') {
      return Promise.resolve({ ok: false, message: 'BL2Sync.syncFirebase no está disponible.' });
    }

    dispatchProgress('firebase', 10, 'Preparando subida a Firebase...');

    return getStudentsForActivePeriod().then(function (data) {
      var estimatedWrites = Math.max(data.students.length, 1);
      var quota = store.getFirebaseQuotaStatus(estimatedWrites);

      if (!quota.allowed) throw new Error('Subida detenida por cuota manual Firebase: ' + quota.used + ' / ' + quota.limit + '.');

      return sync.syncFirebase({ periodoId: data.period.id, periodoLabel: data.period.label, action: 'upload', force: true }).then(function (result) {
        store.registerFirebaseUsage({ writes: Number(result.uploaded || estimatedWrites), label: 'Subida BDLocal → Firebase.' });
        store.updateConnectionStatus('firebase', { connected: !!result.ok, status: result.ok ? 'ok' : 'error', lastError: result.ok ? '' : (result.error || '') });

        return refreshCounts().then(function () {
          dispatchProgress('firebase', 100, 'Firebase actualizado.');
          return { ok: !!result.ok, message: result.ok ? ('BDLocal → Firebase completado. Subidos: ' + Number(result.uploaded || 0)) : ('Firebase falló: ' + (result.error || 'sin detalle')) };
        });
      });
    }).catch(function (error) {
      store.updateConnectionStatus('firebase', { connected: false, status: 'error', lastError: error.message || String(error) });
      dispatchProgress('firebase', 0, 'Firebase con error.');
      return { ok: false, message: 'No se pudo subir a Firebase: ' + (error.message || String(error)) };
    });
  }

  function supabaseHeaders(key, extra) {
    return Object.assign({ apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, extra || {});
  }

  function getSupabaseTable(config) {
    var table = text(config.tableName || 'app_records');
    return table === 'requisitos_estudiantes' ? 'app_records' : table;
  }

  function testSupabase() {
    var store = getStore();
    var config = store.getSupabaseConfig({ includeSecret: true });
    var url = text(config.url).replace(/\/$/, '');
    var key = text(config.anonKey);
    var table = getSupabaseTable(config);

    if (!url || !key || !table) {
      store.updateConnectionStatus('supabase', { connected: false, status: 'sin_configurar', lastError: 'Faltan URL, anon key o tabla.' });
      return Promise.resolve({ ok: false, message: 'Faltan datos de Supabase: URL, anon key o tabla.' });
    }

    dispatchProgress('supabase', 15, 'Probando Supabase...');

    return fetch(url + '/rest/v1/' + encodeURIComponent(table) + '?select=id&limit=1', {
      method: 'GET',
      mode: 'cors',
      headers: supabaseHeaders(key)
    }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.text();
    }).then(function () {
      store.patchConfig({ supabase: { tableName: table } });
      store.updateConnectionStatus('supabase', { connected: true, status: 'ok', lastError: '' });
      dispatchProgress('supabase', 100, 'Supabase conectado.');
      return { ok: true, message: 'Supabase respondió correctamente.' };
    }).catch(function (error) {
      store.updateConnectionStatus('supabase', { connected: false, status: 'error', lastError: error.message || String(error) });
      dispatchProgress('supabase', 0, 'Supabase con error.');
      return { ok: false, message: 'Supabase falló: ' + (error.message || String(error)) };
    });
  }

  function toAppRecord(row, period) {
    row = clone(row || {});
    var studentId = text(row.id || ((row.cedula || row.numeroIdentificacion || '') + '__' + period.id));

    return {
      id: 'estudiantes__' + studentId,
      module_key: 'requisitos',
      table_key: 'estudiantes',
      record_key: studentId,
      periodo_id: text(row.periodoId || period.id),
      estudiante_id: studentId,
      source: 'bdlocal',
      sync_status: 'sincronizado',
      schema_version: '1',
      payload: Object.assign({}, row, {
        id: studentId,
        cedula: text(row.cedula || row.numeroIdentificacion || ''),
        periodoId: text(row.periodoId || period.id),
        periodoLabel: text(row.periodoLabel || period.label),
        updatedAt: text(row.updatedAt || nowIso()),
        syncSource: 'BDLocal'
      })
    };
  }

  function runBatches(items, size, handler, target) {
    items = Array.isArray(items) ? items : [];
    size = Math.max(1, Number(size || 25));

    var done = 0;
    var chain = Promise.resolve();

    for (var i = 0; i < items.length; i += size) {
      (function (batch) {
        chain = chain.then(function () {
          return handler(batch).then(function () {
            done += batch.length;
            var percent = items.length ? Math.round((done * 90) / items.length) + 5 : 100;
            dispatchProgress(target, percent, target + ': ' + done + ' de ' + items.length);
          });
        });
      })(items.slice(i, i + size));
    }

    return chain.then(function () { return { total: items.length, done: done }; });
  }

  function pushLocalToSupabase() {
    var store = getStore();
    var config = store.getSupabaseConfig({ includeSecret: true });
    var url = text(config.url).replace(/\/$/, '');
    var key = text(config.anonKey);
    var table = getSupabaseTable(config);
    var batchSize = Math.max(1, Number((store.loadConfig().sheets || {}).batchSize || 25));

    if (!config.enabled) return Promise.resolve({ ok: false, message: 'Supabase está desactivado en la configuración.' });
    if (!url || !key || !table) return Promise.resolve({ ok: false, message: 'Faltan datos de Supabase: URL, anon key o tabla.' });

    dispatchProgress('supabase', 10, 'Preparando Supabase...');

    return getStudentsForActivePeriod().then(function (data) {
      var rows = data.students.map(function (row) { return toAppRecord(row, data.period); });

      if (!rows.length) return { ok: true, message: 'No hay estudiantes para subir a Supabase.' };

      return runBatches(rows, batchSize, function (batch) {
        return postJson(url + '/rest/v1/' + encodeURIComponent(table) + '?on_conflict=id', batch, supabaseHeaders(key), 60000);
      }, 'supabase').then(function (result) {
        store.patchConfig({ supabase: { tableName: table, connected: true, status: 'ok', lastSyncAt: nowIso(), lastError: '' } });
        dispatchProgress('supabase', 100, 'Supabase actualizado.');
        return { ok: true, message: 'BDLocal → Supabase completado. Subidos: ' + result.done };
      });
    }).catch(function (error) {
      store.updateConnectionStatus('supabase', { connected: false, status: 'error', lastError: error.message || String(error) });
      dispatchProgress('supabase', 0, 'Supabase con error.');
      return { ok: false, message: 'No se pudo subir a Supabase: ' + (error.message || String(error)) };
    });
  }

  function testAll() {
    var store = getStore();
    var config = store ? store.loadConfig() : {};
    var supabaseEnabled = !!(config.supabase && config.supabase.enabled);
    var sheetsEnabled = !!(config.sheets && config.sheets.enabled);

    return Promise.resolve().then(testFirebase).then(function (firebaseResult) {
      return (sheetsEnabled ? testSheets() : Promise.resolve({ ok: true, skipped: true })).then(function (sheetsResult) {
        return (supabaseEnabled ? testSupabase() : Promise.resolve({ ok: true, skipped: true })).then(function (supabaseResult) {
          return {
            ok: !!firebaseResult.ok && !!sheetsResult.ok && !!supabaseResult.ok,
            message: 'Pruebas finalizadas. Firebase: ' + (firebaseResult.ok ? 'OK' : 'Error') + ', Sheets: ' + (sheetsResult.skipped ? 'Desactivado' : (sheetsResult.ok ? 'OK' : 'Error')) + ', Supabase: ' + (supabaseResult.skipped ? 'Desactivado' : (supabaseResult.ok ? 'OK' : 'Error')) + '.'
          };
        });
      });
    });
  }

  function syncAll() {
    var store = getStore();
    var config = store ? store.loadConfig() : {};
    var results = [];

    return Promise.resolve()
      .then(function () { return pushLocalToFirebase().then(function (result) { results.push(result); return result; }); })
      .then(function () { if (!config.sheets || !config.sheets.enabled) return null; return pushLocalToSheets().then(function (result) { results.push(result); return result; }); })
      .then(function () { if (!config.supabase || !config.supabase.enabled) return null; return pushLocalToSupabase().then(function (result) { results.push(result); return result; }); })
      .then(function () {
        var hasError = results.some(function (item) { return item && item.ok === false; });
        return { ok: !hasError, message: hasError ? 'Sincronización finalizada con alertas. Revisa diagnóstico.' : 'Sincronización total completada.' };
      });
  }

  function syncQueue() {
    var store = getStore();
    var config = store ? store.loadConfig() : {};

    return Promise.resolve()
      .then(function () { if (config.sheets && config.sheets.enabled) return pushLocalToSheets(); return { ok: true, message: 'Google Sheets desactivado.' }; })
      .then(function () { if (config.supabase && config.supabase.enabled) return pushLocalToSupabase(); return { ok: true, message: 'Supabase desactivado.' }; })
      .then(function () { return refreshCounts(); })
      .then(function () { return { ok: true, message: 'Pendientes procesados según configuración activa.' }; });
  }

  function setupFirebaseConfigAdapter() {
    var store = getStore();
    var sync = getSync();

    if (!store || !sync || typeof sync.ensureFirebase !== 'function') return;

    store.setRemoteConfigAdapter({
      saveConfig: function (config) {
        return sync.ensureFirebase().then(function (firestore) {
          return firestore.collection('BDLocalConfig').doc('configuracion_general').set({
            id: 'configuracion_general',
            source: 'BDLocalConfigStore',
            config: clone(config),
            updatedAt: nowIso()
          }, { merge: true });
        });
      },
      loadConfig: function () {
        return sync.ensureFirebase().then(function (firestore) {
          return firestore.collection('BDLocalConfig').doc('configuracion_general').get().then(function (doc) {
            if (!doc.exists) return null;
            var data = doc.data() || {};
            return data.config || null;
          });
        });
      }
    });
  }

  function bootstrapUI() {
    setupFirebaseConfigAdapter();
    refreshCounts();

    var boot = function () {
      var root = document.getElementById('bdlocal-config-root');

      if (root && window.BDLocalConfigUI && typeof window.BDLocalConfigUI.init === 'function') {
        window.BDLocalConfigUI.init({ container: root });
      }

      enhanceSheetsTokenUI();
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    window.addEventListener('bl2:ready', function () {
      setupFirebaseConfigAdapter();
      refreshCounts().then(function () {
        if (window.BDLocalConfigUI && typeof window.BDLocalConfigUI.render === 'function') window.BDLocalConfigUI.render();
        enhanceSheetsTokenUI();
      });
    });

    window.addEventListener('bl2:students-saved', function () {
      refreshCounts().then(function () {
        if (window.BDLocalConfigUI && typeof window.BDLocalConfigUI.render === 'function') window.BDLocalConfigUI.render();
        enhanceSheetsTokenUI();
      });
    });
  }

  window.BDLocalSyncManager = {
    testFirebase: testFirebase,
    pullFirebaseToLocal: pullFirebaseToLocal,
    pushLocalToFirebase: pushLocalToFirebase,
    testSheets: testSheets,
    pushLocalToSheets: pushLocalToSheets,
    testSupabase: testSupabase,
    pushLocalToSupabase: pushLocalToSupabase,
    testAll: testAll,
    syncAll: syncAll,
    syncQueue: syncQueue,
    refreshCounts: refreshCounts,
    setupFirebaseConfigAdapter: setupFirebaseConfigAdapter,
    bootstrapUI: bootstrapUI
  };

  bootstrapUI();
})(window, document);
