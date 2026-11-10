/* carga-notas.firebase.js — /CargaNotas
 * Publica solo campos evaluados en las colecciones oficiales, sin borrar actas
 * ni evaluaciones existentes. Bloquea diferencias con valores remotos.
 */
(function(w){
"use strict";
function text(v){return String(v==null?"":v).trim();}
function map(){return w.RequisitosFirebaseMapper;}
function repository(){return w.RequisitosFirebaseRepository;}
function round(v){return Math.round((v+Number.EPSILON)*100)/100;}
var GRADES={
 notas_nucleos:["totalMoodle"],
 notas_complexivo:["notaTeorica","notaPractica","notaTeoricaSupletorio","notaPracticaSupletorio","notaOrdinaria","notaSupletorio","notaOficial"],
 notas_articulo:["notaArticulo","notaDefensa","notaFinal"],
 notas_trabajo:["promedioTrabajoEscrito","promedioDefensaOral","notaFinal"],
 notas:["notaFinalIntegral","promedioNucleos","notaOficial","notaArticulo","notaDefensa","notaFinal","notaTrabajoTitulacion"]
};
function ensure(){
 var center=w.RequisitosFirebaseOperationCenter;
 if(!center)throw Error("Centro de Operaciones Firebase no disponible.");
 return Promise.resolve(typeof center.ensureNcomplex==="function"?center.ensureNcomplex():center.ensure()).then(function(){
  if(!repository()||!map())throw Error("Repositorio y mapeador Firebase no disponibles.");
  return repository();
 });
}
function valueConflict(a,b){
 if(a===undefined||a===null||b===undefined||b===null)return false;
 if(typeof a==="number"&&typeof b==="number")return Math.abs(a-b)>0.025;
 return JSON.stringify(a)!==JSON.stringify(b);
}
function merge(entity,input,remote){
 var old=remote||{},candidate=Object.assign({},old);
 (GRADES[entity]||[]).forEach(function(k){
  if(input[k]!==undefined&&input[k]!==null&&valueConflict(input[k],old[k])){
   var err=Error("Firebase ya tiene una nota diferente en "+k+" ("+old[k]+" frente a "+input[k]+").");
   err.code="NOTA_DISTINTA";throw err;
  }
 });
 Object.keys(input).forEach(function(k){
  if(input[k]!==undefined&&input[k]!==null){
   if(k==="createdAt"&&old.createdAt)return;
   if((k==="origen"||k==="cursoMoodle"||k==="textoOriginalHash")&&old[k])return;
   if(k==="evaluaciones"&&old.evaluaciones&&old.evaluaciones.some(function(v){return v!==null;}))return;
   if(k==="historialCambios"&&old.historialCambios)return;
   candidate[k]=input[k];
  }
 });
 var stamp=new Date().toISOString();
 candidate.createdAt=text(old.createdAt)||stamp;candidate.updatedAt=stamp;
 candidate.version=Math.max(1,Number(old.version||0)+1);
 candidate.eliminado=false;candidate.eliminadoEn="";
 candidate.id=input.id;candidate.firebaseDocumentId=input.id;
 candidate.dataHash=map().dataHash({entity:entity,data:map().functionalContent(candidate)});
 return candidate;
}
async function publish(entity,input){
 var repo=await ensure(),id=input.id,current=await repo.getById(entity,id),old=current&&current.data||null;
 if(old&&old.eliminado===true)throw Error("Registro remoto eliminado; requiere revisión manual.");
 var doc=merge(entity,input,old),expected=old?{exists:true,hash:text(old.dataHash),version:Number(old.version||0),updatedAt:text(old.updatedAt)}:{exists:false};
 // No reescribir documentos si los campos provistos ya coinciden y no faltan.
 if(old&&Object.keys(input).filter(function(k){return k!=="createdAt"&&k!=="updatedAt"&&k!=="version"&&k!=="dataHash";})
   .every(function(k){return input[k]===null||input[k]===undefined||JSON.stringify(input[k])===JSON.stringify(old[k]);}))
   return {ok:true,unchanged:true,entity:entity,id:id};
 var result=await repo.writeChecked(entity,doc,{expected:expected,documentId:id,requireTransaction:true});
 var verified=await repo.getById(entity,id);
 if(!verified||!verified.data)throw Error("Firebase no confirmó el documento "+id);
 (GRADES[entity]||[]).forEach(function(k){
   if(input[k]!==undefined&&input[k]!==null&&valueConflict(input[k],verified.data[k]))
     throw Error("No fue posible verificar "+entity+" / "+k);
 });
 return {ok:!!result.ok,unchanged:!!result.unchanged,entity:entity,id:id};
}
function identity(row){return row.periodoId+"__"+row.cedula;}
function core(row,st){return {id:identity(row),periodoId:row.periodoId,cedula:row.cedula,
 codigoCarrera:text(st.CodigoCarrera||st.codigoCarrera),nombreCarrera:text(st.NombreCarrera||st.nombreCarrera),
 origen:"excel_institucional"};}
function nucleus(row,st,number,existing){
 var previous=existing||{},doc=Object.assign({},previous,core(row,st),{
  id:identity(row)+"__N"+number,nucleo:number,
  nombreNucleo:previous.nombreNucleo||"Núcleo "+number,
  grupoInforme:group(st),evaluaciones:previous.evaluaciones||[null,null,null,null],
  taller:previous.taller===undefined?null:previous.taller,
  prueba:previous.prueba===undefined?null:previous.prueba,
  casoEstudio:previous.casoEstudio===undefined?null:previous.casoEstudio,
  totalMoodle:row.nucleos[number-1],estadoCarga:"CONCILIADO",habilitado:true,
  sourceHash:"carga-notas:"+identity(row)+":N"+number,
  importacionId:"excel-institucional:"+row.periodoId,
  observaciones:"Consolidado institucional (actividades parciales no informadas por esta fuente).",
  historialCambios:previous.historialCambios||[]
 });
 if(previous.origen)doc.origen=previous.origen;
 return doc;
}
function group(st){
 var c=text(st.CodigoCarrera||st.codigoCarrera).toUpperCase(),name=text(st.NombreCarrera||st.nombreCarrera).toUpperCase();
 if(/PVC/.test(c+" "+name))return "PVC";
 if(/-L-/.test(c)||/ONLINE|EN LINEA/.test(name))return "ONLINE";
 if(/-P-/.test(c))return "PRESENCIAL";
 return "";
}
function complexivo(row,st){
 var doc=Object.assign({},core(row,st),{grupoInforme:group(st),modalidadTitulacion:"EXAMEN_COMPLEXIVO",
  oportunidadAplicada:row.supletorio!==null?"SUPLETORIO":"ORDINARIA",
  estadoEvaluacion:row.notaExamenAplicada!==null&&row.notaExamenAplicada>=7?"APROBADO":"NO_APROBADO",
  notaMinimaAprobacion:7,notaOficial:row.notaExamenAplicada,
  notaOrdinaria:row.nota2,
  notaSupletorio:row.supletorio,
  notaTeorica:row.supletorio===null?row.teorico:null,notaPractica:row.supletorio===null?row.practico:null,
  notaTeoricaSupletorio:row.supletorio!==null?row.teorico:null,
  notaPracticaSupletorio:row.supletorio!==null?row.practico:null});
 return doc;
}
function article(row,st){return Object.assign({},core(row,st),{
 modalidadTitulacion:"ARTICULO_ACADEMICO",notaArticulo:row.nota1,notaDefensa:row.nota2,
 notaFinal:row.final!==null?row.final:row.calculado,
 estadoEvaluacion:row.final===null?"INCOMPLETO":row.final>=7?"APROBADO":"NO_APROBADO"});}
function trabajo(row,st){return Object.assign({},core(row,st),{
 grupoInforme:group(st),modalidadTitulacion:"TRABAJO_TITULACION",tipoRegistro:"CONSOLIDADO_INSTITUCIONAL",
 promedioTrabajoEscrito:row.nota1,promedioDefensaOral:row.nota2,
 notaFinal:row.final!==null?row.final:row.calculado,
 estadoEvaluacion:row.final===null?"INCOMPLETO":row.final>=7?"APROBADO":"NO_APROBADO"});}
function general(row,st){
 var note=Object.assign({},core(row,st),{modalidadTitulacion:row.tipo});
 if(row.tipo==="EXAMEN_COMPLEXIVO"){
  note.notaFinalIntegral=row.final!==null?row.final:row.calculado;
  note.promedioNucleos=row.nota1;note.notaOficial=row.notaExamenAplicada;
 }else if(row.tipo==="TRABAJO_TITULACION"){note.notaTrabajoTitulacion=row.final!==null?row.final:row.calculado;}
 else{note.notaArticulo=row.nota1;note.notaDefensa=row.nota2;note.notaFinal=row.final!==null?row.final:row.calculado;}
 return note;
}
w.CargaNotasFirebase=Object.freeze({ensure:ensure,publish:publish,group:group,
 nucleus:nucleus,complexivo:complexivo,article:article,trabajo:trabajo,general:general});
})(window);