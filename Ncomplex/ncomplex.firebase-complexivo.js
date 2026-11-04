/* Publicación manual de resultados Ncomplex en la colección complexivo.
 * No se sobrescriben notas remotas existentes: los conflictos deben conciliarse.
 */
(function(w,d){"use strict";
const $=id=>d.getElementById(id),t=v=>String(v==null?"":v).trim();
let working=false;
const notes=["notaTeorica","notaPractica","notaComplexivo","notaTeoricaSupletorio","notaPracticaSupletorio","notaSupletorio","notaOficial","notaMinimaAprobacion"];
function status(msg,error){const el=$("ncomplex-firebase-status");if(el){el.textContent=msg;el.className="ncomplex-firebase-status "+(error?"is-danger":"is-ok");}}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
function normalize(row,period,group){
 const ced=t(row.cedula||row.numeroIdentificacion).replace(/\D/g,"");
 if(!/^\d{10}$/.test(ced)||t(row.modalidadTitulacion)!=="EXAMEN_COMPLEXIVO")return null;
 const op=t(row.oportunidadAplicada)||"ORDINARIA";
 if(!["ORDINARIA","SUPLETORIO"].includes(op))return null;
 const data={periodoId:period,cedula:ced,grupoInforme:group,
 nombre:t(row.Nombres||row.nombreCompleto||row.nombres),carrera:t(row.NombreCarrera||row.carrera),
 modalidadTitulacion:"EXAMEN_COMPLEXIVO",oportunidadAplicada:op,
 estadoEvaluacion:t(row.estadoEvaluacion),origen:"Ncomplex"};
 for(const k of notes)if(row[k]!==null&&row[k]!==undefined&&t(row[k])!=="")data[k]=Number(row[k]);
 const a=op==="SUPLETORIO"?data.notaTeoricaSupletorio:data.notaTeorica;
 const b=op==="SUPLETORIO"?data.notaPracticaSupletorio:data.notaPractica;
 if(!Number.isFinite(a)||!Number.isFinite(b)||!Number.isFinite(data.notaOficial))return null;
 if(Math.abs(Math.round((a*.4+b*.6)*100)/100-data.notaOficial)>.025)return null;
 data.dataHash="complexivo_"+hash(JSON.stringify(data));
 return data;
}
async function publish(){
 if(working)return;
 const period=t($("ncomplex-filter-periodo")&&$("ncomplex-filter-periodo").value).replace(/_+/g,"__");
 const group=t($("ncomplex-complexivo-grupo")&&$("ncomplex-complexivo-grupo").value);
 if(!period||!group){status("Seleccione período y grupo académico.",true);return;}
 const state=w.NcomplexState&&w.NcomplexState.get&&w.NcomplexState.get();
 if(state&&Object.keys(state.dirty||{}).length){status("Primero guarde las calificaciones pendientes en Base Local.",true);return;}
 const con=w.ConNcomplex,center=w.RequisitosFirebaseOperationCenter;
 if(!con||!center){status("Sin conexión al centro Firebase.",true);return;}
 const btn=$("ncomplex-btn-complexivo-sync");working=true;if(btn)btn.disabled=true;
 try{
  await center.ensure();
  const repo=w.RequisitosFirebaseRepository;
  if(!repo)throw Error("Repositorio central Firebase no disponible.");
  const rows=await con.listEvaluations({periodoId:period}),valid=[],invalid=[];
  (rows||[]).filter(r=>t(r.periodoId).replace(/_+/g,"__")===period&&t(r.modalidadTitulacion)==="EXAMEN_COMPLEXIVO").forEach(r=>{
   const doc=normalize(r,period,group);
   if(doc)valid.push(doc);else invalid.push(t(r.cedula||r.id||"sin cédula"));
  });
  const pending=[],conflicts=[];let same=0;
  for(const doc of valid){
   const remote=await repo.getById("complexivo",period+"__"+doc.cedula);
   if(remote){if(remote.data&&remote.data.dataHash===doc.dataHash)same++;else conflicts.push(doc.cedula);}
   else pending.push(doc);
  }
  if(!pending.length){status("Sin nuevos registros. Iguales: "+same+"; conflictos: "+conflicts.length+"; incompletos: "+invalid.length,!!conflicts.length);return;}
  const batch=pending.slice(0,25);
  if(!w.confirm("Publicar "+batch.length+" notas nuevas en complexivo?\nIguales: "+same+"; conflictos: "+conflicts.length+"; incompletas: "+invalid.length+".\nNo se sobrescribirán notas de otro equipo."))return;
  let saved=0;
  for(const doc of batch){await repo.writeChecked("complexivo",doc,{expected:{exists:false}});saved++;}
  status("Publicados: "+saved+"; iguales: "+same+"; conflictos: "+conflicts.length+"; incompletos: "+invalid.length+(pending.length>25?"; siguiente lote: "+(pending.length-25):""),!!conflicts.length);
 }catch(error){status("No se pudo publicar complexivo: "+(error.message||error),true);}
 finally{working=false;if(btn)btn.disabled=false;}
}
function bind(){const btn=$("ncomplex-btn-complexivo-sync");if(btn)btn.addEventListener("click",publish);}
w.NcomplexFirebaseComplexivo=Object.freeze({publish,normalize});
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",bind);else bind();
})(window,document);
