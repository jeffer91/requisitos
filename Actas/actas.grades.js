/* Consulta remota de núcleos (/notas_nucleos) y complexivo (/notas_complexivo); nunca convierte ausencias en notas.
 * Nota: Actas no carga este lector por ahora (las actas no consultan calificaciones). */
(function(w){"use strict";
const txt=v=>String(v==null?"":v).trim(),period=v=>txt(v).replace(/_+/g,"__");
const ced=row=>{
 const v=txt(row.cedula||row.numeroIdentificacion||row.NumeroIdentificacion||row.Cedula||row._cedula).replace(/\D/g,"");
 if(/^\d{10}$/.test(v))return v;
 const found=txt(row._firestoreId||row.id).match(/__(\d{10})(?:__|$)/);
 return found?found[1]:"";
};
const name=row=>txt(row.Nombres||row.nombres||row.nombreCompleto||row.nombre||row.Nombre);
const fp=value=>txt(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean).sort().join("|");
async function db(){
 if(w.BL2Sync&&typeof w.BL2Sync.ensureFirebase==="function")return w.BL2Sync.ensureFirebase();
 if(w.db&&typeof w.db.collection==="function")return w.db;
 if(w.firebase&&typeof w.firebase.firestore==="function")return w.firebase.firestore();
 throw Error("Firestore no está conectado");
}
async function fetch(db,collection,id){
 const sn=await db.collection(collection).where("periodoId","==",id).get({source:"server"});
 return (sn.docs||[]).map(d=>Object.assign({_firestoreId:d.id},d.data()||{})).filter(r=>r.eliminado!==true);
}
function target(row,students,id){
 if(period(row.periodoId)!==id)return null;
 const ci=ced(row),matching=ci?students.filter(s=>ced(s)===ci):students.filter(s=>fp(name(s))===fp(row.nombre||row.nombres||"")&&fp(name(s))!=="");
 return matching.length===1?matching[0]:null;
}
async function enrich(p,students){
 const id=period(p),client=await db();
 const [nuclei,exams]=await Promise.all([fetch(client,"notas_nucleos",id),fetch(client,"notas_complexivo",id)]);
 const index=new Map(students.map(s=>[ced(s),{n:[],e:[]}]));
 for(const [list,key] of [[nuclei,"n"],[exams,"e"]])for(const row of list){
  const student=target(row,students,id),group=student&&index.get(ced(student));
  if(group)group[key].push(row);
 }
 return students.map(s=>{const g=index.get(ced(s))||{n:[],e:[]};return Object.assign({},s,{_actasNuclei:g.n,_actasComplexivo:g.e.length===1?g.e[0]:null});});
}
w.ActasGrades=Object.freeze({enrich});
})(window);
