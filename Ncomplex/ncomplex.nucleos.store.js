/* BDLocal - evaluaciones_nucleos: almacenamiento separado, sin modificar evaluaciones_titulacion. */
(function(w){"use strict";
var DB_NAME=(w.BL2Config&&w.BL2Config.dbName)||"REQUISITOS_BL2";
var STORE="evaluaciones_nucleos",pending=null;
function text(v){return String(v==null?"":v).trim();}
function key(v){return text(v).replace(/_+/g,"__");}
function id(period,cedula,n){return text(cedula)+"__"+key(period)+"__N"+Number(n);}
function createStore(db,transaction){
 var store=db.objectStoreNames.contains(STORE)?transaction.objectStore(STORE):
  db.createObjectStore(STORE,{keyPath:"id"});
 [["periodoId","periodoId"],["cedula","cedula"],["nucleo","nucleo"],["estadoSync","estadoSync"]]
 .forEach(function(pair){if(!store.indexNames.contains(pair[0]))store.createIndex(pair[0],pair[1],{unique:false});});
}
function ready(){
 if(pending)return pending;
 if(!w.BL2DB||typeof w.BL2DB.open!=="function")return Promise.reject(Error("BDLocal no está disponible."));
 pending=w.BL2DB.open().then(function(db){
  if(db.objectStoreNames.contains(STORE))return db;
  var v=Math.max(Number(db.version||1)+1,4);
  if(typeof w.BL2DB.close==="function")w.BL2DB.close();else db.close();
  return new Promise(function(resolve,reject){
   var req=w.indexedDB.open(DB_NAME,v);
   req.onupgradeneeded=function(ev){
    try{createStore(ev.target.result,ev.target.transaction);}
    catch(error){try{ev.target.transaction.abort();}catch(e){}reject(error);}
   };
   req.onerror=function(){reject(req.error||Error("No se pudo crear la tabla de núcleos."));};
   req.onblocked=function(){reject(Error("Cierra otras ventanas para actualizar BDLocal sin perder información."));};
   req.onsuccess=function(){req.result.close();w.BL2DB.open({skipRepair:true}).then(resolve,reject);};
  });
 }).finally(function(){pending=null;});
 return pending;
}
function list(period){
 return ready().then(function(db){return new Promise(function(resolve,reject){
  var tx=db.transaction(STORE,"readonly"),request=tx.objectStore(STORE).getAll(),all=[];
  request.onsuccess=function(){all=request.result||[];};
  tx.oncomplete=function(){resolve(all.filter(function(r){return !period||key(r.periodoId)===key(period);}));};
  tx.onerror=function(){reject(tx.error||Error("No se pudieron leer los núcleos."));};
 });});
}
function saveMany(entries){
 if(!Array.isArray(entries)||!entries.length)return Promise.resolve([]);
 var uniq=Object.create(null);
 entries.forEach(function(r){
  if(!r||!r.id||!r.periodoId||!r.cedula||![1,2,3,4].includes(Number(r.nucleo))||!Array.isArray(r.evaluaciones)||r.evaluaciones.length!==4)
    throw Error("Registro de núcleo incompleto.");
  if(uniq[r.id])throw Error("Registro de núcleo duplicado en el lote.");
  uniq[r.id]=true;
 });
 return ready().then(function(db){return new Promise(function(resolve,reject){
  var tx=db.transaction(STORE,"readwrite"),store=tx.objectStore(STORE);
  entries.forEach(function(row){store.put(JSON.parse(JSON.stringify(row)));});
  tx.oncomplete=function(){resolve(entries);};
  tx.onerror=function(){reject(tx.error||Error("Error al guardar núcleos localmente."));};
  tx.onabort=function(){reject(tx.error||Error("Guardado de núcleos cancelado."));};
 });});
}
function update(idValue,fields,guards){
 guards=guards||{};
 return ready().then(function(db){return new Promise(function(resolve,reject){
  var tx=db.transaction(STORE,"readwrite"),store=tx.objectStore(STORE),result=null,rejected=null;
  var request=store.get(idValue);
  request.onsuccess=function(){
   var existing=request.result;
   if(!existing){rejected=Error("El registro de núcleos ya no existe.");return;}
   if((guards.updatedAt!==undefined&&existing.updatedAt!==guards.updatedAt)||
      (guards.sourceHash!==undefined&&existing.sourceHash!==guards.sourceHash)){
     rejected=Error("Las notas locales cambiaron durante la sincronización. Vuelve a comparar.");
     rejected.code="LOCAL_CHANGED";return;
   }
   result=Object.assign({},existing,fields||{});
   store.put(result);
  };
  tx.oncomplete=function(){if(rejected)reject(rejected);else resolve(result);};
  tx.onerror=function(){reject(tx.error||Error("No se pudo actualizar el estado de sincronización."));};
  tx.onabort=function(){reject(tx.error||Error("Actualización de núcleos cancelada."));};
 });});
}
w.NcomplexNucleosStore=Object.freeze({ready:ready,list:list,saveMany:saveMany,update:update,id:id,store:STORE});
})(window);
