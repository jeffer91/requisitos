/* =========================================================
Nombre completo: bl2-sync-queue.js
Ruta o ubicación: /Requisitos/BaseLocal2/sync/bl2-sync-queue.js
Función o funciones:
- Guardar cola de sincronización en IndexedDB cuando BL2Storage esté disponible.
- Mantener localStorage solo como respaldo y espejo liviano.
- Encolar cambios por estudiante/período sin reescribir snapshots completos.
- Marcar enviados, errores y pendientes por lote.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.1-indexeddb-queue";
  var Q = "REQ_BL2_SYNC_QUEUE_V1";
  var S = "REQ_BL2_SYNC_STATE_V1";
  var STORE = "sync_queue";
  var MAX_MIRROR = 1000;

  function tx(v){return String(v == null ? "" : v).trim();}
  function now(){return new Date().toISOString();}
  function tm(v){var n = Date.parse(tx(v));return Number.isFinite(n) ? n : 0;}
  function cp(v){try{return JSON.parse(JSON.stringify(v == null ? null : v));}catch(e){return v;}}
  function rj(k,f){try{var x = localStorage.getItem(k);return x ? JSON.parse(x) : f;}catch(e){return f;}}
  function wj(k,v){try{localStorage.setItem(k, JSON.stringify(v));}catch(e){}return v;}
  function storage(){return window.BL2Storage || null;}
  function adapter(){try{return storage() && typeof storage().adapter === "function" ? storage().adapter() : null;}catch(e){return null;}}
  function hasIndexedQueue(){var ad = adapter();return !!(ad && typeof ad.getAll === "function" && typeof ad.putMany === "function" && typeof ad.delete === "function");}

  function readMirror(){var q = rj(Q, []);return Array.isArray(q) ? q : [];}
  function writeMirror(q){return wj(Q, (Array.isArray(q) ? q : []).slice(-MAX_MIRROR));}
  function state(){return rj(S, {lastPushAt:"", lastPullAt:"", lastSyncAt:"", pending:0, mode:"mirror"});}
  function saveState(p){return wj(S, Object.assign({}, state(), p || {}, {updatedAt:now(), version:VERSION}));}
  function rowId(row, ent){row = row || {};if(ent === "periodo"){return tx(row.id || row.periodoId || row.label || row.periodoLabel);}return tx(row.idLocal || row._bl2IdLocal || row.cedula || row.numeroIdentificacion || row.Cedula || row.docId || row._docId || row.id);}
  function firestoreStudentId(row){row = row || {};var raw = tx(row.cedula || row.numeroIdentificacion || row.Cedula || row.docId || row._docId || row.id || row.idLocal);var m = raw.match(/^(\d{7,13})/);return m ? m[1] : raw;}
  function itemKey(entity, entityId, action){return [entity, entityId, action || "upsert"].join("::");}
  function pendingFrom(rows){return (Array.isArray(rows) ? rows : []).filter(function(x){return x && x.estado !== "done" && x.estado !== "omitido";});}
  function read(){return readMirror();}
  function write(q){writeMirror(q);saveState({pending:pendingFrom(q).length, mode:"mirror"});return q;}
  function pending(){return pendingFrom(read());}
  function normalizeItem(ch){ch = ch || {};var ent = tx(ch.entity || ch.entidad);var act = tx(ch.action || ch.accion || "upsert");var data = cp(ch.data || ch.payload || {});var eid = tx(ch.entityId || ch.entidadId || rowId(data, ent));if(!ent || !eid){return null;}return {id:tx(ch.id || itemKey(ent, eid, act)),entity:ent,entityId:eid,firestoreId:ent === "estudiante" ? firestoreStudentId(data) : eid,action:act,data:data,estado:tx(ch.estado || "pendiente"),attempts:Number(ch.attempts || 0) || 0,createdAt:ch.createdAt || now(),updatedAt:now(),source:ch.source || "local"};}

  function enqueue(ch){var item = normalizeItem(ch);if(!item){return null;}var q = read();var i = q.findIndex(function(x){return x.id === item.id;});if(i >= 0){q[i] = Object.assign({}, q[i], item, {attempts:q[i].attempts || 0, createdAt:q[i].createdAt || item.createdAt});}else{q.push(item);}write(q);enqueueAsync(item).catch(function(){});return item;}
  function enqueueMany(list){var out = [];(Array.isArray(list) ? list : []).forEach(function(x){var it = enqueue(x);if(it){out.push(it);}});return out;}
  function enqueueSnapshotChanges(snap,opt){opt = opt || {};snap = snap || {};var since = tm(opt.since || state().lastPushAt || "");var changes = [];(snap.periods || []).forEach(function(p){var id = rowId(p,"periodo"), u = tm(p.updatedAt || p.actualizadoEn || (snap.meta && snap.meta.updatedAt) || "");if(id && (!since || !u || u >= since)){changes.push({entity:"periodo", entityId:id, action:"upsert", data:p, source:opt.source || "snapshot"});}});(snap.students || []).forEach(function(s){var id = rowId(s,"estudiante"), u = tm(s.updatedAt || s.ultimaSincronizacion || s.actualizadoEn || (snap.meta && snap.meta.updatedAt) || "");if(id && (!since || !u || u >= since)){changes.push({entity:"estudiante", entityId:id, action:"upsert", data:s, source:opt.source || "snapshot"});}});return enqueueMany(changes);}
  function markDone(ids){var m = {}; (Array.isArray(ids) ? ids : [ids]).forEach(function(id){m[id] = true;});write(read().filter(function(x){return !m[x.id];}));markDoneAsync(ids).catch(function(){});saveState({pending:pending().length,lastPushAt:now(),lastSyncAt:now()});}
  function markError(id,e){write(read().map(function(x){return x.id === id ? Object.assign({}, x, {estado:"error", attempts:(x.attempts || 0) + 1, errorMessage:e && e.message ? e.message : String(e || "Error"), updatedAt:now()}) : x;}));markErrorAsync(id,e).catch(function(){});saveState({pending:pending().length});}
  function clear(){write([]);clearAsync().catch(function(){});saveState({pending:0});}

  async function readAsync(){
    if(!hasIndexedQueue()){return read();}
    try{
      await storage().initialize({force:false});
      var rows = await adapter().getAll(STORE, {limit:0});
      rows = Array.isArray(rows) ? rows : [];
      if(!rows.length && readMirror().length){await enqueueManyAsync(readMirror());rows = await adapter().getAll(STORE, {limit:0});}
      writeMirror(rows.slice(-MAX_MIRROR));
      return rows;
    }catch(e){return read();}
  }
  async function pendingAsync(){return pendingFrom(await readAsync());}
  async function enqueueAsync(ch){var item = normalizeItem(ch);if(!item){return null;}if(!hasIndexedQueue()){enqueue(item);return item;}try{await storage().initialize({force:false});await adapter().putMany(STORE, [item], {touchMetadata:true});var p = await pendingAsync();saveState({pending:p.length, mode:"indexeddb"});return item;}catch(e){enqueue(item);return item;}}
  async function enqueueManyAsync(list){var items = (Array.isArray(list) ? list : []).map(normalizeItem).filter(Boolean);if(!items.length){return [];}if(!hasIndexedQueue()){return enqueueMany(items);}try{await storage().initialize({force:false});await adapter().putMany(STORE, items, {touchMetadata:true});var all = await readAsync();saveState({pending:pendingFrom(all).length, mode:"indexeddb"});return items;}catch(e){return enqueueMany(items);}}
  async function enqueueSnapshotChangesAsync(snap,opt){opt = opt || {};snap = snap || {};var since = tm(opt.since || state().lastPushAt || "");var changes = [];(snap.periods || []).forEach(function(p){var id = rowId(p,"periodo"), u = tm(p.updatedAt || p.actualizadoEn || (snap.meta && snap.meta.updatedAt) || "");if(id && (!since || !u || u >= since)){changes.push({entity:"periodo", entityId:id, action:"upsert", data:p, source:opt.source || "snapshot"});}});(snap.students || []).forEach(function(s){var id = rowId(s,"estudiante"), u = tm(s.updatedAt || s.ultimaSincronizacion || s.actualizadoEn || (snap.meta && snap.meta.updatedAt) || "");if(id && (!since || !u || u >= since)){changes.push({entity:"estudiante", entityId:id, action:"upsert", data:s, source:opt.source || "snapshot"});}});return enqueueManyAsync(changes);}
  async function markDoneAsync(ids){ids = Array.isArray(ids) ? ids : [ids];if(hasIndexedQueue()){try{await storage().initialize({force:false});for(var i=0;i<ids.length;i+=1){await adapter().delete(STORE, ids[i]);}}catch(e){}}var m = {};ids.forEach(function(id){m[id] = true;});writeMirror(readMirror().filter(function(x){return !m[x.id];}));var p = await pendingAsync();saveState({pending:p.length,lastPushAt:now(),lastSyncAt:now(),mode:hasIndexedQueue()?"indexeddb":"mirror"});}
  async function markErrorAsync(id,e){var rows = await readAsync();var changed = rows.map(function(x){return x.id === id ? Object.assign({}, x, {estado:"error", attempts:(x.attempts || 0) + 1, errorMessage:e && e.message ? e.message : String(e || "Error"), updatedAt:now()}) : x;});if(hasIndexedQueue()){try{await storage().initialize({force:false});var row = changed.filter(function(x){return x.id === id;})[0];if(row){await adapter().putMany(STORE, [row], {touchMetadata:true});}}catch(err){}}writeMirror(changed.slice(-MAX_MIRROR));saveState({pending:pendingFrom(changed).length});}
  async function clearAsync(){if(hasIndexedQueue()){try{await storage().initialize({force:false});await adapter().clear(STORE);}catch(e){}}writeMirror([]);saveState({pending:0, mode:hasIndexedQueue()?"indexeddb":"mirror"});}
  async function statusAsync(){var rows = await readAsync();return {ok:true,mode:hasIndexedQueue()?"indexeddb_queue":"mirror_queue",version:VERSION,total:rows.length,pending:pendingFrom(rows).length,state:state(),updatedAt:now()};}
  function status(){return {ok:true,mode:hasIndexedQueue()?"indexeddb_queue":"mirror_queue",version:VERSION,total:read().length,pending:pending().length,state:state(),updatedAt:now()};}

  window.BL2SyncQueue = {version:VERSION,read:read,write:write,state:state,saveState:saveState,enqueue:enqueue,enqueueMany:enqueueMany,enqueueSnapshotChanges:enqueueSnapshotChanges,pending:pending,markDone:markDone,markError:markError,clear:clear,status:status,readAsync:readAsync,pendingAsync:pendingAsync,enqueueAsync:enqueueAsync,enqueueManyAsync:enqueueManyAsync,enqueueSnapshotChangesAsync:enqueueSnapshotChangesAsync,markDoneAsync:markDoneAsync,markErrorAsync:markErrorAsync,clearAsync:clearAsync,statusAsync:statusAsync,rowId:rowId,firestoreStudentId:firestoreStudentId};
})(window);
