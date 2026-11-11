/* reportes.datos.js — /NotasReportes
 * Lectura de datos para Notas → Descargas.
 *   Base local: matrículas (nombres, carrera) y requisitos.
 *   Firebase:   notas_* (lo que sube Cargado de notas). Quién es de Trabajo de
 *               titulación sale de esas notas (el archivo del sistema lo indica).
 */
(function(w){
"use strict";
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
/* Todo lo de un período (grades:false omite núcleos, complexivo y artículo). */
async function load(period,options){
 options=options||{};
 var c=await local();
 var reqRepo=w.BDLRepoRequisitos||(w.BDLRepositories&&w.BDLRepositories.get&&w.BDLRepositories.get("requisitos"));
 var base=await Promise.all([c.listStudents({periodoId:period}),reqRepo&&reqRepo.list?reqRepo.list({periodoId:period}):[]]);
 var fs=await firestore();
 var names=["notas_trabajo"].concat(options.grades===false?[]:["notas_nucleos","notas_complexivo","notas_articulo"]);
 var remote=await Promise.all(names.map(function(n){return readCollection(fs,fs.name(n),period);}));
 var data={periodoId:period,matriculas:base[0]||[],requisitos:base[1]||[]};
 names.forEach(function(n,i){data[n]=remote[i];});
 return data;
}
w.NotasReportesDatos={periods:periods,load:load};
})(window);
