/* =========================================================
Archivo: bdl.sync.target.firebase.js
Ruta: /BDLocal/sync/targets/bdl.sync.target.firebase.js
Función:
- Registrar destino Firebase para cambios_pendientes.
- Procesar solo notas_titulacion.
- Devolver processedIds para marcar solo lo enviado.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.1.0-block22";

  function text(v){ return String(v == null ? "" : v).trim(); }
  function now(){ return new Date().toISOString(); }
  function rowId(row){ return text(row && (row.id || row.cambioId)); }
  function payloadOf(row){ return Object.assign({}, row && row.payload ? row.payload : row || {}); }
  function isNotas(row){ return text(row && (row.tabla || row.tipo)).toLowerCase() === "notas_titulacion"; }

  function splitNotas(rows){
    rows = Array.isArray(rows) ? rows : [];
    return { rows: rows.filter(isNotas), skipped: rows.filter(function(row){ return !isNotas(row); }) };
  }

  function firebaseCollection(){
    var cfg = window.BL2Config && window.BL2Config.firebase ? window.BL2Config.firebase : {};
    return text(cfg.notasCollection || cfg.collectionNotas || "NotasTitulacion");
  }

  function toFirebaseNote(change){
    var nota = payloadOf(change);
    var idEP = text(nota.idEstudiantePeriodo || change.registroId || change.idEstudiantePeriodo);
    var periodoId = text(nota.periodoId || change.periodoId);
    var cedula = text(nota.cedula || change.cedula);
    return Object.assign({}, nota, {
      id: "notas_titulacion__" + idEP,
      idEstudiantePeriodo: idEP,
      periodoId: periodoId,
      cedula: cedula,
      source: "bdlocal",
      tableKey: "notas_titulacion",
      schemaVersion: "2",
      syncSource: "cambios_pendientes",
      syncTarget: "firebase",
      updatedAt: text(nota.updatedAt || change.updatedAt || now()),
      ultimaSincronizacion: now()
    });
  }

  function push(pendingRows){
    var group = splitNotas(pendingRows);
    var rows = group.rows;
    var skipped = group.skipped;

    if(!rows.length){
      return Promise.resolve({ ok:true, target:"firebase", outboxProcessed:false, partial:true, processedIds:[], skippedIds:skipped.map(rowId), message:"Firebase V2: no hay notas_titulacion para enviar." });
    }

    if(!window.BL2Sync || typeof window.BL2Sync.ensureFirebase !== "function"){
      return Promise.resolve({ ok:false, target:"firebase", outboxProcessed:false, message:"BL2Sync.ensureFirebase no disponible." });
    }

    return window.BL2Sync.ensureFirebase().then(function(firestore){
      var batch = firestore.batch();
      var collection = firebaseCollection();
      rows.forEach(function(change){
        var note = toFirebaseNote(change);
        batch.set(firestore.collection(collection).doc(note.id), note, { merge:true });
      });
      return batch.commit();
    }).then(function(response){
      return { ok:true, target:"firebase", outboxProcessed:false, partial:true, processedIds:rows.map(rowId), skippedIds:skipped.map(rowId), response:response || {}, message:"Firebase V2: " + rows.length + " nota(s) enviadas." };
    }).catch(function(error){
      return { ok:false, target:"firebase", outboxProcessed:false, message:error.message || String(error) };
    });
  }

  if(window.BDLSyncTargets && typeof window.BDLSyncTargets.register === "function"){
    window.BDLSyncTargets.register("firebase", { push:push, version:VERSION });
  }

  window.BDLSyncTargetFirebase = { version:VERSION, push:push };
})(window);
