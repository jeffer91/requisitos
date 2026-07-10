/* =========================================================
Nombre completo: bdlocal-config.ui.js
Ruta o ubicación: /js/bdlocal-config/bdlocal-config.ui.js
Función o funciones:
- Controlar el Centro de Control BDLocal sin crear una segunda interfaz.
- Renderizar Resumen, Bases externas y Pantallas.
- Usar IndexedDB y la cola real de sincronización como fuentes.
- Guardar configuraciones de Firebase, Google Sheets y Supabase.
- Ejecutar pruebas, subidas, descargas y refrescos manuales.
========================================================= */
(function(window, document){
  "use strict";

  var rootElement = null;
  var initialized = false;
  var bound = false;
  var renderSequence = 0;

  var SCREENS = {
    carga:{ label:"Carga", reads:["periodos"], writes:["personas","matriculas_periodo","requisitos_estudiante","cambios_pendientes"] },
    ficha:{ label:"Ficha", reads:["personas","matriculas_periodo","requisitos_estudiante","notas_titulacion","contactos_estudiante"], writes:["contactos_estudiante","requisitos_estudiante","cambios_pendientes"] },
    tabla:{ label:"Tabla", reads:["personas","matriculas_periodo","requisitos_estudiante","notas_titulacion"], writes:["cambios_pendientes"] },
    stats:{ label:"Estadísticas", reads:["matriculas_periodo","requisitos_estudiante","notas_titulacion"], writes:[] },
    coordi:{ label:"Coordinación", reads:["personas","matriculas_periodo","requisitos_estudiante","notas_titulacion"], writes:["notas_titulacion","cambios_pendientes"] },
    reportes:{ label:"Reportes", reads:["personas","matriculas_periodo","requisitos_estudiante","notas_titulacion"], writes:[] },
    defensas:{ label:"Defensas", reads:["personas","matriculas_periodo","requisitos_estudiante"], writes:["notas_titulacion","cambios_pendientes"] },
    global:{ label:"Global", reads:["periodos","personas","matriculas_periodo"], writes:[] }
  };

  function byId(id){ return document.getElementById(id); }
  function text(value){ return String(value == null ? "" : value).trim(); }
  function number(value){ value = Number(value || 0); return Number.isFinite(value) ? value : 0; }
  function esc(value){ return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
  function formatNumber(value){ try{ return number(value).toLocaleString("es-EC"); }catch(error){ return String(number(value)); } }
  function formatDate(value){ if(!text(value)){ return "Sin registro"; } var d = new Date(value); return Number.isFinite(d.getTime()) ? d.toLocaleString("es-EC") : text(value); }
  function store(){ return window.BDLocalConfigStore || null; }
  function manager(){ return window.BDLocalSyncManager || null; }
  function core(){ return window.BL2Core || null; }
  function db(){ return window.BL2DB || null; }
  function hub(){ return window.BDLocalConexiones || null; }

  function statusClass(status){
    status = text(status).toLowerCase();
    if(["ok","conectado","configurado","success","correcto"].indexOf(status) >= 0){ return "ok"; }
    if(["error","failed","bloqueado"].indexOf(status) >= 0){ return "error"; }
    if(["advertencia","warning","pendientes"].indexOf(status) >= 0){ return "warning"; }
    return "pending";
  }

  function badge(status, label){ return '<span class="bdlc-status ' + statusClass(status) + '">' + esc(label || status || "Pendiente") + '</span>'; }
  function setText(id, value){ var el = byId(id); if(el){ el.textContent = value; } }
  function setHTML(id, value){ var el = byId(id); if(el){ el.innerHTML = value; } }
  function input(id){ var el = byId(id); return el ? el.value : ""; }

  function notify(message, type){
    var el = byId("bl2-global-alert") || (rootElement && rootElement.querySelector("[data-bdlc-alert]"));
    if(!el){ window.alert(message); return; }
    el.className = "bdlc-alert " + (type || "info");
    el.textContent = message;
    el.hidden = false;
    el.style.display = "block";
    window.clearTimeout(el.__hideTimer);
    el.__hideTimer = window.setTimeout(function(){ el.hidden = true; el.style.display = "none"; }, 5500);
  }

  function setProgress(active, percent, message){
    percent = Math.max(0, Math.min(100, number(percent)));
    var bar = byId("bl2-sync-bar");
    var fill = byId("bl2-sync-progress");
    if(bar){ bar.hidden = !active; }
    if(fill){ fill.style.width = percent + "%"; }
    setText("bl2-sync-percent", Math.round(percent) + "%");
    setText("bl2-sync-detail", message || "");
  }

  function selectedPeriod(){
    var app = window.BL2App && typeof window.BL2App.getState === "function" ? window.BL2App.getState() : {};
    if(app.activePeriod && text(app.activePeriod.id)){ return { id:text(app.activePeriod.id), label:text(app.activePeriod.label || app.activePeriod.id) }; }
    var select = byId("bl2-period-select");
    var id = text(select && select.value);
    var label = id;
    if(select && select.selectedOptions && select.selectedOptions[0]){ label = text(select.selectedOptions[0].textContent) || id; }
    return { id:id, label:label };
  }

  function queryCount(table, index, value){
    var current = db();
    if(!current){ return Promise.resolve(0); }
    if(index && value && typeof current.queryByIndex === "function"){
      return current.queryByIndex(table, index, value).then(function(rows){ return Array.isArray(rows) ? rows.length : 0; }).catch(function(){ return 0; });
    }
    if(typeof current.count === "function"){ return current.count(table).then(number).catch(function(){ return 0; }); }
    if(typeof current.getAll === "function"){ return current.getAll(table).then(function(rows){ return Array.isArray(rows) ? rows.length : 0; }).catch(function(){ return 0; }); }
    return Promise.resolve(0);
  }

  function lastBackup(){
    var current = db();
    if(!current || typeof current.getAll !== "function"){ return Promise.resolve(null); }
    return current.getAll("backups").then(function(rows){
      rows = Array.isArray(rows) ? rows : [];
      rows.sort(function(a,b){ return new Date(b.createdAt || b.updatedAt || b.at || 0).getTime() - new Date(a.createdAt || a.updatedAt || a.at || 0).getTime(); });
      return rows[0] || null;
    }).catch(function(){ return null; });
  }

  function buildSummary(){
    var section = byId("bl2-section-resumen");
    if(!section || section.__bdlcBuilt){ return; }
    section.__bdlcBuilt = true;
    section.innerHTML = ''
      + '<div class="bdlc-header"><div><span class="bdlc-overline">Vista general</span><h2 class="bdlc-title">Resumen</h2><p class="bdlc-description">Estado del período activo, IndexedDB y sincronizaciones pendientes.</p></div><span id="bdlc-summary-health" class="bdlc-status pending">Verificando</span></div>'
      + '<div class="bdlc-card-grid bdlc-card-grid-kpis">'
      + '<article class="bdlc-card bdlc-kpi-card"><span>Período activo</span><strong id="bl2-kpi-period">—</strong><small id="bl2-kpi-period-id">Sin seleccionar</small></article>'
      + '<article class="bdlc-card bdlc-kpi-card"><span>Estudiantes</span><strong id="bl2-kpi-students">0</strong><small id="bl2-kpi-students-sub">Matrículas del período</small></article>'
      + '<article class="bdlc-card bdlc-kpi-card"><span>Activos</span><strong id="bdlc-kpi-active">0</strong><small>Estado de matrícula</small></article>'
      + '<article class="bdlc-card bdlc-kpi-card"><span>Retirados</span><strong id="bdlc-kpi-retired">0</strong><small>Conservados en reportes</small></article>'
      + '<article class="bdlc-card bdlc-kpi-card"><span>Personas</span><strong id="bdlc-kpi-people">0</strong><small>Registro general</small></article>'
      + '<article class="bdlc-card bdlc-kpi-card"><span>Requisitos</span><strong id="bdlc-kpi-requirements">0</strong><small>Del período</small></article>'
      + '<article class="bdlc-card bdlc-kpi-card"><span>Notas</span><strong id="bdlc-kpi-notes">0</strong><small>Del período</small></article>'
      + '<article class="bdlc-card bdlc-kpi-card"><span>Pendientes Google</span><strong id="bl2-kpi-google">0</strong><small>Google Sheets</small></article>'
      + '<article class="bdlc-card bdlc-kpi-card"><span>Pendientes Firebase</span><strong id="bl2-kpi-firebase">0</strong><small>Firebase</small></article>'
      + '<article class="bdlc-card bdlc-kpi-card"><span>Pendientes Supabase</span><strong id="bl2-kpi-supabase">0</strong><small>Supabase</small></article>'
      + '<article class="bdlc-card bdlc-kpi-card"><span>Errores</span><strong id="bl2-kpi-warnings">0</strong><small>Validación o sincronización</small></article>'
      + '<article class="bdlc-card bdlc-kpi-card"><span>Último respaldo</span><strong id="bdlc-kpi-backup">—</strong><small id="bl2-backup-status">Sin registro</small></article>'
      + '</div>'
      + '<div class="bdlc-card-grid two">'
      + '<article class="bdlc-card"><h3>Estado técnico</h3><div class="bdlc-table-wrap"><table class="bdlc-table"><tbody id="bdlc-summary-technical"><tr><th>Estado</th><td>Consultando IndexedDB...</td></tr></tbody></table></div></article>'
      + '<article class="bdlc-card"><h3>Conexiones externas</h3><div id="bdlc-summary-connections" class="bdlc-placeholder"><strong>Comprobando conexiones</strong><span>Espere un momento.</span></div></article>'
      + '</div>';
  }

  function buildExternal(){
    var section = byId("bl2-section-bases-externas");
    if(!section || section.__bdlcBuilt){ return; }
    section.__bdlcBuilt = true;
    section.innerHTML = ''
      + '<div class="bdlc-header"><div><span class="bdlc-overline">Conexiones</span><h2 class="bdlc-title">Bases externas</h2><p class="bdlc-description">BDLocal sigue siendo la base principal. Las operaciones externas son manuales y controladas.</p></div><button class="bdlc-button secondary" type="button" data-bdlc-action="test-all">Probar todas</button></div>'
      + '<div class="bdlc-connections-grid">'
      + connectionCard("google","Google Sheets","Sin configurar",[
          button("push-google","Subir","bl2-btn-push-google"),
          button("pull-sheets","Traer","bl2-btn-pull-sheets","secondary"),
          button("test-sheets","Probar","","subtle")
        ], sheetsForm())
      + connectionCard("firebase","Firebase","Pendiente",[
          button("push-firebase","Subir","bl2-btn-push-firebase"),
          button("pull-firebase","Traer datos","","secondary"),
          button("fetch-firebase-config","Traer configuración","bl2-btn-fetch-firebase-config","subtle"),
          button("test-firebase","Probar","","subtle")
        ], firebaseForm())
      + connectionCard("supabase","Supabase","Sin configurar",[
          button("push-supabase","Subir","bl2-btn-push-supabase"),
          button("test-supabase","Probar","","subtle")
        ], supabaseForm())
      + '</div>';
  }

  function button(action, label, id, variant){ return '<button ' + (id ? 'id="' + id + '" ' : '') + 'type="button" class="bdlc-button ' + (variant || '') + '" data-bdlc-owned="ui" data-bdlc-action="' + action + '">' + label + '</button>'; }

  function connectionCard(key, label, initial, actions, form){
    return '<article class="bdlc-connection-card" data-bdlc-connection="' + key + '">'
      + '<div class="bdlc-connection-head"><div><h3>' + esc(label) + '</h3><p>BDLocal ↔ ' + esc(label) + '</p></div><span id="bl2-dot-' + key + '" class="bl2-dot bl2-dot-warn"></span></div>'
      + '<div class="bdlc-connection-status"><span>Estado</span><strong id="bl2-' + key + '-status">' + esc(initial) + '</strong></div>'
      + '<div class="bdlc-actions">' + actions.join("") + '</div>'
      + '<details><summary>Configuración y detalles</summary>' + form + '</details>'
      + '</article>';
  }

  function sheetsForm(){
    return '<div class="bdlc-form">'
      + '<div class="bdlc-field"><label class="bdlc-label">Estado</label><select id="bdlc-sheets-enabled" class="bdlc-select"><option value="false">Desactivado</option><option value="true">Activado</option></select></div>'
      + '<div class="bdlc-field"><label class="bdlc-label">Tamaño de lote</label><input id="bdlc-sheets-batch" class="bdlc-input" type="number" min="1" max="500"></div>'
      + '<div class="bdlc-field full"><label class="bdlc-label">URL de Apps Script</label><input id="bdlc-sheets-url" class="bdlc-input" type="url"></div>'
      + '<div class="bdlc-field"><label class="bdlc-label">ID del Google Sheet</label><input id="bdlc-sheets-id" class="bdlc-input" type="text"></div>'
      + '<div class="bdlc-field"><label class="bdlc-label">Nombre de hoja</label><input id="bdlc-sheets-name" class="bdlc-input" type="text"></div>'
      + '<div class="bdlc-field full"><label class="bdlc-label">Token de Apps Script</label><input id="bdlc-sheets-token" class="bdlc-input" type="password" autocomplete="off"></div>'
      + '</div><div class="bdlc-actions"><button class="bdlc-button" type="button" data-bdlc-action="save-sheets">Guardar configuración</button></div>';
  }

  function firebaseForm(){
    return '<div class="bdlc-form">'
      + '<div class="bdlc-field"><label class="bdlc-label">Límite diario estimado</label><input id="bdlc-firebase-limit" class="bdlc-input" type="number" min="1"></div>'
      + '<div class="bdlc-field"><label class="bdlc-label">Advertir al porcentaje</label><input id="bdlc-firebase-warning" class="bdlc-input" type="number" min="1" max="100"></div>'
      + '<div class="bdlc-field"><label class="bdlc-label">Bloquear al porcentaje</label><input id="bdlc-firebase-stop" class="bdlc-input" type="number" min="1" max="100"></div>'
      + '</div><div class="bdlc-actions"><button class="bdlc-button" type="button" data-bdlc-action="save-firebase">Guardar cuota</button></div>';
  }

  function supabaseForm(){
    return '<div class="bdlc-form">'
      + '<div class="bdlc-field"><label class="bdlc-label">Estado</label><select id="bdlc-supabase-enabled" class="bdlc-select"><option value="false">Desactivado</option><option value="true">Activado</option></select></div>'
      + '<div class="bdlc-field"><label class="bdlc-label">Tabla externa</label><input id="bdlc-supabase-table" class="bdlc-input" type="text"></div>'
      + '<div class="bdlc-field full"><label class="bdlc-label">Supabase URL</label><input id="bdlc-supabase-url" class="bdlc-input" type="url"></div>'
      + '<div class="bdlc-field full"><label class="bdlc-label">Anon key</label><input id="bdlc-supabase-key" class="bdlc-input" type="password" autocomplete="off"></div>'
      + '</div><div class="bdlc-actions"><button class="bdlc-button" type="button" data-bdlc-action="save-supabase">Guardar configuración</button></div>';
  }

  function buildScreens(){
    var section = byId("bl2-section-pantallas");
    if(!section || section.__bdlcBuilt){ return; }
    section.__bdlcBuilt = true;
    section.innerHTML = '<div class="bdlc-header"><div><span class="bdlc-overline">Conexiones</span><h2 class="bdlc-title">Pantallas</h2><p class="bdlc-description">Verifica que cada módulo consulte o guarde mediante BDLocal.</p></div><button class="bdlc-button secondary" type="button" data-bdlc-action="screen-refresh-all">Refrescar conexiones</button></div><div id="bdlc-screen-grid" class="bdlc-card-grid three"></div>';
  }

  function renderScreens(){
    var grid = byId("bdlc-screen-grid");
    if(!grid){ return; }
    var currentHub = hub();
    var status = currentHub && typeof currentHub.status === "function" ? currentHub.status() : {};
    var registered = status && Array.isArray(status.connectors) ? status.connectors : [];
    grid.innerHTML = Object.keys(SCREENS).map(function(key){
      var item = SCREENS[key];
      var api = currentHub && typeof currentHub.get === "function" ? currentHub.get(key) : null;
      var ready = registered.indexOf(key) >= 0 || !!api;
      return '<article class="bdlc-card" data-bdlc-screen="' + key + '"><div class="bdlc-header"><div><h3>' + esc(item.label) + '</h3><p>Conector: ' + esc(key) + '</p></div>' + badge(ready ? "ok" : "pendiente", ready ? "Conectada" : "No cargada") + '</div>'
        + '<div class="bdlc-table-wrap"><table class="bdlc-table"><tbody><tr><th>Lee</th><td>' + esc(item.reads.join(", ") || "Ninguna") + '</td></tr><tr><th>Guarda</th><td>' + esc(item.writes.join(", ") || "Solo lectura") + '</td></tr><tr><th>Último resultado</th><td data-bdlc-screen-result="' + key + '">' + (ready ? "Conector disponible" : "Pendiente de carga") + '</td></tr></tbody></table></div>'
        + '<div class="bdlc-actions"><button class="bdlc-button secondary" type="button" data-bdlc-action="screen-test" data-target="' + key + '">Probar conexión</button><button class="bdlc-button subtle" type="button" data-bdlc-action="screen-refresh" data-target="' + key + '">Refrescar datos</button></div></article>';
    }).join("");
  }

  function fillConfigForms(){
    var s = store();
    if(!s){ return; }
    var config = s.loadConfig();
    var sheets = s.getSheetsConfig({ includeSecret:true });
    var supabase = s.getSupabaseConfig({ includeSecret:true });
    function value(id, val){ var el = byId(id); if(el){ el.value = val == null ? "" : val; } }
    value("bdlc-firebase-limit", config.firebase.dailyLimit || 500);
    value("bdlc-firebase-warning", config.firebase.warningPercent || 80);
    value("bdlc-firebase-stop", config.firebase.stopPercent || 95);
    value("bdlc-sheets-enabled", String(!!sheets.enabled)); value("bdlc-sheets-batch", sheets.batchSize || 25); value("bdlc-sheets-url", sheets.appsScriptUrl || ""); value("bdlc-sheets-id", sheets.spreadsheetId || ""); value("bdlc-sheets-name", sheets.sheetName || "Requisitos"); value("bdlc-sheets-token", sheets.token || "");
    value("bdlc-supabase-enabled", String(!!supabase.enabled)); value("bdlc-supabase-table", supabase.tableName || "app_records"); value("bdlc-supabase-url", supabase.url || ""); value("bdlc-supabase-key", supabase.anonKey || "");
  }

  function renderConnections(counts){
    var s = store();
    if(!s){ return; }
    var config = s.loadConfig();
    var sheets = s.getSheetsConfig({ includeSecret:false });
    var supabase = s.getSupabaseConfig({ includeSecret:false });
    counts = counts || {};
    var detail = counts.detail || counts;
    function pending(target){ var row = detail[target] || {}; return number(row.pending) + number(row.waitingRetry) + number(row.error) + number(row.blocked); }
    var gp = pending("google"), fp = pending("firebase"), sp = pending("supabase");
    setText("bl2-google-status", (sheets.connected ? "Conectado" : (sheets.enabled ? "Configurado" : "Sin configurar")) + " · Pendientes: " + gp + " · Última prueba: " + formatDate(sheets.lastTestAt));
    setText("bl2-firebase-status", (config.firebase.connected ? "Conectado" : "Pendiente de prueba") + " · Pendientes: " + fp + " · Última prueba: " + formatDate(config.firebase.lastTestAt));
    setText("bl2-supabase-status", (supabase.connected ? "Conectado" : (supabase.enabled ? "Configurado" : "Sin configurar")) + " · Pendientes: " + sp + " · Última prueba: " + formatDate(supabase.lastTestAt));
    setText("bl2-kpi-google", formatNumber(gp)); setText("bl2-kpi-firebase", formatNumber(fp)); setText("bl2-kpi-supabase", formatNumber(sp));
    var summary = byId("bdlc-summary-connections");
    if(summary){ summary.className = "bdlc-table-wrap"; summary.innerHTML = '<table class="bdlc-table"><tbody><tr><th>Google Sheets</th><td>' + esc(sheets.connected ? "Conectado" : "Revisar") + ' · ' + gp + ' pendiente(s)</td></tr><tr><th>Firebase</th><td>' + esc(config.firebase.connected ? "Conectado" : "Revisar") + ' · ' + fp + ' pendiente(s)</td></tr><tr><th>Supabase</th><td>' + esc(supabase.connected ? "Conectado" : (supabase.enabled ? "Revisar" : "Desactivado")) + ' · ' + sp + ' pendiente(s)</td></tr></tbody></table>'; }
  }

  function renderSummary(){
    var seq = ++renderSequence;
    var period = selectedPeriod();
    var summaryPromise = period.id && core() && typeof core().getSummary === "function" ? core().getSummary(period.id).catch(function(){ return {}; }) : Promise.resolve({});
    var countsPromise = window.BDLSyncUIBridge && typeof window.BDLSyncUIBridge.refreshCounts === "function" ? window.BDLSyncUIBridge.refreshCounts().catch(function(){ return null; }) : Promise.resolve(null);
    return Promise.all([
      summaryPromise,
      queryCount("personas"),
      queryCount("matriculas_periodo","periodoId",period.id),
      queryCount("requisitos_estudiante","periodoId",period.id),
      queryCount("notas_titulacion","periodoId",period.id),
      queryCount("errores_validacion","periodoId",period.id),
      lastBackup(),
      countsPromise
    ]).then(function(values){
      if(seq !== renderSequence){ return null; }
      var summary = values[0] || {};
      var people = values[1], matriculas = values[2], requirements = values[3], notes = values[4], errors = values[5], backupRow = values[6], counts = values[7];
      var appState = window.BL2App && typeof window.BL2App.getState === "function" ? window.BL2App.getState() : {};
      var active = appState.activePeriod || period;
      setText("bl2-kpi-period", active.label || active.id || "—"); setText("bl2-kpi-period-id", active.id || "Sin seleccionar");
      setText("bl2-kpi-students", formatNumber(summary.totalEstudiantes || matriculas));
      setText("bdlc-kpi-active", formatNumber(summary.totalActivos)); setText("bdlc-kpi-retired", formatNumber(summary.totalRetirados));
      setText("bdlc-kpi-people", formatNumber(people)); setText("bdlc-kpi-requirements", formatNumber(requirements)); setText("bdlc-kpi-notes", formatNumber(notes)); setText("bl2-kpi-warnings", formatNumber(errors));
      setText("bdlc-kpi-backup", backupRow ? "Disponible" : "—"); setText("bl2-backup-status", backupRow ? formatDate(backupRow.createdAt || backupRow.updatedAt || backupRow.at) : "Sin respaldo registrado");
      var meta = db() && typeof db().meta === "function" ? db().meta() : {};
      var health = window.BDLFinalHealth && typeof window.BDLFinalHealth.run === "function" ? window.BDLFinalHealth.run() : null;
      var healthEl = byId("bdlc-summary-health");
      if(healthEl){ healthEl.className = "bdlc-status " + (health && health.ok ? "ok" : "warning"); healthEl.textContent = health && health.ok ? "Base saludable" : "Revisar salud"; }
      setHTML("bdlc-summary-technical", '<tr><th>Base</th><td>' + esc(meta.name || "REQUISITOS_BL2") + '</td></tr><tr><th>Versión</th><td>' + esc(meta.version || "—") + '</td></tr><tr><th>Tablas detectadas</th><td>' + esc(Array.isArray(meta.stores) ? meta.stores.length : Array.isArray(meta.storeNames) ? meta.storeNames.length : "—") + '</td></tr><tr><th>Período</th><td>' + esc(active.label || active.id || "Sin seleccionar") + '</td></tr><tr><th>Última actualización</th><td>' + esc(formatDate(summary.updatedAt)) + '</td></tr>');
      renderConnections(counts);
      return summary;
    });
  }

  function saveConfig(action){
    var s = store();
    if(!s){ throw new Error("BDLocalConfigStore no está disponible."); }
    if(action === "save-firebase"){ s.setFirebaseQuota({ dailyLimit:input("bdlc-firebase-limit"), warningPercent:input("bdlc-firebase-warning"), stopPercent:input("bdlc-firebase-stop") }); return "Cuota Firebase guardada."; }
    if(action === "save-sheets"){ s.setSheetsConfig({ enabled:input("bdlc-sheets-enabled") === "true", batchSize:input("bdlc-sheets-batch"), appsScriptUrl:input("bdlc-sheets-url"), spreadsheetId:input("bdlc-sheets-id"), sheetName:input("bdlc-sheets-name"), token:input("bdlc-sheets-token") }); return "Configuración de Google Sheets guardada."; }
    if(action === "save-supabase"){ s.setSupabaseConfig({ enabled:input("bdlc-supabase-enabled") === "true", tableName:input("bdlc-supabase-table"), url:input("bdlc-supabase-url"), anonKey:input("bdlc-supabase-key") }); return "Configuración de Supabase guardada."; }
    return "Configuración guardada.";
  }

  function runManager(method){
    var m = manager();
    if(!m || typeof m[method] !== "function"){ return Promise.reject(new Error("La acción " + method + " no está disponible.")); }
    return Promise.resolve(m[method]());
  }

  function runScreen(action, target){
    var currentHub = hub();
    if(!currentHub){ return Promise.reject(new Error("BDLocalConexiones no está disponible.")); }
    if(action === "screen-refresh" || action === "screen-refresh-all"){
      if(typeof currentHub.refreshCache !== "function"){ return Promise.reject(new Error("El refresco de conexiones no está disponible.")); }
      return currentHub.refreshCache({ force:true, light:true, source:"BDLocalConfigUI" }).then(function(result){ renderScreens(); return { ok:true, message:"Conexiones de pantallas actualizadas.", result:result }; });
    }
    var api = typeof currentHub.get === "function" ? currentHub.get(target) : null;
    if(!api){ return Promise.reject(new Error("El conector " + target + " no está cargado.")); }
    var runner = typeof api.ready === "function" ? api.ready() : (typeof currentHub.ready === "function" ? currentHub.ready() : Promise.resolve(true));
    return Promise.resolve(runner).then(function(result){ var cell = rootElement.querySelector('[data-bdlc-screen-result="' + target + '"]'); if(cell){ cell.textContent = "Prueba correcta: " + new Date().toLocaleString("es-EC"); } return { ok:true, message:"Conexión de " + (SCREENS[target] ? SCREENS[target].label : target) + " correcta.", result:result }; });
  }

  function execute(action, target){
    if(action === "refresh"){ return window.BL2App && typeof window.BL2App.refresh === "function" ? window.BL2App.refresh() : render(); }
    if(action === "save-firebase" || action === "save-sheets" || action === "save-supabase"){ return Promise.resolve({ ok:true, message:saveConfig(action) }); }
    if(action === "test-all"){ return runManager("testAll"); }
    if(action === "test-firebase"){ return runManager("testFirebase"); }
    if(action === "test-sheets"){ return runManager("testSheets"); }
    if(action === "test-supabase"){ return runManager("testSupabase"); }
    if(action === "push-google" || action === "push-firebase" || action === "push-supabase"){
      var syncTarget = action.replace("push-","");
      if(!window.BDLSyncUIBridge || typeof window.BDLSyncUIBridge.runTarget !== "function"){ return Promise.reject(new Error("El puente de sincronización no está disponible.")); }
      return window.BDLSyncUIBridge.runTarget(syncTarget, { confirm:true });
    }
    if(action === "pull-sheets"){
      if(!window.confirm("Traer Google Sheets hacia BDLocal para el período seleccionado. Esta operación no borra la base local. ¿Continuar?")){ return Promise.resolve({ ok:true, cancelled:true, message:"Operación cancelada." }); }
      if(!window.BL2CloudPull || typeof window.BL2CloudPull.pullSheetsToLocal !== "function"){ return Promise.reject(new Error("La descarga de Google Sheets no está disponible.")); }
      return window.BL2CloudPull.pullSheetsToLocal();
    }
    if(action === "fetch-firebase-config"){
      if(!window.BL2CloudPull || typeof window.BL2CloudPull.forceFetchFirebaseConfig !== "function"){ return Promise.reject(new Error("La recuperación de configuración Firebase no está disponible.")); }
      return window.BL2CloudPull.forceFetchFirebaseConfig();
    }
    if(action === "pull-firebase"){
      if(!window.confirm("Traer datos de Firebase hacia BDLocal para el período seleccionado. ¿Continuar?")){ return Promise.resolve({ ok:true, cancelled:true, message:"Operación cancelada." }); }
      return runManager("pullFirebaseToLocal");
    }
    if(action === "screen-test" || action === "screen-refresh" || action === "screen-refresh-all"){ return runScreen(action, target); }
    return Promise.reject(new Error("Acción no reconocida: " + action));
  }

  function handleAction(button){
    var action = text(button.getAttribute("data-bdlc-action"));
    var target = text(button.getAttribute("data-target"));
    if(!action){ return; }
    button.disabled = true;
    setProgress(true, 12, "Ejecutando " + action + "...");
    Promise.resolve().then(function(){ return execute(action, target); }).then(function(result){
      setProgress(true, 100, "Operación finalizada.");
      if(result && !result.cancelled){ notify(result.message || "Operación finalizada.", result.ok === false ? "error" : "success"); }
      return render();
    }).catch(function(error){ setProgress(false, 0, "Error"); notify(error && error.message ? error.message : String(error), "error"); }).finally(function(){ button.disabled = false; window.setTimeout(function(){ setProgress(false, 0, ""); }, 1800); });
  }

  function bindEvents(){
    if(bound || !rootElement){ return; }
    bound = true;
    rootElement.addEventListener("click", function(event){
      var button = event.target && event.target.closest ? event.target.closest("[data-bdlc-action]") : null;
      if(button && rootElement.contains(button)){ event.preventDefault(); handleAction(button); return; }
      var nav = event.target && event.target.closest ? event.target.closest("[data-bl2-section-target]") : null;
      if(nav && store()){ store().patchConfig({ ui:{ activeSection:nav.getAttribute("data-bl2-section-target") || "resumen" } }); }
    });
    window.addEventListener("bdlocal:sync-ui-updated", function(event){ renderConnections(event.detail && event.detail.counts); });
    window.addEventListener("bl2:period-changed", render);
    window.addEventListener("bl2:students-saved", render);
    window.addEventListener("bdlocal:changes-created", render);
  }

  function ensureStructure(){ buildSummary(); buildExternal(); buildScreens(); fillConfigForms(); renderScreens(); }

  function render(){
    if(!rootElement){ return Promise.resolve(null); }
    ensureStructure();
    renderScreens();
    return renderSummary().then(function(result){ fillConfigForms(); return result; });
  }

  function init(options){
    options = options || {};
    rootElement = options.container || document.querySelector(options.containerSelector || "#bdlocal-control-center-root") || document.querySelector("#bdlocal-config-root");
    if(!rootElement){ console.warn("BDLocalConfigUI: no se encontró el contenedor del centro de control."); return Promise.resolve(null); }
    if(!initialized){ initialized = true; bindEvents(); }
    return render();
  }

  window.BDLocalConfigUI = { init:init, render:render, notify:notify, setProgress:setProgress, renderSummary:renderSummary, renderConnections:renderConnections, renderScreens:renderScreens };
})(window, document);
