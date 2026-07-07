/*
  Archivo: bdlocal-config.store.js
  Ruta: js/bdlocal-config/bdlocal-config.store.js

  Store mínimo viable para el centro de control de BDLocal.
  Guarda configuración local, cuota Firebase, cola y logs.
*/
(function (window) {
  'use strict';

  var KEYS = Object.freeze({
    CONFIG: 'requisitos.bdlocal.config.v1',
    QUEUE: 'requisitos.bdlocal.sync.queue.v1',
    LOGS: 'requisitos.bdlocal.config.logs.v1'
  });

  var remoteAdapter = null;

  function nowIso() {
    return new Date().toISOString();
  }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function parseJson(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isObject(value) {
    return value && Object.prototype.toString.call(value) === '[object Object]';
  }

  function merge(base, patch) {
    var out = clone(base || {});
    Object.keys(patch || {}).forEach(function (key) {
      if (isObject(out[key]) && isObject(patch[key])) {
        out[key] = merge(out[key], patch[key]);
      } else {
        out[key] = patch[key];
      }
    });
    return out;
  }

  function protect(value) {
    if (!value) return '';
    try {
      return 'bdlc1:' + window.btoa(unescape(encodeURIComponent(String(value))));
    } catch (error) {
      return String(value);
    }
  }

  function unprotect(value) {
    if (!value) return '';
    if (String(value).indexOf('bdlc1:') !== 0) return String(value);
    try {
      return decodeURIComponent(escape(window.atob(String(value).replace('bdlc1:', ''))));
    } catch (error) {
      return '';
    }
  }

  function mask(value) {
    var text = String(value || '');
    if (!text) return '';
    if (text.length <= 8) return '********';
    return text.slice(0, 4) + '********' + text.slice(-4);
  }

  function defaultConfig() {
    return {
      version: 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ui: { activeSection: 'resumen' },
      bdlocal: {
        connected: true,
        status: 'ok',
        totalRegistros: 0,
        lastTestAt: nowIso(),
        lastError: ''
      },
      firebase: {
        enabled: true,
        connected: false,
        status: 'pendiente',
        backupEnabled: true,
        dailyLimit: 500,
        warningPercent: 80,
        stopPercent: 95,
        usage: { date: todayKey(), reads: 0, writes: 0, deletes: 0, total: 0 },
        lastTestAt: '',
        lastBackupAt: '',
        lastRestoreAt: '',
        lastSyncAt: '',
        lastError: ''
      },
      supabase: {
        enabled: false,
        connected: false,
        status: 'sin_configurar',
        url: '',
        anonKeyProtected: '',
        tableName: 'requisitos_estudiantes',
        lastTestAt: '',
        lastSyncAt: '',
        lastError: ''
      },
      sheets: {
        enabled: false,
        connected: false,
        status: 'sin_configurar',
        appsScriptUrlProtected: '',
        spreadsheetId: '',
        sheetName: 'Requisitos',
        batchSize: 25,
        firstFullUploadDone: false,
        pendingCount: 0,
        lastTestAt: '',
        lastFullUploadAt: '',
        lastDeltaUploadAt: '',
        lastSyncAt: '',
        lastError: ''
      },
      sync: {
        mode: 'manual',
        lastSyncAt: '',
        currentTask: '',
        progress: { active: false, total: 0, done: 0, percent: 0, message: '' }
      },
      safety: {
        hideSensitiveValues: true,
        allowServiceRoleKeys: false
      }
    };
  }

  function normalize(config) {
    var out = merge(defaultConfig(), config || {});
    out.firebase.dailyLimit = Number(out.firebase.dailyLimit || 500);
    out.firebase.warningPercent = Number(out.firebase.warningPercent || 80);
    out.firebase.stopPercent = Number(out.firebase.stopPercent || 95);
    out.sheets.batchSize = Number(out.sheets.batchSize || 25);

    if (!out.firebase.usage || out.firebase.usage.date !== todayKey()) {
      out.firebase.usage = { date: todayKey(), reads: 0, writes: 0, deletes: 0, total: 0 };
    }

    return out;
  }

  function loadConfig() {
    return normalize(parseJson(window.localStorage.getItem(KEYS.CONFIG), null));
  }

  function saveConfig(config) {
    var out = normalize(config || defaultConfig());
    out.updatedAt = nowIso();
    window.localStorage.setItem(KEYS.CONFIG, JSON.stringify(out));
    return out;
  }

  function patchConfig(patch) {
    return saveConfig(merge(loadConfig(), patch || {}));
  }

  function resetConfig() {
    var config = saveConfig(defaultConfig());
    addLog('config', 'Configuración local reiniciada.', 'warning');
    return config;
  }

  function getSupabaseConfig(options) {
    var c = loadConfig().supabase;
    var includeSecret = options && options.includeSecret;
    var key = unprotect(c.anonKeyProtected);
    return {
      enabled: !!c.enabled,
      connected: !!c.connected,
      status: c.status,
      url: c.url,
      anonKey: includeSecret ? key : mask(key),
      tableName: c.tableName,
      lastTestAt: c.lastTestAt,
      lastSyncAt: c.lastSyncAt,
      lastError: c.lastError
    };
  }

  function setSupabaseConfig(data) {
    var patch = {
      supabase: {
        enabled: !!data.enabled,
        url: String(data.url || '').trim(),
        tableName: String(data.tableName || 'requisitos_estudiantes').trim(),
        status: data.enabled ? 'configurado' : 'sin_configurar'
      }
    };
    if (typeof data.anonKey === 'string') patch.supabase.anonKeyProtected = protect(data.anonKey.trim());
    addLog('supabase', 'Configuración de Supabase guardada.', 'success');
    return patchConfig(patch);
  }

  function getSheetsConfig(options) {
    var c = loadConfig().sheets;
    var includeSecret = options && options.includeSecret;
    var url = unprotect(c.appsScriptUrlProtected);
    return {
      enabled: !!c.enabled,
      connected: !!c.connected,
      status: c.status,
      appsScriptUrl: includeSecret ? url : mask(url),
      spreadsheetId: c.spreadsheetId,
      sheetName: c.sheetName,
      batchSize: c.batchSize,
      firstFullUploadDone: !!c.firstFullUploadDone,
      pendingCount: Number(c.pendingCount || 0),
      lastTestAt: c.lastTestAt,
      lastFullUploadAt: c.lastFullUploadAt,
      lastDeltaUploadAt: c.lastDeltaUploadAt,
      lastSyncAt: c.lastSyncAt,
      lastError: c.lastError
    };
  }

  function setSheetsConfig(data) {
    var patch = {
      sheets: {
        enabled: !!data.enabled,
        spreadsheetId: String(data.spreadsheetId || '').trim(),
        sheetName: String(data.sheetName || 'Requisitos').trim(),
        batchSize: Number(data.batchSize || 25),
        status: data.enabled ? 'configurado' : 'sin_configurar'
      }
    };
    if (typeof data.appsScriptUrl === 'string') patch.sheets.appsScriptUrlProtected = protect(data.appsScriptUrl.trim());
    addLog('sheets', 'Configuración de Google Sheets guardada.', 'success');
    return patchConfig(patch);
  }

  function setFirebaseQuota(data) {
    var dailyLimit = Number(data.dailyLimit || 500);
    var warningPercent = Number(data.warningPercent || 80);
    var stopPercent = Number(data.stopPercent || 95);
    if (dailyLimit < 1) dailyLimit = 500;
    if (warningPercent < 1 || warningPercent > 100) warningPercent = 80;
    if (stopPercent < 1 || stopPercent > 100) stopPercent = 95;
    addLog('firebase', 'Cuota manual de Firebase actualizada.', 'success');
    return patchConfig({ firebase: { dailyLimit: dailyLimit, warningPercent: warningPercent, stopPercent: stopPercent } });
  }

  function getFirebaseQuotaStatus(estimatedOps) {
    var c = loadConfig().firebase;
    var used = Number(c.usage.total || 0);
    var limit = Number(c.dailyLimit || 500);
    var next = used + Number(estimatedOps || 0);
    var percent = limit ? Math.round((used / limit) * 100) : 0;
    var nextPercent = limit ? Math.round((next / limit) * 100) : 0;
    var level = 'ok';
    if (nextPercent >= c.stopPercent) level = 'bloqueado';
    else if (nextPercent >= c.warningPercent) level = 'advertencia';
    return {
      allowed: level !== 'bloqueado',
      level: level,
      limit: limit,
      used: used,
      remaining: Math.max(limit - used, 0),
      percent: percent,
      nextPercent: nextPercent,
      estimatedOps: Number(estimatedOps || 0)
    };
  }

  function registerFirebaseUsage(ops) {
    var reads = Number((ops && ops.reads) || 0);
    var writes = Number((ops && ops.writes) || 0);
    var deletes = Number((ops && ops.deletes) || 0);
    var c = loadConfig();
    c.firebase.usage.reads += reads;
    c.firebase.usage.writes += writes;
    c.firebase.usage.deletes += deletes;
    c.firebase.usage.total += reads + writes + deletes;
    saveConfig(c);
    addLog('firebase', (ops && ops.label) || 'Operación Firebase registrada.', 'info', { reads: reads, writes: writes, deletes: deletes });
    return getFirebaseQuotaStatus(0);
  }

  function updateConnectionStatus(target, data) {
    var allowed = ['bdlocal', 'firebase', 'supabase', 'sheets'];
    if (allowed.indexOf(target) === -1) return loadConfig();
    var patch = {};
    patch[target] = {
      connected: !!data.connected,
      status: data.status || (data.connected ? 'ok' : 'error'),
      lastTestAt: data.lastTestAt || nowIso(),
      lastError: data.lastError || ''
    };
    if (target === 'sheets' && typeof data.pendingCount !== 'undefined') patch[target].pendingCount = Number(data.pendingCount || 0);
    addLog(target, data.connected ? 'Conexión correcta.' : 'Error de conexión.', data.connected ? 'success' : 'error', { error: patch[target].lastError });
    return patchConfig(patch);
  }

  function loadQueue() {
    var q = parseJson(window.localStorage.getItem(KEYS.QUEUE), []);
    return Array.isArray(q) ? q : [];
  }

  function saveQueue(queue) {
    var q = Array.isArray(queue) ? queue : [];
    window.localStorage.setItem(KEYS.QUEUE, JSON.stringify(q));
    return q;
  }

  function addQueueItem(item) {
    var q = loadQueue();
    var clean = {
      id: item.id || ('q_' + Date.now() + '_' + Math.random().toString(16).slice(2)),
      target: item.target || 'all',
      type: item.type || 'upsert',
      status: item.status || 'pendiente',
      key: item.key || '',
      periodo: item.periodo || '',
      cedula: item.cedula || '',
      payload: item.payload || {},
      attempts: Number(item.attempts || 0),
      lastError: item.lastError || '',
      createdAt: item.createdAt || nowIso(),
      updatedAt: nowIso()
    };
    q.push(clean);
    saveQueue(q);
    return clean;
  }

  function updateQueueItem(id, patch) {
    var q = loadQueue().map(function (item) {
      return item.id === id ? merge(item, merge(patch || {}, { updatedAt: nowIso() })) : item;
    });
    saveQueue(q);
    return q.find(function (item) { return item.id === id; }) || null;
  }

  function clearQueue(options) {
    if (options && options.keepErrors) {
      return saveQueue(loadQueue().filter(function (item) { return item.status === 'error'; }));
    }
    return saveQueue([]);
  }

  function getQueueSummary() {
    var summary = { total: 0, pendiente: 0, sincronizado: 0, error: 0, firebase: 0, supabase: 0, sheets: 0, all: 0 };
    loadQueue().forEach(function (item) {
      summary.total += 1;
      if (summary[item.status] !== undefined) summary[item.status] += 1;
      if (summary[item.target] !== undefined) summary[item.target] += 1;
    });
    return summary;
  }

  function loadLogs() {
    var logs = parseJson(window.localStorage.getItem(KEYS.LOGS), []);
    return Array.isArray(logs) ? logs : [];
  }

  function saveLogs(logs) {
    var out = Array.isArray(logs) ? logs.slice(-120) : [];
    window.localStorage.setItem(KEYS.LOGS, JSON.stringify(out));
    return out;
  }

  function addLog(scope, message, level, data) {
    var logs = loadLogs();
    logs.push({
      id: 'log_' + Date.now() + '_' + Math.random().toString(16).slice(2),
      scope: scope || 'general',
      message: message || '',
      level: level || 'info',
      data: data || {},
      createdAt: nowIso()
    });
    return saveLogs(logs);
  }

  function clearLogs() {
    return saveLogs([]);
  }

  function setRemoteConfigAdapter(adapter) {
    remoteAdapter = adapter;
  }

  function getAdapter() {
    return remoteAdapter || window.BDLocalFirebaseConfigAdapter || null;
  }

  async function backupConfigToFirebase() {
    var adapter = getAdapter();
    if (!adapter || typeof adapter.saveConfig !== 'function') {
      addLog('firebase', 'No existe adaptador Firebase para respaldar configuración.', 'warning');
      return { ok: false, message: 'No existe adaptador Firebase para respaldar configuración todavía.' };
    }
    try {
      await adapter.saveConfig(loadConfig());
      patchConfig({ firebase: { lastBackupAt: nowIso(), lastError: '' } });
      addLog('firebase', 'Configuración respaldada en Firebase.', 'success');
      return { ok: true, message: 'Configuración respaldada en Firebase.' };
    } catch (error) {
      patchConfig({ firebase: { lastError: error.message || String(error) } });
      return { ok: false, message: error.message || 'No se pudo respaldar configuración.' };
    }
  }

  async function restoreConfigFromFirebase() {
    var adapter = getAdapter();
    if (!adapter || typeof adapter.loadConfig !== 'function') {
      addLog('firebase', 'No existe adaptador Firebase para restaurar configuración.', 'warning');
      return { ok: false, message: 'No existe adaptador Firebase para restaurar configuración todavía.' };
    }
    try {
      var remote = await adapter.loadConfig();
      if (!remote) return { ok: false, message: 'Firebase no tiene configuración respaldada.' };
      var saved = saveConfig(merge(loadConfig(), remote));
      patchConfig({ firebase: { lastRestoreAt: nowIso(), lastError: '' } });
      addLog('firebase', 'Configuración restaurada desde Firebase.', 'success');
      return { ok: true, message: 'Configuración restaurada desde Firebase.', config: saved };
    } catch (error) {
      patchConfig({ firebase: { lastError: error.message || String(error) } });
      return { ok: false, message: error.message || 'No se pudo restaurar configuración.' };
    }
  }

  function getSummary() {
    var c = loadConfig();
    return {
      bdlocal: { connected: c.bdlocal.connected, status: c.bdlocal.status, totalRegistros: c.bdlocal.totalRegistros },
      firebase: { enabled: c.firebase.enabled, connected: c.firebase.connected, status: c.firebase.status, quota: getFirebaseQuotaStatus(0) },
      supabase: { enabled: c.supabase.enabled, connected: c.supabase.connected, status: c.supabase.status },
      sheets: { enabled: c.sheets.enabled, connected: c.sheets.connected, status: c.sheets.status, firstFullUploadDone: c.sheets.firstFullUploadDone, pendingCount: c.sheets.pendingCount },
      queue: getQueueSummary(),
      updatedAt: c.updatedAt
    };
  }

  window.BDLocalConfigStore = {
    STORAGE_KEYS: KEYS,
    loadConfig: loadConfig,
    saveConfig: saveConfig,
    patchConfig: patchConfig,
    resetConfig: resetConfig,
    getSupabaseConfig: getSupabaseConfig,
    setSupabaseConfig: setSupabaseConfig,
    getSheetsConfig: getSheetsConfig,
    setSheetsConfig: setSheetsConfig,
    setFirebaseQuota: setFirebaseQuota,
    getFirebaseQuotaStatus: getFirebaseQuotaStatus,
    registerFirebaseUsage: registerFirebaseUsage,
    updateConnectionStatus: updateConnectionStatus,
    loadQueue: loadQueue,
    saveQueue: saveQueue,
    addQueueItem: addQueueItem,
    updateQueueItem: updateQueueItem,
    clearQueue: clearQueue,
    getQueueSummary: getQueueSummary,
    loadLogs: loadLogs,
    addLog: addLog,
    clearLogs: clearLogs,
    setRemoteConfigAdapter: setRemoteConfigAdapter,
    backupConfigToFirebase: backupConfigToFirebase,
    restoreConfigFromFirebase: restoreConfigFromFirebase,
    getSummary: getSummary,
    protectValue: protect,
    unprotectValue: unprotect,
    maskValue: mask
  };
})(window);
