/* Publicación DIRECTA de resultados Ncomplex en la colección notas_complexivo
 * (igual que Carga). BDLocal es la autoridad: si el documento remoto es igual
 * no se escribe; si falta o difiere se escribe con control de versión sobre el
 * estado remoto recién leído y se verifica con una lectura posterior.
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
 const period=t(options.periodoId||$("ncomplex-filter-periodo")&&$("ncomplex-filter-periodo").value).replace(/_+/g,"__");
 const anyGroup=options.anyGroup!==false;
 const group=anyGroup?"":t(options.grupoInforme||$("ncomplex-complexivo-grupo")&&$("ncomplex-complexivo-grupo").value);
 if(!period||(!group&&!anyGroup)){status("Solo se guardó en BDLocal. Para crear complexivo en Firebase, seleccione período y Grupo (Presencial/Online/PVC) y pulse Publicar en notas_complexivo.",true);return {ok:false,reason:"Seleccione período y grupo"};}
 const state=w.NcomplexState&&w.NcomplexState.get&&w.NcomplexState.get();
 if(state&&Object.keys(state.dirty||{}).length){status("Primero guarde las calificaciones pendientes en Base Local.",true);return {ok:false,reason:"Cambios locales pendientes"};}
 const con=w.ConNcomplex,center=w.RequisitosFirebaseOperationCenter;
 if(!con||!center){status("Sin conexión al centro Firebase.",true);return {ok:false,reason:"Centro Firebase no disponible"};}
 const btn=$("ncomplex-btn-complexivo-sync");working=true;if(btn)btn.disabled=true;
 try{
  if(!w.NcomplexFirebaseAuth||typeof w.NcomplexFirebaseAuth.requireWriter!=="function")
   throw Error("No está disponible el control de permisos Firebase de Ncomplex.");
  await w.NcomplexFirebaseAuth.requireWriter();
  await (typeof center.ensureNcomplex==="function"?center.ensureNcomplex():center.ensure());
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
   // Código oficial de carrera: -P- presencial, -L- en línea (p. ej. 550411C02-L-1701).
   const code=t(st.CodigoCarrera||st.codigoCarrera).toLowerCase();
   const letter=(code.match(/-([a-z])-\d+\s*$/)||[])[1]||"";
   const inferred=/pvc/.test(study+" "+career)?"PVC":
     /online|en.linea|virtual/.test(study)||/\bonline\b/.test(career)||letter==="l"?"ONLINE":
     /presencial/.test(study)||letter==="p"?"PRESENCIAL":"";
   const savedGroup=t(r.grupoInforme).toUpperCase();
   // Una carga Moodle puede contener presencial y online. Publicar cada
   // matrícula únicamente cuando su grupo persistido corresponde al solicitado.
   if(savedGroup&&inferred&&savedGroup!==inferred){
     invalid.push(ced+": grupo guardado distinto del registrado en BDLocal");continue;
   }
   const realGroup=savedGroup||inferred;
   if(["PRESENCIAL","ONLINE","PVC"].indexOf(realGroup)<0){
    invalid.push(ced+": BDLocal no identifica la modalidad para Firestore");continue;
   }
   if(!anyGroup&&realGroup!==group)continue;
   if(typeof con.checkRequirements!=="function"){
     blocked.push(ced+": verificador de requisitos no disponible");continue;
   }
   const eligibility=await con.checkRequirements(period,ced);
   if(!eligibility||eligibility.eligible!==true||eligibility.complete!==9||eligibility.total!==9){
     blocked.push(ced+": "+t(eligibility&&eligibility.reason||"9 requisitos no verificados"));continue;
   }
   const doc=normalize(Object.assign({},st,r),period,realGroup);
   if(doc)valid.push(doc);else invalid.push(ced+": calificaciones incompletas o discordantes");
  }
  const pending=[],conflicts=[];let same=0;
  for(const doc of valid){
   const remote=await repo.getById("notas_complexivo",period+"__"+doc.cedula);
   if(remote&&remote.data&&remote.data.dataHash===doc.dataHash){same++;continue;}
   doc.__expected=remote&&remote.data?{exists:true,hash:t(remote.data.dataHash),
     version:Number(remote.data.version||0),updatedAt:t(remote.data.updatedAt)}:{exists:false};
   pending.push(doc);
  }
  if(!pending.length){
   const detail=blocked.slice(0,3).join(" | ");
   const message="No se crearon documentos en notas_complexivo. Iguales: "+same+"; conflictos: "+conflicts.length+
     "; notas inválidas: "+invalid.length+"; bloqueados por requisitos: "+blocked.length+
     (detail?". "+detail:"")+
     (selected.length===0?". No hay evaluaciones guardadas de Examen Complexivo en el período.":"");
   status(message,blocked.length>0||conflicts.length>0||invalid.length>0);
   return {ok:!blocked.length&&!conflicts.length&&!invalid.length,published:0,same,conflicts,invalid,blocked,pending:blocked.length+invalid.length+conflicts.length};
  }
  const batch=pending;
  // Publicación sin confirmación extra: el guardado local inicia el flujo.
  let saved=0;
  for(const doc of batch){
    const expected=doc.__expected||{exists:false};delete doc.__expected;
    let response;
    try{response=await repo.writeChecked("notas_complexivo",doc,{expected});}
    catch(error){
      if(error&&error.code==="FIREBASE_CONFLICT"){conflicts.push(doc.cedula);continue;}
      throw error;
    }
    if(!response||response.ok!==true)throw new Error("Firebase no confirmó escritura para "+doc.cedula+".");
    const confirmed=await repo.getById("notas_complexivo",period+"__"+doc.cedula);
    if(!confirmed||!confirmed.data||confirmed.data.dataHash!==doc.dataHash)
      throw new Error("No se pudo verificar en Firebase el documento recién publicado de "+doc.cedula+".");
    saved++;
    if(typeof options.onProgress==="function"){
     try{options.onProgress({processed:saved,published:saved,total:batch.length});}
     catch(callbackError){/* La visualización nunca cancela una escritura confirmada. */}
    }
  }
  status("Firebase notas_complexivo: "+saved+" documentos escritos; iguales: "+same+"; conflictos: "+conflicts.length+
   "; inválidos: "+invalid.length+"; bloqueados 9/9: "+blocked.length+
   "; revisados: "+batch.length+
   (blocked.length?". "+blocked.slice(0,2).join(" | "):""),!!conflicts.length||!!blocked.length);
  return {ok:!blocked.length&&!conflicts.length&&!invalid.length&&saved+same===selected.length,published:saved,same,conflicts,invalid,blocked,pending:Math.max(0,selected.length-saved-same)};
 }catch(error){
   const detail=t(error&&error.message||error);
   status("Firebase notas_complexivo NO guardado: "+detail+
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
