/* =========================================================
Archivo: bdl.sync.target.firebase.js
Ruta: /BDLocal/sync/targets/bdl.sync.target.firebase.js
Funcion:
- Registrar destino Firebase para cambios_pendientes.
- Bloque 3: procesar cambios genericos en lotes pequenos.
- Devolver processedIds para marcar solo lo enviado.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.2.0-block3-generic-safe";

  function text(v){ return String(v == null ? "" : v).trim(); }
  function now(){ return new Date().toISOString(); }
  function rowId(row){ return text(row && (row.id || row.cambioId)); }
  function tableOf(row){ return text(row && (row.tabla || row.table || row.tipo || row.tableKey || "registro")).toLowerCase() || "registro"; }
  function payloadOf(row){ return Object.assign({}, row && row.payload ? row.payload : row || {}); }
  function safeRows(rows, options){
    rows = Array.isArray(rows) ? rows : [];
    options = options || {};
    var limit = Number(options.limit || options.batchSize || 25);
    if(!Number.isFinite(limit) || limit <= 0){ limit = 25; }
    return rows.slice(0, Math.max(1, Math.min(50, Math.floor(limit))));
  }
  function firebaseCollection(){
    var cfg = window.BL2Config && window.BL2Config.firebase ? window.BL2Config.firebase : {};
    return text(cfg.outboxCollection || cfg.syncCollection || "BDLocalCambios");
  }
  function toFirebaseRecord(change){
    var payload = payloadOf(change);
    var table = tableOf(change);
    var recordKey = text(change.registroId || payload.idEstudiantePeriodo || payload.id || change.studentId || change.cedula || rowId(change));
    return {
      id: rowId(change) || (table + "__" + recordKey),
      changeId: rowId(change),
      recordKey: recordKey,
      tableKey: table,
      periodoId: text(payload.periodoId || change.periodoId),
      cedula: text(payload.cedula || change.cedula),
      action: text(change.accion || change.action || "UPSERT"),
      source: "bdlocal",
      schemaVersion: text(change.schemaVersion || "2"),
      syncSource: "cambios_pendientes",
      syncTarget: "firebase",
      payload: payload,
      updatedAt: text(payload.updatedAt || change.updatedAt || now()),
      ultimaSincronizacion: now()
    };
  }
  function push(pendingRows, options){
    options = options || {};
    var rows = safeRows(pendingRows, options);
    if(!rows.length){
      return Promise.resolve({ ok:true, target:"firebase", outboxProcessed:false, processedIds:[], message:"Firebase V2: no hay cambios para enviar." });
    }
    if(!window.BL2Sync || typeof window.BL2Sync.ensureFirebase !== "function"){
      return Promise.resolve({ ok:false, target:"firebase", outboxProcessed:false, message:"BL2Sync.ensureFirebase no disponible." });
    }
    return window.BL2Sync.ensureFirebase().then(function(firestore){
      var batch = firestore.batch();
      var collection = firebaseCollection();
      rows.forEach(function(change){
        var record = toFirebaseRecord(change);
        batch.set(firestore.collection(collection).doc(record.id), record, { merge:true });
      });
      return batch.commit();
    }).then(function(response){
      return { ok:true, target:"firebase", outboxProcessed:false, partial:true, processedIds:rows.map(rowId), response:response || {}, message:"Firebase V2: " + rows.length + " cambio(s) enviados." };
    }).catch(function(error){
      return { ok:false, target:"firebase", outboxProcessed:false, message:error.message || String(error) };
    });
  }

  if(window.BDLSyncTargets && typeof window.BDLSyncTargets.register === "function"){
    window.BDLSyncTargets.register("firebase", { push:push, version:VERSION });
  }

  window.BDLSyncTargetFirebase = { version:VERSION, push:push, safeRows:safeRows };
})(window);
