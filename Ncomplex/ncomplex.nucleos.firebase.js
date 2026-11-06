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
 var excluded=Object.create(null),scoped=Object.create(null);
 (options.skipIds||[]).forEach(function(id){excluded[text(id)]=true;});
 var onlyIds=Array.isArray(options.onlyIds)?options.onlyIds:null;
 if(onlyIds)onlyIds.forEach(function(id){scoped[text(id)]=true;});
 if(!period)throw Error("Selecciona el período académico.");
 var local=w.NcomplexNucleosStore;
 if(!local)throw Error("El repositorio local de núcleos no está disponible.");
 active=true;
 var summary={ok:true,periodoId:period,published:0,unchanged:0,conflicts:0,errors:0,pending:0,processed:0,attemptedIds:[],remaining:0,details:[]};
 try{
  var center=w.RequisitosFirebaseOperationCenter;
  if(!center||typeof center.ensure!=="function")throw Error("El Centro de Operaciones Firebase no está disponible.");
  await w.NcomplexFirebaseAuth.requireWriter();
  await center.ensure();
  var repo=repository();
  if(!repo||typeof repo.writeChecked!=="function")throw Error("Repositorio Firebase no disponible.");
  var records=(await local.list(period)).filter(function(r){
   return r.estadoSync!=="SINCRONIZADO" && r.estadoSync!=="CONFLICTO" &&
     !excluded[r.id] && (!onlyIds||scoped[r.id]) && (!group||r.grupoInforme===group);
  });
  records.sort(function(a,b){return a.id.localeCompare(b.id);});
  var eligible=records.filter(function(r){return r.estadoSync!=="CONFLICTO";});
  summary.pending=eligible.length;
  var limit=Math.max(1,Math.min(25,Number(options.limit||25)));
  for(var i=0;i<Math.min(eligible.length,limit);i++){
   var row=eligible[i],doc=remote(row),id=doc.periodoId+"__"+doc.cedula+"__N"+doc.nucleo;
   summary.processed++;summary.attemptedIds.push(row.id);
   var guard={updatedAt:row.updatedAt,sourceHash:row.sourceHash};
   try{
    var old=await repo.getById(entity,id),baseline=text(row.remoteHash);
    if(old&&old.data&&old.data.dataHash===doc.dataHash){
     await local.update(row.id,{estadoSync:"SINCRONIZADO",remoteHash:doc.dataHash,cloudError:"",lastSyncedAt:new Date().toISOString()},guard);
     summary.unchanged++;continue;
    }
    if((old&&(!baseline||baseline!==text(old.data&&old.data.dataHash)))||(!old&&baseline)){
     await local.update(row.id,{estadoSync:"CONFLICTO",cloudError:"La versión de Firebase cambió o fue eliminada; revisa las diferencias."},guard);
     summary.conflicts++;summary.details.push({id:row.id,reason:"Versión remota diferente"});continue;
    }
    var expected=old?{hash:baseline}:{exists:false};
    var saved=await repo.writeChecked(entity,doc,{expected:expected});
    if(!saved||saved.ok!==true)throw Error("Firebase no confirmó el guardado.");
    var verified=await repo.getById(entity,id);
    if(!verified||!verified.data||verified.data.dataHash!==doc.dataHash)throw Error("No se confirmó la versión escrita en Firebase.");
    await local.update(row.id,{estadoSync:"SINCRONIZADO",remoteHash:doc.dataHash,cloudError:"",lastSyncedAt:new Date().toISOString()},guard);
    if(saved.unchanged)summary.unchanged++;else summary.published++;
   }catch(error){
    var conflict=error&&(error.code==="FIREBASE_CONFLICT"||error.code==="LOCAL_CHANGED");
    if(error&&error.code!=="LOCAL_CHANGED"){
     try{await local.update(row.id,{estadoSync:conflict?"CONFLICTO":"ERROR",cloudError:text(error&&error.message||error)},guard);}
     catch(updateError){summary.details.push({id:row.id,reason:"No se pudo actualizar el estado local: "+updateError.message});}
    }
    if(conflict)summary.conflicts++;else summary.errors++;
    summary.details.push({id:row.id,reason:text(error&&error.message||error)});
   }
  }
  summary.remaining=Math.max(0,eligible.length-summary.processed);
  summary.ok=summary.errors===0&&summary.conflicts===0;
  return summary;
 }finally{active=false;}
}
w.NcomplexNucleosFirebase=Object.freeze({remote:remote,push:push,hash:hash,entity:entity});
})(window);