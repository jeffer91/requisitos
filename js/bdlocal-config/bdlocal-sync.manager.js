/*
  Archivo: bdlocal-sync.manager.js
  Ruta: js/bdlocal-config/bdlocal-sync.manager.js

  Función MVP:
  - Conectar el panel nuevo de BDLocal con los módulos existentes BL2Core y BL2Sync.
  - Probar Firebase, Supabase y Google Sheets.
  - Traer Firebase -> BDLocal usando BL2Sync.
  - Subir BDLocal -> Firebase usando BL2Sync y control de cuota manual.
  - Subir BDLocal -> Google Sheets usando BL2Sync y la configuración guardada en el panel.
  - Subir BDLocal -> Supabase por REST en lotes.
*/
(function (window, document) {
  'use strict';

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
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value;
    }
  }

  function log(scope, message, level, data) {
    var store = getStore();
    if (store && typeof store.addLog === 'function') {
      store.addLog(scope || 'sync', message || '', level || 'info', data || {});
    }

    if (window.BL2Core && typeof window.BL2Core.log === 'function') {
      return window.BL2Core.log(level === 'error' ? 'ERROR' : level === 'warning' ? 'WARN' : 'INFO', message || '', data || {}).catch(function () {});
    }

    return Promise.resolve();
  }

  function uiProgress(active, percent, message) {
    if (window.BDLocalConfigUI && typeof window.BDLocalConfigUI.setProgress === 'function') {
      window.BDLocalConfigUI.setProgress(active, percent, message || '');
    }
  }

  function dispatchProgress(target, percent, detail) {
    try {
      window.dispatchEvent(new CustomEvent('bl2:sync-progress', {
        detail: {
          target: target,
          percent: Math.max(0, Math.min(100, Number(percent || 0))),
          detail: detail || '',
          at: nowIso()
        }
      }));
    } catch (error) {}
  }

  function requireModules() {
    if (!getStore()) {
      return Promise.reject(new Error('BDLocalConfigStore no está cargado.'));
    }

    if (!getCore()) {
      return Promise.reject(new Error('BL2Core no está cargado.'));
    }

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

  function getStudentsForActivePeriod() {
    return requireModules().then(getActivePeriod).then(function (period) {
      if (!period || !period.id) {
        throw new Error('Seleccione un período activo antes de sincronizar.');
      }

      return getCore().getStudents({ periodoId: period.id }).then(function (students) {
        return {
          period: period,
          students: Array.isArray(students) ? students : []
        };
      });
    });
  }

  function refreshCounts() {
    var store = getStore();
    var core = getCore();

    if (!store || !core) return Promise.resolve(null);

    return getActivePeriod().then(function (period) {
      if (!period || !period.id || typeof core.getSummary !== 'function') {
        return null;
      }

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

  function postJson(url, payload, headers) {
    return fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
      body: JSON.stringify(payload || {})
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

        return data;
      });
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

    uiProgress(true, 10, 'Probando Firebase...');

    return sync.ensureFirebase().then(function () {
      store.updateConnectionStatus('firebase', { connected: true, status: 'ok', lastError: '' });
      store.registerFirebaseUsage({ reads: 1, label: 'Prueba de conexión Firebase.' });
      uiProgress(false, 100, 'Firebase conectado.');
      return { ok: true, message: 'Firebase conectado correctamente.' };
    }).catch(function (error) {
      store.updateConnectionStatus('firebase', { connected: false, status: 'error', lastError: error.message || String(error) });
      uiProgress(false, 0, 'Firebase con error.');
      return { ok: false, message: 'Firebase falló: ' + (error.message || String(error)) };
    });
  }

  function pullFirebaseToLocal() {
    var store = getStore();
    var sync = getSync();

    if (!sync || typeof sync.syncFirebase !== 'function') {
      return Promise.resolve({ ok: false, message: 'BL2Sync.syncFirebase no está disponible.' });
    }

    uiProgress(true, 10, 'Traer Firebase → BDLocal...');

    return getActivePeriod().then(function (period) {
      if (!period || !period.id) throw new Error('Seleccione un período activo.');

      var quota = store.getFirebaseQuotaStatus(20);
      if (!quota.allowed) {
        throw new Error('Firebase bloqueado por cuota manual: ' + quota.used + ' / ' + quota.limit + '.');
      }

      return sync.syncFirebase({ periodoId: period.id, periodoLabel: period.label, action: 'download', force: true });
    }).then(function (result) {
      var count = Number(result.downloaded || 0);
      store.registerFirebaseUsage({ reads: Math.max(count, 1), label: 'Descarga Firebase → BDLocal.' });
      store.updateConnectionStatus('firebase', { connected: !!result.ok, status: result.ok ? 'ok' : 'error', lastError: result.ok ? '' : (result.error || '') });
      return refreshCounts().then(function () {
        uiProgress(false, 100, 'Firebase descargado.');
        return { ok: !!result.ok, message: result.ok ? ('Firebase → BDLocal completado. Registros: ' + count) : ('Firebase no completó: ' + (result.error || 'sin detalle')) };
      });
    }).catch(function (error) {
      store.updateConnectionStatus('firebase', { connected: false, status: 'error', lastError: error.message || String(error) });
      uiProgress(false, 0, 'Error al traer Firebase.');
      return { ok: false, message: 'No se pudo traer Firebase: ' + (error.message || String(error)) };
    });
  }

  function pushLocalToFirebase() {
    var store = getStore();
    var sync = getSync();

    if (!sync || typeof sync.syncFirebase !== 'function') {
      return Promise.resolve({ ok: false, message: 'BL2Sync.syncFirebase no está disponible.' });
    }

    uiProgress(true, 10, 'Preparando subida a Firebase...');

    return getStudentsForActivePeriod().then(function (data) {
      var estimatedWrites = Math.max(data.students.length, 1);
      var quota = store.getFirebaseQuotaStatus(estimatedWrites);

      if (!quota.allowed) {
        throw new Error('Subida detenida por cuota manual Firebase: ' + quota.used + ' / ' + quota.limit + '.');
      }

      return sync.syncFirebase({ periodoId: data.period.id, periodoLabel: data.period.label, action: 'upload', force: true }).then(function (result) {
        store.registerFirebaseUsage({ writes: Number(result.uploaded || estimatedWrites), label: 'Subida BDLocal → Firebase.' });
        store.updateConnectionStatus('firebase', { connected: !!result.ok, status: result.ok ? 'ok' : 'error', lastError: result.ok ? '' : (result.error || '') });
        return refreshCounts().then(function () {
          uiProgress(false, 100, 'Firebase actualizado.');
          return { ok: !!result.ok, message: result.ok ? ('BDLocal → Firebase completado. Subidos: ' + Number(result.uploaded || 0)) : ('Firebase falló: ' + (result.error || 'sin detalle')) };
        });
      });
    }).catch(function (error) {
      store.updateConnectionStatus('firebase', { connected: false, status: 'error', lastError: error.message || String(error) });
      uiProgress(false, 0, 'Firebase con error.');
      return { ok: false, message: 'No se pudo subir a Firebase: ' + (error.message || String(error)) };
    });
  }

  function testSheets() {
    var store = getStore();
    var config = store.getSheetsConfig({ includeSecret: true });
    var url = text(config.appsScriptUrl);

    if (!url) {
      store.updateConnectionStatus('sheets', { connected: false, status: 'sin_configurar', lastError: 'Falta URL de Apps Script.' });
      return Promise.resolve({ ok: false, message: 'Falta URL de Apps Script para Google Sheets.' });
    }

    uiProgress(true, 15, 'Probando Google Sheets...');

    return syncGoogleUrlToBL2().then(function () {
      return postJson(url, { action: 'ping', source: 'BDLocalConfig', at: nowIso() });
    }).then(function () {
      store.updateConnectionStatus('sheets', { connected: true, status: 'ok', lastError: '' });
      uiProgress(false, 100, 'Google Sheets conectado.');
      return { ok: true, message: 'Google Sheets / Apps Script respondió correctamente.' };
    }).catch(function (error) {
      store.updateConnectionStatus('sheets', { connected: false, status: 'error', lastError: error.message || String(error) });
      uiProgress(false, 0, 'Google Sheets con error.');
      return { ok: false, message: 'Google Sheets falló: ' + (error.message || String(error)) };
    });
  }

  function pushLocalToSheets() {
    var store = getStore();
    var sync = getSync();
    var config = store.getSheetsConfig({ includeSecret: true });

    if (!config.enabled) {
      return Promise.resolve({ ok: false, message: 'Google Sheets está desactivado en la configuración.' });
    }

    if (!text(config.appsScriptUrl)) {
      return Promise.resolve({ ok: false, message: 'Falta configurar la URL de Apps Script.' });
    }

    if (!sync || typeof sync.syncGoogle !== 'function') {
      return Promise.resolve({ ok: false, message: 'BL2Sync.syncGoogle no está disponible.' });
    }

    uiProgress(true, 10, 'Preparando Google Sheets...');

    return getActivePeriod().then(function (period) {
      if (!period || !period.id) throw new Error('Seleccione un período activo.');

      return syncGoogleUrlToBL2().then(function () {
        var firstFull = !config.firstFullUploadDone;
        dispatchProgress('google', 15, firstFull ? 'Primera subida completa en lotes...' : 'Subiendo cambios pendientes...');

        return sync.syncGoogle({
          periodoId: period.id,
          periodoLabel: period.label,
          force: true,
          fullPeriod: firstFull,
          action: firstFull ? 'first_full_upload' : 'sync_bl2'
        }).then(function (result) {
          var patch = {
            sheets: {
              connected: !!result.ok,
              status: result.ok ? 'ok' : 'error',
              lastSyncAt: nowIso(),
              lastError: result.ok ? '' : (result.error || result.reason || '')
            }
          };

          if (result.ok && firstFull) {
            patch.sheets.firstFullUploadDone = true;
            patch.sheets.lastFullUploadAt = nowIso();
          }

          if (result.ok && !firstFull) {
            patch.sheets.lastDeltaUploadAt = nowIso();
          }

          store.patchConfig(patch);

          return refreshCounts().then(function () {
            uiProgress(false, 100, 'Google Sheets actualizado.');
            return {
              ok: !!result.ok,
              message: result.ok
                ? (firstFull ? 'Primera subida completa a Google Sheets finalizada.' : 'Cambios enviados a Google Sheets.')
                : ('Google Sheets no completó: ' + (result.error || result.reason || 'sin detalle'))
            };
          });
        });
      });
    }).catch(function (error) {
      store.updateConnectionStatus('sheets', { connected: false, status: 'error', lastError: error.message || String(error) });
      uiProgress(false, 0, 'Google Sheets con error.');
      return { ok: false, message: 'No se pudo subir a Google Sheets: ' + (error.message || String(error)) };
    });
  }

  function supabaseHeaders(key, extra) {
    return Object.assign({
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json'
    }, extra || {});
  }

  function testSupabase() {
    var store = getStore();
    var config = store.getSupabaseConfig({ includeSecret: true });
    var url = text(config.url).replace(/\/$/, '');
    var key = text(config.anonKey);
    var table = text(config.tableName || 'requisitos_estudiantes');

    if (!url || !key || !table) {
      store.updateConnectionStatus('supabase', { connected: false, status: 'sin_configurar', lastError: 'Faltan URL, anon key o tabla.' });
      return Promise.resolve({ ok: false, message: 'Faltan datos de Supabase: URL, anon key o tabla.' });
    }

    uiProgress(true, 15, 'Probando Supabase...');

    return fetch(url + '/rest/v1/' + encodeURIComponent(table) + '?select=*&limit=1', {
      method: 'GET',
      mode: 'cors',
      headers: supabaseHeaders(key)
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      return response.text();
    }).then(function () {
      store.updateConnectionStatus('supabase', { connected: true, status: 'ok', lastError: '' });
      uiProgress(false, 100, 'Supabase conectado.');
      return { ok: true, message: 'Supabase respondió correctamente.' };
    }).catch(function (error) {
      store.updateConnectionStatus('supabase', { connected: false, status: 'error', lastError: error.message || String(error) });
      uiProgress(false, 0, 'Supabase con error.');
      return { ok: false, message: 'Supabase falló: ' + (error.message || String(error)) };
    });
  }

  function toSupabaseRow(row, period) {
    row = clone(row || {});
    return Object.assign({}, row, {
      id: text(row.id || ((row.cedula || row.numeroIdentificacion || '') + '__' + period.id)),
      cedula: text(row.cedula || row.numeroIdentificacion || ''),
      periodoId: text(row.periodoId || period.id),
      periodoLabel: text(row.periodoLabel || period.label),
      updatedAt: text(row.updatedAt || nowIso()),
      syncSource: 'BDLocal'
    });
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
            uiProgress(true, percent, target + ': ' + done + ' de ' + items.length);
            dispatchProgress(target, percent, target + ': ' + done + ' de ' + items.length);
          });
        });
      })(items.slice(i, i + size));
    }

    return chain.then(function () {
      return { total: items.length, done: done };
    });
  }

  function pushLocalToSupabase() {
    var store = getStore();
    var config = store.getSupabaseConfig({ includeSecret: true });
    var url = text(config.url).replace(/\/$/, '');
    var key = text(config.anonKey);
    var table = text(config.tableName || 'requisitos_estudiantes');
    var batchSize = Math.max(1, Number((store.loadConfig().sheets || {}).batchSize || 25));

    if (!config.enabled) {
      return Promise.resolve({ ok: false, message: 'Supabase está desactivado en la configuración.' });
    }

    if (!url || !key || !table) {
      return Promise.resolve({ ok: false, message: 'Faltan datos de Supabase: URL, anon key o tabla.' });
    }

    uiProgress(true, 10, 'Preparando Supabase...');

    return getStudentsForActivePeriod().then(function (data) {
      var rows = data.students.map(function (row) {
        return toSupabaseRow(row, data.period);
      });

      if (!rows.length) {
        return { ok: true, message: 'No hay estudiantes para subir a Supabase.' };
      }

      return runBatches(rows, batchSize, function (batch) {
        return postJson(
          url + '/rest/v1/' + encodeURIComponent(table) + '?on_conflict=id',
          batch,
          supabaseHeaders(key, { Prefer: 'resolution=merge-duplicates,return=minimal' })
        );
      }, 'supabase').then(function (result) {
        store.patchConfig({
          supabase: {
            connected: true,
            status: 'ok',
            lastSyncAt: nowIso(),
            lastError: ''
          }
        });
        uiProgress(false, 100, 'Supabase actualizado.');
        return { ok: true, message: 'BDLocal → Supabase completado. Subidos: ' + result.done };
      });
    }).catch(function (error) {
      store.updateConnectionStatus('supabase', { connected: false, status: 'error', lastError: error.message || String(error) });
      uiProgress(false, 0, 'Supabase con error.');
      return { ok: false, message: 'No se pudo subir a Supabase: ' + (error.message || String(error)) };
    });
  }

  function testAll() {
    return Promise.resolve()
      .then(testFirebase)
      .then(function (firebaseResult) {
        return testSheets().then(function (sheetsResult) {
          return testSupabase().then(function (supabaseResult) {
            return {
              ok: !!firebaseResult.ok && !!sheetsResult.ok && !!supabaseResult.ok,
              message: 'Pruebas finalizadas. Firebase: ' + (firebaseResult.ok ? 'OK' : 'Error') + ', Sheets: ' + (sheetsResult.ok ? 'OK' : 'Error') + ', Supabase: ' + (supabaseResult.ok ? 'OK' : 'Error') + '.'
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
      .then(function () {
        return pushLocalToFirebase().then(function (result) {
          results.push(result);
          return result;
        });
      })
      .then(function () {
        if (!config.sheets || !config.sheets.enabled) return null;
        return pushLocalToSheets().then(function (result) {
          results.push(result);
          return result;
        });
      })
      .then(function () {
        if (!config.supabase || !config.supabase.enabled) return null;
        return pushLocalToSupabase().then(function (result) {
          results.push(result);
          return result;
        });
      })
      .then(function () {
        var hasError = results.some(function (item) { return item && item.ok === false; });
        return {
          ok: !hasError,
          message: hasError ? 'Sincronización finalizada con alertas. Revisa diagnóstico.' : 'Sincronización total completada.'
        };
      });
  }

  function syncQueue() {
    var store = getStore();
    var config = store ? store.loadConfig() : {};

    return Promise.resolve()
      .then(function () {
        if (config.sheets && config.sheets.enabled) return pushLocalToSheets();
        return { ok: true, message: 'Google Sheets desactivado.' };
      })
      .then(function () {
        if (config.supabase && config.supabase.enabled) return pushLocalToSupabase();
        return { ok: true, message: 'Supabase desactivado.' };
      })
      .then(function () {
        return refreshCounts();
      })
      .then(function () {
        return { ok: true, message: 'Pendientes procesados según configuración activa.' };
      });
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
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }

    window.addEventListener('bl2:ready', function () {
      setupFirebaseConfigAdapter();
      refreshCounts().then(function () {
        if (window.BDLocalConfigUI && typeof window.BDLocalConfigUI.render === 'function') {
          window.BDLocalConfigUI.render();
        }
      });
    });

    window.addEventListener('bl2:students-saved', function () {
      refreshCounts().then(function () {
        if (window.BDLocalConfigUI && typeof window.BDLocalConfigUI.render === 'function') {
          window.BDLocalConfigUI.render();
        }
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
