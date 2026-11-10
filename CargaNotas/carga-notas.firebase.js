/* carga-notas.firebase.js — /CargaNotas
 * Publica solo campos evaluados en las colecciones oficiales, sin borrar actas
 * ni evaluaciones existentes. EL SISTEMA GANA: si Firebase tiene otra nota, se
 * reemplaza y el cambio queda listado en el resultado (`replaced`).
 * El desglose calculado (evaluaciones de núcleo, teórico/práctico del ordinario)
 * se marca con `camposCalculados` / `desgloseCalculado`.
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
 if(a===undefined||a===null||a===""||b===undefined||b===null||b==="")return false;
 if(typeof a==="number"&&typeof b==="number")return Math.abs(a-b)>0.025;
 return JSON.stringify(a)!==JSON.stringify(b);
}
function changes(entity,input,remote){
 var old=remote||{},list=[];
 (GRADES[entity]||[]).forEach(function(k){
  if(input[k]!==undefined&&input[k]!==null&&valueConflict(input[k],old[k]))list.push({campo:k,anterior:old[k],nuevo:input[k]});
 });
 if(old.modalidadTitulacion&&input.modalidadTitulacion&&old.modalidadTitulacion!==input.modalidadTitulacion)
  list.push({campo:"modalidadTitulacion",anterior:old.modalidadTitulacion,nuevo:input.modalidadTitulacion});
 return list;
}
function merge(entity,input,remote){
 var old=remote||{},candidate=Object.assign({},old);
 // Evaluaciones de Moodle reales (no calculadas) se respetan; las calculadas se rehacen.
 var realEvaluations=old.evaluaciones&&old.desgloseCalculado!==true&&old.evaluaciones.some(function(v){return v!==null;});
 Object.keys(input).forEach(function(k){
  if(input[k]!==undefined&&input[k]!==null){
   if(k==="createdAt"&&old.createdAt)return;
   if((k==="origen"||k==="cursoMoodle"||k==="textoOriginalHash")&&old[k])return;
   if((k==="tipoRegistro"||k==="vocales")&&old.numeroActaSenescyt)return;
   if(realEvaluations&&(k==="evaluaciones"||k==="casoEstudio"||k==="desgloseCalculado"))return;
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
 var replaced=changes(entity,input,old),doc=merge(entity,input,old),expected=old?{exists:true,hash:text(old.dataHash),version:Number(old.version||0),updatedAt:text(old.updatedAt)}:{exists:false};
 // No reescribir documentos si los campos provistos ya coinciden y no faltan.
 if(old&&Object.keys(input).filter(function(k){return k!=="createdAt"&&k!=="updatedAt"&&k!=="version"&&k!=="dataHash";})
   .every(function(k){return input[k]===null||input[k]===undefined||JSON.stringify(input[k])===JSON.stringify(old[k]);}))
   return {ok:true,unchanged:true,entity:entity,id:id,replaced:[]};
 var result=await repo.writeChecked(entity,doc,{expected:expected,documentId:id,requireTransaction:true});
 var verified=await repo.getById(entity,id);
 if(!verified||!verified.data)throw Error("Firebase no confirmó el documento "+id);
 (GRADES[entity]||[]).forEach(function(k){
   if(input[k]!==undefined&&input[k]!==null&&valueConflict(input[k],verified.data[k]))
     throw Error("No fue posible verificar "+entity+" / "+k);
 });
 return {ok:!!result.ok,unchanged:!!result.unchanged,entity:entity,id:id,replaced:replaced};
}
// Revisión previa: no bloquea por notas distintas (el sistema gana); devuelve
// la lista de reemplazos que se harán para mostrarla antes de escribir.
async function preflight(entries){
 var repo=await ensure(),all=[];
 for(var j=0;j<entries.length;j++){
  var item=entries[j],current=await repo.getById(item.entity,item.doc.id),old=current&&current.data||null;
  if(old&&old.eliminado===true)throw Error("El registro remoto "+item.doc.id+" está eliminado.");
  changes(item.entity,item.doc,old).forEach(function(c){c.entity=item.entity;all.push(c);});
  merge(item.entity,item.doc,old);
 }
 return all;
}
function identity(row){return row.periodoId+"__"+row.cedula;}
function core(row,st){return {id:identity(row),periodoId:row.periodoId,cedula:row.cedula,
 codigoCarrera:text(st.CodigoCarrera||st.codigoCarrera),nombreCarrera:text(st.NombreCarrera||st.nombreCarrera),
 origen:"excel_institucional"};}
function nucleus(row,st,number,existing){
 var previous=existing||{},computed=row.desgloseNucleos&&row.desgloseNucleos[number-1]||null;
 var realMoodle=previous.desgloseCalculado!==true&&Array.isArray(previous.evaluaciones)&&previous.evaluaciones.some(function(v){return v!==null&&v!==undefined;});
 var split=realMoodle?null:computed;
 var doc=Object.assign({},previous,core(row,st),{
  id:identity(row)+"__N"+number,nucleo:number,
  nombreNucleo:previous.nombreNucleo||"Núcleo "+number,
  grupoInforme:group(st),
  evaluaciones:split?split.evaluaciones.slice():(previous.evaluaciones||[null,null,null,null]),
  taller:previous.taller===undefined?null:previous.taller,
  prueba:previous.prueba===undefined?null:previous.prueba,
  casoEstudio:split?split.casoEstudio:(previous.casoEstudio===undefined?null:previous.casoEstudio),
  desgloseCalculado:!!split,
  totalMoodle:row.nucleos[number-1],estadoCarga:"CONCILIADO",habilitado:true,
  sourceHash:"carga-notas:"+identity(row)+":N"+number,
  importacionId:"excel-institucional:"+row.periodoId,
  observaciones:split?"Nota final del sistema; evaluaciones 1–4 y caso de estudio calculados desde ella."
    :"Nota final del sistema; evaluaciones de Moodle conservadas.",
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
 // Código incompleto (sin -P-/-L-, p. ej. «550613A01»): las carreras online se
 // llaman «… ONLINE», así que un nombre sin esa marca es presencial.
 if(c&&!/-[A-Z]-/.test(c)&&name)return "PRESENCIAL";
 return "";
}
function groupGuessed(st){var c=text(st&&(st.CodigoCarrera||st.codigoCarrera)).toUpperCase();return !!c&&!/-[A-Z]-/.test(c)&&!/PVC/.test(c)&&group(st)==="PRESENCIAL";}
function complexivo(row,st){
 var doc=Object.assign({},core(row,st),{grupoInforme:group(st),modalidadTitulacion:"EXAMEN_COMPLEXIVO",tipoRegistro:"CONSOLIDADO_INSTITUCIONAL",
  oportunidadAplicada:row.supletorio!==null?"SUPLETORIO":"ORDINARIA",
  estadoEvaluacion:row.notaExamenAplicada!==null&&row.notaExamenAplicada>=7?"APROBADO":"NO_APROBADO",
  notaMinimaAprobacion:7,notaOficial:row.notaExamenAplicada,
  notaOrdinaria:row.nota2,
  notaSupletorio:row.supletorio,
  // Con supletorio, el teórico/práctico del ordinario no viene del sistema: se calcula.
  notaTeorica:row.supletorio===null?row.teorico:(row.ordinarioCalculado?row.ordinarioCalculado.teorico:null),
  notaPractica:row.supletorio===null?row.practico:(row.ordinarioCalculado?row.ordinarioCalculado.practico:null),
  notaTeoricaSupletorio:row.supletorio!==null?row.teorico:null,
  notaPracticaSupletorio:row.supletorio!==null?row.practico:null,
  promedioNucleos:row.nota1,notaFinalIntegral:row.final,
  camposCalculados:(row.calculados||[]).slice()});
 return doc;
}
function breakdown(row){
 var p=row.proyecto;if(!p)return {};
 return {calificacionTutor:p.tutor.nota,calificacionLector:p.lector.nota,
  promedioEvaluacionPractica:p.promedioPractica,promedioEvaluacionDefensa:p.promedioDefensa,
  vocales:p.vocales.map(function(v){return {numero:v.numero,nombre:v.nombre,practica:v.practica,defensa:v.defensa};}),
  camposCalculados:(row.calculados||[]).slice()};
}
function article(row,st){return Object.assign({},core(row,st),breakdown(row),{
 modalidadTitulacion:"ARTICULO_ACADEMICO",notaArticulo:row.nota1,notaDefensa:row.nota2,
 notaFinal:row.final,
 estadoEvaluacion:row.final===null?"INCOMPLETO":row.final>=7?"APROBADO":"NO_APROBADO"});}
function trabajo(row,st){return Object.assign({},core(row,st),breakdown(row),{
 grupoInforme:group(st),modalidadTitulacion:"TRABAJO_TITULACION",tipoRegistro:"CONSOLIDADO_INSTITUCIONAL",
 promedioTrabajoEscrito:row.nota1,promedioDefensaOral:row.nota2,
 notaFinal:row.final!==null?row.final:row.calculado,
 estadoEvaluacion:row.final===null?"INCOMPLETO":row.final>=7?"APROBADO":"NO_APROBADO"});}
function general(row,st){
 var note=Object.assign({},core(row,st),{modalidadTitulacion:row.tipo});
 if(row.tipo==="EXAMEN_COMPLEXIVO"){
  note.notaFinalIntegral=row.final;
  note.promedioNucleos=row.nota1;note.notaOficial=row.notaExamenAplicada;
 }else if(row.tipo==="TRABAJO_TITULACION"){note.notaTrabajoTitulacion=row.final;}
 else{note.notaArticulo=row.nota1;note.notaDefensa=row.nota2;note.notaFinal=row.final;}
 return note;
}
w.CargaNotasFirebase=Object.freeze({ensure:ensure,preflight:preflight,publish:publish,group:group,groupGuessed:groupGuessed,changes:changes,
 nucleus:nucleus,complexivo:complexivo,article:article,trabajo:trabajo,general:general});
})(window);