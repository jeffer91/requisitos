/* visor.config.js — /NotasVisor
 * Qué muestra cada pestaña. Cada tipo define: colecciones de Firebase que lee,
 * cómo arma UNA fila por estudiante, sus columnas, su estado y su detalle.
 * Las notas que la app calculó (no vienen del sistema) se marcan con calc:true.
 */
(function(w){
"use strict";
function num(v){return typeof v==="number"&&isFinite(v)?v:(v===null||v===undefined||v===""?null:(isFinite(Number(v))?Number(v):null));}
function avg(list){var v=list.filter(function(x){return x!==null;});return v.length?Math.round(v.reduce(function(a,b){return a+b;},0)/v.length*100)/100:null;}
// ¿La app calculó este dato? (Cargado de notas guarda las etiquetas en camposCalculados.)
function calc(doc,labels){var list=(doc&&doc.camposCalculados)||[];return labels.some(function(l){return list.some(function(x){return String(x).indexOf(l)===0;});});}
function cell(value,isCalc){return {v:num(value),calc:!!isCalc};}
function stateOf(final,doc){
 var s=String(doc&&doc.estadoEvaluacion||"").toUpperCase();
 if(final===null)return "PENDIENTE";
 if(s==="APROBADO"||s==="NO_APROBADO")return s;
 return final>=7?"APROBADO":"NO_APROBADO";
}

var TYPES={
 nucleos:{
  title:"Núcleos",collections:["notas_nucleos","notas_complexivo"],
  rows:function(data){
   var by={},oficial={};
   // El promedio oficial de núcleos es el del sistema (viene en notas_complexivo).
   (data.notas_complexivo||[]).forEach(function(d){var v=num(d.promedioNucleos);if(v!==null)oficial[d.cedula]=v;});
   (data.notas_nucleos||[]).forEach(function(d){var k=d.cedula;(by[k]=by[k]||{cedula:k,doc:d,n:[null,null,null,null]}).n[Number(d.nucleo)-1]=d;});
   return Object.keys(by).map(function(k){
    var r=by[k],tot=r.n.map(function(d){return d?num(d.totalMoodle):null;});
    r.promedio=oficial[k]!==undefined?oficial[k]:(tot.every(function(x){return x!==null;})?avg(tot):null);
    r.cells=tot.map(function(v){return cell(v,false);}).concat([cell(r.promedio,false)]);
    r.final=r.promedio;r.state=r.promedio===null?"PENDIENTE":r.promedio>=7?"APROBADO":"NO_APROBADO";
    return r;
   });
  },
  columns:["Núcleo 1","Núcleo 2","Núcleo 3","Núcleo 4","Promedio"],
  detail:function(r){
   return {table:{title:"Evaluaciones de cada núcleo",head:["Núcleo","Eval. 1","Eval. 2","Eval. 3","Eval. 4","Caso de estudio","Nota del núcleo"],
    rows:r.n.map(function(d,i){
     if(!d)return [{t:"Núcleo "+(i+1)},{v:null},{v:null},{v:null},{v:null},{v:null},{v:null}];
     var c=d.desgloseCalculado===true,ev=(d.evaluaciones||[]).slice(0,4);while(ev.length<4)ev.push(null);
     return [{t:d.nombreNucleo||("Núcleo "+(i+1))}].concat(ev.map(function(v){return cell(v,c);})).concat([cell(d.casoEstudio,c),cell(d.totalMoodle,false)]);
    })},note:r.n.some(function(d){return d&&d.desgloseCalculado===true;})?"Las evaluaciones en cursiva las calculó la app a partir de la nota del núcleo (el sistema no las informa).":""};
  }
 },
 complexivo:{
  title:"Complexivo",collections:["notas_complexivo","notas_nucleos"],
  rows:function(data){
   var nuc={};(data.notas_nucleos||[]).forEach(function(d){(nuc[d.cedula]=nuc[d.cedula]||[null,null,null,null])[Number(d.nucleo)-1]=num(d.totalMoodle);});
   // También aparecen quienes ya tienen núcleos pero aún no examen.
   var docs=(data.notas_complexivo||[]).slice(),has={};docs.forEach(function(d){has[d.cedula]=1;});
   Object.keys(nuc).forEach(function(k){if(!has[k])docs.push({cedula:k,periodoId:"",sinExamen:true});});
   return docs.map(function(d){
    var sup=d.oportunidadAplicada==="SUPLETORIO"||num(d.notaSupletorio)!==null;
    var n=nuc[d.cedula]||[null,null,null,null];
    var prom=num(d.promedioNucleos);if(prom===null&&n.every(function(x){return x!==null;}))prom=avg(n);
    var oficial=num(d.notaOficial),final=num(d.notaFinalIntegral);
    var r={cedula:d.cedula,doc:d,final:final!==null?final:oficial,nucleos:n,sup:sup};
    r.cells=[cell(prom,calc(d,["Promedio de núcleos"])),
     cell(d.notaTeorica,calc(d,sup?["Teórico ordinario"]:["Teórico"])),cell(d.notaPractica,calc(d,sup?["Práctico ordinario"]:["Práctico"])),
     cell(d.notaOrdinaria!==undefined?d.notaOrdinaria:d.notaComplexivo,false),
     cell(d.notaSupletorio,false),cell(oficial,false),cell(final,calc(d,["Nota de titulación"]))];
    r.state=oficial===null?"PENDIENTE":stateOf(oficial,d);
    return r;
   });
  },
  columns:["Prom. núcleos","Teórico","Práctico","Ordinario","Supletorio","Examen que vale","Nota titulación"],
  detail:function(r){
   var d=r.doc;
   return {list:[["Oportunidad",d.sinExamen?"Aún sin examen en el sistema":d.oportunidadAplicada==="SUPLETORIO"?"Supletorio":"Ordinaria"],
     ["Teórico supletorio",d.notaTeoricaSupletorio],["Práctico supletorio",d.notaPracticaSupletorio],
     ["Núcleo 1",r.nucleos[0]],["Núcleo 2",r.nucleos[1]],["Núcleo 3",r.nucleos[2]],["Núcleo 4",r.nucleos[3]],
     ["Fórmula examen","40 % teórico + 60 % práctico"],["Nota titulación","(promedio núcleos + examen) / 2"]],
    note:r.sup?"Fue a supletorio: Teórico y Práctico de la tabla son los del ordinario"+(calc(d,["Teórico ordinario"])?" (calculados por la app)":"")+".":""};
  }
 },
 trabajo:{
  title:"Trabajo de titulación",collections:["notas_trabajo"],
  rows:function(data){
   return (data.notas_trabajo||[]).map(function(d){
    var r={cedula:d.cedula,doc:d,final:num(d.notaFinal)};
    r.cells=[cell(d.calificacionTutor,calc(d,["Calificación tutor"])),cell(d.calificacionLector,calc(d,["Calificación lector"])),
     cell(d.promedioTrabajoEscrito,calc(d,["Trabajo escrito"])),cell(d.promedioEvaluacionPractica,calc(d,["Promedio evaluación práctica"])),
     cell(d.promedioEvaluacionDefensa,calc(d,["Promedio evaluación defensa"])),cell(d.promedioDefensaOral,calc(d,["Defensa oral"])),
     cell(d.notaFinal,calc(d,["Nota final"]))];
    r.state=stateOf(r.final,d);return r;
   });
  },
  columns:["Tutor","Lector","Escrito","Práctica","Defensa","Oral","Final"],
  detail:function(r){return committee(r.doc,"60 % escrito + 40 % defensa oral");}
 },
 articulo:{
  title:"Artículo académico",collections:["notas_articulo"],
  rows:function(data){
   return (data.notas_articulo||[]).map(function(d){
    var r={cedula:d.cedula,doc:d,final:num(d.notaFinal)};
    r.cells=[cell(d.calificacionTutor,calc(d,["Calificación tutor"])),cell(d.calificacionLector,calc(d,["Calificación lector"])),
     cell(d.notaArticulo,calc(d,["Trabajo escrito"])),cell(d.promedioEvaluacionPractica,calc(d,["Promedio evaluación práctica"])),
     cell(d.promedioEvaluacionDefensa,calc(d,["Promedio evaluación defensa"])),cell(d.notaDefensa,calc(d,["Defensa oral"])),
     cell(d.notaFinal,calc(d,["Nota final"])),{t:formulaOf(d,"70/30")}];
    r.state=stateOf(r.final,d);return r;
   });
  },
  columns:["Tutor","Lector","Escrito","Práctica","Defensa","Oral","Final","Fórmula"],
  detail:function(r){var f=formulaOf(r.doc,"70/30");return committee(r.doc,f==="50/50"?"(escrito + oral) / 2 · 50/50":"70 % escrito + 30 % defensa oral");}
 }
};
// Fórmula con la que el sistema calculó la nota final (Cargado de notas la detecta).
function formulaOf(d,fallback){var f=String(d&&d.formula||"");return /^\d+\/\d+$/.test(f)?f:fallback;}
function committee(d,formula){
 var list=[["Fórmula",formula]];
 if(d.numeroActaSenescyt)list.push(["Acta SENESCYT",d.numeroActaSenescyt]);
 if(d.fechaActaGrado)list.push(["Fecha de grado",d.fechaActaGrado]);
 if(d.calificacionTutor!==undefined)list.push(["Tutor",d.calificacionTutor]);
 if(d.calificacionLector!==undefined)list.push(["Lector",d.calificacionLector]);
 var vocales=Array.isArray(d.vocales)?d.vocales:[];
 return {list:list,table:vocales.length?{title:"Tribunal",head:["Vocal","Nombre","Práctica","Defensa"],
  rows:vocales.map(function(v,i){return [{t:"Vocal "+(v.numero||i+1)},{t:v.nombre||"—"},cell(v.practica!==undefined?v.practica:v.evaluacionPractica,false),cell(v.defensa!==undefined?v.defensa:v.evaluacionDefensa,false)];})}:null};
}
w.NotasVisorConfig={types:TYPES,num:num,avg:avg};
})(window);
