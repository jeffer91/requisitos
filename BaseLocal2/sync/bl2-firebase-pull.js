/* =========================================================
Nombre completo: bl2-firebase-pull.js
Ruta o ubicación: /Requisitos/BaseLocal2/sync/bl2-firebase-pull.js
Función o funciones:
- Bajar de Firebase solo cambios nuevos/modificados cuando existe since.
- Evitar lectura completa en sincronización diaria.
- Guardar cambios descargados directamente en BL2Storage/IndexedDB.
- Permitir lectura completa solo con full:true.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.1-incremental-safe";
  var DEFAULT_LIMIT = 1500;
  function now(){return new Date().toISOString();}
  function tx(v){return String(v == null ? "" : v).trim();}
  function q(){return window.BL2SyncQueue || null;}
  function storage(){return window.BL2Storage || null;}
  function cleanValue(value){try{if(value && typeof value.toDate === "function"){return value.toDate().toISOString();}}catch(e){}if(Array.isArray(value)){return value.map(cleanValue);}if(value && typeof value === "object"){var out = {};Object.keys(value).forEach(function(k){out[k] = cleanValue(value[k]);});return out;}return value;}
  function rowsFromSnap(querySnapshot){var rows = [];querySnapshot.forEach(function(doc){rows.push(Object.assign({_firebaseId:doc.id}, cleanValue(doc.data() || {})));});return rows;}
  function withLimit(ref, limit){limit = Math.max(1, Number(limit || DEFAULT_LIMIT) || DEFAULT_LIMIT);return typeof ref.limit === "function" ? ref.limit(limit) : ref;}
  async function readCollectionSince(db,name,since,opt){
    opt = opt || {};
    var ref = db.collection(name);
    if(since){
      try{
        var q1 = ref.where("updatedAt", ">", since);
        if(typeof q1.orderBy === "function"){q1 = q1.orderBy("updatedAt", "asc");}
        q1 = withLimit(q1, opt.limit);
        return rowsFromSnap(await q1.get());
      }catch(error){console.warn("[BL2FirebasePull] updatedAt incremental no disponible", name, error);}
      try{
        var q2 = ref.where("ultimaSincronizacion", ">", since);
        if(typeof q2.orderBy === "function"){q2 = q2.orderBy("ultimaSincronizacion", "asc");}
        q2 = withLimit(q2, opt.limit);
        return rowsFromSnap(await q2.get());
      }catch(error2){console.warn("[BL2FirebasePull] ultimaSincronizacion incremental no disponible", name, error2);}
      return [];
    }
    if(opt.full !== true){return [];} 
    return rowsFromSnap(await withLimit(ref, opt.fullLimit || opt.limit || DEFAULT_LIMIT).get());
  }
  function inferPeriods(students){try{if(window.BLPeriodosService && typeof window.BLPeriodosService.inferFromStudents === "function"){return window.BLPeriodosService.inferFromStudents(students || []);}}catch(e){}return [];}
  async function saveIntoBL2(periods, students){
    if(!storage() || typeof storage().copySnapshot !== "function"){return {ok:false, mode:"sin_bl2_storage"};}
    try{return await storage().copySnapshot({periods:periods || [], students:students || [], meta:{source:"firebase_pull_incremental", updatedAt:now()}}, {source:"BL2FirebasePull", chunkSize:500, pauseMs:0});}
    catch(error){return {ok:false, errorMessage:error && error.message ? error.message : String(error)};}
  }
  async function pullChanges(db,opt){
    opt = opt || {};
    var state = q() ? q().state() : {};
    var since = tx(opt.since || state.lastPullAt || "");
    var full = opt.full === true && !since;
    var periods = await readCollectionSince(db,"periodos",since,{full:full, limit:opt.limit, fullLimit:opt.fullLimit});
    var students = await readCollectionSince(db,"Estudiantes",since,{full:full, limit:opt.limit, fullLimit:opt.fullLimit});
    if(!periods.length && students.length){periods = inferPeriods(students);}
    var saved = await saveIntoBL2(periods, students);
    if(q()){q().saveState({lastPullAt:now(),lastSyncAt:now(),lastPullMode:full ? "full" : "incremental"});}
    return {ok:true,mode:full ? "pull_full_limited" : "pull_incremental",since:since,periods:periods,students:students,totalPeriods:periods.length,totalStudents:students.length,storage:saved,pulledAt:now(),message:"Cambios leídos desde Firebase: " + (periods.length + students.length) + "."};
  }
  function status(){return {ok:true,mode:"firebase_pull_incremental_safe",version:VERSION,state:q()?q().state():null,updatedAt:now()};}
  window.BL2FirebasePull = {version:VERSION,pullChanges:pullChanges,status:status};
})(window);
