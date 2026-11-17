/* NotasVisor/visor.editor.js — Correcciones manuales de Artículo académico.
 * Solo se activa desde ?tipo=articulo. Conserva la información anterior,
 * valida las notas y modifica artículo + resumen en una transacción atómica.
 */
(function(w){
"use strict";
var FIELDS=[
 {key:"calificacionTutor",label:"Tutor"},
 {key:"calificacionLector",label:"Lector"},
 {key:"notaArticulo",label:"Escrito"},
 {key:"promedioEvaluacionPractica",label:"Práctica"},
 {key:"promedioEvaluacionDefensa",label:"Defensa"},
 {key:"notaDefensa",label:"Oral"},
 {key:"notaFinal",label:"Final"}
];
var CALCULATED_LABELS={
 calificacionTutor:"Calificación tutor",
 calificacionLector:"Calificación lector",
 notaArticulo:"Trabajo escrito",
 promedioEvaluacionPractica:"Promedio evaluación práctica",
 promedioEvaluacionDefensa:"Promedio evaluación defensa",
 notaDefensa:"Defensa oral",
 notaFinal:"Nota final"
};
function text(v){return String(v==null?"":v).trim();}
function round(n){return Math.round((n+Number.EPSILON)*100)/100;}
function number(v){
 if(v===null||v===undefined||text(v)==="")return null;
 var n=Number(text(v).replace(",","."));
 if(!Number.isFinite(n)||n<0||n>10||Math.abs(n*100-Math.round(n*100))>0.00001)
  throw Error("Cada nota debe estar entre 0 y 10 y tener como máximo dos decimales.");
 return round(n);
}
function valuesOf(doc){
 var out={};FIELDS.forEach(function(f){out[f.key]=number(doc&&doc[f.key]);});return out;
}
function formula(doc){
 var f=text(doc&&doc.formula);
 return f==="50/50"?0.5:0.7;
}
function average(a,b){return a===null||b===null?null:round((a+b)/2);}
function total(e,o,weight){return e===null||o===null?null:round(e*weight+o*(1-weight));}
function applyChange(values,key,value,weight){
 if(!FIELDS.some(function(f){return f.key===key;}))throw Error("Campo no editable.");
 var next=Object.assign({},values);next[key]=number(value);
 if(key==="calificacionTutor"||key==="calificacionLector")
  next.notaArticulo=average(next.calificacionTutor,next.calificacionLector);
 if(key==="promedioEvaluacionPractica"||key==="promedioEvaluacionDefensa")
  next.notaDefensa=average(next.promedioEvaluacionPractica,next.promedioEvaluacionDefensa);
 if(key!=="notaFinal")
  next.notaFinal=total(next.notaArticulo,next.notaDefensa,weight);
 return next;
}
function changes(before,after){
 return FIELDS.filter(function(f){return before[f.key]!==after[f.key];}).map(function(f){
  return {campo:f.key,etiqueta:f.label,anterior:before[f.key],nuevo:after[f.key]};
 });
}
function norm(v){return text(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]+/g,"_");}
function declaredModality(st){
 st=st||{};
 var names=["tipoTitulacion","Tipo de titulación","tipo_titulacion","trabajoTitulacion","modalidadTitulacion"];
 for(var i=0;i<names.length;i++){
  var value=norm(st[names[i]]);
  if(!value)continue;
  if(value==="ARTICULO_ACADEMICO"||value==="ARTICULO"||value==="ARTICULO_CIENTIFICO"||value==="ARTICULO_ACADEMICO_DE_TITULACION")return "ARTICULO_ACADEMICO";
  if(value==="EXAMEN_COMPLEXIVO"||value==="COMPLEXIVO"||value==="TRABAJO_TITULACION"||value==="TRABAJO_DE_TITULACION"||value==="PROYECTO_DE_TITULACION")return value;
 }
 return "";
}
function missingKind(doc){
 if(!doc)return "SIN_REGISTRO";
 var v=valuesOf(doc);
 if(FIELDS.every(function(field){return v[field.key]===null;}))return "SIN_NOTAS";
 return v.notaFinal===null?"INCOMPLETO":"COMPLETO";
}
function expected(doc){
 return {exists:true,version:Number(doc&&doc.version||0),updatedAt:text(doc&&doc.updatedAt),hash:text(doc&&doc.dataHash)};
}
function conflict(){var e=Error("Las notas fueron modificadas desde otra pantalla. Pulsa Actualizar, revisa los valores y vuelve a intentar.");e.code="FIREBASE_CONFLICT";return e;}
function sameBaseline(base,remote){
 if(!base||!remote)return false;
 var b=expected(base),r=expected(remote);
 if(b.version&&r.version&&b.version!==r.version)return false;
 if(b.updatedAt&&r.updatedAt&&b.updatedAt!==r.updatedAt)return false;
 if(b.hash&&r.hash&&b.hash!==r.hash)return false;
 return FIELDS.every(function(f){return number(base[f.key])===number(remote[f.key]);});
}
function stampDoc(repo,mapper,entity,old,patch,id,stamp){
 var out=Object.assign({},old||{},patch||{},{
  id:id,firebaseDocumentId:id,
  createdAt:text(old&&old.createdAt)||stamp,
  updatedAt:stamp,
  version:Math.max(1,Number(old&&old.version||0)+1),
  eliminado:false,eliminadoEn:""
 });
 out.dataHash=mapper.dataHash({entity:entity,data:mapper.functionalContent(out)});
 var check=repo.validateDocument(entity,out,id);
 if(!check||!check.ok)throw Error("Documento de "+entity+" inválido: "+(check&&check.errors||[]).join(" "));
 return out;
}
async function persist(options){
 options=options||{};
 var base=options.base||{},period=text(options.period),cedula=text(options.cedula);
 if(!/^\d{4}-\d{2}__\d{4}-\d{2}$/.test(period)||!/^\d{10}$/.test(cedula))
  throw Error("Cédula o período inválidos. No se guardó ningún cambio.");
 if(text(base.periodoId)!==period||text(base.cedula)!==cedula)
  throw Error("El estudiante o el período no coinciden con el registro abierto.");
 var creating=options.create===true;
 if(creating&&base.id&&base.id!==period+"__"+cedula)throw Error("Identidad de artículo incorrecta.");
 var before=valuesOf(base),after=valuesOf(options.values);
 var edits=changes(before,after),reason=text(options.reason);
 if(!edits.length)throw Error("No has modificado ninguna calificación.");
 if(reason.length<5)throw Error("Escribe un motivo de corrección de al menos cinco caracteres.");
 if(reason.length>500)throw Error("El motivo no puede superar 500 caracteres.");
 var repo=w.RequisitosFirebaseRepository,mapper=w.RequisitosFirebaseMapper;
 if(!repo||!mapper||typeof repo.validateDocument!=="function"||typeof mapper.functionalContent!=="function")
  throw Error("No se pudo preparar el guardado seguro en Firebase.");
 var db=await repo.ensureFirestore();
 if(!db||typeof db.runTransaction!=="function")
  throw Error("Firebase no admite transacciones: se canceló la corrección.");
 var id=period+"__"+cedula,articleRef=db.collection(repo.collectionName("notas_articulo")).doc(id);
 var summaryRef=db.collection(repo.collectionName("notas")).doc(id);
 var result=await db.runTransaction(async function(tx){
  // Firestore requiere leer todos los documentos antes de efectuar escrituras.
  var articleSnap=await tx.get(articleRef);
  var summarySnap=await tx.get(summaryRef);
  if(creating&&articleSnap.exists)throw conflict();
  if(!creating&&!articleSnap.exists)throw conflict();
  var remote=articleSnap.exists?(articleSnap.data()||{}):null;
  if(remote&&(remote.eliminado===true||!sameBaseline(base,remote)))throw conflict();
  if(remote&&(text(remote.periodoId)!==period||text(remote.cedula)!==cedula))throw conflict();
  var summary=summarySnap.exists?(summarySnap.data()||{}):null;
  if(summary&&summary.eliminado===true)throw Error("El resumen está eliminado; se canceló la corrección.");
  if(summary&&text(summary.modalidadTitulacion)&&text(summary.modalidadTitulacion)!=="ARTICULO_ACADEMICO")
   throw Error("El resumen corresponde a otra modalidad; se canceló para no alterar otra titulación.");
  var now=new Date().toISOString();
  var history=Array.isArray(remote&&remote.historialCorrecciones)?remote.historialCorrecciones.slice():[];
  history.push({fecha:now,origen:creating?"registro_manual_notas_articulo":"edicion_manual_notas_articulo",motivo:reason,cambios:edits});
  var calculated=Array.isArray(remote&&remote.camposCalculados)?remote.camposCalculados.slice():[];
  edits.forEach(function(edit){
   var label=CALCULATED_LABELS[edit.campo];
   calculated=calculated.filter(function(item){return text(item).indexOf(label)!==0;});
  });
  var patch=Object.assign({},creating?{
   periodoId:period,cedula:cedula,
   codigoCarrera:text(base.codigoCarrera),nombreCarrera:text(base.nombreCarrera),
   grupoInforme:text(base.grupoInforme),
   modalidadTitulacion:"ARTICULO_ACADEMICO",tipoRegistro:"REGISTRO_MANUAL",
   origen:"registro_manual_notas_articulo",formula:"70/30",pesoEscrito:0.7
  }:{},after,{
   estadoEvaluacion:after.notaFinal===null?"INCOMPLETO":after.notaFinal>=7?"APROBADO":"NO_APROBADO",
   historialCorrecciones:history,ultimaCorreccionManual:now,camposCalculados:calculated
  });
  var article=stampDoc(repo,mapper,"notas_articulo",remote,patch,id,now);
  var summaryPatch={
   periodoId:period,cedula:cedula,modalidadTitulacion:"ARTICULO_ACADEMICO",
   notaArticulo:after.notaArticulo,notaDefensa:after.notaDefensa,notaFinal:after.notaFinal,
   estadoEvaluacion:patch.estadoEvaluacion,ultimaCorreccionManual:now
  };
  var summaryDoc=stampDoc(repo,mapper,"notas",summary,summaryPatch,id,now);
  tx.set(articleRef,article,{merge:false});
  tx.set(summaryRef,summaryDoc,{merge:false});
  return {id:id,edits:edits,article:article,summary:summaryDoc};
 });
 var checked=await Promise.all([repo.getById("notas_articulo",id),repo.getById("notas",id)]);
 if(!checked[0]||!checked[1]||!checked[0].data||!checked[1].data||
    checked[0].data.dataHash!==result.article.dataHash||checked[1].data.dataHash!==result.summary.dataHash)
  throw Error("Firestore recibió la operación, pero no se pudo verificar la lectura. Actualiza antes de reintentar.");
 return {ok:true,id:id,edits:edits};
}
w.NotasVisorEditor=Object.freeze({
 fields:FIELDS,number:number,valuesOf:valuesOf,formula:formula,
 declaredModality:declaredModality,missingKind:missingKind,
 average:average,total:total,applyChange:applyChange,changes:changes,persist:persist
});
})(window);
