(function(window){
  "use strict";
  function tx(v){return String(v==null?"":v).trim();}
  function now(){return new Date().toISOString();}
  function clone(v){try{return JSON.parse(JSON.stringify(v==null?null:v));}catch(e){return v;}}
  function q(){if(!window.BL2SyncQueue)throw new Error("BL2SyncQueue no disponible.");return window.BL2SyncQueue;}
  function clean(row){var r=clone(row||{})||{};Object.keys(r).forEach(function(k){if(k.charAt(0)==="_")delete r[k];});r.updatedAt=r.updatedAt||now();r.ultimaSincronizacion=now();return r;}
  function docId(row){row=row||{};var id=tx(row.cedula||row.numeroIdentificacion||row.Cedula||row.docId||row._docId||row.id);var m=id.match(/^(\d{7,13})/);return m?m[1]:id;}
  async function commitInChunks(db,writes){var size=450;for(var i=0;i<writes.length;i+=size){var batch=db.batch();writes.slice(i,i+size).forEach(function(x){batch.set(x.ref,x.data,{merge:true});});await batch.commit();}}
  function patchStudent(row,helpers){helpers=helpers||{};if(helpers.controlledStudentPatch)return helpers.controlledStudentPatch(row);var r=clean(row);var id=docId(r);if(id){r.cedula=id;r.numeroIdentificacion=r.numeroIdentificacion||id;}return r;}
  function seedIfNeeded(snapshot,opt){opt=opt||{};var pending=q().pending();if(pending.length&&!opt.forceSeed)return pending;if(!snapshot)return pending;q().enqueueSnapshotChanges(snapshot,{source:opt.source||"firebase_incremental",since:opt.since});return q().pending();}
  async function pushQueue(db,snapshot,opt){opt=opt||{};var pending=seedIfNeeded(snapshot,opt);if(!pending.length){q().saveState({lastPushAt:now(),lastSyncAt:now(),pending:0});return {ok:true,mode:"push_incremental",pushed:0,message:"No hay cambios pendientes para subir."};}var writes=[],ids=[];pending.forEach(function(item){if(item.entity==="periodo"){var pid=tx(item.entityId||q().rowId(item.data,"periodo"));if(pid){writes.push({ref:db.collection("periodos").doc(pid),data:clean(item.data)});ids.push(item.id);}}else if(item.entity==="estudiante"){var sid=docId(item.data)||tx(item.entityId);if(sid){writes.push({ref:db.collection("Estudiantes").doc(sid),data:patchStudent(item.data,opt)});ids.push(item.id);}}});if(!writes.length)return {ok:true,mode:"push_incremental",pushed:0,message:"No se encontraron cambios válidos."};await (opt.commitInChunks||commitInChunks)(db,writes);q().markDone(ids);return {ok:true,mode:"push_incremental",pushed:writes.length,pending:q().pending().length,message:"Cambios incrementales subidos a Firebase: "+writes.length+"."};}
  function status(){return {ok:true,mode:"firebase_push",queue:window.BL2SyncQueue?window.BL2SyncQueue.status():null,updatedAt:now()};}
  window.BL2FirebasePush={version:"2.0.0-alpha.1",pushQueue:pushQueue,status:status};
})(window);
