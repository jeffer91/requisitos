/* =========================================================
Nombre completo: bl2-firebase-push.js
Ruta o ubicación: /Requisitos/BaseLocal2/sync/bl2-firebase-push.js
Función o funciones:
- Subir a Firebase solo cambios pendientes de la cola BL2.
- Usar IndexedDB queue si está disponible.
- Evitar reconstruir snapshots completos para decidir qué subir.
- Marcar enviados o errores por elemento.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.1-incremental-queue";
  function tx(v){return String(v == null ? "" : v).trim();}
  function now(){return new Date().toISOString();}
  function clone(v){try{return JSON.parse(JSON.stringify(v == null ? null : v));}catch(e){return v;}}
  function q(){if(!window.BL2SyncQueue){throw new Error("BL2SyncQueue no disponible.");}return window.BL2SyncQueue;}
  function clean(row){var r = clone(row || {}) || {};Object.keys(r).forEach(function(k){if(k.charAt(0) === "_"){delete r[k];}});r.updatedAt = r.updatedAt || now();r.ultimaSincronizacion = now();return r;}
  function docId(row){row = row || {};if(q() && typeof q().firestoreStudentId === "function"){return q().firestoreStudentId(row);}var id = tx(row.cedula || row.numeroIdentificacion || row.Cedula || row.docId || row._docId || row.id);var m = id.match(/^(\d{7,13})/);return m ? m[1] : id;}
  async function commitInChunks(db,writes){var size = 450;for(var i=0;i<writes.length;i+=size){var batch = db.batch();writes.slice(i,i+size).forEach(function(x){batch.set(x.ref, x.data, {merge:true});});await batch.commit();}}
  function patchStudent(row,helpers){helpers = helpers || {};if(helpers.controlledStudentPatch){return helpers.controlledStudentPatch(row);}var r = clean(row);var id = docId(r);if(id){r.cedula = id;r.numeroIdentificacion = r.numeroIdentificacion || id;}return r;}
  async function seedIfNeeded(snapshot,opt){opt = opt || {};var pending = q().pendingAsync ? await q().pendingAsync() : q().pending();if(pending.length && !opt.forceSeed){return pending;}if(!snapshot){return pending;}if(q().enqueueSnapshotChangesAsync){await q().enqueueSnapshotChangesAsync(snapshot,{source:opt.source || "firebase_incremental", since:opt.since});}else{q().enqueueSnapshotChanges(snapshot,{source:opt.source || "firebase_incremental", since:opt.since});}return q().pendingAsync ? await q().pendingAsync() : q().pending();}
  async function markDone(ids){if(q().markDoneAsync){return q().markDoneAsync(ids);}return q().markDone(ids);}
  async function markError(id,error){if(q().markErrorAsync){return q().markErrorAsync(id,error);}return q().markError(id,error);}
  async function pushQueue(db,snapshot,opt){
    opt = opt || {};
    var pending = await seedIfNeeded(snapshot,opt);
    if(!pending.length){q().saveState({lastPushAt:now(),lastSyncAt:now(),pending:0});return {ok:true,mode:"push_incremental",pushed:0,message:"No hay cambios pendientes para subir."};}
    var writes = [], ids = [], invalid = [];
    pending.forEach(function(item){
      try{
        if(item.entity === "periodo"){
          var pid = tx(item.entityId || q().rowId(item.data,"periodo"));
          if(pid){writes.push({ref:db.collection("periodos").doc(pid), data:clean(item.data)});ids.push(item.id);}else{invalid.push(item);}
        }else if(item.entity === "estudiante"){
          var sid = tx(item.firestoreId || docId(item.data) || item.entityId);
          if(sid){writes.push({ref:db.collection("Estudiantes").doc(sid), data:patchStudent(item.data,opt)});ids.push(item.id);}else{invalid.push(item);}
        }
      }catch(error){invalid.push(Object.assign({}, item, {_error:error}));}
    });
    for(var i=0;i<invalid.length;i+=1){await markError(invalid[i].id, invalid[i]._error || new Error("Cambio inválido para Firebase"));}
    if(!writes.length){return {ok:true,mode:"push_incremental",pushed:0,message:"No se encontraron cambios válidos."};}
    try{
      await (opt.commitInChunks || commitInChunks)(db,writes);
      await markDone(ids);
      var pendingLeft = q().pendingAsync ? (await q().pendingAsync()).length : q().pending().length;
      return {ok:true,mode:"push_incremental",pushed:writes.length,pending:pendingLeft,message:"Cambios incrementales subidos a Firebase: " + writes.length + "."};
    }catch(error){
      for(var j=0;j<ids.length;j+=1){await markError(ids[j], error);}
      throw error;
    }
  }
  function status(){return {ok:true,mode:"firebase_push_incremental",version:VERSION,queue:window.BL2SyncQueue ? window.BL2SyncQueue.status() : null,updatedAt:now()};}
  window.BL2FirebasePush = {version:VERSION,pushQueue:pushQueue,status:status};
})(window);
