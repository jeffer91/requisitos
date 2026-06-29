(function(window){
  "use strict";
  function now(){return new Date().toISOString();}
  function tx(v){return String(v==null?"":v).trim();}
  function q(){return window.BL2SyncQueue||null;}
  function rowsFromSnap(querySnapshot){var rows=[];querySnapshot.forEach(function(doc){rows.push(Object.assign({_firebaseId:doc.id},doc.data()||{}));});return rows;}
  async function readCollectionSince(db,name,since){var ref=db.collection(name);try{if(since){var qs=await ref.where("updatedAt",">",since).get();return rowsFromSnap(qs);}}catch(error){console.warn("[BL2FirebasePull] Filtro incremental no disponible",name,error);}var all=await ref.get();return rowsFromSnap(all);}
  async function pullChanges(db,opt){opt=opt||{};var state=q()?q().state():{};var since=tx(opt.since||state.lastPullAt||"");var periods=await readCollectionSince(db,"periodos",since);var students=await readCollectionSince(db,"Estudiantes",since);if(q())q().saveState({lastPullAt:now(),lastSyncAt:now()});return {ok:true,mode:"pull_incremental",since:since,periods:periods,students:students,totalPeriods:periods.length,totalStudents:students.length,pulledAt:now(),message:"Cambios leídos desde Firebase: "+(periods.length+students.length)+"."};}
  function status(){return {ok:true,mode:"firebase_pull",state:q()?q().state():null,updatedAt:now()};}
  window.BL2FirebasePull={version:"2.0.0-alpha.1",pullChanges:pullChanges,status:status};
})(window);
