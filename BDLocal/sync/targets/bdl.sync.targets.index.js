/* =========================================================
Archivo: bdl.sync.targets.index.js
Ruta: /BDLocal/sync/targets/bdl.sync.targets.index.js
Función:
- Registro de destinos de sincronización.
- Adaptador Google Sheets para cambios_pendientes/notas_titulacion.
- Adaptador Supabase para cambios_pendientes/notas_titulacion.
- Devolver processedIds para marcar solo cambios enviados.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.3.0-block20";
  var targets = Object.create(null);

  function text(v){ return String(v == null ? "" : v).trim(); }
  function now(){ return new Date().toISOString(); }
  function store(){ return window.BDLocalConfigStore || null; }
  function rowId(row){ return text(row && (row.id || row.cambioId)); }
  function isNotas(row){ return text(row && (row.tabla || row.tipo)).toLowerCase() === "notas_titulacion"; }
  function payloadOf(row){ return Object.assign({}, row && row.payload ? row.payload : row || {}); }

  function register(name, adapter){ name = text(name).toLowerCase(); if(!name || !adapter){ return false; } targets[name] = adapter; return true; }
  function get(name){ return targets[text(name).toLowerCase()] || null; }
  function splitNotas(rows){ rows = Array.isArray(rows) ? rows : []; return { rows:rows.filter(isNotas), skipped:rows.filter(function(row){ return !isNotas(row); }) }; }

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

  function googlePush(pendingRows, options){
    var group = splitNotas(pendingRows);
    var rows = group.rows;
    var skipped = group.skipped;
    options = options || {};
    if(!rows.length){ return Promise.resolve({ ok:true, target:"google", outboxProcessed:false, partial:true, processedIds:[], skippedIds:skipped.map(rowId), message:"Google Sheets V2: no hay notas_titulacion para enviar." }); }

    var sheets;
    try{ sheets = sheetsConfig(); }catch(error){ return Promise.resolve({ ok:false, target:"google", message:error.message || String(error), outboxProcessed:false }); }

    var notes = rows.map(payloadOf).map(function(nota){ nota.syncSource = "cambios_pendientes"; nota.syncTarget = "google_sheets"; return nota; });
    var payload = { action:"sync_bl2", target:"google_sheets", source:options.source || "BDLSyncTargetsGoogleV2", schemaVersion:"2", mode:"changes_pendientes", table:"notas_titulacion", token:sheets.token, spreadsheetId:sheets.spreadsheetId, sheetName:sheets.sheetName, generatedAt:now(), changes:rows, tables:{ notas_titulacion:notes }, meta:{ total:rows.length, skipped:skipped.length } };

    return fetchJson(sheets.url, { method:"POST", mode:"cors", redirect:"follow", headers:{ "Content-Type":"text/plain;charset=utf-8" }, body:JSON.stringify(payload) }, 60000).then(function(response){
      try{ if(sheets.store && typeof sheets.store.patchConfig === "function"){ sheets.store.patchConfig({ sheets:{ connected:true, status:"ok", lastSyncAt:now(), lastError:"" } }); } }catch(error){}
      return { ok:true, target:"google", outboxProcessed:false, partial:true, processedIds:rows.map(rowId), skippedIds:skipped.map(rowId), response:response, message:"Google Sheets V2: " + rows.length + " nota(s) enviadas." };
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
    var nota = payloadOf(change);
    var idEP = text(nota.idEstudiantePeriodo || change.registroId || change.idEstudiantePeriodo);
    var periodoId = text(nota.periodoId || change.periodoId);
    var cedula = text(nota.cedula || change.cedula);
    return { id:"notas_titulacion__" + idEP, module_key:"requisitos", table_key:"notas_titulacion", record_key:idEP, periodo_id:periodoId, estudiante_id:idEP, source:"bdlocal", sync_status:"sincronizado", schema_version:"2", payload:Object.assign({}, nota, { idEstudiantePeriodo:idEP, periodoId:periodoId, cedula:cedula, syncSource:"cambios_pendientes", syncTarget:"supabase", updatedAt:text(nota.updatedAt || change.updatedAt || now()) }) };
  }

  function supabasePush(pendingRows){
    var group = splitNotas(pendingRows);
    var rows = group.rows;
    var skipped = group.skipped;
    if(!rows.length){ return Promise.resolve({ ok:true, target:"supabase", outboxProcessed:false, partial:true, processedIds:[], skippedIds:skipped.map(rowId), message:"Supabase V2: no hay notas_titulacion para enviar." }); }

    var sb;
    try{ sb = supabaseConfig(); }catch(error){ return Promise.resolve({ ok:false, target:"supabase", message:error.message || String(error), outboxProcessed:false }); }

    var headers = { apikey:sb.key, "Content-Type":"application/json", Prefer:"resolution=merge-duplicates,return=minimal" };
    headers.Authorization = "Bearer " + sb.key;
    var endpoint = sb.url + "/rest/v1/" + encodeURIComponent(sb.table) + "?on_conflict=id";

    return fetchJson(endpoint, { method:"POST", mode:"cors", headers:headers, body:JSON.stringify(rows.map(toSupabaseRecord)) }, 60000).then(function(response){
      try{ if(sb.store && typeof sb.store.patchConfig === "function"){ sb.store.patchConfig({ supabase:{ tableName:sb.table, connected:true, status:"ok", lastSyncAt:now(), lastError:"" } }); } }catch(error){}
      return { ok:true, target:"supabase", outboxProcessed:false, partial:true, processedIds:rows.map(rowId), skippedIds:skipped.map(rowId), response:response, message:"Supabase V2: " + rows.length + " nota(s) enviadas." };
    }).catch(function(error){
      try{ if(sb.store && typeof sb.store.updateConnectionStatus === "function"){ sb.store.updateConnectionStatus("supabase", { connected:false, status:"error", lastError:error.message || String(error) }); } }catch(e){}
      return { ok:false, target:"supabase", message:error.message || String(error), outboxProcessed:false };
    });
  }

  register("google", { push:googlePush });
  register("sheets", { push:googlePush });
  register("supabase", { push:supabasePush });

  window.BDLSyncTargets = { version:VERSION, register:register, get:get, list:function(){ return Object.keys(targets); } };
})(window);
