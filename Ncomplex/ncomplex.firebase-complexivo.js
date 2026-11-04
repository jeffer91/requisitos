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
async function publish(options){
 options=options||{};
 if(working)return {ok:false,reason:"Publicación en curso"};
 const period=t($("ncomplex-filter-periodo")&&$("ncomplex-filter-periodo").value).replace(/_+/g,"__");
 const group=t($("ncomplex-complexivo-grupo")&&$("ncomplex-complexivo-grupo").value);
 if(!period||!group){status("Solo se guardó en BDLocal. Para crear complexivo en Firebase, seleccione período y Grupo (Presencial/Online/PVC) y pulse Publicar en complexivo.",true);return {ok:false,reason:"Seleccione período y grupo"};}
 const state=w.NcomplexState&&w.NcomplexState.get&&w.NcomplexState.get();
 if(state&&Object.keys(state.dirty||{}).length){status("Primero guarde las calificaciones pendientes en Base Local.",true);return {ok:false,reason:"Cambios locales pendientes"};}
 const con=w.ConNcomplex,center=w.RequisitosFirebaseOperationCenter;
 if(!con||!center){status("Sin conexión al centro Firebase.",true);return {ok:false,reason:"Centro Firebase no disponible"};}
 const btn=$("ncomplex-btn-complexivo-sync");working=true;if(btn)btn.disabled=true;
 try{
  await center.ensure();
  const repo=w.RequisitosFirebaseRepository;
  if(!repo)throw Error("Repositorio central Firebase no disponible.");
  const [rows,students]=await Promise.all([con.listEvaluations({periodoId:period}),con.listStudents({periodoId:period,estadoMatricula:"ACTIVO"})]);
  const studentsByCed=new Map();
  (students||[]).forEach(st=>{
    const ced=t(st.cedula||st.numeroIdentificacion||st.Cedula).replace(/\D/g,"");
    if(!studentsByCed.has(ced))studentsByCed.set(ced,[]);
    studentsByCed.get(ced).push(st);
  });
  const valid=[],invalid=[],blocked=[];
  const scope=Array.isArray(options.onlyCedulas)?new Set(options.onlyCedulas.map(c=>t(c).replace(/\D/g,""))):null;
  const selected=(rows||[]).filter(r=>{
    const ced=t(r.cedula||r.numeroIdentificacion).replace(/\D/g,"");
    return t(r.periodoId).replace(/_+/g,"__")===period &&
      t(r.modalidadTitulacion)==="EXAMEN_COMPLEXIVO" && (!scope||scope.has(ced));
  });
  for(const r of selected){
   const ced=t(r.cedula||r.numeroIdentificacion).replace(/\D/g,"");
   const found=studentsByCed.get(ced)||[];
   if(found.length!==1){invalid.push(ced+": matrícula no identificada unívocamente");continue;}
   const st=found[0];
   const study=t(st.modalidadEstudio||st.Modalidad||st.modalidad||st.tipoModalidad).toLowerCase();
   const career=t(st.NombreCarrera||st.Carrera||st.carrera).toLowerCase();
   const inferred=/online|en.linea|virtual/.test(study)||/\bonline\b/.test(career)?"ONLINE":
     /pvc/.test(study)?"PVC":/presencial/.test(study)?"PRESENCIAL":"";
   if(inferred&&inferred!==group){invalid.push(ced+": grupo distinto de la matrícula");continue;}
   if(typeof con.checkRequirements!=="function"){
     blocked.push(ced+": verificador de requisitos no disponible");continue;
   }
   const eligibility=await con.checkRequirements(period,ced);
   if(!eligibility||eligibility.eligible!==true||eligibility.complete!==9||eligibility.total!==9){
     blocked.push(ced+": "+t(eligibility&&eligibility.reason||"9 requisitos no verificados"));continue;
   }
   const doc=normalize(Object.assign({},st,r),period,group);
   if(doc)valid.push(doc);else invalid.push(ced+": calificaciones incompletas o discordantes");
  }
  const pending=[],conflicts=[];let same=0;
  for(const doc of valid){
   const remote=await repo.getById("complexivo",period+"__"+doc.cedula);
   if(remote){if(remote.data&&remote.data.dataHash===doc.dataHash)same++;else conflicts.push(doc.cedula);}
   else pending.push(doc);
  }
  if(!pending.length){
   const detail=blocked.slice(0,3).join(" | ");
   const message="No se crearon documentos en complexivo. Iguales: "+same+"; conflictos: "+conflicts.length+
     "; notas inválidas: "+invalid.length+"; bloqueados por requisitos: "+blocked.length+
     (detail?". "+detail:"")+
     (selected.length===0?". No hay evaluaciones guardadas de Examen Complexivo en el período.":"");
   status(message,blocked.length>0||conflicts.length>0||invalid.length>0);
   return {ok:true,published:0,same,conflicts,invalid,blocked};
  }
  const batch=pending.slice(0,25);
  if(!w.confirm("Publicar "+batch.length+" notas nuevas en complexivo?\n9/9 requisitos verificados.\nBloqueados: "+blocked.length+"; iguales: "+same+"; conflictos: "+conflicts.length+"; inválidas: "+invalid.length+".\nNo se sobrescribirán notas de otro equipo."))return {ok:false,reason:"Cancelado por usuario"};
  let saved=0;
  for(const doc of batch){
    const response=await repo.writeChecked("complexivo",doc,{expected:{exists:false}});
    if(!response||response.ok!==true)throw new Error("Firebase no confirmó escritura para "+doc.cedula+".");
    const confirmed=await repo.getById("complexivo",period+"__"+doc.cedula);
    if(!confirmed||!confirmed.data||confirmed.data.dataHash!==doc.dataHash)
      throw new Error("No se pudo verificar en Firebase el documento recién publicado de "+doc.cedula+".");
    saved++;
  }
  status("Firebase complexivo: "+saved+" documentos creados; iguales: "+same+"; conflictos: "+conflicts.length+
   "; inválidos: "+invalid.length+"; bloqueados 9/9: "+blocked.length+
   (pending.length>25?"; siguientes por publicar: "+(pending.length-25):"")+
   (blocked.length?". "+blocked.slice(0,2).join(" | "):""),!!conflicts.length||!!blocked.length);
  return {ok:true,published:saved,same,conflicts,invalid,blocked};
 }catch(error){
   const detail=t(error&&error.message||error);
   status("Firebase complexivo NO guardado: "+detail+
    (/permission-denied|insufficient permissions/i.test(detail)?
      ". Revise las reglas Firestore desplegadas y los permisos del proyecto UTET.":""),
    true);
   return {ok:false,error:detail};
 }
 finally{working=false;if(btn)btn.disabled=false;}
}
function bind(){const btn=$("ncomplex-btn-complexivo-sync");if(btn)btn.addEventListener("click",function(){publish();});}
w.NcomplexFirebaseComplexivo=Object.freeze({publish,normalize});
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",bind);else bind();
})(window,document);
