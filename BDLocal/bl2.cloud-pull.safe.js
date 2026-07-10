/* =========================================================
Nombre completo: bl2.cloud-pull.safe.js
Ruta o ubicación: /BDLocal/bl2.cloud-pull.safe.js
Función o funciones:
- Ser la única implementación para traer Google Sheets a Base Local.
- Exigir período, confirmación y respaldo previo.
- Importar únicamente información académica permitida.
- Ignorar config, cambios, logs, resumen, errores y sync_meta remotos.
- Usar identificadores estables para no duplicar filas en descargas repetidas.
- Marcar como procesados los cambios creados por la propia descarga.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION = "3.0.0-single-safe-pull";
  var FETCH_TIMEOUT_MS = 120000;
  var PAUSE_KEY = "REQ_BDLOCAL_PAUSE_GOOGLE_PUSH";
  var LS_DIVISIONES = "carga.periodos.divisiones";
  var LS_PERIODOS = "carga.periodos.local";
  var pulling = false;
  var enginePausedByPull = false;

  var ALLOWED_TABLES = {
    periodos:true,
    periodosDivisiones:true,
    estudiantes:true,
    matriculasPeriodo:true,
    requisitos:true,
    contactos:true,
    notas:true
  };

  var TECHNICAL_TABLES = {
    config:true,
    cambios:true,
    logs:true,
    resumen:true,
    errores:true,
    sync_meta:true,
    cacheViews:true,
    syncEstado:true,
    erroresValidacion:true,
    cambiosPendientes:true
  };

  function text(value){ return String(value == null ? "" : value).trim(); }
  function now(){ return new Date().toISOString(); }
  function byId(name){ return document.getElementById(name); }
  function core(){ return window.BL2Core || null; }
  function db(){ return window.BL2DB || null; }
  function sync(){ return window.BL2Sync || null; }
  function outbox(){ return window.BDLSyncOutbox || null; }
  function store(){ return window.BDLocalConfigStore || null; }
  function manager(){ return window.BDLocalSyncManager || null; }
  function config(){ return window.BL2Config || {}; }
  function stores(){ return config().stores || {}; }

  function normalize(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();
  }

  function key(value){ return normalize(value).replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,""); }

  function escapeHtml(value){
    return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
  }

  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(error){ return value; } }

  function hash(value){
    var source = typeof value === "string" ? value : JSON.stringify(value || {});
    var result = 2166136261;
    for(var index = 0; index < source.length; index += 1){
      result ^= source.charCodeAt(index);
      result += (result << 1) + (result << 4) + (result << 7) + (result << 8) + (result << 24);
    }
    return (result >>> 0).toString(16);
  }

  function first(row,names){
    row = row || {};
    var wanted = (names || []).map(key);
    var rowKeys = Object.keys(row);
    for(var index = 0; index < rowKeys.length; index += 1){
      if(wanted.indexOf(key(rowKeys[index])) >= 0){ return row[rowKeys[index]]; }
    }
    return "";
  }

  function normalizeCedula(value){
    var utils = config().utils || {};
    if(typeof utils.normalizeCedula === "function"){ return utils.normalizeCedula(value); }
    var raw = text(value).replace(/[^0-9A-Za-z]/g,"");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function normalizePeriodId(value){
    value = text(value);
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match ? match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4] : value.replace(/_+/g,"__");
  }

  function log(message,level,data){
    try{
      var box = byId("bl2-log");
      if(box){
        var item = document.createElement("div");
        item.className = "bl2-log-item " + (level ? "is-" + level : "");
        item.innerHTML = "<strong>Google Sheets</strong><span>" + escapeHtml(message) + "</span>";
        box.insertBefore(item,box.firstChild);
      }
    }catch(error){}
    try{
      if(core() && typeof core().log === "function"){
        core().log(level === "error" ? "ERROR" : level === "warn" ? "WARN" : "INFO",message,data || {}).catch(function(){});
      }
    }catch(error2){}
    try{
      if(store() && typeof store().addLog === "function"){
        store().addLog("cloud_pull_safe",message,level === "error" ? "error" : level === "warn" ? "warning" : "success",data || {});
      }
    }catch(error3){}
  }

  function progress(percent,detail){
    try{
      window.dispatchEvent(new CustomEvent("bl2:sync-progress",{ detail:{ target:"google",percent:Math.max(0,Math.min(100,Number(percent || 0))),detail:detail || "",at:now() } }));
    }catch(error){}
    try{
      if(window.BDLocalConfigUI && typeof window.BDLocalConfigUI.setProgress === "function"){
        window.BDLocalConfigUI.setProgress(percent > 0 && percent < 100,percent,detail || "");
      }
    }catch(error2){}
  }

  function setStatus(name,message){ var element = byId(name); if(element){ element.textContent = message; } }

  function setBusy(busy){
    [
      "bl2-btn-fetch-firebase-config","bl2-btn-pull-sheets","bl2-btn-clean-sheets-duplicates",
      "bl2-btn-push-google","bl2-btn-push-firebase","bl2-btn-push-supabase","bl2-btn-sync-queue",
      "bl2-btn-load","bl2-btn-sync-google","bl2-btn-sync-firebase","bl2-btn-period-save","bl2-btn-refresh"
    ].forEach(function(name){ var button = byId(name); if(button){ button.disabled = !!busy; } });
  }

  function writeJson(name,value){ try{ window.localStorage.setItem(name,JSON.stringify(value)); }catch(error){} }
  function readJson(name,fallback){ try{ var value = JSON.parse(window.localStorage.getItem(name) || ""); return value == null ? fallback : value; }catch(error){ return fallback; } }

  function pauseOutbound(period){
    pulling = true;
    window.BL2_GOOGLE_PUSH_PAUSED = true;
    writeJson(PAUSE_KEY,{ paused:true,reason:"Traer Google Sheets: " + period.id,at:now() });
    if(window.BDLSyncV2 && typeof window.BDLSyncV2.pause === "function" && (!window.BDLSyncV2.isPaused || !window.BDLSyncV2.isPaused())){
      window.BDLSyncV2.pause("Importación Google Sheets en curso");
      enginePausedByPull = true;
    }
  }

  function resumeOutbound(){
    pulling = false;
    window.BL2_GOOGLE_PUSH_PAUSED = false;
    try{ window.localStorage.removeItem(PAUSE_KEY); }catch(error){}
    if(enginePausedByPull && window.BDLSyncV2 && typeof window.BDLSyncV2.resume === "function"){
      window.BDLSyncV2.resume();
    }
    enginePausedByPull = false;
  }

  function isPulling(){ return pulling; }

  function selectedPeriod(){
    try{
      if(window.BL2App && typeof window.BL2App.getSelectedPeriod === "function"){
        var selected = window.BL2App.getSelectedPeriod();
        if(selected && text(selected.id)){ return { id:normalizePeriodId(selected.id),label:text(selected.label || selected.id) }; }
      }
      if(window.BL2App && typeof window.BL2App.getState === "function"){
        var state = window.BL2App.getState() || {};
        if(state.activePeriod && text(state.activePeriod.id)){ return { id:normalizePeriodId(state.activePeriod.id),label:text(state.activePeriod.label || state.activePeriod.id) }; }
      }
    }catch(error){}
    var select = byId("bl2-period-select");
    var periodoId = normalizePeriodId(select && select.value);
    if(!periodoId){ return null; }
    return { id:periodoId,label:select && select.selectedOptions && select.selectedOptions[0] ? text(select.selectedOptions[0].textContent) : periodoId };
  }

  function availablePeriods(){
    var map = {};
    var select = byId("bl2-period-select");
    Array.prototype.slice.call(select && select.options || []).forEach(function(option){
      var periodoId = normalizePeriodId(option.value);
      if(periodoId){ map[periodoId] = { id:periodoId,label:text(option.textContent || periodoId) }; }
    });
    if(core() && typeof core().getPeriods === "function"){
      return core().getPeriods().then(function(rows){
        (rows || []).forEach(function(row){
          var periodoId = normalizePeriodId(row.id || row.periodoId || row.periodoCanonicoId);
          if(periodoId){ map[periodoId] = { id:periodoId,label:text(row.label || row.periodoLabel || periodoId) }; }
        });
        return Object.keys(map).map(function(periodoId){ return map[periodoId]; });
      }).catch(function(){ return Object.keys(map).map(function(periodoId){ return map[periodoId]; }); });
    }
    return Promise.resolve(Object.keys(map).map(function(periodoId){ return map[periodoId]; }));
  }

  function ensurePeriodModal(){
    if(byId("bl2-pull-period-modal")){ return; }
    var style = document.createElement("style");
    style.textContent = ".bl2-pull-modal{position:fixed;inset:0;z-index:100000;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.46);padding:18px}.bl2-pull-modal.is-open{display:flex}.bl2-pull-card{width:min(540px,96vw);background:#fff;border:1px solid #dbe3ef;border-radius:20px;box-shadow:0 25px 80px rgba(15,23,42,.28);padding:18px;display:grid;gap:14px}.bl2-pull-card h2{margin:0;color:#172033;font-size:20px}.bl2-pull-card p{margin:0;color:#64748b;font-size:13px;font-weight:700;line-height:1.4}.bl2-pull-card label{display:grid;gap:6px;font-size:12px;font-weight:900}.bl2-pull-card select{min-height:42px;border:1px solid #dbe3ef;border-radius:12px;padding:8px 11px;background:#fff}.bl2-pull-warning{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:10px;font-size:12px;font-weight:800;line-height:1.4}.bl2-pull-actions{display:flex;justify-content:flex-end;gap:9px}.bl2-pull-actions button{min-height:38px;border-radius:999px;border:1px solid #dbe3ef;background:#fff;padding:0 14px;font-weight:900;cursor:pointer}.bl2-pull-actions .primary{background:#3949e8;border-color:#3949e8;color:#fff}";
    document.head.appendChild(style);
    var modal = document.createElement("section");
    modal.id = "bl2-pull-period-modal";
    modal.className = "bl2-pull-modal";
    modal.innerHTML = '<div class="bl2-pull-card" role="dialog" aria-modal="true"><div><h2>Traer Google Sheets a Base Local</h2><p>Seleccione un solo período. Base Local no se borra y no se importan tablas técnicas.</p></div><label>Período<select id="bl2-pull-period-select"></select></label><div class="bl2-pull-warning">Se ignorarán config, cambios, logs, resumen, errores y sync_meta. Antes de guardar se creará un respaldo local.</div><div class="bl2-pull-actions"><button type="button" data-pull-cancel>Cancelar</button><button type="button" class="primary" data-pull-confirm>Continuar</button></div></div>';
    document.body.appendChild(modal);
  }

  function choosePeriod(){
    ensurePeriodModal();
    return availablePeriods().then(function(periods){
      if(!periods.length){ throw new Error("No existen períodos disponibles."); }
      return new Promise(function(resolve,reject){
        var modal = byId("bl2-pull-period-modal");
        var select = byId("bl2-pull-period-select");
        var active = selectedPeriod();
        select.innerHTML = periods.map(function(period){ return '<option value="' + escapeHtml(period.id) + '">' + escapeHtml(period.label) + ' · ' + escapeHtml(period.id) + '</option>'; }).join("");
        if(active && active.id){ select.value = active.id; }
        function close(){ modal.classList.remove("is-open"); modal.onclick = null; modal.querySelector("[data-pull-cancel]").onclick = null; modal.querySelector("[data-pull-confirm]").onclick = null; }
        modal.querySelector("[data-pull-cancel]").onclick = function(){ close(); reject(new Error("Operación cancelada.")); };
        modal.querySelector("[data-pull-confirm]").onclick = function(){ var id = normalizePeriodId(select.value); var found = periods.filter(function(period){ return period.id === id; })[0]; close(); resolve(found || { id:id,label:id }); };
        modal.onclick = function(event){ if(event.target === modal){ close(); reject(new Error("Operación cancelada.")); } };
        modal.classList.add("is-open");
      });
    });
  }

  function requireSheetsConfig(){
    if(!store() || typeof store().getSheetsConfig !== "function"){ throw new Error("La configuración de Google Sheets no está disponible."); }
    var cfg = store().getSheetsConfig({ includeSecret:true }) || {};
    if(!cfg.enabled){ throw new Error("Google Sheets está desactivado."); }
    if(!text(cfg.appsScriptUrl)){ throw new Error("Falta la URL de Apps Script."); }
    if(!text(cfg.token)){ throw new Error("Falta el token de Apps Script."); }
    if(!text(cfg.spreadsheetId)){ throw new Error("Falta el ID de Google Sheets."); }
    return cfg;
  }

  function syncSheetsConfigToBL2(cfg){
    cfg = cfg || {};
    var tasks = [];
    if(sync() && typeof sync().setGoogleScriptUrl === "function" && text(cfg.appsScriptUrl)){ tasks.push(sync().setGoogleScriptUrl(cfg.appsScriptUrl)); }
    if(db() && typeof db().setSetting === "function"){
      if(text(cfg.appsScriptUrl)){ tasks.push(db().setSetting("googleScriptUrl",text(cfg.appsScriptUrl))); }
      if(text(cfg.spreadsheetId)){ tasks.push(db().setSetting("googleSpreadsheetId",text(cfg.spreadsheetId))); }
      if(text(cfg.token)){ tasks.push(db().setSetting("googleToken",text(cfg.token))); }
    }
    writeJson("REQ_BDLOCAL_GOOGLE_SHEETS_CONFIG",{ enabled:true,appsScriptUrl:text(cfg.appsScriptUrl),webAppUrl:text(cfg.appsScriptUrl),spreadsheetId:text(cfg.spreadsheetId),token:text(cfg.token),sheetName:text(cfg.sheetName || "Requisitos"),updatedAt:now(),source:"BL2CloudPullSafe" });
    return Promise.all(tasks.map(function(task){ return Promise.resolve(task).catch(function(){ return null; }); }));
  }

  function postJson(url,payload,timeoutMs){
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? window.setTimeout(function(){ controller.abort(); },Number(timeoutMs || FETCH_TIMEOUT_MS)) : null;
    return fetch(url,{ method:"POST",mode:"cors",redirect:"follow",headers:{ "Content-Type":"text/plain;charset=utf-8" },body:JSON.stringify(payload || {}),signal:controller ? controller.signal : undefined }).then(function(response){
      return response.text().then(function(raw){
        var data = {};
        try{ data = raw ? JSON.parse(raw) : {}; }catch(error){ data = { ok:response.ok,raw:raw }; }
        if(!response.ok){ throw new Error(data.message || data.error || ("HTTP " + response.status)); }
        if(data && data.ok === false){
          var reason = text(data.error || data.code || data.message);
          if(reason.indexOf("ACCION_NO_RECONOCIDA") >= 0){ throw new Error("Apps Script está desactualizado y no reconoce pull_bl2."); }
          throw new Error(reason || "Apps Script respondió ok=false.");
        }
        return data;
      });
    }).catch(function(error){
      if(error && error.name === "AbortError"){ throw new Error("Tiempo agotado al leer Google Sheets."); }
      throw error;
    }).finally(function(){ if(timer){ window.clearTimeout(timer); } });
  }

  function requestPull(cfg,period){
    return postJson(cfg.appsScriptUrl,{ action:"pull_bl2",target:"bdlocal",source:"BL2CloudPullSafe",mode:"pull_to_bdlocal",token:cfg.token,spreadsheetId:cfg.spreadsheetId,sheetName:cfg.sheetName || "Requisitos",periodoId:period.id,periodoLabel:period.label,requestedAt:now() },FETCH_TIMEOUT_MS);
  }

  function requestCompact(cfg){
    return postJson(cfg.appsScriptUrl,{ action:"compact_bl2",target:"google_sheets",source:"BL2CloudPullSafe",token:cfg.token,spreadsheetId:cfg.spreadsheetId,sheetName:cfg.sheetName || "Requisitos",requestedAt:now() },FETCH_TIMEOUT_MS);
  }

  function normalizeTableKey(name){
    var map = {
      config:"config",periodos:"periodos",periodo:"periodos",periodosdivisiones:"periodosDivisiones",divisionesperiodo:"periodosDivisiones",
      estudiantes:"estudiantes",estudiante:"estudiantes",matriculasperiodo:"matriculasPeriodo",matriculas:"matriculasPeriodo",
      requisitos:"requisitos",requisito:"requisitos",contactos:"contactos",contacto:"contactos",notas:"notas",nota:"notas",
      cambios:"cambios",cambio:"cambios",cambiospendientes:"cambiosPendientes",logs:"logs",log:"logs",resumen:"resumen",
      errores:"errores",erroresvalidacion:"erroresValidacion",syncmeta:"sync_meta",syncestado:"syncEstado",cacheviews:"cacheViews"
    };
    return map[key(name).replace(/_/g,"")] || map[key(name)] || name;
  }

  function extractTables(response){
    var tables = {};
    [response && response.tables,response && response.data && response.data.tables,response && response.payload && response.payload.tables,response && response.sheets,response && response.rowsBySheet].forEach(function(root){
      if(!root || typeof root !== "object" || Array.isArray(root)){ return; }
      Object.keys(root).forEach(function(name){
        if(!Array.isArray(root[name])){ return; }
        var mapped = normalizeTableKey(name);
        tables[mapped] = (tables[mapped] || []).concat(root[name]);
      });
    });
    if(Array.isArray(response && response.estudiantes)){ tables.estudiantes = (tables.estudiantes || []).concat(response.estudiantes); }
    if(Array.isArray(response && response.rows)){ tables.estudiantes = (tables.estudiantes || []).concat(response.rows); }
    return tables;
  }

  function ensurePeriod(row,period){
    row = Object.assign({},row || {});
    var periodoId = normalizePeriodId(first(row,["periodoId","periodoCanonicoId","idPeriodo","periodId","PeriodoId"]) || period.id);
    var periodoLabel = text(first(row,["periodoLabel","periodoCanonicoLabel","periodo","Periodo"]) || period.label || periodoId);
    row.periodoId = periodoId;
    row.periodoCanonicoId = periodoId;
    row.periodoLabel = periodoLabel;
    row.periodoCanonicoLabel = periodoLabel;
    row.updatedAt = row.updatedAt || now();
    return row;
  }

  function buildDivisions(rows,period){
    var byPeriod = {};
    (rows || []).forEach(function(source){
      var row = ensurePeriod(source,period);
      var divisionName = text(first(row,["division","Division","División","nombreDivision","NombreDivision","nivel","Nivel"]));
      if(!row.periodoId || !divisionName){ return; }
      var divisionId = key(divisionName);
      if(!byPeriod[row.periodoId]){ byPeriod[row.periodoId] = {}; }
      if(!byPeriod[row.periodoId][divisionId]){ byPeriod[row.periodoId][divisionId] = { id:divisionId,nombre:divisionName,carreras:[],updatedAt:now() }; }
      var nombre = text(first(row,["NombreCarrera","nombreCarrera","Carrera","carrera"]));
      var codigo = text(first(row,["CodigoCarrera","codigoCarrera","CódigoCarrera"]));
      if(nombre || codigo){ byPeriod[row.periodoId][divisionId].carreras.push({ id:codigo || key(nombre),codigo:codigo,nombre:nombre || codigo }); }
    });
    Object.keys(byPeriod).forEach(function(periodoId){
      Object.keys(byPeriod[periodoId]).forEach(function(divisionId){
        var unique = {};
        byPeriod[periodoId][divisionId].carreras.forEach(function(career){ unique[career.id] = career; });
        byPeriod[periodoId][divisionId].carreras = Object.keys(unique).map(function(id){ return unique[id]; });
      });
    });
    return byPeriod;
  }

  function saveDivisions(divisions,period){
    var saved = readJson(LS_DIVISIONES,{});
    var localPeriods = readJson(LS_PERIODOS,[]);
    if(!saved || typeof saved !== "object" || Array.isArray(saved)){ saved = {}; }
    if(!Array.isArray(localPeriods)){ localPeriods = []; }
    var count = 0;
    var chain = Promise.resolve();
    Object.keys(divisions || {}).forEach(function(periodoId){
      var rows = Object.keys(divisions[periodoId]).map(function(id){ return divisions[periodoId][id]; });
      count += rows.length;
      saved[periodoId] = { periodoId:periodoId,divisiones:rows,updatedAt:now(),source:"GoogleSheetsPullSafe" };
      var found = false;
      localPeriods = localPeriods.map(function(item){
        var currentId = normalizePeriodId(item.periodoId || item.id);
        if(currentId !== periodoId){ return item; }
        found = true;
        return Object.assign({},item,{ id:periodoId,periodoId:periodoId,divisiones:rows,updatedAt:now() });
      });
      if(!found){ localPeriods.push({ id:periodoId,periodoId:periodoId,label:period.label,periodoLabel:period.label,divisiones:rows,updatedAt:now() }); }
      if(core() && typeof core().savePeriod === "function"){
        chain = chain.then(function(){ return core().savePeriod({ id:periodoId,periodoId:periodoId,label:periodoId === period.id ? period.label : periodoId,periodoLabel:periodoId === period.id ? period.label : periodoId,divisiones:rows,updatedAt:now() }); });
      }
    });
    writeJson(LS_DIVISIONES,saved);
    writeJson(LS_PERIODOS,localPeriods);
    try{ if(window.BLDivisionesService && typeof window.BLDivisionesService.invalidate === "function"){ window.BLDivisionesService.invalidate(); } }catch(error){}
    return chain.then(function(){ return count; });
  }

  function stableRowId(table,row,period){
    var existing = text(row.id || row.key || row.registroId);
    if(existing){ return existing; }
    var cedula = normalizeCedula(first(row,["cedula","numeroIdentificacion","NumeroIdentificacion","Cédula","Cedula"]));
    var periodoId = normalizePeriodId(first(row,["periodoId","periodoCanonicoId","idPeriodo","periodId"]) || period.id);
    if(table === "notas"){ return (cedula || "sin_cedula") + "__" + periodoId; }
    if(table === "requisitos"){
      var requirement = key(first(row,["requisitoKey","requisito","Requisito","nombre","campo","key"]) || hash(row));
      return (cedula || "sin_cedula") + "__" + periodoId + "__" + requirement;
    }
    if(table === "contactos"){
      var kind = key(first(row,["tipoKey","tipo","Tipo","campo"]) || "contacto");
      var contactValue = text(first(row,["valor","correo","email","telefono","celular"]) || hash(row));
      return (cedula || "sin_cedula") + "__" + periodoId + "__" + kind + "__" + hash(contactValue);
    }
    return table + "__" + periodoId + "__" + (cedula || hash(row));
  }

  function saveRawBusinessTable(table,rows,period){
    if(!db() || typeof db().bulkPut !== "function"){ return Promise.resolve(0); }
    var storeName = table === "requisitos" ? (stores().requisitos || "requisitos") : table === "contactos" ? (stores().contactos || "contactos") : (stores().notas || "notas");
    var map = {};
    (rows || []).forEach(function(source){
      var row = ensurePeriod(source,period);
      if(row.periodoId !== period.id){ return; }
      row.cedula = normalizeCedula(first(row,["cedula","numeroIdentificacion","NumeroIdentificacion","Cédula","Cedula"]));
      row.numeroIdentificacion = row.numeroIdentificacion || row.cedula;
      row.id = stableRowId(table,row,period);
      row.source = "google_sheets_pull";
      map[row.id] = row;
    });
    var prepared = Object.keys(map).map(function(id){ return map[id]; });
    if(!prepared.length){ return Promise.resolve(0); }
    return db().bulkPut(storeName,prepared).then(function(result){ return (result || []).length; });
  }

  function markImportedChanges(changes){
    changes = Array.isArray(changes) ? changes : [];
    if(!changes.length){ return Promise.resolve(); }
    if(outbox() && typeof outbox().markSynced === "function"){
      var chain = Promise.resolve();
      ["google","firebase","supabase"].forEach(function(target){
        chain = chain.then(function(){ return outbox().markSynced(changes,target,{ syncedAt:now(),source:"google_sheets_pull",imported:true }); });
      });
      return chain;
    }
    if(sync() && typeof sync().markChanges === "function"){
      return Promise.all(["google","firebase","supabase"].map(function(target){ return sync().markChanges(changes,target,"SINCRONIZADO",{ source:"google_sheets_pull",imported:true }); }));
    }
    return Promise.resolve();
  }

  function prepareStudents(tables,period){
    var source = (tables.estudiantes || []).concat(tables.matriculasPeriodo || []);
    var map = {};
    source.forEach(function(item){
      var row = ensurePeriod(item,period);
      var cedula = normalizeCedula(first(row,["cedula","numeroIdentificacion","NumeroIdentificacion","Cédula","Cedula"]));
      if(!cedula || row.periodoId !== period.id){ return; }
      row.cedula = cedula;
      row.numeroIdentificacion = row.numeroIdentificacion || cedula;
      row.source = "google_sheets_pull";
      var current = map[cedula];
      var incomingTime = Date.parse(row.updatedAt || "") || 0;
      var currentTime = Date.parse(current && current.updatedAt || "") || 0;
      if(!current || incomingTime >= currentTime){ map[cedula] = row; }
    });
    return Object.keys(map).map(function(cedula){ return map[cedula]; });
  }

  function createSafetyBackup(period){
    var backup = window.BL2BackupV2 || window.BL2Backup;
    return backup && typeof backup.createBackup === "function"
      ? backup.createBackup({ scope:"period",periodoId:period.id,periodoLabel:period.label,type:"pre_google_sheets_pull" })
      : Promise.resolve(null);
  }

  function saveStudents(students,period,summary){
    if(!students.length){ return Promise.resolve(); }
    return core().saveStudents(students,{
      normalized:false,
      periodoId:period.id,
      periodoLabel:period.label,
      source:"google_sheets_pull",
      markRetired:false,
      sync:false,
      localOnly:true,
      cloudSync:false,
      manualCloudSync:true,
      importResult:{ advertencias:[],errores:[],duplicados:summary.duplicatesIgnored }
    }).then(function(result){
      summary.guardados += Number(result.guardados || 0);
      summary.actualizados += Number(result.actualizados || 0);
      summary.sinCambios += Number(result.sinCambios || 0);
      summary.duplicados += Number(result.duplicados || 0);
      return markImportedChanges(result.changes);
    });
  }

  function pullSheetsToLocal(period){
    if(pulling){ return Promise.resolve({ ok:false,blocked:true,message:"Ya existe una descarga de Google Sheets en curso." }); }
    if(!period || !text(period.id)){ return Promise.reject(new Error("Seleccione un período para traer Google Sheets.")); }
    if(!core() || typeof core().saveStudents !== "function"){ return Promise.reject(new Error("BL2Core.saveStudents no está disponible.")); }
    period = { id:normalizePeriodId(period.id),label:text(period.label || period.id) };
    var cfg = requireSheetsConfig();
    var summary = { ok:true,periodoId:period.id,periodoLabel:period.label,totalEntrada:0,guardados:0,actualizados:0,sinCambios:0,duplicados:0,duplicatesIgnored:0,divisionesImportadas:0,rawTables:{},importedTables:{},ignoredTables:{},startedAt:now(),finishedAt:"",message:"" };

    pauseOutbound(period);
    setBusy(true);
    progress(5,"Creando respaldo antes de traer Google Sheets...");

    return createSafetyBackup(period).then(function(backup){
      summary.safetyBackupId = backup && backup.record && backup.record.id || "";
      return syncSheetsConfigToBL2(cfg);
    }).then(function(){
      progress(15,"Leyendo Google Sheets del período " + period.label + "...");
      return requestPull(cfg,period);
    }).then(function(response){
      var tables = extractTables(response);
      var names = Object.keys(tables);
      if(!names.length){ throw new Error("Apps Script no devolvió tablas para importar."); }
      names.forEach(function(name){
        summary.rawTables[name] = (tables[name] || []).length;
        if(ALLOWED_TABLES[name]){ summary.importedTables[name] = (tables[name] || []).length; }
        else{ summary.ignoredTables[name] = (tables[name] || []).length; }
      });

      Object.keys(TECHNICAL_TABLES).forEach(function(name){ if(tables[name]){ delete tables[name]; } });
      var students = prepareStudents(tables,period);
      summary.totalEntrada = students.length;
      summary.duplicatesIgnored = Math.max(0,(summary.importedTables.estudiantes || 0) + (summary.importedTables.matriculasPeriodo || 0) - students.length);

      var chain = Promise.resolve();
      if(tables.periodos && tables.periodos.length && core() && typeof core().savePeriod === "function"){
        chain = chain.then(function(){ return core().savePeriod({ id:period.id,periodoId:period.id,label:period.label,periodoLabel:period.label,updatedAt:now() }); });
      }
      chain = chain.then(function(){ return saveDivisions(buildDivisions(tables.periodosDivisiones || [],period),period).then(function(count){ summary.divisionesImportadas = count; }); });
      chain = chain.then(function(){ progress(55,"Guardando estudiantes sin generar reenvíos..."); return saveStudents(students,period,summary); });
      ["requisitos","contactos","notas"].forEach(function(table){
        chain = chain.then(function(){
          var rows = tables[table] || [];
          if(!rows.length){ return null; }
          return saveRawBusinessTable(table,rows,period).then(function(count){ summary.guardados += count; });
        });
      });
      return chain;
    }).then(function(){
      summary.finishedAt = now();
      summary.message = "Google Sheets → Base Local completado sin importar tablas técnicas ni generar reenvíos.";
      if(store() && typeof store().patchConfig === "function"){
        store().patchConfig({ sheets:{ connected:true,status:"ok",lastSyncAt:now(),lastError:"",lastPullPeriodId:period.id },bdlocal:{ connected:true,status:"ok",lastTestAt:now() } });
      }
      progress(100,summary.message);
      setStatus("bl2-google-status","Importado de forma segura: " + new Date().toLocaleString());
      log(summary.message,"ok",summary);
      if(window.BL2App && typeof window.BL2App.refresh === "function"){ return window.BL2App.refresh().catch(function(){ return null; }).then(function(){ return summary; }); }
      return summary;
    }).catch(function(error){
      if(store() && typeof store().updateConnectionStatus === "function"){ store().updateConnectionStatus("sheets",{ connected:false,status:"error",lastError:error.message || String(error) }); }
      progress(0,"Error al traer Google Sheets.");
      log(error.message || String(error),"error");
      throw error;
    }).finally(function(){ setBusy(false); resumeOutbound(); });
  }

  function selectAndPull(){
    return choosePeriod().then(function(period){
      if(!window.confirm("Google Sheets → Base Local\n\nPeríodo: " + period.label + "\n\nSe creará respaldo, no se marcarán retirados y se ignorarán tablas técnicas. ¿Continuar?")){
        return { ok:true,cancelled:true,message:"Operación cancelada." };
      }
      return pullSheetsToLocal(period);
    });
  }

  function forceFetchFirebaseConfig(){
    if(!store() || typeof store().restoreConfigFromFirebase !== "function"){ return Promise.reject(new Error("La restauración de configuración Firebase no está disponible.")); }
    if(manager() && typeof manager().setupFirebaseConfigAdapter === "function"){ try{ manager().setupFirebaseConfigAdapter(); }catch(error){} }
    return store().restoreConfigFromFirebase().then(function(result){
      if(!result || result.ok === false){ throw new Error(result && result.message || "Firebase no devolvió configuración."); }
      return syncSheetsConfigToBL2(store().getSheetsConfig({ includeSecret:true })).then(function(){ return { ok:true,message:"Configuración Firebase aplicada localmente." }; });
    });
  }

  function cleanSheetsDuplicates(){
    var cfg = requireSheetsConfig();
    return requestCompact(cfg).then(function(result){
      if(store() && typeof store().patchConfig === "function"){ store().patchConfig({ sheets:{ connected:true,status:"ok",lastSyncAt:now(),lastError:"" } }); }
      return Object.assign({ ok:true,message:"Duplicados de Google Sheets compactados." },result || {});
    });
  }

  function bindButton(name,handler){
    var button = byId(name);
    if(!button || button.__singleSafePullBound){ return; }
    button.__singleSafePullBound = true;
    button.setAttribute("data-cloud-pull-owner","safe");
    button.addEventListener("click",function(event){
      event.preventDefault();
      event.stopPropagation();
      if(typeof event.stopImmediatePropagation === "function"){ event.stopImmediatePropagation(); }
      handler().catch(function(error){
        if(error && error.message === "Operación cancelada."){ return; }
        log(error.message || String(error),"error");
        window.alert(error.message || String(error));
      });
    },true);
  }

  function bind(){
    bindButton("bl2-btn-pull-sheets",function(){ return selectAndPull().then(function(result){ if(result && !result.cancelled){ window.alert(result.message + "\n\nEstudiantes: " + result.totalEntrada + "\nGuardados: " + result.guardados + "\nActualizados: " + result.actualizados); } return result; }); });
    bindButton("bl2-btn-fetch-firebase-config",function(){ return forceFetchFirebaseConfig().then(function(result){ window.alert(result.message); return result; }); });
    bindButton("bl2-btn-clean-sheets-duplicates",function(){ if(!window.confirm("Compactar duplicados de Google Sheets sin borrar registros únicos. ¿Continuar?")){ return Promise.resolve({ cancelled:true }); } return cleanSheetsDuplicates().then(function(result){ window.alert(result.message); return result; }); });
  }

  window.BL2CloudPullSafe = {
    version:VERSION,
    singleImplementation:true,
    allowedTables:Object.keys(ALLOWED_TABLES),
    technicalTablesIgnored:Object.keys(TECHNICAL_TABLES),
    forceFetchFirebaseConfig:forceFetchFirebaseConfig,
    pullSheetsToLocal:pullSheetsToLocal,
    selectAndPull:selectAndPull,
    cleanSheetsDuplicates:cleanSheetsDuplicates,
    syncSheetsConfigToBL2:syncSheetsConfigToBL2,
    extractTables:extractTables,
    buildDivisions:buildDivisions,
    pauseGooglePush:pauseOutbound,
    resumeGooglePush:resumeOutbound,
    isPulling:isPulling,
    bind:bind
  };

  if(document.readyState === "loading"){ document.addEventListener("DOMContentLoaded",bind); }
  else{ bind(); }
})(window,document);
