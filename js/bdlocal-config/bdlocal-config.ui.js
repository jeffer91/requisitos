/* =========================================================
Nombre completo: bdlocal-config.ui.js
Ruta o ubicación: /js/bdlocal-config/bdlocal-config.ui.js
Función o funciones:
- Controlar Resumen, Conexiones, Pantallas, Tablas y Consulta de estudiante.
- Reutilizar IndexedDB, servicios y sincronización existentes.
========================================================= */
(function(window, document){
  "use strict";

  var root = null;
  var bound = false;
  var studentSnapshot = null;

  var SCREENS = {
    carga:["Carga","periodos","personas, matriculas_periodo, requisitos_estudiante, cambios_pendientes"],
    ficha:["Ficha","personas, matriculas_periodo, requisitos_estudiante, notas_titulacion, contactos_estudiante","contactos_estudiante, requisitos_estudiante, cambios_pendientes"],
    tabla:["Tabla","personas, matriculas_periodo, requisitos_estudiante, notas_titulacion","cambios_pendientes"],
    stats:["Estadísticas","matriculas_periodo, requisitos_estudiante, notas_titulacion","Solo lectura"],
    coordi:["Coordinación","personas, matriculas_periodo, requisitos_estudiante, notas_titulacion","notas_titulacion, cambios_pendientes"],
    reportes:["Reportes","personas, matriculas_periodo, requisitos_estudiante, notas_titulacion","Solo lectura"],
    defensas:["Defensas","personas, matriculas_periodo, requisitos_estudiante","notas_titulacion, cambios_pendientes"],
    global:["Global","periodos, personas, matriculas_periodo","Solo lectura"]
  };

  function id(name){ return document.getElementById(name); }
  function txt(value){ return String(value == null ? "" : value).trim(); }
  function num(value){ value = Number(value || 0); return Number.isFinite(value) ? value : 0; }
  function esc(value){ return txt(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
  function setText(name,value){ var el = id(name); if(el){ el.textContent = value; } }
  function setHTML(name,value){ var el = id(name); if(el){ el.innerHTML = value; } }
  function value(name){ var el = id(name); return el ? el.value : ""; }
  function db(){ return window.BL2DB || null; }
  function core(){ return window.BL2Core || null; }
  function store(){ return window.BDLocalConfigStore || null; }
  function manager(){ return window.BDLocalSyncManager || null; }
  function hub(){ return window.BDLocalConexiones || null; }
  function format(value){ try{ return num(value).toLocaleString("es-EC"); }catch(error){ return String(num(value)); } }
  function date(value){ if(!txt(value)){ return "Sin registro"; } var d = new Date(value); return Number.isFinite(d.getTime()) ? d.toLocaleString("es-EC") : txt(value); }

  function period(){
    if(window.BL2App && typeof window.BL2App.getSelectedPeriod === "function"){
      var row = window.BL2App.getSelectedPeriod();
      if(row && txt(row.id)){ return { id:txt(row.id), label:txt(row.label || row.id) }; }
    }
    var select = id("bl2-period-select");
    var pid = txt(select && select.value);
    return { id:pid, label:select && select.selectedOptions && select.selectedOptions[0] ? txt(select.selectedOptions[0].textContent) : pid };
  }

  function notify(message,type){
    var box = id("bl2-global-alert");
    if(!box){ window.alert(message); return; }
    box.className = "bdlc-alert " + (type || "info");
    box.textContent = message;
    box.hidden = false;
    clearTimeout(box.__timer);
    box.__timer = setTimeout(function(){ box.hidden = true; },5000);
  }

  function progress(show,percent,message){
    var bar = id("bl2-sync-bar");
    if(bar){ bar.hidden = !show; }
    setText("bl2-sync-percent",Math.round(num(percent)) + "%");
    setText("bl2-sync-detail",message || "");
    var fill = id("bl2-sync-progress");
    if(fill){ fill.style.width = Math.max(0,Math.min(100,num(percent))) + "%"; }
  }

  function badge(ok,label){ return '<span class="bdlc-status ' + (ok ? 'ok' : 'warning') + '">' + esc(label) + '</span>'; }
  function button(action,label,variant,target,buttonId){ return '<button ' + (buttonId ? 'id="' + buttonId + '" ' : '') + 'class="bdlc-button ' + (variant || '') + '" type="button" data-bdlc-action="' + action + '"' + (target ? ' data-target="' + target + '"' : '') + '>' + label + '</button>'; }

  function buildSummary(){
    var section = id("bl2-section-resumen");
    if(!section || section.__built){ return; }
    section.__built = true;
    var cards = [
      ["Período activo","bl2-kpi-period","—"],["Estudiantes","bl2-kpi-students","0"],["Activos","bdlc-kpi-active","0"],["Retirados","bdlc-kpi-retired","0"],
      ["Personas","bdlc-kpi-people","0"],["Requisitos","bdlc-kpi-requirements","0"],["Notas","bdlc-kpi-notes","0"],["Errores","bl2-kpi-warnings","0"],
      ["Google","bl2-kpi-google","0"],["Firebase","bl2-kpi-firebase","0"],["Supabase","bl2-kpi-supabase","0"],["Respaldo","bdlc-kpi-backup","—"]
    ];
    section.innerHTML = '<div class="bdlc-header"><div><span class="bdlc-overline">Vista general</span><h2 class="bdlc-title">Resumen</h2><p class="bdlc-description">Estado del período activo, tablas y pendientes.</p></div><span id="bdlc-summary-health" class="bdlc-status pending">Verificando</span></div><div class="bdlc-card-grid bdlc-card-grid-kpis">'
      + cards.map(function(card){ return '<article class="bdlc-card bdlc-kpi-card"><span>' + card[0] + '</span><strong id="' + card[1] + '">' + card[2] + '</strong><small>Base Local</small></article>'; }).join("")
      + '</div><div class="bdlc-card-grid two"><article class="bdlc-card"><h3>Estado técnico</h3><div class="bdlc-table-wrap"><table class="bdlc-table"><tbody id="bdlc-summary-technical"></tbody></table></div></article><article class="bdlc-card"><h3>Conexiones</h3><div id="bdlc-summary-connections" class="bdlc-empty">Verificando...</div></article></div>';
  }

  function connection(key,label,actions,form){
    return '<article class="bdlc-connection-card"><div class="bdlc-connection-head"><div><h3>' + label + '</h3><p>BDLocal ↔ ' + label + '</p></div><span id="bl2-dot-' + key + '" class="bl2-dot bl2-dot-warn"></span></div><div class="bdlc-connection-status"><span>Estado</span><strong id="bl2-' + key + '-status">Verificando...</strong></div><div class="bdlc-actions">' + actions + '</div><details><summary>Configuración</summary>' + form + '</details></article>';
  }

  function buildExternal(){
    var section = id("bl2-section-bases-externas");
    if(!section || section.__built){ return; }
    section.__built = true;
    var sheetsForm = '<div class="bdlc-form"><div class="bdlc-field"><label class="bdlc-label">Estado</label><select id="bdlc-sheets-enabled" class="bdlc-select"><option value="false">Desactivado</option><option value="true">Activado</option></select></div><div class="bdlc-field"><label class="bdlc-label">Lote</label><input id="bdlc-sheets-batch" class="bdlc-input" type="number"></div><div class="bdlc-field full"><label class="bdlc-label">Apps Script</label><input id="bdlc-sheets-url" class="bdlc-input"></div><div class="bdlc-field"><label class="bdlc-label">Sheet ID</label><input id="bdlc-sheets-id" class="bdlc-input"></div><div class="bdlc-field"><label class="bdlc-label">Hoja</label><input id="bdlc-sheets-name" class="bdlc-input"></div></div>' + button("save-sheets","Guardar","","","");
    var firebaseForm = '<div class="bdlc-form"><div class="bdlc-field"><label class="bdlc-label">Límite diario</label><input id="bdlc-firebase-limit" class="bdlc-input" type="number"></div><div class="bdlc-field"><label class="bdlc-label">Advertir %</label><input id="bdlc-firebase-warning" class="bdlc-input" type="number"></div><div class="bdlc-field"><label class="bdlc-label">Bloquear %</label><input id="bdlc-firebase-stop" class="bdlc-input" type="number"></div></div>' + button("save-firebase","Guardar","","","");
    var supabaseForm = '<div class="bdlc-form"><div class="bdlc-field"><label class="bdlc-label">Estado</label><select id="bdlc-supabase-enabled" class="bdlc-select"><option value="false">Desactivado</option><option value="true">Activado</option></select></div><div class="bdlc-field"><label class="bdlc-label">Tabla</label><input id="bdlc-supabase-table" class="bdlc-input"></div><div class="bdlc-field full"><label class="bdlc-label">URL</label><input id="bdlc-supabase-url" class="bdlc-input"></div><div class="bdlc-field full"><label class="bdlc-label">Anon key</label><input id="bdlc-supabase-key" class="bdlc-input" type="password"></div></div>' + button("save-supabase","Guardar","","","");
    section.innerHTML = '<div class="bdlc-header"><div><span class="bdlc-overline">Conexiones</span><h2 class="bdlc-title">Bases externas</h2><p class="bdlc-description">Operaciones manuales y controladas.</p></div>' + button("test-all","Probar todas","secondary") + '</div><div class="bdlc-connections-grid">'
      + connection("google","Google Sheets",button("push-google","Subir","","","bl2-btn-push-google") + button("pull-sheets","Traer","secondary","","bl2-btn-pull-sheets") + button("test-sheets","Probar","subtle"),sheetsForm)
      + connection("firebase","Firebase",button("push-firebase","Subir","","","bl2-btn-push-firebase") + button("pull-firebase","Traer datos","secondary") + button("fetch-firebase-config","Traer configuración","subtle","","bl2-btn-fetch-firebase-config") + button("test-firebase","Probar","subtle"),firebaseForm)
      + connection("supabase","Supabase",button("push-supabase","Subir","","","bl2-btn-push-supabase") + button("test-supabase","Probar","subtle"),supabaseForm)
      + '</div>';
  }

  function buildScreens(){
    var section = id("bl2-section-pantallas");
    if(!section || section.__built){ return; }
    section.__built = true;
    section.innerHTML = '<div class="bdlc-header"><div><span class="bdlc-overline">Conexiones</span><h2 class="bdlc-title">Pantallas</h2><p class="bdlc-description">Módulos que leen o guardan mediante BDLocal.</p></div>' + button("screen-refresh-all","Refrescar","secondary") + '</div><div id="bdlc-screen-grid" class="bdlc-card-grid three"></div>';
  }

  function renderScreens(){
    var grid = id("bdlc-screen-grid");
    if(!grid){ return; }
    var current = hub();
    var registered = current && typeof current.status === "function" ? current.status().connectors || [] : [];
    grid.innerHTML = Object.keys(SCREENS).map(function(key){
      var row = SCREENS[key];
      var ready = registered.indexOf(key) >= 0 || !!(current && current.get && current.get(key));
      return '<article class="bdlc-card"><div class="bdlc-header"><div><h3>' + row[0] + '</h3><p>' + key + '</p></div>' + badge(ready,ready ? "Conectada" : "No cargada") + '</div><div class="bdlc-table-wrap"><table class="bdlc-table"><tbody><tr><th>Lee</th><td>' + row[1] + '</td></tr><tr><th>Guarda</th><td>' + row[2] + '</td></tr><tr><th>Resultado</th><td data-screen-result="' + key + '">' + (ready ? "Disponible" : "Pendiente") + '</td></tr></tbody></table></div><div class="bdlc-actions">' + button("screen-test","Probar","secondary",key) + button("screen-refresh","Refrescar datos","subtle",key) + '</div></article>';
    }).join("");
  }

  function buildTables(){
    var section = id("bl2-section-tablas");
    if(!section || section.__built){ return; }
    section.__built = true;
    section.innerHTML = '<div class="bdlc-header"><div><span class="bdlc-overline">IndexedDB</span><h2 class="bdlc-title">Tablas</h2><p class="bdlc-description">Explorador de solo lectura.</p></div></div><div id="bl2-tables-slot" class="bdlc-empty">Preparando explorador...</div>';
  }

  function mountTables(force){
    var slot = id("bl2-tables-slot");
    if(!slot || !window.BL2RawView || typeof window.BL2RawView.mount !== "function"){ return Promise.resolve(null); }
    if(!force && slot.getAttribute("data-raw-mounted") === "true"){ return Promise.resolve(window.BL2RawView.getState()); }
    return window.BL2RawView.mount(slot,{ periodoId:period().id });
  }

  function buildStudent(){
    var section = id("bl2-section-estudiante");
    if(!section || section.__built){ return; }
    section.__built = true;
    section.innerHTML = '<div class="bdlc-header"><div><span class="bdlc-overline">Consulta integral</span><h2 class="bdlc-title">Consulta de estudiante</h2><p class="bdlc-description">Resultado consolidado como texto bruto.</p></div><span id="student-period" class="bdlc-status pending">Sin período</span></div><div class="bdlc-card"><div class="bdlc-field"><label class="bdlc-label">Cédula, nombre, correo o carrera</label><input id="student-search" class="bdlc-input" type="search" placeholder="Escriba al menos dos caracteres"></div><div class="bdlc-actions">' + button("student-search","Buscar") + button("student-clear","Limpiar","secondary") + button("student-copy","Copiar resultado","secondary") + '</div></div><div id="student-results" class="bdlc-empty">Realice una búsqueda.</div><div class="bdlc-card"><h3>Texto bruto</h3><pre id="student-raw" class="bdlc-raw-output">{}</pre></div>';
    id("student-search").addEventListener("keydown",function(event){ if(event.key === "Enter"){ event.preventDefault(); handleAction(section.querySelector('[data-bdlc-action="student-search"]')); } });
  }

  function updateStudentPeriod(){
    var current = period();
    var pill = id("student-period");
    if(pill){ pill.className = "bdlc-status " + (current.id ? "ok" : "warning"); pill.textContent = current.id ? current.label : "Seleccione un período"; }
  }

  function fillForms(){
    var s = store();
    if(!s){ return; }
    var config = s.loadConfig();
    var sheets = s.getSheetsConfig({ includeSecret:true });
    var supabase = s.getSupabaseConfig({ includeSecret:true });
    function put(name,val){ var el = id(name); if(el){ el.value = val == null ? "" : val; } }
    put("bdlc-firebase-limit",config.firebase.dailyLimit || 500); put("bdlc-firebase-warning",config.firebase.warningPercent || 80); put("bdlc-firebase-stop",config.firebase.stopPercent || 95);
    put("bdlc-sheets-enabled",String(!!sheets.enabled)); put("bdlc-sheets-batch",sheets.batchSize || 25); put("bdlc-sheets-url",sheets.appsScriptUrl || ""); put("bdlc-sheets-id",sheets.spreadsheetId || ""); put("bdlc-sheets-name",sheets.sheetName || "Requisitos");
    put("bdlc-supabase-enabled",String(!!supabase.enabled)); put("bdlc-supabase-table",supabase.tableName || "app_records"); put("bdlc-supabase-url",supabase.url || ""); put("bdlc-supabase-key",supabase.anonKey || "");
  }

  function query(table,index,key){
    var current = db();
    if(!current){ return Promise.resolve([]); }
    if(index && typeof current.queryByIndex === "function"){ return current.queryByIndex(table,index,key).catch(function(){ return []; }); }
    return current.getAll(table).catch(function(){ return []; });
  }

  function count(table,index,key){ return query(table,index,key).then(function(rows){ return rows.length; }); }

  function renderSummary(){
    var current = period();
    var summary = current.id && core() ? core().getSummary(current.id).catch(function(){ return {}; }) : Promise.resolve({});
    var counts = window.BDLSyncUIBridge ? window.BDLSyncUIBridge.refreshCounts().catch(function(){ return null; }) : Promise.resolve(null);
    return Promise.all([summary,count("personas"),count("matriculas_periodo","periodoId",current.id),count("requisitos_estudiante","periodoId",current.id),count("notas_titulacion","periodoId",current.id),count("errores_validacion","periodoId",current.id),counts]).then(function(rows){
      var s = rows[0] || {};
      setText("bl2-kpi-period",current.label || "—"); setText("bl2-kpi-students",format(s.totalEstudiantes || rows[2])); setText("bdlc-kpi-active",format(s.totalActivos)); setText("bdlc-kpi-retired",format(s.totalRetirados));
      setText("bdlc-kpi-people",format(rows[1])); setText("bdlc-kpi-requirements",format(rows[3])); setText("bdlc-kpi-notes",format(rows[4])); setText("bl2-kpi-warnings",format(rows[5]));
      var meta = db() && db().meta ? db().meta() : {};
      setHTML("bdlc-summary-technical",'<tr><th>Base</th><td>' + esc(meta.name || "REQUISITOS_BL2") + '</td></tr><tr><th>Versión</th><td>' + esc(meta.version || "—") + '</td></tr><tr><th>Tablas</th><td>' + (meta.stores || []).length + '</td></tr><tr><th>Período</th><td>' + esc(current.label || "Sin seleccionar") + '</td></tr><tr><th>Actualización</th><td>' + esc(date(s.updatedAt)) + '</td></tr>');
      var health = id("bdlc-summary-health"); if(health){ var ok = !(meta.missingStores || []).length; health.className = "bdlc-status " + (ok ? "ok" : "warning"); health.textContent = ok ? "Base saludable" : "Faltan tablas"; }
      renderConnections(rows[6]);
      return s;
    });
  }

  function renderConnections(counts){
    var s = store(); if(!s){ return; }
    var cfg = s.loadConfig(); var sheets = s.getSheetsConfig({ includeSecret:false }); var supabase = s.getSupabaseConfig({ includeSecret:false });
    var detail = counts && (counts.detail || counts) || {};
    function pending(name){ var row = detail[name] || {}; return num(row.pending) + num(row.waitingRetry) + num(row.error) + num(row.blocked); }
    var g = pending("google"), f = pending("firebase"), sp = pending("supabase");
    setText("bl2-kpi-google",format(g)); setText("bl2-kpi-firebase",format(f)); setText("bl2-kpi-supabase",format(sp));
    setText("bl2-google-status",(sheets.connected ? "Conectado" : "Revisar") + " · " + g + " pendiente(s)"); setText("bl2-firebase-status",(cfg.firebase.connected ? "Conectado" : "Revisar") + " · " + f + " pendiente(s)"); setText("bl2-supabase-status",(supabase.connected ? "Conectado" : "Revisar") + " · " + sp + " pendiente(s)");
    var box = id("bdlc-summary-connections"); if(box){ box.className = "bdlc-table-wrap"; box.innerHTML = '<table class="bdlc-table"><tbody><tr><th>Google</th><td>' + g + '</td></tr><tr><th>Firebase</th><td>' + f + '</td></tr><tr><th>Supabase</th><td>' + sp + '</td></tr></tbody></table>'; }
  }

  function searchStudent(){
    var current = period(); var q = txt(value("student-search")); var box = id("student-results");
    if(!current.id){ return Promise.reject(new Error("Seleccione un período.")); }
    if(q.length < 2){ return Promise.reject(new Error("Escriba al menos dos caracteres.")); }
    if(!core() || !core().searchStudents){ return Promise.reject(new Error("El buscador no está disponible.")); }
    box.className = "bdlc-empty"; box.textContent = "Buscando...";
    return core().searchStudents({ periodoId:current.id,search:q,limit:25 }).then(function(result){
      var rows = result.rows || [];
      if(!rows.length){ box.textContent = "No se encontraron estudiantes."; setText("student-raw","{}"); return { ok:true,message:"Sin resultados." }; }
      var exact = rows.filter(function(row){ return txt(row.cedula || row.numeroIdentificacion) === q; })[0];
      if(exact || rows.length === 1){ return loadStudent(txt((exact || rows[0]).cedula || (exact || rows[0]).numeroIdentificacion)); }
      box.className = "bdlc-table-wrap";
      box.innerHTML = '<table class="bdlc-table"><thead><tr><th>Ver</th><th>Cédula</th><th>Nombre</th><th>Carrera</th><th>Estado</th></tr></thead><tbody>' + rows.map(function(row){ var cedula = txt(row.cedula || row.numeroIdentificacion); return '<tr><td>' + button("student-select","Ver","subtle",cedula) + '</td><td>' + esc(cedula) + '</td><td>' + esc(row.Nombres || row.nombres || row.nombreCompleto) + '</td><td>' + esc(row.NombreCarrera || row.carrera) + '</td><td>' + esc(row.estadoMatricula) + '</td></tr>'; }).join("") + '</tbody></table>';
      return { ok:true,message:rows.length + " coincidencia(s)." };
    });
  }

  function loadStudent(cedula){
    var current = period();
    var base = window.BDLServiceFicha && window.BDLServiceFicha.getDetalle
      ? window.BDLServiceFicha.getDetalle({ periodoId:current.id,cedula:cedula })
      : core().getStudentByCedula(cedula,current.id).then(function(row){ return { ok:!!row,periodoId:current.id,cedula:cedula,estudiante:row }; });
    return Promise.all([base,query("divisiones_estudiante","periodo_cedula",[current.id,cedula]),query("cambios_pendientes","cedula",cedula),query("errores_validacion","cedula",cedula)]).then(function(rows){
      var data = rows[0] || {};
      data.divisiones = rows[1] || [];
      data.cambiosPendientes = (rows[2] || []).filter(function(row){ return !txt(row.periodoId) || txt(row.periodoId) === current.id; });
      data.erroresValidacion = (rows[3] || []).filter(function(row){ return !txt(row.periodoId) || txt(row.periodoId) === current.id; });
      data.fuente = "BDLocal"; data.consultadoEn = new Date().toISOString();
      studentSnapshot = data;
      setText("student-raw",JSON.stringify(data,null,2));
      var box = id("student-results"); box.className = "bdlc-alert success"; box.textContent = "Estudiante cargado: " + cedula + ".";
      return { ok:true,message:"Consulta cargada." };
    });
  }

  function clearStudent(){ studentSnapshot = null; setText("student-raw","{}"); var search = id("student-search"); if(search){ search.value = ""; } var box = id("student-results"); if(box){ box.className = "bdlc-empty"; box.textContent = "Realice una búsqueda."; } return { ok:true,message:"Consulta limpiada." }; }
  function copyStudent(){ if(!navigator.clipboard || !navigator.clipboard.writeText){ return Promise.reject(new Error("Portapapeles no disponible.")); } return navigator.clipboard.writeText(JSON.stringify(studentSnapshot || {},null,2)).then(function(){ return { ok:true,message:"Resultado copiado." }; }); }

  function save(action){
    var s = store(); if(!s){ throw new Error("Configuración no disponible."); }
    if(action === "save-firebase"){ s.setFirebaseQuota({ dailyLimit:value("bdlc-firebase-limit"),warningPercent:value("bdlc-firebase-warning"),stopPercent:value("bdlc-firebase-stop") }); }
    if(action === "save-sheets"){ s.setSheetsConfig({ enabled:value("bdlc-sheets-enabled") === "true",batchSize:value("bdlc-sheets-batch"),appsScriptUrl:value("bdlc-sheets-url"),spreadsheetId:value("bdlc-sheets-id"),sheetName:value("bdlc-sheets-name") }); }
    if(action === "save-supabase"){ s.setSupabaseConfig({ enabled:value("bdlc-supabase-enabled") === "true",tableName:value("bdlc-supabase-table"),url:value("bdlc-supabase-url"),anonKey:value("bdlc-supabase-key") }); }
    return { ok:true,message:"Configuración guardada." };
  }

  function execute(action,target){
    if(action.indexOf("save-") === 0){ return Promise.resolve(save(action)); }
    if(action === "test-all" || action === "test-firebase" || action === "test-sheets" || action === "test-supabase"){
      var method = action === "test-all" ? "testAll" : action === "test-firebase" ? "testFirebase" : action === "test-sheets" ? "testSheets" : "testSupabase";
      return manager() && manager()[method] ? manager()[method]() : Promise.reject(new Error("Prueba no disponible."));
    }
    if(action.indexOf("push-") === 0){ return window.BDLSyncUIBridge.runTarget(action.replace("push-",""),{ confirm:true }); }
    if(action === "pull-sheets"){ if(!confirm("Traer Google Sheets hacia BDLocal sin borrar datos locales. ¿Continuar?")){ return Promise.resolve({ cancelled:true }); } return window.BL2CloudPull.pullSheetsToLocal(); }
    if(action === "fetch-firebase-config"){ return window.BL2CloudPull.forceFetchFirebaseConfig(); }
    if(action === "pull-firebase"){ if(!confirm("Traer Firebase hacia BDLocal para el período activo. ¿Continuar?")){ return Promise.resolve({ cancelled:true }); } return manager().pullFirebaseToLocal(); }
    if(action === "screen-refresh" || action === "screen-refresh-all"){ return hub().refreshCache({ force:true,light:true }).then(function(){ renderScreens(); return { ok:true,message:"Conexiones actualizadas." }; }); }
    if(action === "screen-test"){ var api = hub().get(target); if(!api){ return Promise.reject(new Error("Conector no disponible.")); } return Promise.resolve(api.ready ? api.ready() : hub().ready()).then(function(){ return { ok:true,message:"Conexión correcta." }; }); }
    if(action === "student-search"){ return searchStudent(); }
    if(action === "student-select"){ return loadStudent(target); }
    if(action === "student-clear"){ return Promise.resolve(clearStudent()); }
    if(action === "student-copy"){ return copyStudent(); }
    return Promise.reject(new Error("Acción no reconocida."));
  }

  function handleAction(buttonEl){
    if(!buttonEl){ return; }
    var action = txt(buttonEl.getAttribute("data-bdlc-action")); var target = txt(buttonEl.getAttribute("data-target"));
    buttonEl.disabled = true; progress(true,15,"Procesando...");
    Promise.resolve().then(function(){ return execute(action,target); }).then(function(result){ if(result && !result.cancelled){ notify(result.message || "Operación finalizada.",result.ok === false ? "error" : "success"); } return render(); }).catch(function(error){ notify(error.message || String(error),"error"); }).finally(function(){ buttonEl.disabled = false; progress(false,0,""); });
  }

  function bindEvents(){
    if(bound){ return; } bound = true;
    root.addEventListener("click",function(event){
      var action = event.target.closest && event.target.closest("[data-bdlc-action]");
      if(action && root.contains(action)){ event.preventDefault(); handleAction(action); return; }
      var nav = event.target.closest && event.target.closest("[data-bl2-section-target]");
      if(nav && nav.getAttribute("data-bl2-section-target") === "tablas"){ mountTables(false); }
    });
    window.addEventListener("bdlocal:raw-view-ready",function(){ mountTables(false); });
    window.addEventListener("bdlocal:sync-ui-updated",function(event){ renderConnections(event.detail && event.detail.counts); });
    window.addEventListener("bl2:period-changed",function(){ updateStudentPeriod(); clearStudent(); if(window.BL2RawView){ window.BL2RawView.setPeriod(period().id); } render(); });
    window.addEventListener("bl2:students-saved",render);
  }

  function build(){ buildSummary(); buildExternal(); buildScreens(); buildTables(); buildStudent(); fillForms(); renderScreens(); updateStudentPeriod(); mountTables(false); }
  function render(){ if(!root){ return Promise.resolve(null); } build(); renderScreens(); return renderSummary().then(function(result){ fillForms(); return result; }); }

  function init(options){
    options = options || {};
    root = options.container || document.querySelector(options.containerSelector || "#bdlocal-control-center-root") || id("bdlocal-config-root");
    if(!root){ return Promise.resolve(null); }
    bindEvents();
    return render();
  }

  window.BDLocalConfigUI = {
    init:init,
    render:render,
    notify:notify,
    setProgress:progress,
    renderSummary:renderSummary,
    renderConnections:renderConnections,
    renderScreens:renderScreens,
    mountTables:mountTables,
    searchStudents:searchStudent,
    loadStudent:loadStudent,
    getStudentSnapshot:function(){ return studentSnapshot; }
  };
})(window, document);
