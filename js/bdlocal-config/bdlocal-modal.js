/*
  Archivo: bdlocal-modal.js
  Ruta: js/bdlocal-config/bdlocal-modal.js

  Función:
  - Mostrar un modal de diagnóstico para BDLocal.
  - Registrar progreso, errores JavaScript, errores de promesas y eventos de sincronización.
  - Avisar cuando una sincronización parece quedarse congelada.
*/
(function (window, document) {
  'use strict';

  var MAX_ITEMS = 160;
  var STALLED_MS = 45000;
  var CHECK_MS = 5000;
  var logs = [];
  var root = null;
  var list = null;
  var badge = null;
  var status = null;
  var currentSync = null;
  var originalNotify = null;

  function nowIso() {
    return new Date().toISOString();
  }

  function text(value) {
    return String(value === null || value === undefined ? '' : value).trim();
  }

  function esc(value) {
    return text(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function levelClass(level) {
    level = text(level || 'info').toLowerCase();
    if (level === 'error') return 'error';
    if (level === 'warning' || level === 'warn') return 'warning';
    if (level === 'success' || level === 'ok') return 'success';
    return 'info';
  }

  function injectStyles() {
    if (document.getElementById('bdlocal-modal-styles')) return;

    var style = document.createElement('style');
    style.id = 'bdlocal-modal-styles';
    style.textContent = [
      '.bdm-fab{position:fixed;right:18px;bottom:18px;z-index:99998;border:0;border-radius:999px;background:#1d4ed8;color:#fff;padding:12px 16px;font-weight:900;box-shadow:0 10px 28px rgba(15,23,42,.25);cursor:pointer;display:flex;gap:8px;align-items:center}',
      '.bdm-badge{min-width:22px;height:22px;border-radius:999px;background:#ef4444;color:#fff;font-size:12px;display:none;align-items:center;justify-content:center;padding:0 6px}',
      '.bdm-overlay{position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.42);display:none;align-items:center;justify-content:center;padding:18px}',
      '.bdm-overlay.is-open{display:flex}',
      '.bdm-modal{width:min(980px,96vw);max-height:90vh;background:#fff;border-radius:18px;box-shadow:0 24px 80px rgba(15,23,42,.35);overflow:hidden;border:1px solid #e2e8f0}',
      '.bdm-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:18px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc}',
      '.bdm-title{margin:0;font-size:20px;font-weight:900;color:#0f172a}',
      '.bdm-subtitle{margin:4px 0 0;color:#64748b;font-size:13px;line-height:1.45}',
      '.bdm-close{border:0;background:#e2e8f0;border-radius:10px;padding:9px 12px;cursor:pointer;font-weight:900;color:#0f172a}',
      '.bdm-body{padding:16px 20px;overflow:auto;max-height:calc(90vh - 156px)}',
      '.bdm-status{border:1px solid #cbd5e1;border-radius:14px;background:#f8fafc;padding:12px 14px;margin-bottom:14px;color:#334155;font-weight:700;font-size:13px;line-height:1.45}',
      '.bdm-actions{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px}',
      '.bdm-btn{border:0;border-radius:11px;padding:10px 13px;font-weight:900;cursor:pointer;background:#e2e8f0;color:#0f172a}',
      '.bdm-btn.primary{background:#1d4ed8;color:#fff}',
      '.bdm-btn.danger{background:#dc2626;color:#fff}',
      '.bdm-list{display:flex;flex-direction:column;gap:8px}',
      '.bdm-item{border:1px solid #e2e8f0;border-left-width:5px;border-radius:12px;padding:10px 12px;background:#fff}',
      '.bdm-item.info{border-left-color:#3b82f6}',
      '.bdm-item.success{border-left-color:#10b981}',
      '.bdm-item.warning{border-left-color:#f59e0b;background:#fffbeb}',
      '.bdm-item.error{border-left-color:#ef4444;background:#fef2f2}',
      '.bdm-item strong{display:block;color:#0f172a;font-size:13px;margin-bottom:4px}',
      '.bdm-item p{margin:0;color:#334155;font-size:13px;line-height:1.45}',
      '.bdm-meta{display:block;color:#64748b;font-size:11px;margin-top:6px;word-break:break-word}',
      '.bdm-empty{border:1px dashed #cbd5e1;border-radius:14px;padding:18px;color:#64748b;text-align:center;font-weight:800;background:#f8fafc}',
      '@media(max-width:640px){.bdm-head{flex-direction:column}.bdm-fab{left:14px;right:14px;justify-content:center}.bdm-modal{width:100vw;max-height:92vh}}'
    ].join('\n');

    document.head.appendChild(style);
  }

  function build() {
    if (root) return;

    injectStyles();

    var fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'bdm-fab';
    fab.innerHTML = '<span>Diagnóstico</span><span class="bdm-badge" data-bdm-badge>0</span>';
    document.body.appendChild(fab);
    badge = fab.querySelector('[data-bdm-badge]');

    root = document.createElement('div');
    root.className = 'bdm-overlay';
    root.innerHTML = '' +
      '<div class="bdm-modal" role="dialog" aria-modal="true" aria-label="Diagnóstico BDLocal">' +
        '<div class="bdm-head">' +
          '<div>' +
            '<h2 class="bdm-title">Diagnóstico BDLocal</h2>' +
            '<p class="bdm-subtitle">Aquí se muestran errores, avisos y pasos de sincronización para saber por qué no sube o dónde se queda detenido.</p>' +
          '</div>' +
          '<button type="button" class="bdm-close" data-bdm-close>Cerrar</button>' +
        '</div>' +
        '<div class="bdm-body">' +
          '<div class="bdm-status" data-bdm-status>Esperando eventos...</div>' +
          '<div class="bdm-actions">' +
            '<button type="button" class="bdm-btn primary" data-bdm-copy>Copiar diagnóstico</button>' +
            '<button type="button" class="bdm-btn" data-bdm-refresh>Actualizar</button>' +
            '<button type="button" class="bdm-btn danger" data-bdm-clear>Limpiar</button>' +
          '</div>' +
          '<div class="bdm-list" data-bdm-list></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);

    list = root.querySelector('[data-bdm-list]');
    status = root.querySelector('[data-bdm-status]');

    fab.addEventListener('click', open);
    root.querySelector('[data-bdm-close]').addEventListener('click', close);
    root.querySelector('[data-bdm-refresh]').addEventListener('click', render);
    root.querySelector('[data-bdm-clear]').addEventListener('click', clear);
    root.querySelector('[data-bdm-copy]').addEventListener('click', copyReport);

    root.addEventListener('click', function (event) {
      if (event.target === root) close();
    });
  }

  function add(level, title, message, data) {
    var item = {
      id: 'bdm_' + Date.now() + '_' + Math.random().toString(16).slice(2),
      at: nowIso(),
      level: levelClass(level),
      title: title || 'Evento',
      message: message || '',
      data: data || null
    };

    logs.push(item);
    logs = logs.slice(-MAX_ITEMS);

    try {
      window.localStorage.setItem('requisitos.bdlocal.modal.logs.v1', JSON.stringify(logs));
    } catch (error) {}

    render();

    if (item.level === 'error' || item.level === 'warning') {
      updateBadge();
    }

    return item;
  }

  function loadSaved() {
    try {
      var saved = JSON.parse(window.localStorage.getItem('requisitos.bdlocal.modal.logs.v1') || '[]');
      if (Array.isArray(saved)) logs = saved.slice(-MAX_ITEMS);
    } catch (error) {}
  }

  function updateBadge() {
    if (!badge) return;

    var count = logs.filter(function (item) {
      return item.level === 'error' || item.level === 'warning';
    }).length;

    badge.textContent = String(count);
    badge.style.display = count ? 'inline-flex' : 'none';
  }

  function syncStatusText() {
    if (!currentSync) return 'Sin sincronización activa detectada.';

    var seconds = Math.round((Date.now() - currentSync.lastAt) / 1000);
    return 'Último estado: ' + currentSync.target + ' ' + currentSync.percent + '% · ' + currentSync.detail + ' · hace ' + seconds + 's';
  }

  function render() {
    build();
    updateBadge();

    if (status) status.textContent = syncStatusText();
    if (!list) return;

    if (!logs.length) {
      list.innerHTML = '<div class="bdm-empty">Todavía no hay eventos registrados.</div>';
      return;
    }

    list.innerHTML = logs.slice().reverse().map(function (item) {
      var dataText = '';

      if (item.data) {
        try {
          dataText = JSON.stringify(item.data);
        } catch (error) {
          dataText = String(item.data);
        }
      }

      return '<div class="bdm-item ' + esc(item.level) + '">' +
        '<strong>' + esc(item.title) + '</strong>' +
        '<p>' + esc(item.message) + '</p>' +
        '<span class="bdm-meta">' + esc(item.at) + (dataText ? ' · ' + esc(dataText) : '') + '</span>' +
      '</div>';
    }).join('');
  }

  function open() {
    build();
    render();
    root.classList.add('is-open');
  }

  function close() {
    if (root) root.classList.remove('is-open');
  }

  function clear() {
    logs = [];
    currentSync = null;
    try {
      window.localStorage.removeItem('requisitos.bdlocal.modal.logs.v1');
    } catch (error) {}
    render();
  }

  function copyReport() {
    var report = {
      at: nowIso(),
      location: window.location.href,
      currentSync: currentSync,
      events: logs.slice(-80)
    };

    var textReport = JSON.stringify(report, null, 2);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textReport).then(function () {
        add('success', 'Diagnóstico copiado', 'El reporte técnico se copió al portapapeles.', {});
      }).catch(function () {
        window.prompt('Copia este diagnóstico:', textReport);
      });
      return;
    }

    window.prompt('Copia este diagnóstico:', textReport);
  }

  function patchNotifyWhenReady() {
    if (window.BDLocalConfigUI && typeof window.BDLocalConfigUI.notify === 'function' && window.BDLocalConfigUI.notify !== originalNotify) {
      originalNotify = window.BDLocalConfigUI.notify;
      window.BDLocalConfigUI.notify = function (message, type) {
        add(type || 'info', 'Aviso de BDLocal', message || '', {});
        return originalNotify.apply(window.BDLocalConfigUI, arguments);
      };
    }
  }

  function readStoreLogs() {
    try {
      if (!window.BDLocalConfigStore || typeof window.BDLocalConfigStore.loadLogs !== 'function') return;
      var storeLogs = window.BDLocalConfigStore.loadLogs() || [];
      storeLogs.slice(-20).forEach(function (item) {
        var exists = logs.some(function (logItem) {
          return logItem.at === item.createdAt && logItem.message === item.message;
        });
        if (!exists) {
          logs.push({
            id: item.id || ('store_' + Math.random()),
            at: item.createdAt || nowIso(),
            level: levelClass(item.level),
            title: 'Store · ' + (item.scope || 'general'),
            message: item.message || '',
            data: item.data || null
          });
        }
      });
      logs = logs.slice(-MAX_ITEMS);
    } catch (error) {}
  }

  function checkStalled() {
    if (!currentSync) return;

    if (currentSync.percent <= 0 || currentSync.percent >= 100) return;

    var elapsed = Date.now() - currentSync.lastAt;
    if (elapsed < STALLED_MS || currentSync.warned) return;

    currentSync.warned = true;
    add('warning', 'Sincronización detenida', 'La sincronización lleva más de 45 segundos sin avanzar. Revisa Apps Script, token, permisos o cantidad de datos enviada.', currentSync);
    open();
  }

  function setupEvents() {
    window.addEventListener('bl2:sync-progress', function (event) {
      var detail = event.detail || {};
      var percent = Number(detail.percent || 0);
      var target = text(detail.target || 'sync');
      var info = text(detail.detail || 'Procesando...');

      currentSync = {
        target: target,
        percent: percent,
        detail: info,
        lastAt: Date.now(),
        warned: false
      };

      add(percent <= 0 ? 'error' : percent >= 100 ? 'success' : 'info', 'Progreso ' + target, info + ' (' + percent + '%)', detail);
    });

    window.addEventListener('bl2:students-saved', function (event) {
      add('success', 'Carga local guardada', 'BDLocal guardó estudiantes en la base local.', event.detail || {});
    });

    window.addEventListener('error', function (event) {
      add('error', 'Error JavaScript', event.message || 'Error no identificado.', {
        file: event.filename || '',
        line: event.lineno || '',
        column: event.colno || ''
      });
      open();
    });

    window.addEventListener('unhandledrejection', function (event) {
      var reason = event.reason || {};
      add('error', 'Promesa rechazada', reason.message || String(reason), {
        stack: reason.stack || ''
      });
      open();
    });

    window.setInterval(function () {
      patchNotifyWhenReady();
      readStoreLogs();
      checkStalled();
      render();
    }, CHECK_MS);
  }

  function boot() {
    loadSaved();
    build();
    patchNotifyWhenReady();
    setupEvents();
    add('info', 'Diagnóstico iniciado', 'El modal de diagnóstico ya está escuchando eventos de BDLocal.', {});
  }

  window.BDLocalModal = {
    open: open,
    close: close,
    add: add,
    info: function (title, message, data) { return add('info', title, message, data); },
    success: function (title, message, data) { return add('success', title, message, data); },
    warning: function (title, message, data) { return add('warning', title, message, data); },
    error: function (title, message, data) { return add('error', title, message, data); },
    copyReport: copyReport,
    clear: clear
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window, document);
