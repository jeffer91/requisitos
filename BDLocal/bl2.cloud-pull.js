/* =========================================================
Archivo: bl2.cloud-pull.js
Ruta: /BDLocal/bl2.cloud-pull.js
Función:
- Agregar acciones manuales seguras en BL2.
- Forzar traída de configuración desde Firebase hacia la app local.
- Traer datos desde Google Sheets hacia Base Local sin depender de carga Excel.
- Guardar primero en BDLocal/IndexedDB para que Ficha, Tabla, Stats, Reportes y Defensas lean la información.
Con qué se conecta:
- bl2.html
- bl2.db.js
- bl2.core.js
- bl2.sync.js
- bdlocal-config.store.js
- bdlocal-sync.manager.js
========================================================= */
(function(window, document){
  "use strict";

  var FETCH_TIMEOUT_MS = 120000;
  var LS_DIVISIONES = "carga.periodos.divisiones";
  var LS_PERIODOS = "carga.periodos.local";

  function text(value){ return String(value == null ? "" : value).trim(); }
  function nowISO(){ return new Date().toISOString(); }
  function byId(id){ return document.getElementById(id); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value == null ? null : value)); }catch(error){ return value; } }
  function norm(value){ return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function key(value){ return norm(value).replace(/[^a-z0-9]+/g, ""); }

  function log(message, type, payload){
    type = text(type || "info");

    try{
      var box = byId("bl2-log");
      if(box){
        var item = document.createElement("div");
        item.className = "bl2-log-item";
        item.innerHTML = "<strong>" + new Date().toLocaleString() + "</strong><span>" + escapeHtml(message) + "</span>";
        box.insertBefore(item, box.firstChild);
      }
    }catch(error){}

    try{
      if(window.BL2Core && typeof window.BL2Core.log === "function"){
        window.BL2Core.log(type === "error" ? "ERROR" : type === "warn" ? "WARN" : "INFO", message, payload || {}).catch(function(){});
      }
    }catch(error2){}

    try{
      if(window.BDLocalConfigStore && typeof window.BDLocalConfigStore.addLog === "function"){
        window.BDLocalConfigStore.addLog("cloud_pull", message, type === "error" ? "error" : type === "warn" ? "warning" : "success", payload || {});
      }
    }catch(error3){}
  }

  function escapeHtml(value){
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function progress(target, percent, detail){
    try{
      window.dispatchEvent(new CustomEvent("bl2:sync-progress", {
        detail:{ target:target, percent:Math.max(0, Math.min(100, Number(percent) || 0)), detail:detail || "", at:nowISO() }
      }));
    }catch(error){}

    try{
      if(window.BDLocalConfigUI && typeof window.BDLocalConfigUI.setProgress === "function"){
        window.BDLocalConfigUI.setProgress(percent > 0 && percent < 100, percent, detail || "");
      }
    }catch(error2){}
  }

  function setStatus(id, message){
    var el = byId(id);
    if(el){ el.textContent = message; }
  }

  function setBusy(busy, message){
    ["bl2-btn-fetch-firebase-config", "bl2-btn-pull-sheets", "bl2-btn-load", "bl2-btn-sync-google", "bl2-btn-sync-firebase", "bl2-btn-test", "bl2-btn-export"].forEach(function(id){
      var btn = byId(id);
      if(btn){ btn.disabled = !!busy; }
    });
    if(message){ log(message, "info"); }
  }

  function store(){ return window.BDLocalConfigStore || null; }
  function db(){ return window.BL2DB || null; }
  function core(){ return window.BL2Core || null; }
  function sync(){ return window.BL2Sync || null; }
  function manager(){ return window.BDLocalSyncManager || null; }

  function selectedPeriod(){
    var app = window.BL2App && typeof window.BL2App.getState === "function" ? window.BL2App.getState() : {};
    if(app && app.activePeriod && text(app.activePeriod.id)){
      return { id:text(app.activePeriod.id), label:text(app.activePeriod.label || app.activePeriod.id) };
    }

    var select = byId("bl2-period-select");
    var id = text(select && select.value);
    var label = id;
    if(select && select.selectedOptions && select.selectedOptions[0]){ label = text(select.selectedOptions[0].textContent) || id; }
    return id ? { id:id, label:label } : null;
  }

  function syncSheetsConfigToBL2Settings(config){
    config = config || {};
    var s = sync();
    var d = db();
    var tasks = [];

    if(s && typeof s.setGoogleScriptUrl === "function" && text(config.appsScriptUrl)){
      tasks.push(s.setGoogleScriptUrl(config.appsScriptUrl));
    }

    if(d && typeof d.setSetting === "function"){
      if(text(config.appsScriptUrl)){ tasks.push(d.setSetting("googleScriptUrl", text(config.appsScriptUrl))); }
      if(text(config.spreadsheetId)){ tasks.push(d.setSetting("googleSpreadsheetId", text(config.spreadsheetId))); }
      if(text(config.token)){ tasks.push(d.setSetting("googleToken", text(config.token))); }
    }

    try{
      if(text(config.appsScriptUrl) || text(config.spreadsheetId) || text(config.token)){
        window.localStorage.setItem("REQ_BDLOCAL_GOOGLE_SHEETS_CONFIG", JSON.stringify({
          enabled:true,
          webAppUrl:text(config.appsScriptUrl),
          appsScriptUrl:text(config.appsScriptUrl),
          spreadsheetId:text(config.spreadsheetId),
          token:text(config.token),
          sheetName:text(config.sheetName || "Requisitos"),
          updatedAt:nowISO(),
          source:"FirebaseConfigPull"
        }));
      }
    }catch(error){}

    return Promise.all(tasks.map(function(task){ return Promise.resolve(task).catch(function(){ return null; }); }));
  }

  function forceFetchFirebaseConfig(){
    var s = store();
    var m = manager();

    if(!s || typeof s.restoreConfigFromFirebase !== "function"){
      return Promise.reject(new Error("BDLocalConfigStore.restoreConfigFromFirebase no está disponible."));
    }

    if(m && typeof m.setupFirebaseConfigAdapter === "function"){
      try{ m.setupFirebaseConfigAdapter(); }catch(error){}
    }

    progress("firebase", 15, "Trayendo configuración desde Firebase...");

    return s.restoreConfigFromFirebase().then(function(result){
      if(!result || !result.ok){
        throw new Error((result && result.message) || "Firebase no devolvió configuración.");
      }

      var sheets = s.getSheetsConfig({ includeSecret:true });
      return syncSheetsConfigToBL2Settings(sheets).then(function(){
        progress("firebase", 100, "Configuración Firebase aplicada.");
        setStatus("bl2-firebase-status", "Configuración restaurada: " + new Date().toLocaleString());
        if(text(sheets.appsScriptUrl)){ setStatus("bl2-google-status", "Configuración Google Sheets lista desde Firebase."); }
        return Object.assign({}, result, { ok:true, sheets:sheets, message:"Configuración traída desde Firebase y aplicada localmente." });
      });
    });
  }

  function requireSheetsConfig(){
    var s = store();
    if(!s){ throw new Error("BDLocalConfigStore no está cargado."); }
    var config = s.getSheetsConfig({ includeSecret:true }) || {};
    if(!config.enabled){ throw new Error("Google Sheets está desactivado en la configuración."); }
    if(!text(config.appsScriptUrl)){ throw new Error("Falta URL de Apps Script. Usa primero Traer config Firebase o configura Google Sheets."); }
    if(!text(config.token)){ throw new Error("Falta token de Apps Script."); }
    if(!text(config.spreadsheetId)){ throw new Error("Falta ID del Google Sheet."); }
    return config;
  }

  function postJson(url, payload, timeoutMs){
    timeoutMs = Number(timeoutMs || FETCH_TIMEOUT_MS);
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? window.setTimeout(function(){ controller.abort(); }, timeoutMs) : null;

    return fetch(url, {
      method:"POST",
      mode:"cors",
      redirect:"follow",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body:JSON.stringify(payload || {}),
      signal:controller ? controller.signal : undefined
    }).then(function(response){
      return response.text().then(function(raw){
        var data = {};
        try{ data = raw ? JSON.parse(raw) : {}; }
        catch(error){ data = { ok:response.ok, raw:raw }; }
        if(!response.ok){ throw new Error(data.message || data.error || ("HTTP " + response.status)); }
        if(data && data.ok === false){ throw new Error(data.message || data.error || "Apps Script respondió ok=false."); }
        return data;
      });
    }).catch(function(error){
      if(error && error.name === "AbortError"){
        throw new Error("Tiempo agotado al leer Google Sheets. Revisa Apps Script, permisos, token o tamaño del archivo.");
      }
      throw error;
    }).finally(function(){ if(timer){ window.clearTimeout(timer); } });
  }

  function requestSheetsPull(config, period){
    var actions = ["pull_bl2", "export_bl2", "get_bl2", "read_bl2"];
    var lastError = null;
    var chain = Promise.resolve(null);

    actions.forEach(function(action){
      chain = chain.then(function(done){
        if(done){ return done; }
        return postJson(config.appsScriptUrl, {
          action:action,
          target:"bdlocal",
          source:"BL2CloudPull",
          mode:"pull_to_bdlocal",
          token:config.token,
          spreadsheetId:config.spreadsheetId,
          sheetName:config.sheetName || "Requisitos",
          periodoId:period ? period.id : "",
          periodoLabel:period ? period.label : "",
          requestedAt:nowISO()
        }, FETCH_TIMEOUT_MS).then(function(response){
          response.__action = action;
          return response;
        }).catch(function(error){
          lastError = error;
          return null;
        });
      });
    });

    return chain.then(function(response){
      if(response){ return response; }
      throw lastError || new Error("Apps Script no devolvió datos para importar.");
    });
  }

  function normalizeTableKey(name){
    var k = key(name);
    var map = {
      config:"config",
      periodos:"periodos",
      periodo:"periodos",
      carreras:"carreras",
      periodoscarreras:"periodosCarreras",
      periodosdivisiones:"periodosDivisiones",
      estudiantes:"estudiantes",
      estudiante:"estudiantes",
      matriculasperiodo:"matriculasPeriodo",
      requisitos:"requisitos",
      requisito:"requisitos",
      contactos:"contactos",
      contacto:"contactos",
      notas:"notas",
      nota:"notas",
      divisionesestudiantes:"divisionesEstudiantes",
      cambios:"cambios",
      cambio:"cambios",
      logs:"logs",
      log:"logs",
      resumen:"resumen",
      syncmeta:"sync_meta",
      sync_meta:"sync_meta",
      errores:"errores"
    };
    return map[k] || name;
  }

  function extractTables(response){
    var roots = [response && response.tables, response && response.data && response.data.tables, response && response.payload && response.payload.tables, response && response.sheets, response && response.rowsBySheet];
    var tables = {};

    roots.forEach(function(root){
      if(!root || typeof root !== "object" || Array.isArray(root)){ return; }
      Object.keys(root).forEach(function(name){
        var rows = root[name];
        if(!Array.isArray(rows)){ return; }
        var mapped = normalizeTableKey(name);
        tables[mapped] = (tables[mapped] || []).concat(rows);
      });
    });

    if(Array.isArray(response && response.estudiantes)){ tables.estudiantes = (tables.estudiantes || []).concat(response.estudiantes); }
    if(Array.isArray(response && response.rows)){ tables.estudiantes = (tables.estudiantes || []).concat(response.rows); }

    return tables;
  }

  function first(row, names){
    row = row || {};
    names = Array.isArray(names) ? names : [];
    var rowKeys = Object.keys(row);
    var wanted = names.map(key);
    for(var i = 0; i < rowKeys.length; i += 1){
      if(wanted.indexOf(key(rowKeys[i])) >= 0){ return row[rowKeys[i]]; }
    }
    return "";
  }

  function normalizeCedula(value){
    var utils = window.BL2Config && window.BL2Config.utils;
    if(utils && typeof utils.normalizeCedula === "function"){ return utils.normalizeCedula(value); }
    var raw = text(value).replace(/[^\dA-Za-z]/g, "");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function normalizePeriodId(value){
    value = text(value);
    if(!value){ return ""; }
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    if(match){ return match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4]; }
    return value.replace(/_+/g, "__");
  }

  function ensurePeriod(row, period){
    row = Object.assign({}, row || {});
    var id = normalizePeriodId(first(row, ["periodoId", "periodoCanonicoId", "idPeriodo", "periodId"]) || (period && period.id));
    var label = text(first(row, ["periodoLabel", "periodoCanonicoLabel", "periodo", "Periodo"]) || (period && period.label) || id);
    if(id){
      row.periodoId = id;
      row.periodoCanonicoId = id;
      row.ultimoPeriodoId = row.ultimoPeriodoId || id;
    }
    if(label){
      row.periodoLabel = label;
      row.periodoCanonicoLabel = label;
    }
    return row;
  }

  function prepareStudents(rows, period){
    return (Array.isArray(rows) ? rows : []).map(function(row){
      row = ensurePeriod(row, period);
      var cedula = normalizeCedula(first(row, ["cedula", "numeroIdentificacion", "NumeroIdentificacion", "Cédula", "Cedula"]));
      if(cedula){
        row.cedula = cedula;
        row.numeroIdentificacion = row.numeroIdentificacion || cedula;
      }
      row.source = row.source || "google_sheets_pull";
      row.updatedAt = row.updatedAt || row.fechaRegistro || row.fechaRegistroNotas || nowISO();
      return row;
    }).filter(function(row){ return text(row.cedula || row.numeroIdentificacion) && text(row.periodoId); });
  }

  function normalizeRawRow(tableName, row, period){
    row = ensurePeriod(row || {}, period);
    tableName = text(tableName);

    if(tableName === "periodos"){
      row.id = normalizePeriodId(row.id || row.periodoId || row.periodoCanonicoId || (period && period.id));
      row.label = row.label || row.periodoLabel || row.periodoCanonicoLabel || (period && period.label) || row.id;
    }

    if(["requisitos", "contactos", "notas", "estudiantes"].indexOf(tableName) >= 0){
      var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || first(row, ["cedula", "numeroIdentificacion"]));
      if(cedula){ row.cedula = cedula; row.numeroIdentificacion = row.numeroIdentificacion || cedula; }
      row.id = row.id || (cedula && row.periodoId ? cedula + "__" + row.periodoId : "");
      row.studentId = row.studentId || row.id;
    }

    if(tableName === "requisitos"){
      var req = row.key || row.nombre || row.requisito || row.label || "requisito";
      row.id = row.id || (row.cedula + "__" + row.periodoId + "__" + key(req));
      row.nombre = row.nombre || row.key || req;
      row.key = row.key || row.nombre;
    }

    if(tableName === "cambios" || tableName === "logs" || tableName === "errores" || tableName === "resumen"){
      row.id = row.id || row.key || (tableName + "_gs_" + Date.now() + "_" + Math.random().toString(16).slice(2));
    }

    if(tableName === "sync_meta"){
      row.key = row.key || row.id || ("gs_pull_" + Date.now() + "_" + Math.random().toString(16).slice(2));
    }

    row.updatedAt = row.updatedAt || nowISO();
    return row;
  }

  function saveRawTable(tableName, rows, period){
    var d = db();
    if(!d || typeof d.bulkPut !== "function"){ return Promise.resolve(0); }
    rows = (Array.isArray(rows) ? rows : []).map(function(row){ return normalizeRawRow(tableName, row, period); }).filter(function(row){
      return tableName === "sync_meta" ? text(row.key) : text(row.id);
    });
    if(!rows.length){ return Promise.resolve(0); }
    return d.bulkPut(tableName, rows).then(function(saved){ return (saved || []).length; });
  }

  function readLocalJson(name, fallback){
    try{ return JSON.parse(window.localStorage.getItem(name) || "") || fallback; }catch(error){ return fallback; }
  }

  function uniqueCareers(list){
    var map = {};
    (Array.isArray(list) ? list : []).forEach(function(c){
      c = c || {};
      var id = text(c.id || c.codigo || key(c.nombre));
      if(!id){ return; }
      map[id] = { id:id, codigo:text(c.codigo || ""), nombre:text(c.nombre || c.label || id) };
    });
    return Object.keys(map).map(function(id){ return map[id]; });
  }

  function importPeriodDivisions(rows, period){
    rows = Array.isArray(rows) ? rows : [];
    if(!rows.length){ return 0; }

    var store = readLocalJson(LS_DIVISIONES, {});
    var periods = readLocalJson(LS_PERIODOS, []);
    var byPeriod = {};

    rows.forEach(function(row){
      row = row || {};
      var periodoId = normalizePeriodId(first(row, ["periodoId", "PeriodoId", "periodo", "idPeriodo"]) || (period && period.id));
      var division = text(first(row, ["division", "Division", "División", "nombreDivision", "NombreDivision"]));
      if(!periodoId || !division){ return; }
      var carreraNombre = text(first(row, ["carrera", "Carrera", "NombreCarrera", "nombreCarrera"]));
      var carreraCodigo = text(first(row, ["codigoCarrera", "CodigoCarrera", "CódigoCarrera"]));
      var divId = key(division);
      if(!byPeriod[periodoId]){ byPeriod[periodoId] = {}; }
      if(!byPeriod[periodoId][divId]){ byPeriod[periodoId][divId] = { id:divId, nombre:division, carreras:[], updatedAt:nowISO() }; }
      if(carreraNombre || carreraCodigo){
        byPeriod[periodoId][divId].carreras.push({ id:carreraCodigo || key(carreraNombre), codigo:carreraCodigo, nombre:carreraNombre || carreraCodigo });
      }
    });

    Object.keys(byPeriod).forEach(function(periodoId){
      var divisions = Object.keys(byPeriod[periodoId]).map(function(id){
        var div = byPeriod[periodoId][id];
        div.carreras = uniqueCareers(div.carreras);
        return div;
      });
      store[periodoId] = Object.assign({}, store[periodoId] || {}, { periodoId:periodoId, divisiones:divisions, updatedAt:nowISO(), source:"GoogleSheetsPull" });

      if(Array.isArray(periods)){
        var found = false;
        periods = periods.map(function(p){
          var id = normalizePeriodId(p.periodoId || p.id || p.periodoCanonicoId || "");
          if(id === periodoId){ found = true; return Object.assign({}, p, { divisiones:divisions, updatedAt:nowISO() }); }
          return p;
        });
        if(!found){ periods.push({ id:periodoId, periodoId:periodoId, label:(period && period.label) || periodoId, periodoLabel:(period && period.label) || periodoId, divisiones:divisions, updatedAt:nowISO() }); }
      }
    });

    try{ window.localStorage.setItem(LS_DIVISIONES, JSON.stringify(store)); }catch(error){}
    try{ window.localStorage.setItem(LS_PERIODOS, JSON.stringify(periods)); }catch(error2){}
    try{ if(window.BLDivisionesService && typeof window.BLDivisionesService.invalidate === "function"){ window.BLDivisionesService.invalidate(); } }catch(error3){}

    return rows.length;
  }

  function pullSheetsToLocal(){
    var config = requireSheetsConfig();
    var c = core();
    var d = db();
    var s = store();
    var period = selectedPeriod();

    if(!c || typeof c.saveStudents !== "function"){ return Promise.reject(new Error("BL2Core.saveStudents no está disponible.")); }
    if(!d || typeof d.bulkPut !== "function"){ return Promise.reject(new Error("BL2DB.bulkPut no está disponible.")); }

    progress("google", 10, "Leyendo Google Sheets...");

    return syncSheetsConfigToBL2Settings(config).then(function(){
      return requestSheetsPull(config, period);
    }).then(function(response){
      progress("google", 45, "Preparando datos para Base Local...");
      var tables = extractTables(response);
      var tableNames = Object.keys(tables);
      if(!tableNames.length){ throw new Error("Apps Script respondió, pero no devolvió tablas. Necesita soportar pull_bl2/read_bl2 con tables."); }

      var summary = {
        ok:true,
        source:"GoogleSheets",
        action:response.__action || "pull_bl2",
        periodoId:period ? period.id : "",
        periodoLabel:period ? period.label : "",
        totalEntrada:0,
        guardados:0,
        actualizados:0,
        sinCambios:0,
        duplicados:0,
        advertencias:[],
        errores:[],
        rawTables:{},
        startedAt:nowISO(),
        finishedAt:""
      };

      tableNames.forEach(function(name){ summary.rawTables[name] = Array.isArray(tables[name]) ? tables[name].length : 0; });

      var chain = Promise.resolve();

      if(tables.periodos && tables.periodos.length){
        chain = chain.then(function(){ return saveRawTable((window.BL2Config.stores || {}).periodos || "periodos", tables.periodos, period); });
      }

      var students = prepareStudents(tables.estudiantes || [], period);
      if(students.length){
        summary.totalEntrada = students.length;
        chain = chain.then(function(){
          progress("google", 60, "Guardando estudiantes en Base Local...");
          return c.saveStudents(students, {
            normalized:false,
            periodoId:period ? period.id : "",
            periodoLabel:period ? period.label : "",
            source:"google_sheets_pull",
            markRetired:false,
            sync:false,
            importResult:{ advertencias:[], errores:[], duplicados:0 }
          }).then(function(result){
            summary.guardados += Number(result.guardados || 0);
            summary.actualizados += Number(result.actualizados || 0);
            summary.sinCambios += Number(result.sinCambios || 0);
            summary.duplicados += Number(result.duplicados || 0);
            summary.periodoId = summary.periodoId || result.periodoId || "";
            summary.periodoLabel = summary.periodoLabel || result.periodoLabel || "";
            if(window.BL2Sync && typeof window.BL2Sync.markChanges === "function" && Array.isArray(result.changes)){
              return window.BL2Sync.markChanges(result.changes, "google", "SINCRONIZADO", { source:"GoogleSheetsPull" }).then(function(){ return result; });
            }
            return result;
          });
        });
      }

      var rawStoreMap = {
        requisitos:(window.BL2Config.stores || {}).requisitos || "requisitos",
        contactos:(window.BL2Config.stores || {}).contactos || "contactos",
        notas:(window.BL2Config.stores || {}).notas || "notas",
        cambios:(window.BL2Config.stores || {}).cambios || "cambios",
        logs:(window.BL2Config.stores || {}).logs || "logs",
        resumen:(window.BL2Config.stores || {}).resumen || "resumen",
        errores:(window.BL2Config.stores || {}).errores || "errores",
        sync_meta:(window.BL2Config.stores || {}).syncMeta || "sync_meta"
      };

      Object.keys(rawStoreMap).forEach(function(keyName){
        var rows = tables[keyName] || [];
        if(!rows.length){ return; }
        chain = chain.then(function(){
          return saveRawTable(rawStoreMap[keyName], rows, period).then(function(count){ summary.guardados += count; });
        });
      });

      if(tables.periodosDivisiones && tables.periodosDivisiones.length){
        chain = chain.then(function(){
          var count = importPeriodDivisions(tables.periodosDivisiones, period);
          summary.rawTables.periodosDivisionesImportadas = count;
        });
      }

      return chain.then(function(){
        summary.finishedAt = nowISO();
        if(s){
          s.patchConfig({ sheets:{ connected:true, status:"ok", lastSyncAt:nowISO(), lastError:"" }, bdlocal:{ connected:true, status:"ok", lastTestAt:nowISO() } });
        }
        progress("google", 100, "Google Sheets importado en Base Local.");
        return summary;
      });
    }).catch(function(error){
      if(s){ s.updateConnectionStatus("sheets", { connected:false, status:"error", lastError:error.message || String(error) }); }
      progress("google", 0, "Error al traer Google Sheets.");
      throw error;
    });
  }

  function renderSummary(summary){
    var target = byId("bl2-import-summary");
    if(!target || !summary){ return; }
    var warnings = Array.isArray(summary.advertencias) ? summary.advertencias : [];
    var errors = Array.isArray(summary.errores) ? summary.errores : [];
    target.innerHTML = ""
      + '<div class="bl2-summary-grid">'
      + '<div class="bl2-summary-item"><span>Origen</span><strong>Google Sheets</strong></div>'
      + '<div class="bl2-summary-item"><span>Filas leídas</span><strong>' + escapeHtml(summary.totalEntrada || 0) + '</strong></div>'
      + '<div class="bl2-summary-item"><span>Guardados</span><strong>' + escapeHtml(summary.guardados || 0) + '</strong></div>'
      + '<div class="bl2-summary-item"><span>Actualizados</span><strong>' + escapeHtml(summary.actualizados || 0) + '</strong></div>'
      + '</div>'
      + '<div class="bl2-warning-list">'
      + warnings.slice(0, 8).map(function(item){ return '<div class="bl2-warning">' + escapeHtml(item) + '</div>'; }).join("")
      + errors.slice(0, 8).map(function(item){ return '<div class="bl2-warning">' + escapeHtml(item) + '</div>'; }).join("")
      + '</div>';
  }

  function refreshApp(){
    if(window.BL2App && typeof window.BL2App.refresh === "function"){
      return window.BL2App.refresh().catch(function(){ return null; });
    }
    return Promise.resolve(null);
  }

  function bind(){
    var configBtn = byId("bl2-btn-fetch-firebase-config");
    var sheetsBtn = byId("bl2-btn-pull-sheets");

    if(configBtn && !configBtn.__cloudPullBound){
      configBtn.__cloudPullBound = true;
      configBtn.addEventListener("click", function(){
        setBusy(true, "Forzando traída de configuración desde Firebase...");
        forceFetchFirebaseConfig().then(function(result){
          log(result.message || "Configuración Firebase aplicada.", "ok", result);
          alert(result.message || "Configuración traída desde Firebase.");
          return refreshApp();
        }).catch(function(error){
          log("No se pudo traer configuración Firebase: " + error.message, "error");
          alert("No se pudo traer configuración Firebase: " + error.message);
        }).finally(function(){ setBusy(false); });
      });
    }

    if(sheetsBtn && !sheetsBtn.__cloudPullBound){
      sheetsBtn.__cloudPullBound = true;
      sheetsBtn.addEventListener("click", function(){
        if(!window.confirm("Esto traerá los datos de Google Sheets y los guardará en Base Local. No borra la base local. ¿Continuar?")){
          return;
        }
        setBusy(true, "Trayendo Google Sheets hacia Base Local...");
        pullSheetsToLocal().then(function(summary){
          renderSummary(summary);
          log("Google Sheets → Base Local completado. Filas: " + (summary.totalEntrada || 0) + ".", "ok", summary);
          setStatus("bl2-google-status", "Importado desde Google Sheets: " + new Date().toLocaleString());
          return refreshApp().then(function(){ return summary; });
        }).then(function(summary){
          alert("Google Sheets → Base Local completado.\n\nFilas leídas: " + (summary.totalEntrada || 0) + "\nGuardados: " + (summary.guardados || 0) + "\nActualizados: " + (summary.actualizados || 0));
        }).catch(function(error){
          log("No se pudo traer Google Sheets: " + error.message, "error");
          alert("No se pudo traer Google Sheets: " + error.message);
        }).finally(function(){ setBusy(false); });
      });
    }
  }

  function boot(){
    bind();
    var tries = 0;
    var timer = window.setInterval(function(){
      tries += 1;
      bind();
      if(tries >= 30){ window.clearInterval(timer); }
    }, 250);
  }

  window.BL2CloudPull = {
    forceFetchFirebaseConfig:forceFetchFirebaseConfig,
    pullSheetsToLocal:pullSheetsToLocal,
    syncSheetsConfigToBL2Settings:syncSheetsConfigToBL2Settings
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})(window, document);
