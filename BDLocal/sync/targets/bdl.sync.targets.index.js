/* =========================================================
Archivo: bdl.sync.targets.index.js
Ruta: /BDLocal/sync/targets/bdl.sync.targets.index.js
Función:
- Crear el registro de destinos de sincronización.
- Registrar adaptador real Google Sheets para cambios_pendientes.
- Empezar controlado con tabla notas_titulacion.
- Devolver processedIds para marcar solo los cambios realmente enviados.
Con qué se conecta:
- BDLocal/sync/bdl.sync.index.js
- BDLocal/sync/bdl.sync.orchestrator.js
- BDLocal/sync/bdl.sync.outbox.js
- js/bdlocal-config/bdlocal-config.store.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.2.1-block19";
  var targets = Object.create(null);

  function text(value){ return String(value == null ? "" : value).trim(); }
  function now(){ return new Date().toISOString(); }

  function register(name, adapter){
    name = text(name).toLowerCase();
    if(!name || !adapter){ return false; }
    targets[name] = adapter;
    return true;
  }

  function get(name){ return targets[text(name).toLowerCase()] || null; }

  function postJson(url, payload, timeoutMs){
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? window.setTimeout(function(){ controller.abort(); }, timeoutMs || 60000) : null;
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
        try{ data = raw ? JSON.parse(raw) : {}; }catch(error){ data = { ok:response.ok, raw:raw }; }
        if(!response.ok){ throw new Error(data.message || data.error || ("HTTP " + response.status)); }
        if(data && data.ok === false){ throw new Error(data.message || data.error || "Apps Script respondió ok=false."); }
        return data;
      });
    }).catch(function(error){
      if(error && error.name === "AbortError"){ throw new Error("Tiempo agotado al enviar cambios_pendientes a Google Sheets."); }
      throw error;
    }).finally(function(){ if(timer){ window.clearTimeout(timer); } });
  }

  function sheetsConfig(){
    var store = window.BDLocalConfigStore || null;
    if(!store || typeof store.getSheetsConfig !== "function"){ throw new Error("BDLocalConfigStore no disponible."); }
    var config = store.getSheetsConfig({ includeSecret:true }) || {};
    var url = text(config.appsScriptUrl);
    var token = text(config.token);
    var spreadsheetId = text(config.spreadsheetId);
    if(!config.enabled){ throw new Error("Google Sheets está desactivado."); }
    if(!url){ throw new Error("Falta URL de Apps Script."); }
    if(!token){ throw new Error("Falta token de Apps Script."); }
    if(!spreadsheetId){ throw new Error("Falta spreadsheetId."); }
    return { store:store, config:config, url:url, token:token, spreadsheetId:spreadsheetId, sheetName:text(config.sheetName || "Requisitos") };
  }

  function rowId(row){ return text(row && (row.id || row.cambioId)); }
  function isNotas(row){ return text(row && (row.tabla || row.tipo)).toLowerCase() === "notas_titulacion"; }
  function payloadOf(row){ return Object.assign({}, row && row.payload ? row.payload : row || {}); }

  function googlePush(pendingRows, options){
    pendingRows = Array.isArray(pendingRows) ? pendingRows : [];
    options = options || {};
    var rows = pendingRows.filter(isNotas);
    var skipped = pendingRows.filter(function(row){ return !isNotas(row); });

    if(!rows.length){
      return Promise.resolve({ ok:true, target:"google", outboxProcessed:false, processedIds:[], skippedIds:skipped.map(rowId), message:"Google Sheets V2: no hay cambios notas_titulacion para enviar." });
    }

    var sheets;
    try{ sheets = sheetsConfig(); }catch(error){ return Promise.resolve({ ok:false, target:"google", message:error.message || String(error) }); }

    var notes = rows.map(payloadOf).map(function(nota){
      nota = Object.assign({}, nota || {});
      nota.syncSource = "cambios_pendientes";
      nota.syncTarget = "google_sheets";
      return nota;
    });

    var payload = {
      action:"sync_bl2",
      target:"google_sheets",
      source:options.source || "BDLSyncTargetsGoogleV2",
      schemaVersion:"2",
      mode:"changes_pendientes",
      table:"notas_titulacion",
      token:sheets.token,
      spreadsheetId:sheets.spreadsheetId,
      sheetName:sheets.sheetName,
      generatedAt:now(),
      changes:rows,
      tables:{ notas_titulacion:notes },
      meta:{ total:rows.length, skipped:skipped.length }
    };

    return postJson(sheets.url, payload, 60000).then(function(response){
      try{
        if(sheets.store && typeof sheets.store.patchConfig === "function"){
          sheets.store.patchConfig({ sheets:{ connected:true, status:"ok", lastSyncAt:now(), lastError:"" } });
        }
      }catch(error){}
      return {
        ok:true,
        target:"google",
        outboxProcessed:false,
        partial:true,
        processedIds:rows.map(rowId),
        skippedIds:skipped.map(rowId),
        response:response,
        message:"Google Sheets V2: " + rows.length + " nota(s) enviadas desde cambios_pendientes."
      };
    }).catch(function(error){
      try{
        if(sheets.store && typeof sheets.store.updateConnectionStatus === "function"){
          sheets.store.updateConnectionStatus("sheets", { connected:false, status:"error", lastError:error.message || String(error) });
        }
      }catch(e){}
      return { ok:false, target:"google", message:error.message || String(error), outboxProcessed:false };
    });
  }

  register("google", { push:googlePush });
  register("sheets", { push:googlePush });

  window.BDLSyncTargets = { version:VERSION, register:register, get:get, list:function(){ return Object.keys(targets); } };
})(window);
