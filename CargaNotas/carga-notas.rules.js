/* carga-notas.rules.js — /CargaNotas
 * Interpretación del Excel institucional de titulación. Sin escrituras.
 * Identidades: cédula + período; cálculos: nunca se inventan componentes.
 */
(function(root){
"use strict";
function txt(v){return String(v==null?"":v).trim();}
function norm(v){return txt(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\s+/g," ");}
function round(v){return Math.round((v+Number.EPSILON)*100)/100;}
function grade(v){if(v===null||v===undefined||txt(v)==="")return null;var n=Number(txt(v).replace(",","."));return Number.isFinite(n)&&n>=0&&n<=10?round(n):NaN;}
function cid(v){var c=txt(v).replace(/\D/g,"");return /^\d{9}$/.test(c)?"0"+c:c;}
var MONTH={ENERO:"01",FEBRERO:"02",MARZO:"03",ABRIL:"04",MAYO:"05",JUNIO:"06",JULIO:"07",AGOSTO:"08",SEPTIEMBRE:"09",OCTUBRE:"10",NOVIEMBRE:"11",DICIEMBRE:"12"};
function period(v){
 var t=norm(v),m=t.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
 if(m)return m[1]+"-"+m[2]+"__"+m[3]+"-"+m[4];
 m=t.match(/^([A-Z]+)\s+(\d{4})\s*(?:-|A|AL)\s*([A-Z]+)\s+(\d{4})$/);
 return m&&MONTH[m[1]]&&MONTH[m[3]]?m[2]+"-"+MONTH[m[1]]+"__"+m[4]+"-"+MONTH[m[3]]:"";
}
function modality(v){
 var t=norm(v);
 if(/ARTICULO/.test(t))return "ARTICULO_ACADEMICO";
 if(/TRABAJO|PROYECTO/.test(t))return "TRABAJO_TITULACION";
 if(/COMPLEXIVO/.test(t))return "EXAMEN_COMPLEXIVO";
 return "";
}
function asRow(raw){
 var o=Object.create(null);
 Object.keys(raw||{}).forEach(function(k){var key=norm(k).replace(/[^A-Z0-9]/g,"").toLowerCase();if(key&&key!=="__proto__"&&key!=="constructor"&&key!=="prototype")o[key]=raw[k];});
 return o;
}
function get(r,k){return r[norm(k).replace(/[^A-Z0-9]/g,"").toLowerCase()];}
function invalid(g){return Number.isNaN(g);}
function compare(a,b,tolerance){return a!=null&&b!=null&&Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)>(tolerance||0.05);}
function parse(raw){
 var r=asRow(raw),errors=[],warnings=[],cedula=cid(get(r,"identificacion_estudiante")),periodoId=period(get(r,"periodo_academico"));
 if(!/^\d{10}$/.test(cedula))errors.push("Cédula inválida.");
 if(!periodoId)errors.push("Período no reconocido.");
 var a=modality(get(r,"trabajoTitulacion")),b=modality(get(r,"tipo_titulacion"));
 if(!a||!b)errors.push("Modalidad no identificada.");
 if(a&&b&&a!==b)errors.push("Modalidad contradictoria entre trabajoTitulacion y tipo_titulacion.");
 var tipo=a&&a===b?a:"";
 var n1=grade(get(r,"nota1")),n2=grade(get(r,"nota2")),final=grade(get(r,"notaTrabajoTitulacion"));
 var sup=grade(get(r,"notaSupletorio")),teor=grade(get(r,"notaTeorico")),prac=grade(get(r,"notaPractico"));
 var nuclei=[1,2,3,4].map(function(i){return grade(get(r,"nota_nucleo"+i));});
 var code=[1,2,3,4].map(function(i){return txt(get(r,"codigo_nucleo"+i));});
 var accumulated=grade(get(r,"notaPromedioAcumulado"));
 var antiplagio=txt(get(r,"antiplagio"))===""?null:Number(txt(get(r,"antiplagio")).replace(",","."));
 [n1,n2,final,sup,teor,prac,accumulated].concat(nuclei).forEach(function(v){if(invalid(v))errors.push("Calificación fuera de la escala 0–10 o no numérica.");});
 if(antiplagio!==null&&(!Number.isFinite(antiplagio)||antiplagio<0||antiplagio>100))errors.push("Antiplagio fuera del rango porcentual 0–100.");
 var filled=nuclei.filter(function(x){return x!==null&&Number.isFinite(x);});
 var mean=filled.length===4?round(filled.reduce(function(x,y){return x+y;},0)/4):null;
 var exam=null,effective=null,computed=null;
 if(tipo==="EXAMEN_COMPLEXIVO"){
   if(compare(mean,n1,0.051))errors.push("Promedio de núcleos del Excel no coincide con los cuatro núcleos.");
   if(sup!==null){
     if(teor===null||prac===null)errors.push("El supletorio no tiene componentes teórico y práctico completos.");
     else if(compare(round(teor*0.4+prac*0.6),sup,0.055))errors.push("Supletorio no coincide con 40 % teórico + 60 % práctico.");
     effective=sup;exam=n2;
   }else{
     if(teor===null||prac===null)errors.push("El examen ordinario no tiene componentes completos.");
     else{
       exam=round(teor*0.4+prac*0.6);
       if(compare(n2,exam,0.055))errors.push("Ordinario no coincide con 40 % teórico + 60 % práctico.");
     }
     effective=exam;
   }
   if(n1!==null&&effective!==null)computed=round((n1+effective)/2);
   if(compare(final,computed,0.055))errors.push("El resultado integral difiere de 50 % núcleos + 50 % examen válido.");
   if(n1===null)warnings.push("Sin promedio de núcleos; no se calcula resultado integral.");
 }else if(tipo==="ARTICULO_ACADEMICO"||tipo==="TRABAJO_TITULACION"){
   var w=tipo==="ARTICULO_ACADEMICO"?0.7:0.6;
   if(n1!==null&&n2!==null)computed=round(n1*w+n2*(1-w));
   if(compare(final,computed,0.055))errors.push("Resultado final no coincide con la ponderación "+Math.round(w*100)+"/"+Math.round((1-w)*100)+".");
 }
 if(final===null)warnings.push("Sin resultado final; se conservan únicamente componentes disponibles.");
 return {cedula:cedula,periodoId:periodoId,tipo:tipo,nota1:n1,nota2:n2,final:final,
   supletorio:sup,teorico:teor,practico:prac,notaExamen:exam,notaExamenAplicada:effective,
   promedioNucleos:mean,nucleos:nuclei,codigosNucleos:code,notaPromedioAcumulado:accumulated,
   antiplagio:antiplagio,codigoTitulacion:txt(get(r,"codigoTitulacion")),
   calculado:computed,errors:errors,warnings:warnings,raw:raw};
}
root.CargaNotasRules=Object.freeze({version:"1.0.0",grade:grade,period:period,modality:modality,parse:parse,round:round,compare:compare,cid:cid});
})(window);