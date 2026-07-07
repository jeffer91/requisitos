/* =========================================================
Archivo: bl2.cloud-pull.safe.js
Ruta: /BDLocal/bl2.cloud-pull.safe.js
Función:
- Reforzar el flujo Traer config Firebase y Traer Sheets → BL.
- Abrir modal para elegir período antes de traer datos desde Google Sheets.
- Pausar la subida automática a Google Sheets mientras se trae información.
- Detectar Apps Script desactualizado cuando no reconoce pull_bl2.
- Ejecutar limpieza de duplicados en Google Sheets con confirmación.
- Guardar divisiones antes de estudiantes para que BL2 asigne división por carrera.
Con qué se conecta:
- bl2.html
- bl2.cloud-pull.js
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
  var PAUSE_KEY = "REQ_BDLOCAL_PAUSE_GOOGLE_PUSH";
  var PAUSE_REASON = "Traer Google Sheets hacia Base Local";
  var isPulling = false;

  function text(value){ return String(value === null || value === undefined ? "" : value).trim(); }
  function nowISO(){ return new Date().toISOString(); }
  function byId(id){ return document.getElementById(id); }
  function norm(value){ return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function key(value){ return norm(value).replace(/[^a-z0-9]+/g, ""); }

  function escapeHtml(value){
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function config(){ return window.BL2Config || {}; }
  function stores(){ return (config().stores || {}); }
  function core(){ return window.BL2Core || null; }
  function db(){ return window.BL2DB || null; }
  function sync(){ return window.BL2Sync || null; }
  function store(){ return window.BDLocalConfigStore || null; }
  function manager(){ return window.BDLocalSyncManager || null; }

  function log(message, level, data){
    level = text(level || "info");

    try{
      var box = byId("bl2-log");
      if(box){
        var item = document.createElement("div");
        item.className = "bl2-log-item";
        item.innerHTML = "<strong>" + escapeHtml(new Date().toLocaleString()) + "</strong><span>" + escapeHtml(message) + "</span>";
        box.insertBefore(item, box.firstChild);
      }
    }catch(error){}

    try{
      if(core() && typeof core().log === "function"){
        core().log(level === "error" ? "ERROR" : level === "warn" ? "WARN" : "INFO", message, data || {}).catch(function(){});
      }
    }catch(error2){}

    try{
      if(store() && typeof store().addLog === "function"){
        store().addLog("cloud_pull_safe", message, level === "error" ? "error" : level === "warn" ? "warning" : "success", data || {});
      }
    }catch(error3){}
  }

  function progress(target, percent, detail){
    var cleanPercent = Math.max(0, Math.min(100, Number(percent || 0)));

    try{
      window.dispatchEvent(new CustomEvent("bl2:sync-progress", {
        detail:{ target:target, percent:cleanPercent, detail:detail || "", at:nowISO() }
      }));
    }catch(error){}

    try{
      if(window.BDLocalConfigUI && typeof window.BDLocalConfigUI.setProgress === "function"){
        window.BDLocalConfigUI.setProgress(cleanPercent > 0 && cleanPercent < 100, cleanPercent, detail || "");
      }
    }catch(error2){}
  }

  function setStatus(id, value){
    var el = byId(id);
    if(el){ el.textContent = value; }
  }

  function setBusy(busy, message){
    [
      "bl2-btn-fetch-firebase-config",
      "bl2-btn-pull-sheets",
      "bl2-btn-clean-sheets-duplicates",
      "bl2-btn-load",
      "bl2-btn-sync-google",
      "bl2-btn-sync-firebase",
      "bl2-btn-test",
      "bl2-btn-export",
      "bl2-btn-period-save",
      "bl2-btn-refresh"
    ].forEach(function(id){
      var btn = byId(id);
      if(btn){ btn.disabled = !!busy; }
    });

    if(message){ log(message, "info"); }
  }

  function readJson(name, fallback){
    try{
      var parsed = JSON.parse(window.localStorage.getItem(name) || "");
      return parsed === null || parsed === undefined ? fallback : parsed;
    }catch(error){ return fallback; }
  }

  function writeJson(name, value){
    try{ window.localStorage.setItem(name, JSON.stringify(value)); }catch(error){}
  }

  function pauseGooglePush(reason){
    isPulling = true;
    window.BL2_GOOGLE_PUSH_PAUSED = true;
    writeJson(PAUSE_KEY, { paused:true, reason:reason || PAUSE_REASON, at:nowISO() });
    try{ window.dispatchEvent(new CustomEvent("bl2:google-push-paused", { detail:{ reason:reason || PAUSE_REASON, at:nowISO() } })); }catch(error){}
  }

  function resumeGooglePush(){
    isPulling = false;
    window.BL2_GOOGLE_PUSH_PAUSED = false;
    try{ window.localStorage.removeItem(PAUSE_KEY); }catch(error){}
    try{ window.dispatchEvent(new CustomEvent("bl2:google-push-resumed", { detail:{ at:nowISO() } })); }catch(error2){}
  }

  function googlePushPaused(){
    if(isPulling || window.BL2_GOOGLE_PUSH_PAUSED){ return true; }
    var info = readJson(PAUSE_KEY, null);
    return !!(info && info.paused);
  }

  function normalizeCedula(value){
    var utils = config().utils || {};
    if(typeof utils.normalizeCedula === "function"){ return utils.normalizeCedula(value); }
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

  function first(row, names){
    row = row || {};
    var rowKeys = Object.keys(row);
    var wanted = (Array.isArray(names) ? names : []).map(key);

    for(var i = 0; i < rowKeys.length; i += 1){
      if(wanted.indexOf(key(rowKeys[i])) >= 0){ return row[rowKeys[i]]; }
    }

    return "";
  }

  function selectedPeriod(){
    try{
      if(window.BL2App && typeof window.BL2App.getState === "function"){
        var state = window.BL2App.getState() || {};
        if(state.activePeriod && text(state.activePeriod.id)){
          return { id:normalizePeriodId(state.activePeriod.id), label:text(state.activePeriod.label || state.activePeriod.id) };
        }
      }
    }catch(error){}

    var select = byId("bl2-period-select");
    var id = text(select && select.value);
    if(!id){ return null; }
    var label = id;
    if(select && select.selectedOptions && select.selectedOptions[0]){
      label = text(select.selectedOptions[0].textContent) || id;
    }
    return { id:normalizePeriodId(id), label:label };
  }

  function periodsFromSelect(){
    var select = byId("bl2-period-select");
    if(!select){ return []; }
    return Array.prototype.slice.call(select.options || []).map(function(option){
      var id = normalizePeriodId(option.value);
      if(!id){ return null; }
      return { id:id, label:text(option.textContent || option.label || id) };
    }).filter(Boolean);
  }

  function getAvailablePeriods(){
    var fromSelect = periodsFromSelect();
    if(core() && typeof core().getPeriods === "function"){
      return core().getPeriods().then(function(rows){
        var map = {};
        fromSelect.forEach(function(period){ map[period.id] = period; });
        (Array.isArray(rows) ? rows : []).forEach(function(row){
          var id = normalizePeriodId(row.id || row.periodoId || row.periodoCanonicoId || row.value || "");
          if(!id){ return; }
          map[id] = { id:id, label:text(row.label || row.periodoLabel || row.periodoCanonicoLabel || id) };
        });
        return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){ return text(a.label).localeCompare(text(b.label), "es", { sensitivity:"base" }); });
      }).catch(function(){ return fromSelect; });
    }
    return Promise.resolve(fromSelect);
  }

  function ensurePeriodModal(){
    if(byId("bl2-pull-period-modal")){ return; }

    var style = document.createElement("style");
    style.id = "bl2-pull-period-style";
    style.textContent = [
      ".bl2-pull-modal{position:fixed;inset:0;z-index:100000;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.46);padding:18px}",
      ".bl2-pull-modal.is-open{display:flex}",
      ".bl2-pull-card{width:min(520px,96vw);background:#fff;border:1px solid #dbe3ef;border-radius:20px;box-shadow:0 25px 80px rgba(15,23,42,.28);padding:18px;display:grid;gap:14px}",
      ".bl2-pull-card h2{margin:0;color:#172033;font-size:20px;letter-spacing:-.03em}",
      ".bl2-pull-card p{margin:0;color:#64748b;font-size:13px;font-weight:750;line-height:1.35}",
      ".bl2-pull-card label{display:grid;gap:6px;font-size:12px;font-weight:950;color:#334155}",
      ".bl2-pull-card select{min-height:42px;border:1px solid #dbe3ef;border-radius:12px;padding:8px 11px;background:#fff;outline:none}",
      ".bl2-pull-warning{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:10px;font-size:12px;font-weight:850;line-height:1.35}",
      ".bl2-pull-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap}.bl2-pull-actions button{min-height:38px;border-radius:999px;border:1px solid #dbe3ef;background:#fff;padding:0 14px;font-weight:950;cursor:pointer}.bl2-pull-actions .primary{background:#3949e8;border-color:#3949e8;color:#fff}"
    ].join("\n");
    document.head.appendChild(style);

    var modal = document.createElement("section");
    modal.id = "bl2-pull-period-modal";
    modal.className = "bl2-pull-modal";
    modal.innerHTML = '<div class="bl2-pull-card" role="dialog" aria-modal="true" aria-labelledby="bl2PullTitle"><div><h2 id="bl2PullTitle">Traer Google Sheets a Base Local</h2><p>Elige el período que quieres traer. La subida automática a Google Sheets se pausará mientras dura esta operación.</p></div><label>Período a traer<select id="bl2-pull-period-select"></select></label><div class="bl2-pull-warning">No se borra Base Local. Se actualiza solo el período elegido y se conservan datos locales más recientes cuando corresponda.</div><div class="bl2-pull-actions"><button type="button" data-bl2-pull-cancel>Cancelar</button><button type="button" class="primary" data-bl2-pull-confirm>Traer período</button></div></div>';
    document.body.appendChild(modal);
  }

  function openPeriodModal(){
    ensurePeriodModal();
    return getAvailablePeriods().then(function(periods){
      return new Promise(function(resolve, reject){
        if(!periods.length){
          reject(new Error("No hay períodos disponibles para seleccionar."));
          return;
        }

        var active = selectedPeriod();
        var modal = byId("bl2-pull-period-modal");
        var select = byId("bl2-pull-period-select");
        select.innerHTML = periods.map(function(period){
          return '<option value="' + escapeHtml(period.id) + '">' + escapeHtml(period.label || period.id) + ' · ' + escapeHtml(period.id) + '</option>';
        }).join("");
        if(active && active.id){ select.value = active.id; }

        function cleanup(){
          modal.classList.remove("is-open");
          modal.onclick = null;
          modal.querySelector("[data-bl2-pull-cancel]").onclick = null;
          modal.querySelector("[data-bl2-pull-confirm]").onclick = null;
        }

        modal.querySelector("[data-bl2-pull-cancel]").onclick = function(){ cleanup(); reject(new Error("Operación cancelada.")); };
        modal.querySelector("[data-bl2-pull-confirm]").onclick = function(){
          var id = normalizePeriodId(select.value);
          var found = periods.filter(function(period){ return period.id === id; })[0];
          cleanup();
          resolve(found || { id:id, label:id });
        };
        modal.onclick = function(event){ if(event.target === modal){ cleanup(); reject(new Error("Operación cancelada.")); } };
        modal.classList.add("is-open");
      });
    });
  }

  function requireSheetsConfig(){
    var s = store();
    if(!s || typeof s.getSheetsConfig !== "function"){
      throw new Error("BDLocalConfigStore no está cargado.");
    }

    var cfg = s.getSheetsConfig({ includeSecret:true }) || {};
    if(!cfg.enabled){ throw new Error("Google Sheets está desactivado en configuración."); }
    if(!text(cfg.appsScriptUrl)){ throw new Error("Falta URL de Apps Script. Usa Traer config Firebase o configura Google Sheets."); }
    if(!text(cfg.token)){ throw new Error("Falta token de Apps Script."); }
    if(!text(cfg.spreadsheetId)){ throw new Error("Falta ID del Google Sheet."); }
    return cfg;
  }

  function syncSheetsConfigToBL2(cfg){
    cfg = cfg || {};
    var tasks = [];

    if(sync() && typeof sync().setGoogleScriptUrl === "function" && text(cfg.appsScriptUrl)){
      tasks.push(sync().setGoogleScriptUrl(cfg.appsScriptUrl));
    }

    if(db() && typeof db().setSetting === "function"){
      if(text(cfg.appsScriptUrl)){ tasks.push(db().setSetting("googleScriptUrl", text(cfg.appsScriptUrl))); }
      if(text(cfg.spreadsheetId)){ tasks.push(db().setSetting("googleSpreadsheetId", text(cfg.spreadsheetId))); }
      if(text(cfg.token)){ tasks.push(db().setSetting("googleToken", text(cfg.token))); }
    }

    if(text(cfg.appsScriptUrl) || text(cfg.spreadsheetId) || text(cfg.token)){
      writeJson("REQ_BDLOCAL_GOOGLE_SHEETS_CONFIG", {
        enabled:true,
        appsScriptUrl:text(cfg.appsScriptUrl),
        webAppUrl:text(cfg.appsScriptUrl),
        spreadsheetId:text(cfg.spreadsheetId),
        token:text(cfg.token),
        sheetName:text(cfg.sheetName || "Requisitos"),
        updatedAt:nowISO(),
        source:"BL2CloudPullSafe"
      });
    }

    return Promise.all(tasks.map(function(task){ return Promise.resolve(task).catch(function(){ return null; }); }));
  }

  function normalizeScriptError(data){
    var code = text(data && (data.error || data.code));
    var message = text(data && data.message);
    if(code === "ACCION_NO_RECONOCIDA" || message.indexOf("acción no reconocida") >= 0 || message.indexOf("accion no reconocida") >= 0){
      return new Error("Tu Apps Script publicado está desactualizado: no reconoce pull_bl2. Guarda el código nuevo y actualiza la implementación Web App con Nueva versión.");
    }
    return new Error(message || code || "Apps Script respondió ok=false.");
  }

  function postJson(url, payload, timeoutMs){
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? window.setTimeout(function(){ controller.abort(); }, Number(timeoutMs || FETCH_TIMEOUT_MS)) : null;

    return fetch(url, {
      method:"POST",
      mode:"cors",
      redirect:"follow",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body:JSON.stringify(payload || {}),
      signal:controller ? controller.signal : undefined
    }).then(function(response){
      return response.text().then(function(raw){
        var data;
        try{ data = raw ? JSON.parse(raw) : {}; }
        catch(error){ data = { ok:response.ok, raw:raw }; }
        if(!response.ok){ throw new Error(data.message || data.error || ("HTTP " + response.status)); }
        if(data && data.ok === false){ throw normalizeScriptError(data); }
        return data || {};
      });
    }).catch(function(error){
      if(error && error.name === "AbortError"){
        throw new Error("Tiempo agotado al leer Google Sheets. Revisa Apps Script, permisos, token o tamaño del archivo.");
      }
      throw error;
    }).finally(function(){ if(timer){ window.clearTimeout(timer); } });
  }

  function requestSheetsPull(cfg, period){
    return postJson(cfg.appsScriptUrl, {
      action:"pull_bl2",
      target:"bdlocal",
      source:"BL2CloudPullSafe",
      mode:"pull_to_bdlocal",
      token:cfg.token,
      spreadsheetId:cfg.spreadsheetId,
      sheetName:cfg.sheetName || "Requisitos",
      periodoId:period ? period.id : "",
      periodoLabel:period ? period.label : "",
      requestedAt:nowISO()
    }, FETCH_TIMEOUT_MS).then(function(response){
      response.__action = "pull_bl2";
      return response;
    });
  }

  function requestCompactSheets(cfg){
    return postJson(cfg.appsScriptUrl, {
      action:"compact_bl2",
      target:"google_sheets",
      source:"BL2CloudPullSafe",
      token:cfg.token,
      spreadsheetId:cfg.spreadsheetId,
      sheetName:cfg.sheetName || "Requisitos",
      requestedAt:nowISO()
    }, FETCH_TIMEOUT_MS).then(function(response){
      response.__action = "compact_bl2";
      return response;
    });
  }

  function normalizeTableKey(name){
    var map = {
      config:"config", periodos:"periodos", periodo:"periodos", carreras:"carreras",
      periodoscarreras:"periodosCarreras", periodosdivisiones:"periodosDivisiones", divisionesperiodo:"periodosDivisiones",
      estudiantes:"estudiantes", estudiante:"estudiantes", matriculasperiodo:"matriculasPeriodo", matriculas:"matriculasPeriodo",
      requisitos:"requisitos", requisito:"requisitos", contactos:"contactos", contacto:"contactos", notas:"notas", nota:"notas",
      divisionesestudiantes:"divisionesEstudiantes", cambios:"cambios", cambio:"cambios", logs:"logs", log:"logs",
      resumen:"resumen", errores:"errores", syncmeta:"sync_meta", sync_meta:"sync_meta"
    };
    return map[key(name)] || name;
  }

  function extractTables(response){
    var tables = {};
    [response && response.tables, response && response.data && response.data.tables, response && response.payload && response.payload.tables, response && response.sheets, response && response.rowsBySheet].forEach(function(root){
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

  function careerFromRow(row){
    var nombre = text(first(row, ["NombreCarrera", "nombreCarrera", "Carrera", "carrera", "nombre_carrera"]));
    var codigo = text(first(row, ["CodigoCarrera", "codigoCarrera", "CódigoCarrera", "codigo_carrera"]));
    if(!nombre && !codigo){ return null; }
    return { id:codigo || key(nombre), codigo:codigo, nombre:nombre || codigo };
  }

  function buildDivisions(rows, fallbackPeriod){
    var byPeriod = {};

    (Array.isArray(rows) ? rows : []).forEach(function(row){
      row = row || {};
      var periodoId = normalizePeriodId(first(row, ["periodoId", "PeriodoId", "periodo", "Periodo", "idPeriodo", "periodId"]) || (fallbackPeriod && fallbackPeriod.id));
      var divisionName = text(first(row, ["division", "Division", "División", "nombreDivision", "NombreDivision", "nivel", "Nivel"]));
      if(!periodoId || !divisionName){ return; }

      var divId = key(divisionName);
      if(!byPeriod[periodoId]){ byPeriod[periodoId] = {}; }
      if(!byPeriod[periodoId][divId]){ byPeriod[periodoId][divId] = { id:divId, nombre:divisionName, carreras:[], updatedAt:nowISO() }; }

      var career = careerFromRow(row);
      if(career){ byPeriod[periodoId][divId].carreras.push(career); }
    });

    Object.keys(byPeriod).forEach(function(periodoId){
      Object.keys(byPeriod[periodoId]).forEach(function(divId){
        var careerMap = {};
        byPeriod[periodoId][divId].carreras.forEach(function(career){ if(career && career.id){ careerMap[career.id] = career; } });
        byPeriod[periodoId][divId].carreras = Object.keys(careerMap).map(function(id){ return careerMap[id]; });
      });
    });

    return byPeriod;
  }

  function mergeDivisionsIntoLocalStorage(divisionsByPeriod, fallbackPeriod){
    var saved = readJson(LS_DIVISIONES, {});
    if(!saved || typeof saved !== "object" || Array.isArray(saved)){ saved = {}; }

    var localPeriods = readJson(LS_PERIODOS, []);
    if(!Array.isArray(localPeriods)){ localPeriods = []; }

    Object.keys(divisionsByPeriod || {}).forEach(function(periodoId){
      var divisions = Object.keys(divisionsByPeriod[periodoId] || {}).map(function(id){ return divisionsByPeriod[periodoId][id]; });
      saved[periodoId] = Object.assign({}, saved[periodoId] || {}, { periodoId:periodoId, divisiones:divisions, updatedAt:nowISO(), source:"GoogleSheetsPullSafe" });

      var found = false;
      localPeriods = localPeriods.map(function(period){
        var id = normalizePeriodId(period.periodoId || period.id || period.periodoCanonicoId || "");
        if(id === periodoId){ found = true; return Object.assign({}, period, { id:periodoId, periodoId:periodoId, divisiones:divisions, updatedAt:nowISO() }); }
        return period;
      });

      if(!found){
        localPeriods.push({ id:periodoId, periodoId:periodoId, label:(fallbackPeriod && fallbackPeriod.label) || periodoId, periodoLabel:(fallbackPeriod && fallbackPeriod.label) || periodoId, divisiones:divisions, updatedAt:nowISO() });
      }
    });

    writeJson(LS_DIVISIONES, saved);
    writeJson(LS_PERIODOS, localPeriods);
    try{ if(window.BLDivisionesService && typeof window.BLDivisionesService.invalidate === "function"){ window.BLDivisionesService.invalidate(); } }catch(error){}
  }

  function saveDivisionsToBL2Periods(divisionsByPeriod, fallbackPeriod){
    mergeDivisionsIntoLocalStorage(divisionsByPeriod, fallbackPeriod);

    if(!core() || typeof core().savePeriod !== "function"){ return Promise.resolve(0); }

    var count = 0;
    var chain = Promise.resolve();
    Object.keys(divisionsByPeriod || {}).forEach(function(periodoId){
      chain = chain.then(function(){
        var divisions = Object.keys(divisionsByPeriod[periodoId] || {}).map(function(id){ return divisionsByPeriod[periodoId][id]; });
        if(!divisions.length){ return null; }
        count += divisions.length;
        return core().savePeriod({ id:periodoId, periodoId:periodoId, label:(fallbackPeriod && fallbackPeriod.id === periodoId && fallbackPeriod.label) ? fallbackPeriod.label : periodoId, periodoLabel:(fallbackPeriod && fallbackPeriod.id === periodoId && fallbackPeriod.label) ? fallbackPeriod.label : periodoId, divisiones:divisions, updatedAt:nowISO() });
      });
    });
    return chain.then(function(){ return count; });
  }

  function ensurePeriod(row, fallbackPeriod){
    row = Object.assign({}, row || {});
    var periodoId = normalizePeriodId(first(row, ["periodoId", "periodoCanonicoId", "idPeriodo", "periodId", "PeriodoId"]) || (fallbackPeriod && fallbackPeriod.id));
    var periodoLabel = text(first(row, ["periodoLabel", "periodoCanonicoLabel", "periodo", "Periodo"]) || (fallbackPeriod && fallbackPeriod.label) || periodoId);

    if(periodoId){ row.periodoId = periodoId; row.periodoCanonicoId = periodoId; row.ultimoPeriodoId = row.ultimoPeriodoId || periodoId; }
    if(periodoLabel){ row.periodoLabel = periodoLabel; row.periodoCanonicoLabel = periodoLabel; }
    return row;
  }

  function prepareStudents(rows, fallbackPeriod){
    return (Array.isArray(rows) ? rows : []).map(function(row){
      row = ensurePeriod(row, fallbackPeriod);
      var cedula = normalizeCedula(first(row, ["cedula", "numeroIdentificacion", "NumeroIdentificacion", "Cédula", "Cedula"]));
      if(cedula){ row.cedula = cedula; row.numeroIdentificacion = row.numeroIdentificacion || cedula; }
      row.source = row.source || "google_sheets_pull";
      row.updatedAt = row.updatedAt || row.fechaRegistro || row.fechaRegistroNotas || nowISO();
      return row;
    }).filter(function(row){ return text(row.cedula || row.numeroIdentificacion) && text(row.periodoId) && (!fallbackPeriod || !fallbackPeriod.id || normalizePeriodId(row.periodoId) === fallbackPeriod.id); });
  }

  function groupStudentsByPeriod(rows){
    var map = {};
    rows.forEach(function(row){
      var periodoId = normalizePeriodId(row.periodoId || row.periodoCanonicoId || "");
      if(!periodoId){ return; }
      if(!map[periodoId]){ map[periodoId] = { label:text(row.periodoLabel || periodoId), rows:[] }; }
      map[periodoId].rows.push(row);
    });
    return map;
  }

  function saveRawTable(tableName, rows, fallbackPeriod){
    if(!db() || typeof db().bulkPut !== "function"){ return Promise.resolve(0); }
    rows = (Array.isArray(rows) ? rows : []).map(function(row){
      row = ensurePeriod(row, fallbackPeriod);
      if(fallbackPeriod && fallbackPeriod.id && row.periodoId && normalizePeriodId(row.periodoId) !== fallbackPeriod.id){ return null; }
      if(tableName === (stores().periodos || "periodos")){
        row.id = normalizePeriodId(row.id || row.periodoId || row.periodoCanonicoId || (fallbackPeriod && fallbackPeriod.id));
        row.label = row.label || row.periodoLabel || row.periodoCanonicoLabel || row.id;
      }
      if(tableName === (stores().syncMeta || "sync_meta")){
        row.key = row.key || row.id || ("gs_pull_" + Date.now() + "_" + Math.random().toString(16).slice(2));
      }else{
        row.id = row.id || row.key || ((row.cedula || row.numeroIdentificacion || "row") + "__" + (row.periodoId || "") + "__" + Date.now() + "_" + Math.random().toString(16).slice(2));
      }
      row.updatedAt = row.updatedAt || nowISO();
      return row;
    }).filter(function(row){ return row && (tableName === (stores().syncMeta || "sync_meta") ? text(row.key) : text(row.id)); });

    if(!rows.length){ return Promise.resolve(0); }
    return db().bulkPut(tableName, rows).then(function(saved){ return (saved || []).length; });
  }

  function saveStudentsByPeriod(students, fallbackPeriod, summary){
    var groups = groupStudentsByPeriod(students);
    var periodIds = Object.keys(groups);
    var chain = Promise.resolve();

    periodIds.forEach(function(periodoId){
      var group = groups[periodoId];
      chain = chain.then(function(){
        progress("google", 60, "Guardando estudiantes: " + periodoId + "...");
        return core().saveStudents(group.rows, { normalized:false, periodoId:periodoId, periodoLabel:group.label || (fallbackPeriod && fallbackPeriod.label) || periodoId, source:"google_sheets_pull", markRetired:false, sync:false, importResult:{ advertencias:[], errores:[], duplicados:0 } }).then(function(result){
          summary.guardados += Number(result.guardados || 0);
          summary.actualizados += Number(result.actualizados || 0);
          summary.sinCambios += Number(result.sinCambios || 0);
          summary.duplicados += Number(result.duplicados || 0);
          if(!summary.periodoId){ summary.periodoId = result.periodoId || periodoId; }
          if(!summary.periodoLabel){ summary.periodoLabel = result.periodoLabel || group.label || periodoId; }
          if(sync() && typeof sync().markChanges === "function" && Array.isArray(result.changes)){
            return sync().markChanges(result.changes, "google", "SINCRONIZADO", { source:"GoogleSheetsPullSafe" });
          }
          return null;
        });
      });
    });

    return chain;
  }

  function renderImportSummary(summary){
    var target = byId("bl2-import-summary");
    if(!target){ return; }
    target.innerHTML = ""
      + '<div class="bl2-summary-grid">'
      + '<div class="bl2-summary-item"><span>Origen</span><strong>Google Sheets</strong></div>'
      + '<div class="bl2-summary-item"><span>Período</span><strong>' + escapeHtml(summary.periodoLabel || summary.periodoId || "—") + '</strong></div>'
      + '<div class="bl2-summary-item"><span>Filas estudiantes</span><strong>' + escapeHtml(summary.totalEntrada || 0) + '</strong></div>'
      + '<div class="bl2-summary-item"><span>Guardados</span><strong>' + escapeHtml(summary.guardados || 0) + '</strong></div>'
      + '<div class="bl2-summary-item"><span>Actualizados</span><strong>' + escapeHtml(summary.actualizados || 0) + '</strong></div>'
      + '</div>'
      + '<div class="bl2-warning-list">'
      + '<div class="bl2-warning">Tablas leídas: ' + escapeHtml(JSON.stringify(summary.rawTables || {})) + '</div>'
      + (summary.divisionesImportadas ? '<div class="bl2-warning">Divisiones importadas antes de guardar estudiantes: ' + escapeHtml(summary.divisionesImportadas) + '</div>' : '')
      + '</div>';
  }

  function refreshApp(){
    if(window.BL2App && typeof window.BL2App.refresh === "function"){
      return window.BL2App.refresh().catch(function(){ return null; });
    }
    return Promise.resolve(null);
  }

  function forceFetchFirebaseConfigSafe(){
    var s = store();
    var m = manager();
    if(!s || typeof s.restoreConfigFromFirebase !== "function"){ return Promise.reject(new Error("BDLocalConfigStore.restoreConfigFromFirebase no está disponible.")); }
    if(m && typeof m.setupFirebaseConfigAdapter === "function"){ try{ m.setupFirebaseConfigAdapter(); }catch(error){} }

    progress("firebase", 15, "Trayendo configuración desde Firebase...");
    return s.restoreConfigFromFirebase().then(function(result){
      if(!result || !result.ok){ throw new Error((result && result.message) || "Firebase no devolvió configuración."); }
      var sheets = s.getSheetsConfig({ includeSecret:true });
      return syncSheetsConfigToBL2(sheets).then(function(){
        progress("firebase", 100, "Configuración Firebase aplicada.");
        setStatus("bl2-firebase-status", "Configuración restaurada: " + new Date().toLocaleString());
        if(text(sheets.appsScriptUrl)){ setStatus("bl2-google-status", "Configuración Google Sheets lista desde Firebase."); }
        return { ok:true, message:"Configuración traída desde Firebase y aplicada localmente.", sheets:sheets };
      });
    });
  }

  function pullSheetsToLocalSafe(period){
    if(!core() || typeof core().saveStudents !== "function"){ return Promise.reject(new Error("BL2Core.saveStudents no está disponible.")); }
    if(!period || !period.id){ return Promise.reject(new Error("Selecciona un período para traer desde Google Sheets.")); }

    var cfg = requireSheetsConfig();
    var s = store();

    pauseGooglePush("Traer Sheets → BL: " + period.id);
    progress("google", 10, "Leyendo Google Sheets del período " + period.label + "...");

    return syncSheetsConfigToBL2(cfg).then(function(){
      return requestSheetsPull(cfg, period);
    }).then(function(response){
      progress("google", 40, "Preparando tablas para Base Local...");
      var tables = extractTables(response);
      var names = Object.keys(tables);
      if(!names.length){ throw new Error("Apps Script respondió, pero no devolvió tablas. Debe devolver { ok:true, tables:{ Estudiantes:[...], PeriodosDivisiones:[...] } }."); }

      var summary = { ok:true, action:response.__action || "pull_bl2", periodoId:period.id, periodoLabel:period.label, totalEntrada:0, guardados:0, actualizados:0, sinCambios:0, duplicados:0, divisionesImportadas:0, rawTables:{}, startedAt:nowISO(), finishedAt:"" };
      names.forEach(function(name){ summary.rawTables[name] = Array.isArray(tables[name]) ? tables[name].length : 0; });

      var chain = Promise.resolve();
      if(tables.periodos && tables.periodos.length){ chain = chain.then(function(){ return saveRawTable(stores().periodos || "periodos", tables.periodos, period); }); }

      var divisionsByPeriod = buildDivisions(tables.periodosDivisiones || [], period);
      chain = chain.then(function(){ return saveDivisionsToBL2Periods(divisionsByPeriod, period).then(function(count){ summary.divisionesImportadas = count; }); });

      var students = prepareStudents(tables.estudiantes || [], period);
      summary.totalEntrada = students.length;
      if(students.length){ chain = chain.then(function(){ return saveStudentsByPeriod(students, period, summary); }); }

      var rawMap = { requisitos:stores().requisitos || "requisitos", contactos:stores().contactos || "contactos", notas:stores().notas || "notas", cambios:stores().cambios || "cambios", logs:stores().logs || "logs", resumen:stores().resumen || "resumen", errores:stores().errores || "errores", sync_meta:stores().syncMeta || "sync_meta" };
      Object.keys(rawMap).forEach(function(tableKey){
        var rows = tables[tableKey] || [];
        if(!rows.length){ return; }
        chain = chain.then(function(){ return saveRawTable(rawMap[tableKey], rows, period).then(function(count){ summary.guardados += count; }); });
      });

      return chain.then(function(){
        summary.finishedAt = nowISO();
        if(s && typeof s.patchConfig === "function"){ s.patchConfig({ sheets:{ connected:true, status:"ok", lastSyncAt:nowISO(), lastError:"" }, bdlocal:{ connected:true, status:"ok", lastTestAt:nowISO() } }); }
        progress("google", 100, "Google Sheets guardado en Base Local.");
        return summary;
      });
    }).catch(function(error){
      if(s && typeof s.updateConnectionStatus === "function"){ s.updateConnectionStatus("sheets", { connected:false, status:"error", lastError:error.message || String(error) }); }
      progress("google", 0, "Error al traer Google Sheets.");
      throw error;
    }).finally(function(){ resumeGooglePush(); });
  }

  function cleanSheetsDuplicatesSafe(){
    var cfg = requireSheetsConfig();
    progress("google", 10, "Limpiando duplicados en Google Sheets...");
    return requestCompactSheets(cfg).then(function(response){
      progress("google", 100, "Duplicados de Google Sheets limpiados.");
      if(store() && typeof store().patchConfig === "function"){ store().patchConfig({ sheets:{ connected:true, status:"ok", lastSyncAt:nowISO(), lastError:"" } }); }
      return response;
    }).catch(function(error){
      if(store() && typeof store().updateConnectionStatus === "function"){ store().updateConnectionStatus("sheets", { connected:false, status:"error", lastError:error.message || String(error) }); }
      progress("google", 0, "Error al limpiar duplicados.");
      throw error;
    });
  }

  function hijack(id, handler){
    var btn = byId(id);
    if(!btn || btn.__cloudPullSafeBound){ return; }
    btn.__cloudPullSafeBound = true;
    btn.addEventListener("click", function(event){
      event.preventDefault();
      event.stopPropagation();
      if(typeof event.stopImmediatePropagation === "function"){ event.stopImmediatePropagation(); }
      handler();
    }, true);
  }

  function installManagerPauseGuard(){
    var m = manager();
    if(!m || m.__cloudPullPauseGuard){ return; }
    m.__cloudPullPauseGuard = true;

    function pausedResult(){
      return Promise.resolve({ ok:true, skipped:true, message:"Subida a Google Sheets pausada temporalmente mientras se trae información desde Sheets hacia Base Local." });
    }

    ["pushLocalToSheets", "syncQueue", "syncAll"].forEach(function(name){
      if(typeof m[name] !== "function"){ return; }
      var original = m[name];
      m[name] = function(){
        if(googlePushPaused()){
          log("Subida automática a Google Sheets pausada por Traer Sheets → BL.", "warn", { method:name });
          return pausedResult();
        }
        return original.apply(m, arguments);
      };
    });
  }

  function bind(){
    installManagerPauseGuard();

    hijack("bl2-btn-fetch-firebase-config", function(){
      setBusy(true, "Forzando traída de configuración desde Firebase...");
      forceFetchFirebaseConfigSafe().then(function(result){
        log(result.message, "ok", result);
        alert(result.message);
        return refreshApp();
      }).catch(function(error){
        log("No se pudo traer configuración Firebase: " + error.message, "error");
        alert("No se pudo traer configuración Firebase: " + error.message);
      }).finally(function(){ setBusy(false); });
    });

    hijack("bl2-btn-pull-sheets", function(){
      openPeriodModal().then(function(period){
        if(!window.confirm("Se traerán datos de Google Sheets solo para el período:\n\n" + period.label + "\n" + period.id + "\n\nLa subida automática se pausará mientras dura el proceso. ¿Continuar?")){
          return null;
        }
        setBusy(true, "Trayendo Google Sheets hacia Base Local para " + period.label + "...");
        return pullSheetsToLocalSafe(period).then(function(summary){
          renderImportSummary(summary);
          log("Google Sheets → Base Local completado. Estudiantes: " + (summary.totalEntrada || 0) + ".", "ok", summary);
          setStatus("bl2-google-status", "Importado desde Google Sheets: " + new Date().toLocaleString());
          return refreshApp().then(function(){ return summary; });
        }).then(function(summary){
          if(!summary){ return; }
          alert("Google Sheets → Base Local completado.\n\nPeríodo: " + (summary.periodoLabel || summary.periodoId) + "\nEstudiantes leídos: " + (summary.totalEntrada || 0) + "\nGuardados: " + (summary.guardados || 0) + "\nActualizados: " + (summary.actualizados || 0) + "\nDivisiones: " + (summary.divisionesImportadas || 0));
        });
      }).catch(function(error){
        if(error && error.message === "Operación cancelada."){ return; }
        log("No se pudo traer Google Sheets: " + error.message, "error");
        alert("No se pudo traer Google Sheets: " + error.message);
      }).finally(function(){ setBusy(false); resumeGooglePush(); });
    });

    hijack("bl2-btn-clean-sheets-duplicates", function(){
      if(!window.confirm("Esto compactará Google Sheets y eliminará duplicados por clave en las hojas principales. No borra datos únicos. ¿Continuar?")){
        return;
      }
      setBusy(true, "Limpiando duplicados en Google Sheets...");
      cleanSheetsDuplicatesSafe().then(function(response){
        log("Limpieza de duplicados en Google Sheets completada.", "ok", response);
        alert("Limpieza de duplicados completada. Revisa la hoja y luego prueba Traer Sheets → BL.");
      }).catch(function(error){
        log("No se pudo limpiar duplicados: " + error.message, "error");
        alert("No se pudo limpiar duplicados: " + error.message);
      }).finally(function(){ setBusy(false); });
    });
  }

  function boot(){
    bind();
    var attempts = 0;
    var timer = window.setInterval(function(){
      attempts += 1;
      bind();
      if(attempts >= 40){ window.clearInterval(timer); }
    }, 250);
  }

  window.BL2CloudPullSafe = {
    forceFetchFirebaseConfig:forceFetchFirebaseConfigSafe,
    pullSheetsToLocal:pullSheetsToLocalSafe,
    cleanSheetsDuplicates:cleanSheetsDuplicatesSafe,
    syncSheetsConfigToBL2:syncSheetsConfigToBL2,
    extractTables:extractTables,
    buildDivisions:buildDivisions,
    pauseGooglePush:pauseGooglePush,
    resumeGooglePush:resumeGooglePush
  };

  if(document.readyState === "loading"){ document.addEventListener("DOMContentLoaded", boot); }
  else{ boot(); }
})(window, document);
