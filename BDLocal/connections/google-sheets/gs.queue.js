/* =========================================================
Nombre completo: gs.queue.js
Ruta: /BDLocal/connections/google-sheets/gs.queue.js
Función:
- Mantener una cola local de eventos pendientes para Google Sheets.
- Enviar cambios poquito a poquito, sin bloquear BDLocal.
- Guardar intentos y errores para reintentar luego.
========================================================= */
(function(window){
  "use strict";

  var KEY = "REQ_GOOGLE_SHEETS_QUEUE_V1";
  var MAX_ITEMS = 5000;
  var MAX_SENT_KEEP = 300;

  function now(){ return new Date().toISOString(); }
  function txt(value){ return String(value == null ? "" : value).trim(); }
  function arr(value){ return Array.isArray(value) ? value : []; }
  function uid(){ return "gs_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9); }
  function json(value){ try{ return JSON.stringify(value); }catch(error){ return String(value); } }

  function read(){
    try{ return JSON.parse(window.localStorage.getItem(KEY) || "[]"); }
    catch(error){ return []; }
  }

  function write(items){
    items = arr(items);
    var sent = items.filter(function(item){ return item.status === "sent"; }).slice(-MAX_SENT_KEEP);
    var active = items.filter(function(item){ return item.status !== "sent"; });
    var finalItems = active.concat(sent).slice(-MAX_ITEMS);
    try{ window.localStorage.setItem(KEY, JSON.stringify(finalItems)); }catch(error){}
    return finalItems;
  }

  function normalizeRow(row){
    row = row || {};
    return {
      modulo: txt(row.modulo || row.tipo || row.module || "Requisitos"),
      accion: txt(row.accion || row.action || row.campo || row.dato || row.base || "cambio"),
      fecha: txt(row.fecha || row.createdAt || row.updatedAt || now()),
      usuario: txt(row.usuario || row.user || "Requisitos App"),
      datos: row.datos != null ? txt(row.datos) : json(row),
      estado: txt(row.estado || row.status || row.ok || row.prioridad || "pendiente")
    };
  }

  function enqueue(row, meta){
    meta = meta || {};
    var item = {
      id: meta.id || uid(),
      row: normalizeRow(row),
      status: "pending",
      attempts: 0,
      createdAt: now(),
      updatedAt: now(),
      nextTryAt: "",
      lastError: ""
    };
    var items = read();
    items.push(item);
    write(items);
    try{ window.dispatchEvent(new CustomEvent("googleSheets:queue-changed", { detail: counts() })); }catch(error){}
    return item;
  }

  function pending(limit){
    var n = Number(limit || 10);
    var current = now();
    return read().filter(function(item){
      if(item.status !== "pending" && item.status !== "error"){ return false; }
      if(item.nextTryAt && item.nextTryAt > current){ return false; }
      return true;
    }).slice(0, n);
  }

  function markSending(ids){
    ids = arr(ids);
    var map = Object.create(null);
    ids.forEach(function(id){ map[id] = true; });
    var items = read().map(function(item){
      if(map[item.id]){ item.status = "sending"; item.updatedAt = now(); }
      return item;
    });
    write(items);
    return counts();
  }

  function markSent(ids){
    ids = arr(ids);
    var map = Object.create(null);
    ids.forEach(function(id){ map[id] = true; });
    var items = read().map(function(item){
      if(map[item.id]){ item.status = "sent"; item.updatedAt = now(); item.lastError = ""; }
      return item;
    });
    write(items);
    try{ window.dispatchEvent(new CustomEvent("googleSheets:queue-changed", { detail: counts() })); }catch(error){}
    return counts();
  }

  function markError(ids, error){
    ids = arr(ids);
    var map = Object.create(null);
    ids.forEach(function(id){ map[id] = true; });
    var message = error && error.message ? error.message : String(error || "Error desconocido");
    var items = read().map(function(item){
      if(map[item.id]){
        item.status = "error";
        item.attempts = Number(item.attempts || 0) + 1;
        item.updatedAt = now();
        item.lastError = message;
        var wait = Math.min(30, Math.max(1, item.attempts)) * 60000;
        item.nextTryAt = new Date(Date.now() + wait).toISOString();
      }
      return item;
    });
    write(items);
    try{ window.dispatchEvent(new CustomEvent("googleSheets:queue-changed", { detail: counts() })); }catch(e){}
    return counts();
  }

  function resetSending(){
    var items = read().map(function(item){
      if(item.status === "sending"){ item.status = "pending"; item.updatedAt = now(); }
      return item;
    });
    write(items);
    return counts();
  }

  function counts(){
    var c = { total:0, pending:0, sending:0, sent:0, error:0 };
    read().forEach(function(item){ c.total += 1; c[item.status] = (c[item.status] || 0) + 1; });
    return c;
  }

  function clearSent(){
    var items = read().filter(function(item){ return item.status !== "sent"; });
    write(items);
    return counts();
  }

  function clearAll(){ write([]); return counts(); }
  function list(){ return read(); }

  window.BDLGoogleSheetsQueue = {
    storageKey: KEY,
    enqueue: enqueue,
    pending: pending,
    markSending: markSending,
    markSent: markSent,
    markError: markError,
    resetSending: resetSending,
    counts: counts,
    clearSent: clearSent,
    clearAll: clearAll,
    list: list,
    normalizeRow: normalizeRow
  };
})(window);
