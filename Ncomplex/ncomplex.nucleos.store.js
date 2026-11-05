/* Ncomplex · lectura y guardado de núcleos SIN migrar IndexedDB al abrir la pantalla.
 * Si la tabla evaluaciones_nucleos ya existe, se sigue leyendo.
 * Cuando no existe, se usa el store oficial settings con claves propias.
 * No elimina datos y nunca solicita un incremento de versión de BDLocal. */
(function(w){"use strict";
 var STORE="evaluaciones_nucleos",FALLBACK="settings",PREFIX="ncomplex:nucleo:",opening=null;
 function text(v){return String(v==null?"":v).trim();}
 function canonical(v){return text(v).replace(/_+/g,"__");}
 function id(periodoId,cedula,nucleo){
   return text(cedula)+"__"+canonical(periodoId)+"__N"+Number(nucleo);
 }
 function clone(row){return JSON.parse(JSON.stringify(row));}
 function storageKey(recordId){return PREFIX+text(recordId);}
 function has(db,name){return !!(db&&db.objectStoreNames&&db.objectStoreNames.contains(name));}
 function open(){
   if(opening)return opening;
   if(!w.BL2DB||typeof w.BL2DB.open!=="function")
     return Promise.reject(Error("BDLocal no está preparada; abre primero el Centro de datos."));
   opening=w.BL2DB.open({skipRepair:true}).then(function(db){
     if(!has(db,STORE)&&!has(db,FALLBACK))
       throw Error("BDLocal no tiene evaluaciones_nucleos ni settings; no es seguro guardar.");
     return db;
   }).finally(function(){opening=null;});
   return opening;
 }
 function ready(){
   return open().then(function(db){
     return {ok:true,mode:has(db,STORE)?"dedicated":"settings",readOnly:false};
   });
 }
 function names(db){
   return [STORE,FALLBACK].filter(function(name){return has(db,name);});
 }
 function unpack(name,record){
   if(name===STORE)return record&&record.id?clone(record):null;
   if(record&&typeof record.key==="string"&&record.key.indexOf(PREFIX)===0&&
      record.value&&typeof record.value==="object"&&record.value.id===record.key.slice(PREFIX.length))
     return clone(record.value);
   return null;
 }
 function readAll(db){
   return new Promise(function(resolve,reject){
     var stores=names(db),tx,found=Object.create(null);
     try{tx=db.transaction(stores,"readonly");}
     catch(error){reject(error);return;}
     stores.forEach(function(name){
       var request=tx.objectStore(name).getAll();
       request.onsuccess=function(){found[name]=request.result||[];};
     });
     tx.oncomplete=function(){
       var byId=Object.create(null);
       stores.forEach(function(name){
         (found[name]||[]).forEach(function(source){
           var row=unpack(name,source);if(!row)return;
           var previous=byId[row.id];
           if(!previous||String(row.updatedAt||"")>=String(previous.updatedAt||""))byId[row.id]=row;
         });
       });
       resolve(Object.keys(byId).map(function(key){return byId[key];}));
     };
     tx.onerror=function(){reject(tx.error||Error("No se pudieron leer las calificaciones de núcleos."));};
     tx.onabort=function(){reject(tx.error||Error("Lectura de núcleos cancelada."));};
   });
 }
 function list(periodoId){
   return open().then(readAll).then(function(rows){
     var period=canonical(periodoId);
     return period?rows.filter(function(row){return canonical(row.periodoId)===period;}):rows;
   });
 }
 function validate(row){
   if(!row||!row.id||!row.cedula||!row.periodoId||![1,2,3,4].includes(Number(row.nucleo))||
      !Array.isArray(row.evaluaciones)||row.evaluaciones.length!==4||
      row.id!==id(row.periodoId,row.cedula,row.nucleo))
     throw Error("Calificación de núcleo inválida: identifica período, estudiante y núcleo.");
   return clone(row);
 }
 function saveMany(entries){
   entries=Array.isArray(entries)?entries:[];
   if(!entries.length)return Promise.resolve([]);
   var seen=Object.create(null);
   var rows=entries.map(function(entry){
     var row=validate(entry);
     if(seen[row.id])throw Error("La misma calificación aparece dos veces en el lote.");
     seen[row.id]=true;return row;
   });
   return open().then(function(db){return new Promise(function(resolve,reject){
     var target=has(db,FALLBACK)?FALLBACK:STORE,tx;
     try{tx=db.transaction([target],"readwrite");}
     catch(error){reject(error);return;}
     var store=tx.objectStore(target);
     rows.forEach(function(row){
       store.put(target===FALLBACK
         ?{key:storageKey(row.id),value:row,updatedAt:row.updatedAt||new Date().toISOString()}
         :row);
     });
     tx.oncomplete=function(){resolve(rows);};
     tx.onerror=function(){reject(tx.error||Error("No se pudieron guardar los núcleos."));};
     tx.onabort=function(){reject(tx.error||Error("Guardado cancelado, sin alterar notas anteriores."));};
   });});
 }
 function update(rowId,fields,guards){
   guards=guards||{};
   return open().then(function(db){return new Promise(function(resolve,reject){
     var stores=names(db),tx,sourceName=null,current=null,answer=null,failure=null;
     try{tx=db.transaction(stores,"readwrite");}
     catch(error){reject(error);return;}
     var primary=has(db,FALLBACK)?FALLBACK:STORE;
     var primaryKey=primary===FALLBACK?storageKey(rowId):rowId;
     var lookup=tx.objectStore(primary).get(primaryKey);
     function apply(record,name){
       var existing=unpack(name,record);
       if(!existing){failure=Error("La calificación local no existe.");return;}
       if((guards.updatedAt!==undefined&&existing.updatedAt!==guards.updatedAt)||
          (guards.sourceHash!==undefined&&existing.sourceHash!==guards.sourceHash)){
         failure=Error("Las notas locales cambiaron durante la sincronización.");
         failure.code="LOCAL_CHANGED";return;
       }
       answer=Object.assign({},existing,fields||{});
       if(name===FALLBACK){
         tx.objectStore(name).put({key:storageKey(rowId),value:clone(answer),
           updatedAt:answer.updatedAt||new Date().toISOString()});
       }else tx.objectStore(name).put(clone(answer));
     }
     lookup.onsuccess=function(){
       if(lookup.result){sourceName=primary;apply(lookup.result,sourceName);return;}
       if(primary===FALLBACK&&has(db,STORE)){
         var legacy=tx.objectStore(STORE).get(rowId);
         legacy.onsuccess=function(){sourceName=STORE;apply(legacy.result,sourceName);};
       }else failure=Error("La calificación local no existe.");
     };
     tx.oncomplete=function(){if(failure)reject(failure);else resolve(answer);};
     tx.onerror=function(){reject(tx.error||Error("No se pudo actualizar la calificación."));};
     tx.onabort=function(){reject(tx.error||Error("Actualización local cancelada."));};
   });});
 }
 w.NcomplexNucleosStore=Object.freeze({
   version:"2.0.0-nonblocking",ready:ready,list:list,saveMany:saveMany,update:update,
   id:id,store:STORE,fallbackStore:FALLBACK,fallbackPrefix:PREFIX
 });
})(window);
