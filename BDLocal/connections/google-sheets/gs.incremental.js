/* =========================================================
Nombre completo: gs.incremental.js
Ruta: /BDLocal/connections/google-sheets/gs.incremental.js
Función:
- Sincronizar Google Sheets en segundo plano de forma lenta e incremental.
- Escuchar cambios importantes de BDLocal y encolarlos.
- Enviar pocos registros por lote para no saturar Apps Script.
========================================================= */
(function(window){
  "use strict";

  var DEFAULT_INTERVAL_MS = 45000;
  var DEFAULT_BATCH_SIZE = 10;
  var timer = null;
  var running = false;
  var lastResult = null;

  function now(){ return new Date().toISOString(); }
  function txt(value){ return String(value == null ? "" : value).trim(); }
  function queue(){ return window.BDLGoogleSheetsQueue; }
  function cfg(){ return window.BDLGoogleSheetsConfig; }

  function isReady(){
    return !!(queue() && cfg() && cfg().isEnabled && cfg().isEnabled() && cfg().webAppUrl && cfg().webAppUrl());
  }

  function enqueue(row, meta){
    if(!queue()){ return null; }
    return queue().enqueue(row, meta || {});
  }

  function enqueueSystem(action, detail, status){
    detail = detail || {};
    return enqueue({
      modulo: "BDLocal",
      accion: action || "evento",
      fecha: detail.at || detail.updatedAt || detail.createdAt || now(),
      usuario: "Requisitos App",
      datos: JSON.stringify(detail),
      estado: status || detail.status || "pendiente"
    });
  }

  function sendRows(rows, ids){
    var url = cfg() && cfg().webAppUrl ? cfg().webAppUrl() : "";
    if(!url){ return Promise.reject(new Error("Google Sheets no tiene Web App URL configurada.")); }
    return fetch(url, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({
        source: "Requisitos BL incremental",
        createdAt: now(),
        mode: "incremental",
        rows: rows
      })
    }).then(function(res){
      return res.text().then(function(body){
        if(!res.ok){ throw new Error(body || ("Google Sheets error " + res.status)); }
        return { ok:true, rows:rows.length, ids:ids, response:body, at:now() };
      });
    });
  }

  function flush(options){
    options = options || {};
    if(running){ return Promise.resolve({ ok:false, skipped:true, reason:"google_sheets_running", counts:queue() ? queue().counts() : {} }); }
    if(!queue()){ return Promise.resolve({ ok:false, skipped:true, reason:"google_sheets_queue_missing" }); }
    if(!isReady() && !options.force){
      return Promise.resolve({ ok:false, skipped:true, reason:"google_sheets_no_configurado", counts:queue().counts() });
    }
    var batch = queue().pending(options.limit || DEFAULT_BATCH_SIZE);
    if(!batch.length){
      lastResult = { ok:true, skipped:true, reason:"sin_pendientes", counts:queue().counts(), at:now() };
      return Promise.resolve(lastResult);
    }
    running = true;
    var ids = batch.map(function(item){ return item.id; });
    var rows = batch.map(function(item){ return item.row; });
    queue().markSending(ids);
    return sendRows(rows, ids).then(function(result){
      queue().markSent(ids);
      running = false;
      lastResult = Object.assign({}, result, { counts:queue().counts() });
      try{ window.dispatchEvent(new CustomEvent("googleSheets:sent", { detail:lastResult })); }catch(error){}
      return lastResult;
    }).catch(function(error){
      queue().markError(ids, error);
      running = false;
      lastResult = { ok:false, error:error && error.message ? error.message : String(error), rows:rows.length, counts:queue().counts(), at:now() };
      return lastResult;
    });
  }

  function tick(){
    if(!isReady()){ return; }
    flush({ limit: DEFAULT_BATCH_SIZE }).then(function(result){
      if(result && !result.skipped){ console.log("[Google Sheets incremental]", result); }
    });
  }

  function start(){
    if(timer){ return status(); }
    if(queue()){ queue().resetSending(); }
    timer = window.setInterval(tick, DEFAULT_INTERVAL_MS);
    window.setTimeout(tick, 3000);
    return status();
  }

  function stop(){
    if(timer){ window.clearInterval(timer); timer = null; }
    return status();
  }

  function status(){
    return {
      ok:true,
      enabled:!!(cfg() && cfg().isEnabled && cfg().isEnabled()),
      configured:!!(cfg() && cfg().webAppUrl && cfg().webAppUrl()),
      running:running,
      intervalMs:DEFAULT_INTERVAL_MS,
      batchSize:DEFAULT_BATCH_SIZE,
      counts:queue() ? queue().counts() : {},
      last:lastResult
    };
  }

  function bindEvents(){
    window.addEventListener("bdlocal:legacy-snapshot", function(ev){
      enqueueSystem("snapshot_actualizado", ev.detail || {}, "pendiente");
      window.setTimeout(tick, 1500);
    });
    window.addEventListener("bdlocal:continuity-event", function(ev){
      var d = ev.detail || {};
      enqueue({
        modulo: "Continuidad",
        accion: d.tipoDato || d.campo || "evento_continuidad",
        fecha: d.createdAt || now(),
        usuario: "Requisitos App",
        datos: JSON.stringify(d),
        estado: d.prioridad || "pendiente"
      });
      window.setTimeout(tick, 1500);
    });
    window.addEventListener("bdlocal:connection-settings-changed", function(ev){
      enqueueSystem("ajuste_conexion", ev.detail || {}, "registrado");
      if(ev.detail && ev.detail.id === "googleSheets"){ window.setTimeout(tick, 1000); }
    });
    window.addEventListener("bdlocal:sync-status", function(ev){
      var d = ev.detail || {};
      enqueueSystem("sincronizacion_" + (d.status || "estado"), d, d.status || "registrado");
    });
  }

  bindEvents();
  window.setTimeout(start, 2000);

  window.BDLGoogleSheetsIncremental = {
    enqueue: enqueue,
    enqueueSystem: enqueueSystem,
    flush: flush,
    start: start,
    stop: stop,
    status: status,
    tick: tick
  };
})(window);
