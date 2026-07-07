/*
  Archivo: bdlocal-config.ui.js
  Ruta: js/bdlocal-config/bdlocal-config.ui.js

  Interfaz MVP para el centro de control de BDLocal.
  Requiere bdlocal-config.store.js y bdlocal-config.css.
*/
(function (window, document) {
  'use strict';

  var activeSection = 'resumen';
  var rootElement = null;
  var MENU = [
    { id: 'resumen', label: 'Resumen general' },
    { id: 'base', label: 'Base local' },
    { id: 'firebase', label: 'Firebase' },
    { id: 'supabase', label: 'Supabase' },
    { id: 'sheets', label: 'Google Sheets' },
    { id: 'cola', label: 'Cola / Pendientes' },
    { id: 'diagnostico', label: 'Diagnóstico' }
  ];

  function store() {
    return window.BDLocalConfigStore || null;
  }

  function syncManager() {
    return window.BDLocalSyncManager || null;
  }

  function html(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(value) {
    if (!value) return 'Sin registro';
    var d = new Date(value);
    return Number.isNaN(d.getTime()) ? 'Sin registro' : d.toLocaleString();
  }

  function statusText(status) {
    var map = {
      ok: 'OK',
      conectado: 'Conectado',
      configurado: 'Configurado',
      pendiente: 'Pendiente',
      sin_configurar: 'Sin configurar',
      error: 'Error',
      bloqueado: 'Bloqueado',
      advertencia: 'Advertencia',
      success: 'Correcto'
    };
    return map[status] || status || 'Pendiente';
  }

  function statusClass(status) {
    var s = String(status || '').toLowerCase();
    if (['ok', 'conectado', 'configurado', 'success'].indexOf(s) !== -1) return 'ok';
    if (['advertencia', 'warning', 'modo_ahorro'].indexOf(s) !== -1) return 'warning';
    if (['error', 'bloqueado', 'failed'].indexOf(s) !== -1) return 'error';
    return 'pending';
  }

  function badge(status, label) {
    return '<span class="bdlc-status ' + statusClass(status) + '">' + html(label || statusText(status)) + '</span>';
  }

  function card(title, value, note) {
    return '<div class="bdlc-card">' +
      '<p class="bdlc-card-title">' + html(title) + '</p>' +
      '<p class="bdlc-card-value">' + value + '</p>' +
      (note ? '<p class="bdlc-card-note">' + html(note) + '</p>' : '') +
      '</div>';
  }

  function notify(message, type) {
    var el = rootElement ? rootElement.querySelector('[data-bdlc-alert]') : null;
    if (!el) {
      window.alert(message);
      return;
    }
    el.className = 'bdlc-alert ' + (type || 'info');
    el.textContent = message;
    el.style.display = 'block';
    window.setTimeout(function () { el.style.display = 'none'; }, 4500);
  }

  function setProgress(active, percent, message) {
    var wrap = rootElement ? rootElement.querySelector('[data-bdlc-progress]') : null;
    var bar = rootElement ? rootElement.querySelector('[data-bdlc-progress-bar]') : null;
    var text = rootElement ? rootElement.querySelector('[data-bdlc-progress-text]') : null;
    if (!wrap || !bar || !text) return;
    wrap.style.display = active ? 'block' : 'none';
    bar.style.width = Math.max(0, Math.min(100, Number(percent || 0))) + '%';
    text.textContent = message || '';
  }

  function runAction(name) {
    var manager = syncManager();
    if (!manager || typeof manager[name] !== 'function') {
      notify('Esta acción quedará activa en el Bloque 3 de sincronización.', 'warning');
      return;
    }
    setProgress(true, 10, 'Ejecutando...');
    Promise.resolve(manager[name]())
      .then(function (result) {
        setProgress(false, 100, 'Finalizado.');
        notify((result && result.message) || 'Acción finalizada.', result && result.ok === false ? 'error' : 'success');
        render();
      })
      .catch(function (error) {
        setProgress(false, 0, 'Error.');
        notify(error && error.message ? error.message : 'No se pudo ejecutar la acción.', 'error');
      });
  }

  function menu() {
    return '<aside class="bdlc-sidebar">' +
      '<div class="bdlc-sidebar-title">BDLocal</div>' +
      '<div class="bdlc-sidebar-subtitle">Centro de control de base local, Firebase, Supabase y Google Sheets.</div>' +
      '<nav class="bdlc-nav">' +
      MENU.map(function (item) {
        return '<button type="button" class="bdlc-nav-button ' + (item.id === activeSection ? 'is-active' : '') + '" data-bdlc-section-target="' + item.id + '">' + html(item.label) + '</button>';
      }).join('') +
      '</nav>' +
      '</aside>';
  }

  function sectionClass(id) {
    return 'bdlc-section ' + (activeSection === id ? 'is-active' : '');
  }

  function resumen() {
    var s = store().getSummary();
    var quota = s.firebase.quota || {};
    return '<section class="' + sectionClass('resumen') + '">' +
      '<div class="bdlc-header"><div><h2 class="bdlc-title">Resumen general</h2><p class="bdlc-description">Estado rápido de las bases y sincronizaciones manuales.</p></div>' + badge('ok', 'BDLocal activo') + '</div>' +
      '<div class="bdlc-card-grid">' +
      card('BDLocal', badge(s.bdlocal.status, statusText(s.bdlocal.status)), 'Base principal de la app.') +
      card('Firebase', badge(s.firebase.connected ? 'ok' : s.firebase.status, s.firebase.connected ? 'Conectado' : statusText(s.firebase.status)), 'Uso diario: ' + quota.used + ' / ' + quota.limit) +
      card('Supabase', badge(s.supabase.connected ? 'ok' : s.supabase.status, s.supabase.connected ? 'Conectado' : statusText(s.supabase.status)), s.supabase.enabled ? 'Activado' : 'Desactivado') +
      card('Google Sheets', badge(s.sheets.connected ? 'ok' : s.sheets.status, s.sheets.connected ? 'Conectado' : statusText(s.sheets.status)), 'Pendientes: ' + Number(s.sheets.pendingCount || 0)) +
      '</div>' +
      '<div class="bdlc-card-grid three">' +
      card('Pendientes en cola', String(s.queue.pendiente || 0), 'Cambios todavía no sincronizados.') +
      card('Errores en cola', String(s.queue.error || 0), 'Registros que requieren reintento.') +
      card('Primera subida Sheets', s.sheets.firstFullUploadDone ? 'Realizada' : 'Pendiente', 'Primero sube todo; luego solo cambios.') +
      '</div>' +
      '<div class="bdlc-card"><p class="bdlc-card-title">Acciones rápidas</p>' + actionButtons() + progressHtml() + '</div>' +
      '</section>';
  }

  function actionButtons() {
    return '<div class="bdlc-actions">' +
      '<button type="button" class="bdlc-button" data-bdlc-action="pullFirebaseToLocal">Traer de Firebase</button>' +
      '<button type="button" class="bdlc-button secondary" data-bdlc-action="pushLocalToFirebase">Subir a Firebase</button>' +
      '<button type="button" class="bdlc-button secondary" data-bdlc-action="pushLocalToSheets">Subir a Google Sheets</button>' +
      '<button type="button" class="bdlc-button secondary" data-bdlc-action="pushLocalToSupabase">Subir a Supabase</button>' +
      '<button type="button" class="bdlc-button success" data-bdlc-action="syncAll">Sincronizar todo</button>' +
      '<button type="button" class="bdlc-button warning" data-bdlc-action="testAll">Probar conexiones</button>' +
      '</div>';
  }

  function progressHtml() {
    return '<div data-bdlc-progress style="display:none;"><div class="bdlc-progress"><div class="bdlc-progress-bar" data-bdlc-progress-bar></div></div><div class="bdlc-progress-text" data-bdlc-progress-text></div></div>';
  }

  function baseLocal() {
    return '<section class="' + sectionClass('base') + '">' +
      '<div class="bdlc-header"><div><h2 class="bdlc-title">Base local</h2><p class="bdlc-description">BDLocal se mantiene como base principal.</p></div>' + badge('ok', 'Principal') + '</div>' +
      '<div class="bdlc-alert info">Aquí se debe insertar o envolver la tabla actual de BDLocal sin borrar su lógica.</div>' +
      '<div id="bdlc-base-local-slot" class="bdlc-card"><p class="bdlc-card-title">Espacio para la base actual</p><p class="bdlc-card-note">En la integración final se conecta aquí la tabla existente.</p></div>' +
      '</section>';
  }

  function firebase() {
    var c = store().loadConfig();
    var quota = store().getFirebaseQuotaStatus(0);
    return '<section class="' + sectionClass('firebase') + '">' +
      '<div class="bdlc-header"><div><h2 class="bdlc-title">Firebase</h2><p class="bdlc-description">Control de conexión, respaldo, recuperación inicial y cuota diaria manual.</p></div>' + badge(c.firebase.connected ? 'ok' : c.firebase.status, c.firebase.connected ? 'Conectado' : statusText(c.firebase.status)) + '</div>' +
      '<div class="bdlc-card-grid three">' +
      card('Uso diario', quota.used + ' / ' + quota.limit, 'Porcentaje actual: ' + quota.percent + '%') +
      card('Restante', String(quota.remaining), 'Operaciones disponibles estimadas.') +
      card('Estado cuota', badge(quota.level, statusText(quota.level)), 'La app frenará si se acerca al límite.') +
      '</div>' +
      '<div class="bdlc-card"><p class="bdlc-card-title">Cuota diaria manual</p>' +
      '<div class="bdlc-form">' +
      field('bdlc-firebase-limit', 'Límite diario estimado', 'number', c.firebase.dailyLimit, 'Ejemplo: 500 operaciones por día.') +
      field('bdlc-firebase-warning', 'Advertencia al %', 'number', c.firebase.warningPercent, 'Recomendado: 80.') +
      field('bdlc-firebase-stop', 'Bloquear al %', 'number', c.firebase.stopPercent, 'Recomendado: 95.') +
      '</div>' +
      '<div class="bdlc-actions">' +
      '<button type="button" class="bdlc-button" data-bdlc-action="saveFirebaseQuota">Guardar cuota</button>' +
      '<button type="button" class="bdlc-button secondary" data-bdlc-action="testFirebase">Probar Firebase</button>' +
      '<button type="button" class="bdlc-button success" data-bdlc-action="pullFirebaseToLocal">Traer Firebase → BDLocal</button>' +
      '<button type="button" class="bdlc-button secondary" data-bdlc-action="pushLocalToFirebase">Subir BDLocal → Firebase</button>' +
      '<button type="button" class="bdlc-button warning" data-bdlc-action="backupConfigToFirebase">Respaldar configuración</button>' +
      '<button type="button" class="bdlc-button warning" data-bdlc-action="restoreConfigFromFirebase">Restaurar configuración</button>' +
      '</div></div>' +
      statusTable([
        ['Última prueba', formatDate(c.firebase.lastTestAt)],
        ['Último respaldo', formatDate(c.firebase.lastBackupAt)],
        ['Última restauración', formatDate(c.firebase.lastRestoreAt)],
        ['Último error', c.firebase.lastError || 'Sin errores']
      ]) +
      '</section>';
  }

  function field(id, label, type, value, help, full) {
    return '<div class="bdlc-field ' + (full ? 'full' : '') + '">' +
      '<label class="bdlc-label" for="' + id + '">' + html(label) + '</label>' +
      '<input id="' + id + '" class="bdlc-input" type="' + (type || 'text') + '" value="' + html(value || '') + '">' +
      (help ? '<div class="bdlc-help">' + html(help) + '</div>' : '') +
      '</div>';
  }

  function selectField(id, label, enabled) {
    return '<div class="bdlc-field"><label class="bdlc-label" for="' + id + '">' + html(label) + '</label><select id="' + id + '" class="bdlc-select"><option value="false" ' + (!enabled ? 'selected' : '') + '>Desactivado</option><option value="true" ' + (enabled ? 'selected' : '') + '>Activado</option></select></div>';
  }

  function statusTable(rows) {
    return '<div class="bdlc-card"><p class="bdlc-card-title">Estado</p><div class="bdlc-table-wrap"><table class="bdlc-table"><tbody>' +
      rows.map(function (row) { return '<tr><th>' + html(row[0]) + '</th><td>' + html(row[1]) + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>';
  }

  function supabase() {
    var c = store().getSupabaseConfig({ includeSecret: true });
    return '<section class="' + sectionClass('supabase') + '">' +
      '<div class="bdlc-header"><div><h2 class="bdlc-title">Supabase</h2><p class="bdlc-description">Base paralela. Recibirá cambios importantes desde BDLocal.</p></div>' + badge(c.connected ? 'ok' : c.status, c.connected ? 'Conectado' : statusText(c.status)) + '</div>' +
      '<div class="bdlc-card"><p class="bdlc-card-title">Configuración Supabase</p><div class="bdlc-form">' +
      selectField('bdlc-supabase-enabled', 'Estado', c.enabled) +
      field('bdlc-supabase-table', 'Tabla', 'text', c.tableName || 'requisitos_estudiantes') +
      field('bdlc-supabase-url', 'Supabase URL', 'url', c.url || '', 'Ejemplo: https://xxxxx.supabase.co', true) +
      field('bdlc-supabase-key', 'Anon key', 'password', c.anonKey || '', 'No uses service_role en frontend. Para MVP usa anon key con políticas seguras.', true) +
      '</div><div class="bdlc-actions">' +
      '<button type="button" class="bdlc-button" data-bdlc-action="saveSupabaseConfig">Guardar Supabase</button>' +
      '<button type="button" class="bdlc-button secondary" data-bdlc-action="testSupabase">Probar conexión</button>' +
      '<button type="button" class="bdlc-button success" data-bdlc-action="pushLocalToSupabase">Subir BDLocal → Supabase</button>' +
      '</div></div>' +
      statusTable([
        ['Última prueba', formatDate(c.lastTestAt)],
        ['Última sincronización', formatDate(c.lastSyncAt)],
        ['Último error', c.lastError || 'Sin errores']
      ]) +
      '</section>';
  }

  function sheets() {
    var c = store().getSheetsConfig({ includeSecret: true });
    return '<section class="' + sectionClass('sheets') + '">' +
      '<div class="bdlc-header"><div><h2 class="bdlc-title">Google Sheets</h2><p class="bdlc-description">Primera subida completa en lotes. Después solo cambios reales.</p></div>' + badge(c.connected ? 'ok' : c.status, c.connected ? 'Conectado' : statusText(c.status)) + '</div>' +
      '<div class="bdlc-card-grid three">' +
      card('Primera subida', c.firstFullUploadDone ? 'Realizada' : 'Pendiente', 'Si está pendiente, se sube toda la base poco a poco.') +
      card('Pendientes Sheets', String(c.pendingCount || 0), 'Cambios esperando envío.') +
      card('Tamaño de lote', String(c.batchSize || 25), 'Cantidad enviada por bloque.') +
      '</div>' +
      '<div class="bdlc-card"><p class="bdlc-card-title">Configuración Google Sheets</p><div class="bdlc-form">' +
      selectField('bdlc-sheets-enabled', 'Estado', c.enabled) +
      field('bdlc-sheets-batch', 'Tamaño de lote', 'number', c.batchSize || 25) +
      field('bdlc-sheets-url', 'URL de Apps Script', 'url', c.appsScriptUrl || '', 'Ejemplo: https://script.google.com/macros/s/XXXX/exec', true) +
      field('bdlc-sheets-id', 'ID del Google Sheet', 'text', c.spreadsheetId || '') +
      field('bdlc-sheets-name', 'Nombre de hoja', 'text', c.sheetName || 'Requisitos') +
      '</div><div class="bdlc-actions">' +
      '<button type="button" class="bdlc-button" data-bdlc-action="saveSheetsConfig">Guardar Google Sheets</button>' +
      '<button type="button" class="bdlc-button secondary" data-bdlc-action="testSheets">Probar conexión</button>' +
      '<button type="button" class="bdlc-button success" data-bdlc-action="pushLocalToSheets">Subir BDLocal → Google Sheets</button>' +
      '<button type="button" class="bdlc-button warning" data-bdlc-action="markSheetsFullUploadPending">Marcar primera subida como pendiente</button>' +
      '</div></div>' +
      statusTable([
        ['Última prueba', formatDate(c.lastTestAt)],
        ['Última subida completa', formatDate(c.lastFullUploadAt)],
        ['Última subida de cambios', formatDate(c.lastDeltaUploadAt)],
        ['Último error', c.lastError || 'Sin errores']
      ]) +
      '</section>';
  }

  function cola() {
    var q = store().loadQueue();
    var s = store().getQueueSummary();
    var rows = q.slice(-80).reverse().map(function (item) {
      return '<tr><td>' + html(item.target || '') + '</td><td>' + html(item.type || '') + '</td><td>' + badge(item.status || 'pendiente', statusText(item.status || 'pendiente')) + '</td><td>' + html(item.periodo || '') + '</td><td>' + html(item.cedula || '') + '</td><td>' + html(item.lastError || '') + '</td></tr>';
    }).join('');

    return '<section class="' + sectionClass('cola') + '">' +
      '<div class="bdlc-header"><div><h2 class="bdlc-title">Cola de sincronización</h2><p class="bdlc-description">Cambios pendientes para Firebase, Supabase y Google Sheets.</p></div>' + badge(s.error > 0 ? 'warning' : 'ok', s.error > 0 ? 'Con errores' : 'Sin errores') + '</div>' +
      '<div class="bdlc-card-grid three">' +
      card('Total cola', String(s.total), 'Todos los registros en cola.') +
      card('Pendientes', String(s.pendiente), 'Esperando sincronización.') +
      card('Errores', String(s.error), 'Requieren reintento.') +
      '</div>' +
      '<div class="bdlc-actions"><button type="button" class="bdlc-button" data-bdlc-action="syncQueue">Sincronizar pendientes</button><button type="button" class="bdlc-button secondary" data-bdlc-action="refresh">Actualizar vista</button><button type="button" class="bdlc-button danger" data-bdlc-action="clearQueue">Limpiar cola</button></div>' +
      (q.length === 0 ? '<div class="bdlc-empty">No hay pendientes en cola.</div>' : '<div class="bdlc-table-wrap"><table class="bdlc-table"><thead><tr><th>Destino</th><th>Tipo</th><th>Estado</th><th>Período</th><th>Cédula</th><th>Error</th></tr></thead><tbody>' + rows + '</tbody></table></div>') +
      '</section>';
  }

  function diagnostico() {
    var c = store().loadConfig();
    var logs = store().loadLogs().slice(-50).reverse();
    var issues = [];
    if (!c.firebase.connected) issues.push('Firebase todavía no ha sido probado o no aparece como conectado.');
    if (c.supabase.enabled && !c.supabase.url) issues.push('Supabase está activado, pero falta la URL.');
    if (c.supabase.enabled && !c.supabase.anonKeyProtected) issues.push('Supabase está activado, pero falta la anon key.');
    if (c.sheets.enabled && !c.sheets.appsScriptUrlProtected) issues.push('Google Sheets está activado, pero falta la URL de Apps Script.');
    if (c.sheets.enabled && !c.sheets.sheetName) issues.push('Google Sheets está activado, pero falta el nombre de hoja.');

    var issueHtml = issues.length ? '<div class="bdlc-alert warning">' + issues.map(html).join('<br>') + '</div>' : '<div class="bdlc-alert success">No se detectan problemas básicos de configuración.</div>';
    var logHtml = logs.length ? '<div class="bdlc-log-list">' + logs.map(function (log) {
      return '<div class="bdlc-log-item"><strong>' + html(log.scope || 'general') + ' · ' + html(log.level || 'info') + '</strong><span>' + html(formatDate(log.createdAt)) + '</span><span>' + html(log.message || '') + '</span></div>';
    }).join('') + '</div>' : '<div class="bdlc-empty">Todavía no hay eventos registrados.</div>';

    return '<section class="' + sectionClass('diagnostico') + '">' +
      '<div class="bdlc-header"><div><h2 class="bdlc-title">Diagnóstico</h2><p class="bdlc-description">Revisión rápida de configuración, errores y eventos internos.</p></div>' + badge(issues.length ? 'warning' : 'ok', issues.length ? 'Revisar' : 'Correcto') + '</div>' +
      issueHtml +
      '<div class="bdlc-actions"><button type="button" class="bdlc-button" data-bdlc-action="testAll">Probar conexiones</button><button type="button" class="bdlc-button secondary" data-bdlc-action="refresh">Actualizar</button><button type="button" class="bdlc-button danger" data-bdlc-action="clearLogs">Limpiar eventos</button></div>' +
      '<div class="bdlc-card"><p class="bdlc-card-title">Eventos recientes</p>' + logHtml + '</div>' +
      '</section>';
  }

  function render() {
    if (!rootElement) return;
    if (!store()) {
      rootElement.innerHTML = '<div class="bdlc-alert error">No se encontró BDLocalConfigStore. Carga bdlocal-config.store.js antes que bdlocal-config.ui.js.</div>';
      return;
    }
    store().patchConfig({ ui: { activeSection: activeSection } });
    rootElement.innerHTML = '<div class="bdlc-shell">' + menu() + '<main class="bdlc-main"><div data-bdlc-alert style="display:none;"></div>' + resumen() + baseLocal() + firebase() + supabase() + sheets() + cola() + diagnostico() + '</main></div>';
    bindEvents();
  }

  function bindEvents() {
    rootElement.querySelectorAll('[data-bdlc-section-target]').forEach(function (button) {
      button.addEventListener('click', function () {
        activeSection = button.getAttribute('data-bdlc-section-target') || 'resumen';
        render();
      });
    });
    rootElement.querySelectorAll('[data-bdlc-action]').forEach(function (button) {
      button.addEventListener('click', function () {
        handleAction(button.getAttribute('data-bdlc-action'));
      });
    });
  }

  function input(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function handleAction(action) {
    var s = store();
    if (!s) return;

    if (action === 'refresh') return render();
    if (action === 'saveFirebaseQuota') {
      s.setFirebaseQuota({ dailyLimit: input('bdlc-firebase-limit'), warningPercent: input('bdlc-firebase-warning'), stopPercent: input('bdlc-firebase-stop') });
      notify('Cuota de Firebase guardada.', 'success');
      return render();
    }
    if (action === 'saveSupabaseConfig') {
      s.setSupabaseConfig({ enabled: input('bdlc-supabase-enabled') === 'true', url: input('bdlc-supabase-url'), anonKey: input('bdlc-supabase-key'), tableName: input('bdlc-supabase-table') });
      notify('Configuración de Supabase guardada.', 'success');
      return render();
    }
    if (action === 'saveSheetsConfig') {
      s.setSheetsConfig({ enabled: input('bdlc-sheets-enabled') === 'true', appsScriptUrl: input('bdlc-sheets-url'), spreadsheetId: input('bdlc-sheets-id'), sheetName: input('bdlc-sheets-name'), batchSize: input('bdlc-sheets-batch') });
      notify('Configuración de Google Sheets guardada.', 'success');
      return render();
    }
    if (action === 'backupConfigToFirebase') {
      return s.backupConfigToFirebase().then(function (result) { notify(result.message, result.ok ? 'success' : 'warning'); render(); });
    }
    if (action === 'restoreConfigFromFirebase') {
      return s.restoreConfigFromFirebase().then(function (result) { notify(result.message, result.ok ? 'success' : 'warning'); render(); });
    }
    if (action === 'clearQueue') {
      if (!window.confirm('¿Seguro que quieres limpiar la cola local de sincronización?')) return;
      s.clearQueue();
      s.addLog('cola', 'Cola local limpiada manualmente.', 'warning');
      notify('Cola limpiada.', 'success');
      return render();
    }
    if (action === 'clearLogs') {
      s.clearLogs();
      notify('Eventos limpiados.', 'success');
      return render();
    }
    if (action === 'markSheetsFullUploadPending') {
      s.patchConfig({ sheets: { firstFullUploadDone: false, lastFullUploadAt: '' } });
      s.addLog('sheets', 'Primera subida completa marcada como pendiente.', 'warning');
      notify('Google Sheets quedó marcado para primera subida completa.', 'success');
      return render();
    }

    runAction(action);
  }

  function init(options) {
    options = options || {};
    rootElement = options.container || document.querySelector(options.containerSelector || '#bdlocal-config-root');
    if (!rootElement) {
      console.warn('BDLocalConfigUI: no se encontró el contenedor #bdlocal-config-root.');
      return;
    }
    if (store()) {
      activeSection = (store().loadConfig().ui || {}).activeSection || 'resumen';
    }
    render();
  }

  window.BDLocalConfigUI = {
    init: init,
    render: render,
    notify: notify,
    setProgress: setProgress
  };
})(window, document);
