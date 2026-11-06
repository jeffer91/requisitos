/* Publicación de notas de núcleos, con control optimista de conflictos.
 * Debe iniciarse mediante acción expresa del usuario, no al abrir la pantalla. */
(function(w){"use strict";
var entity="evaluaciones_nucleos",active=false;
function text(v){return String(v==null?"":v).trim();}
function stable(v){
 if(Array.isArray(v))return "["+v.map(stable).join(",")+"]";
 if(v&&typeof v==="object")return "{"+Object.keys(v).sort().map(function(k){return JSON.stringify(k)+":"+stable(v[k]);}).join(",")+"}";
 return JSON.stringify(v);
}
function hash(v){var s=stable(v),h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return "nu_"+(h>>>0).toString(16).padStart(8,"0");}
function remote(record){
 var fields=["periodoId","cedula","codigoCarrera","nombreCarrera","grupoInforme","nucleo",
  "nombreNucleo","cursoMoodle","evaluaciones","taller","prueba","casoEstudio","actividadesAdicionales","totalMoodle",
  "estadoCarga","habilitado","requisitosPendientes","observaciones","origen","sourceHash","importacionId","historialCambios"];
 var doc={};
 fields.forEach(function(k){doc[k]=record[k]===undefined?null:record[k];});
 doc.dataHash=hash(doc);
 return doc;
}
function repository(){return w.RequisitosFirebaseRepository;}
async function push(options){
 options=options||{};
 if(active)throw Error("Ya hay una sincronización de núcleos en curso.");
 var period=text(options.periodoId||options.periodId),group=text(options.grupoInforme);
 if(!period)throw Error("Selecciona el período académico.");
 var local=w.NcomplexNucleosStore;
 if(!local)throw Error("El repositorio local de núcleos no está disponible.");
 var excluded=Object.create(null),scoped=Object.create(null);
 (options.skipIds||[]).forEach(function(id){excluded[text(id)]=true;});
 var onlyIds=Array.isArray(options.onlyIds)?options.onlyIds:null;
 if(onlyIds)onlyIds.forEach(function(id){scoped[text(id)]=true;});
 active=true;
 var summary={ok:true,periodoId:period,published:0,unchanged:0,conflicts:0,errors:0,
  pending:0,processed:0,attemptedIds:[],remaining:0,details:[]};
 try{
  var center=w.RequisitosFirebaseOperationCenter;
  if(!center||typeof center.ensure!=="function")throw Error("El Centro de Operaciones Firebase no está disponible.");
  await w.NcomplexFirebaseAuth.requireWriter();
  await center.ensure();
  var repo=repository();
  if(!repo||typeof repo.writeChecked!=="function"||typeof repo.getById!=="function")
   throw Error("Repositorio Firebase de escritura y verificación no disponible.");
  var records=(await local.list(period)).filter(function(r){
   return r.estadoSync!=="SINCRONIZADO"&&r.estadoSync!=="CONFLICTO"&&
     !excluded[r.id]&&(!onlyIds||scoped[r.id])&&(!group||r.grupoInforme===group);
  }).sort(function(a,b){return a.id.localeCompare(b.id);});
  summary.pending=records.length;
  var limit=Math.max(1,Math.min(25,Number(options.limit||25)));
  var selected=records.slice(0,limit),next=0;
  async function upload(row){
   var doc=remote(row),id=doc.periodoId+"__"+doc.cedula+"__N"+doc.nucleo;
   var guard={updatedAt:row.updatedAt,sourceHash:row.sourceHash};
   try{
    // SOLO CREACIÓN: si ya existe una nota diferente, la transacción la bloquea.
    // Si existe idéntica, writeChecked la devuelve como unchanged sin escribir.
    // Nunca usar remoteHash como permiso para sustituir una calificación.
    var saved=await repo.writeChecked(entity,doc,{
     expected:{exists:false},requireTransaction:true
    });
    if(!saved||saved.ok!==true)throw Error("Firebase no confirmó la escritura.");
    var verified=await repo.getById(entity,id);
    if(!verified||!verified.data||verified.data.dataHash!==doc.dataHash)
     throw Error("No fue posible verificar en Firebase la versión guardada.");
    await local.update(row.id,{estadoSync:"SINCRONIZADO",remoteHash:doc.dataHash,
     cloudError:"",lastSyncedAt:new Date().toISOString()},guard);
    if(saved.unchanged)summary.unchanged++;
    else summary.published++;
   }catch(error){
    var conflict=error&&(error.code==="FIREBASE_CONFLICT"||error.code==="LOCAL_CHANGED");
    if(error&&error.code!=="LOCAL_CHANGED"){
     try{await local.update(row.id,{estadoSync:conflict?"CONFLICTO":"ERROR",
      cloudError:text(error.message||error)},guard);}
     catch(updateError){summary.details.push({id:row.id,reason:"Actualización local: "+updateError.message});}
    }
    if(conflict)summary.conflicts++;else summary.errors++;
    summary.details.push({id:row.id,reason:text(error&&error.message||error)});
   }finally{
    summary.processed++;summary.attemptedIds.push(row.id);
    if(typeof options.onProgress==="function"){
     try{options.onProgress({processed:summary.processed,published:summary.published,
      unchanged:summary.unchanged,conflicts:summary.conflicts,errors:summary.errors});}
     catch(callbackError){/* Nunca interrumpir el guardado por fallos de visualización. */}
    }
   }
  }
  // Concurrencia limitada para reducir latencia sin saturar Firestore.
  async function worker(){
   while(next<selected.length){var row=selected[next++];await upload(row);}
  }
  await Promise.all(Array.from({length:Math.min(4,selected.length)},function(){return worker();}));
  summary.remaining=Math.max(0,records.length-summary.processed);
  summary.pending=summary.remaining+summary.errors+summary.conflicts;
  summary.ok=summary.errors===0&&summary.conflicts===0;
  return summary;
 }finally{active=false;}
}

w.NcomplexNucleosFirebase=Object.freeze({remote:remote,push:push,hash:hash,entity:entity});
})(window);