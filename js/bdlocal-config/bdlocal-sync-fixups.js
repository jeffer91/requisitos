/*
  Archivo: bdlocal-sync-fixups.js
  Ruta: js/bdlocal-config/bdlocal-sync-fixups.js

  Función:
  - Revisar conexiones de la pantalla BDLocal al cargar.
  - Evitar que errores silenciosos queden ocultos.
  - Corregir la ruta Supabase para no usar el postJson de Google Sheets.
*/
(function (window, document) {
  'use strict';

  function text(value) {
    return String(value === null || value === undefined ? '' : value).trim();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function modal(level, title, message, data) {
    if (window.BDLocalModal && typeof window.BDLocalModal.add === 'function') {
      window.BDLocalModal.add(level || 'info', title || 'BDLocal', message || '', data || {});
    }
  }

  function store() {
    return window.BDLocalConfigStore || null;
  }

  function core() {
    return window.BL2Core || null;
  }

  function manager() {
    return window.BDLocalSyncManager || null;
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

    if (core() && typeof core().getActivePeriod === 'function') {
      return core().getActivePeriod().then(function (period) {
        if (!period || !text(period.id)) return null;
        return {
          id: text(period.id),
          label: text(period.label || period.periodoLabel || period.id)
        };
      });
    }

    return Promise.resolve(null);
  }

  function getStudents(periodoId) {
    if (!core() || typeof core().getStudents !== 'function') return Promise.resolve([]);

    return core().getStudents({ periodoId: periodoId, matricula: '' }).then(function (rows) {
      return Array.isArray(rows) ? rows : [];
    }).catch(function () {
      return [];
    });
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

  function supabaseHeaders(key, extra) {
    return Object.assign({
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json'
    }, extra || {});
  }

  function requestJson(url, options, timeoutMs) {
    timeoutMs = Number(timeoutMs || 60000);

    var controller = window.AbortController ? new AbortController() : null;
    var timer = null;

    if (controller) {
      timer = window.setTimeout(function () {
        controller.abort();
      }, timeoutMs);
    }

    options = options || {};
    if (controller) options.signal = controller.signal;

    return fetch(url, options).then(function (response) {
      return response.text().then(function (raw) {
        var data = null;
        try { data = raw ? JSON.parse(raw) : null; } catch (error) { data = raw; }
        if (!response.ok) throw new Error('HTTP ' + response.status + (raw ? ' · ' + raw.slice(0, 300) : ''));
        return data;
      });
    }).catch(function (error) {
      if (error && error.name === 'AbortError') {
        throw new Error('Tiempo agotado al comunicarse con Supabase.');
      }
      throw error;
    }).finally(function () {
      if (timer) window.clearTimeout(timer);
    });
  }

  function getSupabaseTable(config) {
    var table = text(config.tableName || 'app_records');
    return table === 'requisitos_estudiantes' ? 'app_records' : table;
  }

  function toAppRecord(row, period) {
    row = row || {};
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

  function runBatches(items, size, handler) {
    items = Array.isArray(items) ? items : [];
    size = Math.max(1, Number(size || 25));
    var done = 0;
    var chain = Promise.resolve();

    for (var i = 0; i < items.length; i += size) {
      (function (batch) {
        chain = chain.then(function () {
          return handler(batch).then(function () {
            done += batch.length;
            dispatchProgress('supabase', items.length ? Math.round((done * 90) / items.length) + 5 : 100, 'Supabase: ' + done + ' de ' + items.length);
          });
        });
      })(items.slice(i, i + size));
    }

    return chain.then(function () {
      return { done: done, total: items.length };
    });
  }

  function installSupabaseFix() {
    var m = manager();
    var s = store();
    if (!m || !s || m.__bdlocalSupabaseFixInstalled) return false;

    m.testSupabase = function () {
      var config = s.getSupabaseConfig({ includeSecret: true });
      var url = text(config.url).replace(/\/$/, '');
      var key = text(config.anonKey);
      var table = getSupabaseTable(config);

      if (!url || !key || !table) {
        s.updateConnectionStatus('supabase', { connected: false, status: 'sin_configurar', lastError: 'Faltan URL, anon key o tabla.' });
        modal('warning', 'Supabase incompleto', 'Faltan URL, anon key o tabla.', {});
        return Promise.resolve({ ok: false, message: 'Faltan datos de Supabase: URL, anon key o tabla.' });
      }

      dispatchProgress('supabase', 15, 'Probando Supabase...');

      return requestJson(url + '/rest/v1/' + encodeURIComponent(table) + '?select=id&limit=1', {
        method: 'GET',
        mode: 'cors',
        headers: supabaseHeaders(key)
      }, 30000).then(function () {
        s.patchConfig({ supabase: { tableName: table } });
        s.updateConnectionStatus('supabase', { connected: true, status: 'ok', lastError: '' });
        dispatchProgress('supabase', 100, 'Supabase conectado.');
        modal('success', 'Supabase conectado', 'La tabla ' + table + ' respondió correctamente.', {});
        return { ok: true, message: 'Supabase respondió correctamente.' };
      }).catch(function (error) {
        s.updateConnectionStatus('supabase', { connected: false, status: 'error', lastError: error.message || String(error) });
        dispatchProgress('supabase', 0, 'Supabase con error.');
        modal('error', 'Supabase falló', error.message || String(error), {});
        return { ok: false, message: 'Supabase falló: ' + (error.message || String(error)) };
      });
    };

    m.pushLocalToSupabase = function () {
      var config = s.getSupabaseConfig({ includeSecret: true });
      var url = text(config.url).replace(/\/$/, '');
      var key = text(config.anonKey);
      var table = getSupabaseTable(config);
      var batchSize = Math.max(1, Number((s.loadConfig().sheets || {}).batchSize || 25));

      if (!config.enabled) return Promise.resolve({ ok: false, message: 'Supabase está desactivado en la configuración.' });
      if (!url || !key || !table) return Promise.resolve({ ok: false, message: 'Faltan datos de Supabase: URL, anon key o tabla.' });

      dispatchProgress('supabase', 10, 'Preparando Supabase...');

      return getActivePeriod().then(function (period) {
        if (!period || !period.id) throw new Error('Seleccione un período activo.');
        return getStudents(period.id).then(function (students) {
          var rows = students.map(function (row) { return toAppRecord(row, period); });
          if (!rows.length) return { ok: true, message: 'No hay estudiantes para subir a Supabase.' };

          return runBatches(rows, batchSize, function (batch) {
            return requestJson(url + '/rest/v1/' + encodeURIComponent(table) + '?on_conflict=id', {
              method: 'POST',
              mode: 'cors',
              headers: supabaseHeaders(key, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
              body: JSON.stringify(batch)
            }, 60000);
          }).then(function (result) {
            s.patchConfig({ supabase: { tableName: table, connected: true, status: 'ok', lastSyncAt: nowIso(), lastError: '' } });
            dispatchProgress('supabase', 100, 'Supabase actualizado.');
            modal('success', 'Supabase sincronizado', 'Registros enviados: ' + result.done, result);
            return { ok: true, message: 'BDLocal → Supabase completado. Subidos: ' + result.done };
          });
        });
      }).catch(function (error) {
        s.updateConnectionStatus('supabase', { connected: false, status: 'error', lastError: error.message || String(error) });
        dispatchProgress('supabase', 0, 'Supabase con error.');
        modal('error', 'No se pudo subir a Supabase', error.message || String(error), {});
        return { ok: false, message: 'No se pudo subir a Supabase: ' + (error.message || String(error)) };
      });
    };

    m.__bdlocalSupabaseFixInstalled = true;
    modal('success', 'Correcciones BDLocal activas', 'La pantalla tiene diagnóstico y rutas de sincronización corregidas.', {});
    return true;
  }

  function healthCheck() {
    var missing = [];
    if (!window.BL2DB) missing.push('BL2DB');
    if (!window.BL2Core) missing.push('BL2Core');
    if (!window.BL2Sync) missing.push('BL2Sync');
    if (!window.BDLocalConfigStore) missing.push('BDLocalConfigStore');
    if (!window.BDLocalConfigUI) missing.push('BDLocalConfigUI');
    if (!window.BDLocalSyncManager) missing.push('BDLocalSyncManager');

    if (missing.length) {
      modal('warning', 'Módulos pendientes', 'Todavía faltan módulos por cargar: ' + missing.join(', '), { missing: missing });
      return false;
    }

    modal('success', 'Pantalla BDLocal conectada', 'Los módulos principales están cargados.', {});
    return true;
  }

  function start() {
    var attempts = 0;
    var timer = window.setInterval(function () {
      attempts += 1;
      var ok = healthCheck();
      var fixed = installSupabaseFix();

      if ((ok && fixed) || attempts >= 30) {
        window.clearInterval(timer);
      }
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  window.addEventListener('bl2:ready', function () {
    healthCheck();
    installSupabaseFix();
  });
})(window, document);
