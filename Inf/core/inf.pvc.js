/* INF PVC: consolidación académica sin escrituras ni estimaciones.
 * La identidad es período + cédula. Los estados ausentes NO equivalen a reprobación.
 */
(function(root){
"use strict";
var R=[
 ["Academico","Académico"],["Documentacion","Documentación"],
 ["Financiero","Financiero"],["PracticasVinculacion","Prácticas"],
 ["Vinculacion","Vinculación"],["SeguimientoGraduados","Seguimiento a graduados"],
 ["Ingles","Inglés"],["ActualizacionDatos","Actualización de datos"]
];
function text(v){return String(v==null?"":v).trim();}
function norm(v){return text(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9]/g,"").toUpperCase();}
function period(v){var x=text(v);return x.replace(/_+/g,"__");}
function periodOf(x){return period(x.periodoId||x.periodId||x.periodoCanonicoId||x._periodoId||x.ultimoPeriodoId);}
function cid(x){return text(x.cedula||x.numeroIdentificacion||x.NumeroIdentificacion||x.numero_identificacion||"").replace(/\D/g,"");}
function first(x,keys){for(var i=0;i<keys.length;i++){var v=x&&x[keys[i]];if(v!==undefined&&v!==null&&text(v)!=="")return v;}return null;}
function grade(v){if(v===null||v===undefined||text(v)==="")return null;var n=Number(text(v).replace(",","."));return Number.isFinite(n)&&n>=0&&n<=10?Math.round(n*100)/100:null;}
function pct(a,b){return b?Math.round(a*10000/b)/100:null;}
function round(n){return Math.round(n*100)/100;}
function avg(items,key){var a=items.map(function(x){return x[key];}).filter(function(x){return x!==null&&Number.isFinite(x);});return a.length?round(a.reduce(function(s,v){return s+v;},0)/a.length):null;}
function career(r){return text(first(r,["NombreCarrera","nombreCarrera","carrera","Carrera"]))||"SIN CARRERA";}
function name(r){return text(first(r,["nombreCompleto","nombres","Nombres","Estudiante","nombre","Nombre"]))||"";}
function enrollmentStatus(r){return norm(first(r,["estadoMatricula","_estadoMatricula"])||"ACTIVO");}
function mode(r){
 var raw=norm(first(r,["modalidadTitulacion","tipoTitulacion","trabajoTitulacion","modalidadDeTitulacion"])||"");
 if(/COMPLEXIVO/.test(raw))return "COMPLEXIVO";
 if(/ARTICULO/.test(raw))return "ARTICULO";
 if(/TRABAJO|PROYECTO/.test(raw))return "TRABAJO";
 return "SIN_MODALIDAD";
}
function state(v){var x=norm(v);if(x==="CUMPLE"||x==="APROBADO"||x==="SI"||x==="TRUE")return "CUMPLE";if(x==="NO CUMPLE"||x==="NOCUMPLE"||x==="INCUMPLE"||x==="REPROBADO"||x==="FALSE")return "NO CUMPLE";if(x==="PENDIENTE")return "PENDIENTE";return "SIN DATO";}
function reqKey(k){
 var x=norm(k);
 if(x==="ACADEMICO")return "Academico";
 if(x==="DOCUMENTACION")return "Documentacion";
 if(x==="FINANCIERO")return "Financiero";
 if(x==="PRACTICASVINCULACION"||x==="PRACTICAS"||x==="PRACTICASPREPROFESIONALES")return "PracticasVinculacion";
 if(x==="VINCULACION")return "Vinculacion";
 if(x==="SEGUIMIENTOGRADUADOS"||x==="SEGUIMIENTOAGRADUADOS")return "SeguimientoGraduados";
 if(x==="INGLES")return "Ingles";
 if(x==="ACTUALIZACIONDATOS")return "ActualizacionDatos";
 if(x==="TITULACION")return "Titulacion";
 return "";
}
function rowsFor(items,id){return (items||[]).filter(function(x){return !periodOf(x)||periodOf(x)===id;});}
function modalityCompatible(student,note){
 var m=mode(note);return m==="SIN_MODALIDAD"||mode(student)==="SIN_MODALIDAD"||m===mode(student);
}
function hasPVCScore(row){return first(row,["Notart","Nart","notaArticulo","notaEscrito","promedioTrabajoEscrito","Notdef","Ndef","notaDefensa","promedioDefensaOral","notaFinal","Notafinal","Nfinal"])!==null;}
function make(snapshot,meta){
 if(!snapshot||!meta||!text(meta.periodoId))throw Error("Seleccione un período válido antes de crear el informe.");
 var id=period(meta.periodoId),sources=rowsFor(snapshot.students,id),persons=Object.create(null);
 (snapshot.persons||[]).forEach(function(r){if(cid(r))persons[cid(r)]=r;});
 var byStudent=Object.create(null),duplicates=0,excludedComplex=0,skipped=0;
 sources.forEach(function(r){
   var c=cid(r);if(!c){skipped++;return;}
   if(enrollmentStatus(r)==="RETIRADO"){return;}
   if(mode(r)==="COMPLEXIVO"){excludedComplex++;return;}
   if(byStudent[c]){duplicates++;if(text(byStudent[c].updatedAt)>text(r.updatedAt))return;}
   byStudent[c]=r;
 });
 var enrolled=Object.keys(byStudent),noteIndex=Object.create(null),rawNotes=rowsFor((snapshot.notes||[]).concat(snapshot.evaluations||[]),id),unmatched=0;
 rawNotes.forEach(function(r){
  var c=cid(r);if(!c||!byStudent[c]){if(hasPVCScore(r))unmatched++;return;}
  if(!modalityCompatible(byStudent[c],r))return;
  if(mode(r)==="COMPLEXIVO")return;
  if(!hasPVCScore(r))return;
  var scoreCount=["Notart","notaArticulo","Notdef","notaDefensa","Notafinal","notaFinal"].filter(function(k){return grade(r[k])!==null;}).length;
  var prev=noteIndex[c];
  if(!prev||scoreCount>prev.scoreCount||(scoreCount===prev.scoreCount&&text(r.updatedAt)>text(prev.row.updatedAt)))noteIndex[c]={row:r,scoreCount:scoreCount};
 });
 var reqIndex=Object.create(null),reqRows=rowsFor(snapshot.requirements||[],id),reqMatched=0;
 function putReq(c,key,value){if(!byStudent[c]||!key)return;var map=reqIndex[c]||(reqIndex[c]=Object.create(null));var s=state(value);if(s!=="SIN DATO"){map[key]=s;reqMatched++;}}
 reqRows.forEach(function(row){
  var c=cid(row);if(!byStudent[c])return;
  var key=reqKey(first(row,["requisitoKey","requisitoId","requisitoLabel","nombre","campo"])||"");
  if(key)putReq(c,key,first(row,["estado","estadoKey","valor","value","cumplimiento"]));
  var vals=row.valores||row.requisitos||null;
  if(vals&&typeof vals==="object"&&!Array.isArray(vals))Object.keys(vals).forEach(function(k){putReq(c,reqKey(k),vals[k]);});
  R.concat([["Titulacion","Titulación"]]).forEach(function(item){
   [item[0],item[1]].forEach(function(k){if(row[k]!==undefined)putReq(c,item[0],row[k]);});
  });
 });
 var students=enrolled.map(function(c){
   var raw=byStudent[c],person=persons[c]||{},note=noteIndex[c]&&noteIndex[c].row||{},rr=reqIndex[c]||{};
   var m=mode(raw);if(m==="SIN_MODALIDAD")m=mode(note);
   var art=grade(first(note,["Notart","Nart","notaArticulo","notaEscrito","promedioTrabajoEscrito"]));
   var def=grade(first(note,["Notdef","Ndef","notaDefensa","notaDefensaOral","promedioDefensaOral"]));
   var official=grade(first(note,["Notafinal","Nfinal","notaFinal","notaTrabajoTitulacion"]));
   var weight=m==="ARTICULO"?0.7:m==="TRABAJO"?0.6:null;
   var calculated=weight!==null&&art!==null&&def!==null?round(art*weight+def*(1-weight)):null;
   var final=official!==null?official:calculated,origin=official!==null?"OFICIAL":calculated!==null?"CALCULADA":"SIN NOTA";
   var misMatch=official!==null&&calculated!==null&&Math.abs(official-calculated)>0.05;
   var prevKnown=R.every(function(item){return rr[item[0]]!==undefined;});
   var prevOK=R.every(function(item){return rr[item[0]]==="CUMPLE";});
   var titKnown=rr.Titulacion!==undefined;
   var passed=final!==null&&final>=7;
   return {cedula:c,carrera:career(raw),nombre:name(raw)||name(person),modalidad:m,req:rr,
     requisitosConocidos:prevKnown,requisitosCompletos:prevOK,titulacionConocida:titKnown,
     habilitado:prevOK&&rr.Titulacion==="CUMPLE",articulo:art,defensa:def,nota:final,
     notaOrigen:origin,inconsistencia:misMatch,estado:final===null?"SIN_NOTA":passed?"APROBADO":"REPROBADO"};
 }).sort(function(a,b){return a.carrera.localeCompare(b.carrera,"es")||a.cedula.localeCompare(b.cedula);});
 var counts={total:students.length,conDatosRequisitos:students.filter(function(s){return s.requisitosConocidos;}).length,
  requisitosCompletos:students.filter(function(s){return s.requisitosCompletos;}).length,
  conTitulacion:students.filter(function(s){return s.titulacionConocida;}).length,
  habilitados:students.filter(function(s){return s.habilitado;}).length,
  evaluados:students.filter(function(s){return s.nota!==null;}).length,
  aprobados:students.filter(function(s){return s.estado==="APROBADO";}).length,
  reprobados:students.filter(function(s){return s.estado==="REPROBADO";}).length,
  sinNota:students.filter(function(s){return s.nota===null;}).length,
  notasOficiales:students.filter(function(s){return s.notaOrigen==="OFICIAL";}).length,
  notasCalculadas:students.filter(function(s){return s.notaOrigen==="CALCULADA";}).length,
  inconsistencias:students.filter(function(s){return s.inconsistencia;}).length,
  tituladoEvaluado:students.filter(function(s){return s.habilitado&&s.nota!==null;}).length,
  tituladoAprobado:students.filter(function(s){return s.habilitado&&s.estado==="APROBADO";}).length
 };
 counts.tasaGlobal=pct(counts.aprobados,counts.total);
 counts.tasaEvaluados=pct(counts.aprobados,counts.evaluados);
 var groups=Object.create(null);
 students.forEach(function(s){(groups[s.carrera]||(groups[s.carrera]=[])).push(s);});
 var careers=Object.keys(groups).sort(function(a,b){return a.localeCompare(b,"es");}).map(function(c){
   var rows=groups[c],e=rows.filter(function(x){return x.nota!==null;});
   return {nombre:c,total:rows.length,reqOK:rows.filter(function(x){return x.requisitosCompletos;}).length,
     habilitados:rows.filter(function(x){return x.habilitado;}).length,evaluados:e.length,
     aprobados:rows.filter(function(x){return x.estado==="APROBADO";}).length,
     reprobados:rows.filter(function(x){return x.estado==="REPROBADO";}).length,
     sinNota:rows.filter(function(x){return x.nota===null;}).length,
     tasa:pct(rows.filter(function(x){return x.estado==="APROBADO";}).length,e.length),
     promedio:avg(e,"nota")};
 });
 var reqStats=R.map(function(item){
  var known=students.filter(function(s){return s.req[item[0]]!==undefined;});
  var ok=known.filter(function(s){return s.req[item[0]]==="CUMPLE";}).length;
  return {key:item[0],label:item[1],cumplen:ok,pendientes:known.length-ok,sinDato:students.length-known.length,verificados:known.length,tasa:pct(ok,known.length)};
 });
 var modes=["ARTICULO","TRABAJO","SIN_MODALIDAD"].map(function(m){return {id:m,n:students.filter(function(s){return s.modalidad===m;}).length};});
 var bands=[{label:"0–6,99",low:0,high:7},{label:"7–7,99",low:7,high:8},{label:"8–8,99",low:8,high:9},{label:"9–10",low:9,high:10.001}].map(function(b){
  return {label:b.label,n:students.filter(function(s){return s.nota!==null&&s.nota>=b.low&&s.nota<b.high;}).length};
 });
 var issues=[];
 if(snapshot.limited)issues.push("La consulta utiliza caché limitada: no hay garantía de cobertura de calificaciones.");
 if(skipped)issues.push(skipped+" matrículas sin cédula válida quedaron fuera.");
 if(duplicates)issues.push(duplicates+" registros de matrícula duplicados se consolidaron por cédula.");
 if(unmatched)issues.push(unmatched+" registros de notas no se asociaron a estudiantes activos del período.");
 if(counts.conDatosRequisitos<counts.total)issues.push("La cobertura de los ocho requisitos es "+counts.conDatosRequisitos+"/"+counts.total+" estudiantes; las ausencias se clasifican SIN DATO.");
 if(counts.conTitulacion<counts.total)issues.push("El requisito Titulación solo consta en "+counts.conTitulacion+" de "+counts.total+" matrículas.");
 if(counts.notasCalculadas)issues.push(counts.notasCalculadas+" calificaciones finales se calcularon desde escrito y defensa; no se sustituyó ninguna nota oficial.");
 if(counts.inconsistencias)issues.push(counts.inconsistencias+" notas oficiales difieren más de 0,05 de la fórmula esperada; se conservan los valores oficiales.");
 if(counts.evaluados>counts.habilitados&&counts.conTitulacion)
  issues.push("Hay más evaluados que habilitados según los requisitos; no se puede interpretar el embudo como conciliación individual completa.");
 if(excludedComplex)issues.push(excludedComplex+" registros identificados como Complexivo se excluyeron de la cohorte PVC.");
 if(students.some(function(s){return s.modalidad==="SIN_MODALIDAD";}))
  issues.push("Hay estudiantes sin modalidad de titulación identificada: solo se usa su nota oficial, sin aplicar ponderaciones presumidas.");
 if(!reqRows.length)issues.push("No existen registros de requisitos asociados a este período en la fuente consultada.");
 if(!rawNotes.length)issues.push("No existen registros de notas de titulación asociados a este período en la fuente consultada.");
 return {ok:students.length>0,periodoId:id,periodoLabel:text(meta.periodoLabel)||id,
  fecha:text(meta.fecha)||new Date().toISOString().slice(0,10),code:text(meta.codigo)||"Pendiente de asignación",
  source:text(snapshot.source)||"BDLocal",generatedAt:new Date().toISOString(),students:students,
  counts:counts,careers:careers,requirements:reqStats,modes:modes,bands:bands,
  issues:issues,notasCoincidentes:Object.keys(noteIndex).length,reqMatched:reqMatched,
  statisticalBasis:"Los porcentajes de aprobación se distinguen entre cohorte total y estudiantes evaluados. Los requisitos sin registro se muestran como SIN DATO. Sin cruce individual validado no se interpreta una diferencia entre etapas como reprobación."
 };
}
root.InfPVC=Object.freeze({build:make,requirements:R,normalize:norm});
if(typeof module!=="undefined"&&module.exports)module.exports=root.InfPVC;
})(typeof window!=="undefined"?window:globalThis);
