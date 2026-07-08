/* =========================================================
Archivo: bdl.changes.outbox-bridge.js
Ruta: /BDLocal/patches/bdl.changes.outbox-bridge.js
Funcion:
- Mantener una sola cola real de sincronizacion: cambios_pendientes.
- Si codigo legacy guarda en cambios, se conserva ese guardado y se espeja a cambios_pendientes.
- No rompe pantallas antiguas que todavia leen cambios.
- No bloquea la app si el espejo falla; solo deja advertencia en consola.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.0";
  var FLAG = "__bdlOutboxBridgeInstalled";

  if(window[FLAG]){ return; }
  window[FLAG] = true;

  function text(value){ return String(value == null ? "" : value).trim(); }
  function nowISO(){ return new Date().toISOString(); }
  function clone(value){
    if(value === undefined){ return undefined; }
    try{ return JSON.parse(JSON.stringify(value)); }
    catch(error){ return value; }
  }

  function cfgStores(){
    var cfg = window.BL2Config || {};
    var stores = cfg.stores || {};
    return {
      legacy: stores.cambios || "cambios",
      outbox: stores.cambiosPendientes || "cambios_pendientes"
    };
  }

  function fallbackId(row){
    row = row || {};
    return [
      text(row.tabla || row.tipo || "registro"),
      text(row.accion || row.action || "UPSERT"),
      text(row.periodoId || "global"),
      text(row.cedula || row.registroId || row.idEstudiantePeriodo || row.studentId || "sin_id"),
      Date.now(),
      Math.random().toString(16).slice(2)
    ].join("__");
  }

  function normalizeForOutbox(row, options){
    row = Object.assign({}, clone(row || {}));
    options = options || {};

    try{
      if(window.BDLRulesSync && typeof window.BDLRulesSync.build === "function"){
        row = window.BDLRulesSync.build(row, Object.assign({ source:"outbox_bridge" }, options));
      }
    }catch(error){}

    row.id = text(row.id || row.cambioId || fallbackId(row));
    row.cambioId = text(row.cambioId || row.id);
    row.createdAt = text(row.createdAt) || nowISO();
    row.updatedAt = text(row.updatedAt) || nowISO();

    if(!text(row.estadoSheets || row.statusGoogle)){
      row.estadoSheets = "PENDIENTE";
      row.statusGoogle = "PENDIENTE";
    }

    if(!text(row.estadoFirebase || row.statusFirebase)){
      row.estadoFirebase = "PENDIENTE";
      row.statusFirebase = "PENDIENTE";
    }

    if(!text(row.estadoSupabase || row.statusSupabase)){
      row.estadoSupabase = "PENDIENTE";
      row.statusSupabase = "PENDIENTE";
    }

    row.outboxBridge = true;
    row.outboxBridgeVersion = VERSION;
    return row;
  }

  function install(){
    var db = window.BL2DB || null;
    if(!db || typeof db.put !== "function" || typeof db.bulkPut !== "function"){
      return false;
    }

    if(db.__outboxBridgeInstalled){ return true; }

    var originalPut = db.put.bind(db);
    var originalBulkPut = db.bulkPut.bind(db);

    db.put = function(storeName, value){
      var stores = cfgStores();
      if(text(storeName) !== stores.legacy){
        return originalPut(storeName, value);
      }

      return originalPut(storeName, value).then(function(saved){
        var outboxRow = normalizeForOutbox(saved || value, { mode:"put" });
        return originalPut(stores.outbox, outboxRow).catch(function(error){
          try{ console.warn("[BDLOutboxBridge] No se pudo espejar cambio a cambios_pendientes", error); }catch(innerError){}
          return null;
        }).then(function(){
          try{
            window.dispatchEvent(new CustomEvent("bdlocal:outbox-bridged", {
              detail:{ id:outboxRow.id, store:stores.outbox, at:nowISO() }
            }));
          }catch(eventError){}
          return saved;
        });
      });
    };

    db.bulkPut = function(storeName, rows){
      var stores = cfgStores();
      rows = Array.isArray(rows) ? rows : [];
      if(text(storeName) !== stores.legacy || !rows.length){
        return originalBulkPut(storeName, rows);
      }

      return originalBulkPut(storeName, rows).then(function(saved){
        var sourceRows = Array.isArray(saved) && saved.length ? saved : rows;
        var outboxRows = sourceRows.map(function(row){ return normalizeForOutbox(row, { mode:"bulkPut" }); });
        return originalBulkPut(stores.outbox, outboxRows).catch(function(error){
          try{ console.warn("[BDLOutboxBridge] No se pudo espejar lote a cambios_pendientes", error); }catch(innerError){}
          return [];
        }).then(function(){ return saved; });
      });
    };

    db.__outboxBridgeInstalled = true;
    db.outboxBridgeVersion = VERSION;

    try{
      window.dispatchEvent(new CustomEvent("bdlocal:outbox-bridge-ready", {
        detail:{ version:VERSION, legacy:cfgStores().legacy, outbox:cfgStores().outbox, at:nowISO() }
      }));
    }catch(error){}

    return true;
  }

  window.BDLOutboxBridge = {
    version: VERSION,
    install: install,
    normalizeForOutbox: normalizeForOutbox
  };

  install();
})(window);
