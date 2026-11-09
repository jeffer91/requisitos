/* Ncomplex: inventario de calificaciones confirmado por lecturas reales de Firebase.
 * La ausencia de copia local no significa que falte el documento remoto.
 * Nunca modifica registros ni infiere el estado remoto solo desde BDLocal. */
(function(w){"use strict";
 function text(value){return String(value==null?"":value).trim();}
 function cedula(st){return text(st.cedula||st.numeroIdentificacion||st.NumeroIdentificacion||st._cedula).replace(/\D/g,"");}
 function name(st){return text(st.Nombres||st.nombres||st.nombreCompleto||st.nombre||st.Nombre);}
 function code(st){return text(st.CodigoCarrera||st.codigoCarrera||st.NombreCarrera||st.nombreCarrera);}
 function group(st){return text(st.grupoInforme||st.modalidadEstudio||st.tipoModalidad||st.Modalidad);}
 function localHash(mode,entry,st,period){
  if(!entry)return "";
  try{
   if(mode==="nucleos"){
    var api=w.NcomplexNucleosFirebase;
    return api&&api.remote?text(api.remote(entry).dataHash):"";
   }
   var complex=w.NcomplexFirebaseComplexivo;
   if(!complex||!complex.normalize)return "";
   var prepared=complex.normalize(Object.assign({},st,entry),period,
    text(entry.grupoInforme)||(/online|virtual|en.linea/i.test(group(st))?"ONLINE":/pvc/i.test(group(st))?"PVC":/presencial/i.test(group(st))?"PRESENCIAL":""));
   return text(prepared&&prepared.dataHash);
  }catch(error){return "";}
 }
 async function inspect(options){
  options=options||{};
  var period=text(options.periodoId),mode=options.mode==="complexivo"?"complexivo":"nucleos";
  var nucleus=Number(options.nucleus||1),rows=Array.isArray(options.students)?options.students:[];
  if(!period)throw Error("Selecciona el período para consultar Firebase.");
  if(mode==="nucleos"&&![1,2,3,4].includes(nucleus))throw Error("Selecciona un núcleo válido.");
  var auth=w.NcomplexFirebaseAuth,center=w.RequisitosFirebaseOperationCenter;
  if(!auth||typeof auth.requireUser!=="function")throw Error("Conecta Firebase para consultar las calificaciones subidas.");
  if(mode==="complexivo")await auth.requireWriter();else await auth.requireUser();
  if(!center||typeof center.ensure!=="function")throw Error("Centro Firebase no disponible.");
  await (typeof center.ensureNcomplex==="function"?center.ensureNcomplex():center.ensure());
  var repo=w.RequisitosFirebaseRepository;
  if(!repo||typeof repo.getById!=="function")throw Error("La consulta Firebase no está disponible.");
  var byCed=Object.create(null),local=Object.create(null);
  (options.local||[]).forEach(function(entry){
   var id=cedula(entry);
   if(id&&!local[id])local[id]=entry;
  });
  var list=[];
  rows.forEach(function(st){
   var id=cedula(st);
   if(!id)return;
   if(!byCed[id]){byCed[id]=[];list.push({cedula:id,student:st});}
   else byCed[id].push(st);
  });
  var total=list.length,completed=0,results=new Array(total);
  var progress=typeof options.onProgress==="function"?options.onProgress:function(){};
  progress({done:0,total:total});
  // Consultas limitadas en paralelo para no saturar Firestore en carreras grandes.
  var index=0;
  async function worker(){
   while(index<total){
    var i=index++,item=list[i],id=item.cedula,entry=local[id]||null,
      key=period+"__"+id+(mode==="nucleos"?"__N"+nucleus:"");
    var state={cedula:id,name:name(item.student),career:code(item.student),group:group(item.student),
      local:!!entry,uploaded:false,match:null,status:"No verificado",error:""};
    if(byCed[id]&&byCed[id].length){state.status="Matrícula ambigua";state.error="Existen varias matrículas de esta cédula en BDLocal.";}
    else{
     try{
      var remote=await repo.getById(mode==="nucleos"?"notas_nucleos":"notas_complexivo",key);
      if(remote&&remote.data){
       state.uploaded=true;state.status="Subido en Firebase";
       var h=localHash(mode,entry,item.student,period),remoteHash=text(remote.data.dataHash);
       if(entry&&h&&remoteHash){state.match=h===remoteHash;state.status=state.match?"Coincide con BDLocal":"Diferente de BDLocal";}
       else if(!entry)state.status="Solo en Firebase";
      }else{state.status=entry?"Pendiente de subir":"Sin nota en Firebase";}
     }catch(error){state.status="No verificado";state.error=text(error&&error.message||error);}
    }
    results[i]=state;completed++;
    progress({done:completed,total:total,uploaded:results.filter(function(r){return !!r&&r.uploaded;}).length});
   }
  }
  await Promise.all(Array.from({length:Math.min(6,total)},function(){return worker();}));
  var summary={total:total,verified:0,uploaded:0,matching:0,different:0,remoteOnly:0,
    pending:0,errors:0,checkedAt:new Date().toISOString(),rows:results};
  results.forEach(function(row){
   if(row.error){summary.errors++;return;}
   summary.verified++;
   if(row.uploaded){summary.uploaded++;
    if(row.match===true)summary.matching++;
    if(row.match===false)summary.different++;
    if(!row.local)summary.remoteOnly++;
   }else summary.pending++;
  });
  return summary;
 }
 w.NcomplexFirebaseInventory=Object.freeze({inspect:inspect});
})(window);
