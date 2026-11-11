/* reportes.datos.js — /NotasReportes
 * Lectura de datos para Descargas y Modalidad.
 *   Base local: matrículas (nombres, carrera) y requisitos.
 *   Firebase:   notas_* (lo que sube Cargado de notas) y modalidad_titulacion
 *               (quién va a Trabajo de titulación; se marca en Notas → Modalidad).
 */
(function(w){
"use strict";
var MOD="modalidad_titulacion";
function txt(v){return String(v==null?"":v).trim();}
async function firestore(){
 var center=w.RequisitosFirebaseOperationCenter;
 if(!center)throw Error("No se pudo preparar la conexión con Firebase.");
 var repo=await (typeof center.ensureNcomplex==="function"?center.ensureNcomplex():center.ensure());
 repo=repo&&repo.ensureFirestore?repo:w.RequisitosFirebaseRepository;
 var db=await repo.ensureFirestore();
 return {db:db,name:function(e){try{return repo.collectionName(e)||e;}catch(err){return e;}}};
}
async function readCollection(fs,name,period){
 var snap=await fs.db.collection(name).where("periodoId","==",period).get(),out=[];
 (snap.docs||[]).forEach(function(s){var v=typeof s.data==="function"?s.data():s.data;if(v&&v.eliminado!==true)out.push(v);});
 return out;
}
async function local(){
 var c=w.ConNcomplex;if(!c)throw Error("Base local no disponible.");
 var r=await c.ready();if(r&&r.ok===false)throw Error(r.error||"Base local no disponible.");
 return c;
}
async function periods(){
 var c=await local(),rows=await c.listPeriods()||[],seen={},out=[];
 rows.forEach(function(r){var id=txt(r.id||r.periodoId||r.periodId).replace(/^(\d{4}-\d{2})_+(\d{4}-\d{2})$/,"$1__$2");
  if(/^\d{4}-\d{2}__\d{4}-\d{2}$/.test(id)&&!seen[id]){seen[id]=1;out.push({id:id,label:txt(r.label||r.nombre)});}});
 return out.sort(function(a,b){return b.id.localeCompare(a.id);});
}
/* Todo lo de un período. grades:false evita leer las notas (pantalla Modalidad). */
async function load(period,options){
 options=options||{};
 var c=await local();
 var reqRepo=w.BDLRepoRequisitos||(w.BDLRepositories&&w.BDLRepositories.get&&w.BDLRepositories.get("requisitos"));
 var base=await Promise.all([c.listStudents({periodoId:period}),reqRepo&&reqRepo.list?reqRepo.list({periodoId:period}):[]]);
 var fs=await firestore();
 var names=["notas_trabajo"].concat(options.grades===false?[]:["notas_nucleos","notas_complexivo","notas_articulo"]);
 var remote=await Promise.all([readCollection(fs,MOD,period)].concat(names.map(function(n){return readCollection(fs,fs.name(n),period);})));
 var data={periodoId:period,matriculas:base[0]||[],requisitos:base[1]||[],modalidades:remote[0]};
 names.forEach(function(n,i){data[n]=remote[i+1];});
 return data;
}
async function saveModalidad(period,cedula,modalidad){
 var fs=await firestore(),id=period+"__"+cedula,stamp=new Date().toISOString();
 var doc={id:id,periodoId:period,cedula:cedula,modalidadTitulacion:modalidad,origen:"notas_modalidad",updatedAt:stamp};
 await fs.db.collection(MOD).doc(id).set(doc,{merge:true});
 var check=await fs.db.collection(MOD).doc(id).get();
 var saved=check&&(typeof check.data==="function"?check.data():check.data);
 if(!saved||saved.modalidadTitulacion!==modalidad)throw Error("Firebase no confirmó el cambio de "+cedula+".");
 return doc;
}
w.NotasReportesDatos={periods:periods,load:load,saveModalidad:saveModalidad,collection:MOD};
})(window);
