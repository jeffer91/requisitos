/* =========================================================
Archivo: bdl.sync.targets.index.js
Ruta: /BDLocal/sync/targets/bdl.sync.targets.index.js
Función:
- Registro de destinos de sincronización.
- Adaptador Google Sheets para cambios_pendientes genéricos.
- Adaptador Supabase para cambios_pendientes genéricos.
- Devolver processedIds para marcar solo cambios enviados.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.4.0-generic-outbox";
  var targets = Object.create(null);

  function text(v){ return String(v == null ? "" : v).trim(); }
  function now(){ return new Date().toISOString(); }
  function store(){ return window.BDLocalConfigStore || null; }
  function rowId(row){ return text(row && (row.id || row.cambioId)); }
  function tableOf(row){ return text(row && (row.tabla || row.tipo || row.tableKey || "registro")).toLowerCase() || "registro"; }
  function payloadOf(row){ return Object.assign({}, row && row.payload ? row.payload : row || {}); }

  function register(name, adapter){ name = text(name).toLowerCase(); if(!name || !adapter){ return false; } targets[name] = adapter; return true; }
  function get(name){ return targets[text(name).toLowerCase()] || null; }

  function groupByTable(rows){
    var grouped = {};
    (Array.isArray(rows) ? rows : []).forEach(function(row){
      var table = tableOf(row);
      if(!grouped[table]){ grouped[table] = []; }
      grouped[table].push(row);
    });
    return grouped;
  }

  function fetchJson(url, options, timeoutMs){
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? window.setTimeout(function(){ controller.abort(); }, timeoutMs || 60000) : null;
    options = options || {};
    if(controller){ options.signal = controller.signal; }
    return fetch(url, options).then(function(response){
      return response.text().then(function(raw){
        var data = {};
        try{ data = raw ? JSON.parse(raw) : {}; }catch(error){ data = { ok:response.ok, raw:raw }; }
        if(!response.ok){ throw new Error(data.message || data.error || ("HTTP " + response.status)); }
        if(data && data.ok === false){ throw new Error(data.message || data.error || "Respuesta ok=false."); }
        return data;
      });
    }).catch(function(error){
      if(error && error.name === "AbortError"){ throw new Error("Tiempo agotado en sincronización externa."); }
      throw error;
    }).finally(function(){ if(timer){ window.clearTimeout(timer); } });
  }

  function sheetsConfig(){
    var s = store();
    if(!s || typeof s.getSheetsConfig !== "function"){ throw new Error("BDLocalConfigStore no disponible."); }
    var c = s.getSheetsConfig({ includeSecret:true }) || {};
    if(!c.enabled){ throw new Error("Google Sheets está desactivado."); }
    if(!text(c.appsScriptUrl)){ throw new Error("Falta URL de Apps Script."); }
    if(!text(c.token)){ throw new Error("Falta token de Apps Script."); }
    if(!text(c.spreadsheetId)){ throw new Error("Falta spreadsheetId."); }
    return { store:s, url:text(c.appsScriptUrl), token:text(c.token), spreadsheetId:text(c.spreadsheetId), sheetName:text(c.sheetName || "Requisitos") };
  }

  function buildSheetsTables(rows){
    var grouped = groupByTable(rows);
    var tables = {};
    Object.keys(grouped).forEach(function(table){
      tables[table] = grouped[table].map(function(change){
        var payload = payloadOf(change);
        payload.syncSource = "cambios_pendientes";
        payload.syncTarget = "google_sheets";
        payload.tableKey = table;
        payload.changeId = rowId(change);
        return payload;
      });
    });
    return tables;
  }

  function googlePush(pendingRows, options){
    var rows = Array.isArray(pendingRows) ? pendingRows : [];
    options = options || {};
    if(!rows.length){ return Promise.resolve({ ok:true, target:"google", outboxProcessed:false, partial:true, processedIds:[], message:"Google Sheets V2: no hay cambios para enviar." }); }

    var sheets;
    try{ sheets = sheetsConfig(); }catch(error){ return Promise.resolve({ ok:false, target:"google", message:error.message || String(error), outboxProcessed:false }); }

    var tables = buildSheetsTables(rows);
    var payload = { action:"sync_bl2", target:"google_sheets", source:options.source || "BDLSyncTargetsGoogleV2", schemaVersion:"2", mode:"changes_pendientes", token:sheets.token, spreadsheetId:sheets.spreadsheetId, sheetName:sheets.sheetName, generatedAt:now(), changes:rows, tables:tables, meta:{ total:rows.length, tables:Object.keys(tables) } };

    return fetchJson(sheets.url, { method:"POST", mode:"cors", redirect:"follow", headers:{ "Content-Type":"text/plain;charset=utf-8" }, body:JSON.stringify(payload) }, 60000).then(function(response){
      try{ if(sheets.store && typeof sheets.store.patchConfig === "function"){ sheets.store.patchConfig({ sheets:{ connected:true, status:"ok", lastSyncAt:now(), lastError:"" } }); } }catch(error){}
      return { ok:true, target:"google", outboxProcessed:false, partial:true, processedIds:rows.map(rowId), response:response, message:"Google Sheets V2: " + rows.length + " cambio(s) enviados." };
    }).catch(function(error){
      try{ if(sheets.store && typeof sheets.store.updateConnectionStatus === "function"){ sheets.store.updateConnectionStatus("sheets", { connected:false, status:"error", lastError:error.message || String(error) }); } }catch(e){}
      return { ok:false, target:"google", message:error.message || String(error), outboxProcessed:false };
    });
  }

  function supabaseConfig(){
    var s = store();
    if(!s || typeof s.getSupabaseConfig !== "function"){ throw new Error("BDLocalConfigStore no disponible."); }
    var c = s.getSupabaseConfig({ includeSecret:true }) || {};
    var url = text(c.url).replace(/\/$/, "");
    var key = text(c.anonKey);
    var table = text(c.tableName || "app_records");
    if(table === "requisitos_estudiantes"){ table = "app_records"; }
    if(!c.enabled){ throw new Error("Supabase está desactivado."); }
    if(!url){ throw new Error("Falta URL de Supabase."); }
    if(!key){ throw new Error("Falta anonKey de Supabase."); }
    return { store:s, url:url, key:key, table:table };
  }

  function toSupabaseRecord(change){
    var payload = payloadOf(change);
    var table = tableOf(change);
    var recordKey = text(change.registroId || payload.idEstudiantePeriodo || payload.id || change.studentId || change.cedula || rowId(change));
    var periodoId = text(payload.periodoId || change.periodoId);
    var cedula = text(payload.cedula || change.cedula);
    return { id:table + "__" + recordKey, module_key:"requisitos", table_key:table, record_key:recordKey, periodo_id:periodoId, estudiante_id:text(payload.idEstudiantePeriodo || change.studentId || recordKey), source:"bdlocal", sync_status:"sincronizado", schema_version:text(change.schemaVersion || "2"), payload:Object.assign({}, payload, { recordKey:recordKey, periodoId:periodoId, cedula:cedula, syncSource:"cambios_pendientes", syncTarget:"supabase", changeId:rowId(change), action:text(change.accion || change.action || "UPSERT"), updatedAt:text(payload.updatedAt || change.updatedAt || now()) }) };
  }

  function supabasePush(pendingRows){
    var rows = Array.isArray(pendingRows) ? pendingRows : [];
    if(!rows.length){ return Promise.resolve({ ok:true, target:"supabase", outboxProcessed:false, partial:true, processedIds:[], message:"Supabase V2: no hay cambios para enviar." }); }

    var sb;
    try{ sb = supabaseConfig(); }catch(error){ return Promise.resolve({ ok:false, target:"supabase", message:error.message || String(error), outboxProcessed:false }); }

    var headers = { apikey:sb.key, "Content-Type":"application/json", Prefer:"resolution=merge-duplicates,return=minimal" };
    headers.Authorization = "Bearer " + sb.key;
    var endpoint = sb.url + "/rest/v1/" + encodeURIComponent(sb.table) + "?on_conflict=id";

    return fetchJson(endpoint, { method:"POST", mode:"cors", headers:headers, body:JSON.stringify(rows.map(toSupabaseRecord)) }, 60000).then(function(response){
      try{ if(sb.store && typeof sb.store.patchConfig === "function"){ sb.store.patchConfig({ supabase:{ tableName:sb.table, connected:true, status:"ok", lastSyncAt:now(), lastError:"" } }); } }catch(error){}
      return { ok:true, target:"supabase", outboxProcessed:false, partial:true, processedIds:rows.map(rowId), response:response, message:"Supabase V2: " + rows.length + " cambio(s) enviados." };
    }).catch(function(error){
      try{ if(sb.store && typeof sb.store.updateConnectionStatus === "function"){ sb.store.updateConnectionStatus("supabase", { connected:false, status:"error", lastError:error.message || String(error) }); } }catch(e){}
      return { ok:false, target:"supabase", message:error.message || String(error), outboxProcessed:false };
    });
  }

  register("google", { push:googlePush, version:VERSION });
  register("sheets", { push:googlePush, version:VERSION });
  register("supabase", { push:supabasePush, version:VERSION });

  window.BDLSyncTargets = { version:VERSION, register:register, get:get, list:function(){ return Object.keys(targets); }, groupByTable:groupByTable };
})(window);