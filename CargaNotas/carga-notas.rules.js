/* carga-notas.rules.js — /CargaNotas
 * Interpretación del Excel institucional de titulación (sistema académico). Sin escrituras.
 * Identidad: cédula (+ período de la matrícula en BDLocal).
 *
 * Fórmulas oficiales (verificadas con el archivo de octubre 2025):
 *   Examen complexivo   = 40 % teórico + 60 % práctico (ordinario o supletorio)
 *   Supletorio          = solo si perdió el ordinario
 *   Nota de titulación  = (promedio de los 4 núcleos + examen que vale) / 2
 *   Trabajo titulación  = 60 % escrito + 40 % defensa oral
 *   Artículo académico  = 70 % escrito + 30 % defensa oral
 *   Escrito = (tutor + lector) / 2 · Oral = (promedio práctica + promedio defensa) / 2
 *
 * EL SISTEMA GANA: sus notas se guardan tal cual; si no cuadran con la fórmula
 * se avisa, pero no se bloquea. Lo que el sistema no trae se CALCULA y se marca:
 *   - si falta un solo dato, se despeja de la fórmula;
 *   - si faltan varios, se reparte la nota superior por igual (desglose calculado).
 * Así se obtienen las evaluaciones 1–4 y el caso de estudio de cada núcleo y el
 * teórico/práctico del ordinario cuando el estudiante fue a supletorio.
 */
(function(root){
"use strict";
var PASSING=7,TOL=0.011,TOL_CHAIN=0.021;
function txt(v){return String(v==null?"":v).trim();}
function norm(v){return txt(v).normalize("NFD").replace(/[̀-ͯ]/g,"").toUpperCase().replace(/\s+/g," ");}
function round(v){return Math.round((v+Number.EPSILON)*100)/100;}
function grade(v){if(v===null||v===undefined||txt(v)==="")return null;var n=Number(txt(v).replace(",","."));return Number.isFinite(n)&&n>=0&&n<=10?round(n):NaN;}
function has(v){return v!==null&&v!==undefined&&Number.isFinite(v);}
function cid(v){var c=txt(v).replace(/\D/g,"");return c&&c.length<10?c.padStart(10,"0"):c;}
var MONTH={ENERO:"01",FEBRERO:"02",MARZO:"03",ABRIL:"04",MAYO:"05",JUNIO:"06",JULIO:"07",AGOSTO:"08",SEPTIEMBRE:"09",SETIEMBRE:"09",OCTUBRE:"10",NOVIEMBRE:"11",DICIEMBRE:"12"};
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

/* Nodo ponderado value = Σ w·hijo: verifica, calcula el valor o completa hijos.
   ctx.calculados recibe las etiquetas de lo calculado; ctx.noCuadra los avisos. */
function solve(ctx,label,value,children,weights,tolerance){
 var known=0,missing=[];
 children.forEach(function(c,i){if(has(c.v))known+=weights[i]*c.v;else missing.push(i);});
 if(!missing.length){
  var calc=round(known);
  if(has(value)){
   if(Math.abs(calc-value)>(tolerance||TOL))ctx.noCuadra.push(label+": la fórmula da "+calc+" y el sistema dice "+value+"; se conserva lo del sistema.");
   return value;
  }
  if(label)ctx.calculados.push(label);
  return calc;
 }
 if(!has(value))return null;
 var wm=0;missing.forEach(function(i){wm+=weights[i];});
 var each=round((value-known)/wm);
 if(!(each>=-0.005&&each<=10.005)){ctx.noCuadra.push(label+": no se puede completar el desglose (daría "+each+").");return value;}
 missing.forEach(function(i){children[i].v=Math.max(0,Math.min(10,each));children[i].calc=true;if(children[i].label)ctx.calculados.push(children[i].label);});
 return value;
}

function parse(raw){
 var r=asRow(raw),errors=[],warnings=[],ctx={calculados:[],noCuadra:[]};
 var cedula=cid(get(r,"identificacion_estudiante")),periodoId=period(get(r,"periodo_academico"));
 if(!/^\d{10}$/.test(cedula))errors.push("Cédula inválida.");
 if(!periodoId)warnings.push("Período del sistema no reconocido; se usa el de la matrícula en BDLocal.");
 // «trabajoTitulacion» es la columna confiable; «tipo_titulacion» trae errores en el sistema.
 var a=modality(get(r,"trabajoTitulacion")),b=modality(get(r,"tipo_titulacion"));
 var tipo=a||b;
 if(!tipo)errors.push("Modalidad no identificada.");
 if(a&&b&&a!==b)warnings.push("El sistema dice «"+txt(get(r,"tipo_titulacion"))+"» en tipo_titulacion; se usa trabajoTitulacion («"+txt(get(r,"trabajoTitulacion"))+"»).");
 var n1=grade(get(r,"nota1")),n2=grade(get(r,"nota2")),final=grade(get(r,"notaTrabajoTitulacion"));
 var sup=grade(get(r,"notaSupletorio")),teor=grade(get(r,"notaTeorico")),prac=grade(get(r,"notaPractico"));
 var nuclei=[1,2,3,4].map(function(i){return grade(get(r,"nota_nucleo"+i));});
 var code=[1,2,3,4].map(function(i){return txt(get(r,"codigo_nucleo"+i));});
 var accumulated=grade(get(r,"notaPromedioAcumulado"));
 var antiplagio=txt(get(r,"antiplagio"))===""?null:Number(txt(get(r,"antiplagio")).replace(",","."));
 var tutor=grade(get(r,"evaluacionTutor")),lector=grade(get(r,"evaluacionLector"));
 var vocalRaw=[1,2,3].map(function(i){return {numero:i,nombre:txt(get(r,"nombre_vocal"+i)),
   practica:grade(get(r,"sumatoriaEvaluacionPractica_vocal"+i)),defensa:grade(get(r,"sumatoriaEvaluacionDefensa_vocal"+i))};});
 [n1,n2,final,sup,teor,prac].concat(nuclei)
  .forEach(function(v){if(invalid(v))errors.push("Calificación fuera de la escala 0–10 o no numérica.");});
 // Datos de apoyo (tutor, lector, vocales, acumulado) fuera de escala: se avisa y se
 // dejan vacíos; no bloquean las notas finales del sistema.
 function support(v,label){if(invalid(v)){warnings.push(label+" fuera de la escala 0–10 en el sistema; se omite.");return null;}return v;}
 accumulated=support(accumulated,"Promedio acumulado");tutor=support(tutor,"Calificación tutor");lector=support(lector,"Calificación lector");
 vocalRaw.forEach(function(v){v.practica=support(v.practica,"Práctica vocal "+v.numero);v.defensa=support(v.defensa,"Defensa vocal "+v.numero);});
 if(antiplagio!==null&&(!Number.isFinite(antiplagio)||antiplagio<0||antiplagio>100))errors.push("Antiplagio fuera del rango porcentual 0–100.");
 if(errors.length){
  return {cedula:cedula,periodoId:periodoId,periodoSistemaId:periodoId,periodoSistema:txt(get(r,"periodo_academico")),tipo:tipo,
   nota1:n1,nota2:n2,final:final,supletorio:sup,teorico:teor,practico:prac,notaExamen:null,notaExamenAplicada:null,
   promedioNucleos:null,nucleos:nuclei,codigosNucleos:code,desgloseNucleos:[],notaPromedioAcumulado:accumulated,antiplagio:antiplagio,
   codigoTitulacion:txt(get(r,"codigoTitulacion")),calculado:null,calculados:[],proyecto:null,ordinarioCalculado:null,
   errors:errors,warnings:warnings,raw:raw};
 }

 var exam=null,effective=null,computed=null,proyecto=null,ordinarioCalc=null,desglose=[];
 if(tipo==="EXAMEN_COMPLEXIVO"){
  var nodes=nuclei.map(function(v,i){return {label:"Núcleo "+(i+1),v:v};});
  n1=solve(ctx,"Promedio de núcleos",n1,nodes,[.25,.25,.25,.25],TOL_CHAIN);
  nuclei=nodes.map(function(x){return has(x.v)?round(x.v):null;});
  // Teórico/práctico del sistema son los del ÚLTIMO examen rendido.
  var tp=[{label:sup!==null?"Teórico supletorio":"Teórico",v:teor},{label:sup!==null?"Práctico supletorio":"Práctico",v:prac}];
  if(sup!==null){
   sup=solve(ctx,"Supletorio (40 % teórico + 60 % práctico)",sup,tp,[.4,.6],TOL);
   teor=tp[0].v;prac=tp[1].v;effective=sup;exam=n2;
   // Del ordinario el sistema guarda solo el total: el desglose se calcula.
   var otp=[{label:"Teórico ordinario",v:null},{label:"Práctico ordinario",v:null}];
   solve(ctx,"Examen ordinario",n2,otp,[.4,.6],TOL);
   ordinarioCalc=has(otp[0].v)?{teorico:otp[0].v,practico:otp[1].v}:null;
   if(has(n2)&&n2>=PASSING)ctx.noCuadra.push("Tiene supletorio aunque aprobó el ordinario ("+n2+").");
  }else{
   n2=solve(ctx,"Examen ordinario (40 % teórico + 60 % práctico)",n2,tp,[.4,.6],TOL);
   teor=tp[0].v;prac=tp[1].v;exam=n2;effective=n2;
  }
  if(!has(effective))warnings.push("Sin nota de examen.");
  var expected=has(n1)&&has(effective)&&effective>=PASSING?round((n1+effective)/2):null;
  computed=expected;
  if(has(final)&&has(expected)&&Math.abs(final-expected)>TOL_CHAIN)ctx.noCuadra.push("Nota de titulación: (núcleos + examen) / 2 = "+expected+" y el sistema dice "+final+"; se conserva lo del sistema.");
  if(has(final)&&has(effective)&&effective<PASSING)ctx.noCuadra.push("Tiene nota de titulación aunque el examen quedó bajo 7.");
  if(!has(final)&&has(expected)){final=expected;ctx.calculados.push("Nota de titulación");}
  if(!has(n1))warnings.push("Sin promedio de núcleos; no se calcula la nota de titulación.");
  // Desglose de cada núcleo: evaluaciones 1–4 y caso de estudio desde su nota final.
  desglose=nuclei.map(function(v,i){return has(v)?{numero:i+1,evaluaciones:[v,v,v,v],casoEstudio:v,calculado:true}:null;});
  if(nuclei.some(has))ctx.calculados.push("Evaluaciones 1–4 y caso de estudio de los núcleos");
 }else if(tipo==="ARTICULO_ACADEMICO"||tipo==="TRABAJO_TITULACION"){
  var w=tipo==="ARTICULO_ACADEMICO"?0.7:0.6;
  var tl=[{label:"Calificación tutor",v:tutor},{label:"Calificación lector",v:lector}];
  n1=solve(ctx,"Trabajo escrito ((tutor + lector) / 2)",n1,tl,[.5,.5],TOL);
  var pr=vocalRaw.map(function(v){return {label:"Práctica vocal "+v.numero,v:v.practica};});
  var df=vocalRaw.map(function(v){return {label:"Defensa vocal "+v.numero,v:v.defensa};});
  var pp={label:"Promedio evaluación práctica",v:solve({calculados:[],noCuadra:[]},"",null,pr,[1/3,1/3,1/3])};
  var pd={label:"Promedio evaluación defensa",v:solve({calculados:[],noCuadra:[]},"",null,df,[1/3,1/3,1/3])};
  n2=solve(ctx,"Defensa oral ((práctica + defensa) / 2)",n2,[pp,pd],[.5,.5],TOL_CHAIN);
  solve(ctx,"Promedio evaluación práctica",pp.v,pr,[1/3,1/3,1/3],TOL_CHAIN);
  solve(ctx,"Promedio evaluación defensa",pd.v,df,[1/3,1/3,1/3],TOL_CHAIN);
  var e={label:"Trabajo escrito",v:n1},o={label:"Defensa oral",v:n2};
  computed=has(e.v)&&has(o.v)?round(e.v*w+o.v*(1-w)):null;
  var label="Nota final ("+Math.round(w*100)+" % escrito + "+Math.round((1-w)*100)+" % defensa)";
  final=solve(ctx,label,final,[e,o],[w,1-w],TOL);
  n1=e.v;n2=o.v;
  proyecto={pesoEscrito:w,tutor:{nombre:txt(get(r,"nombre_tutor")),nota:tl[0].v},lector:{nombre:txt(get(r,"nombre_lector")),nota:tl[1].v},
   promedioPractica:has(pp.v)?round(pp.v):null,promedioDefensa:has(pd.v)?round(pd.v):null,
   vocales:vocalRaw.map(function(v,i){return {numero:v.numero,nombre:v.nombre,
     practica:has(pr[i].v)?round(pr[i].v):null,defensa:has(df[i].v)?round(df[i].v):null};})};
 }
 if(final===null)warnings.push("Sin resultado final; se conservan únicamente componentes disponibles.");
 ctx.noCuadra.forEach(function(m){warnings.push("No cuadra: "+m);});
 var calculados=ctx.calculados.filter(function(v,i,all){return v&&all.indexOf(v)===i;});
 return {cedula:cedula,periodoId:periodoId,periodoSistemaId:periodoId,periodoSistema:txt(get(r,"periodo_academico")),tipo:tipo,
   nota1:n1,nota2:n2,final:final,
   supletorio:sup,teorico:teor,practico:prac,notaExamen:exam,notaExamenAplicada:effective,
   promedioNucleos:n1!==null&&tipo==="EXAMEN_COMPLEXIVO"?n1:null,nucleos:nuclei,codigosNucleos:code,desgloseNucleos:desglose,
   ordinarioCalculado:ordinarioCalc,proyecto:proyecto,notaPromedioAcumulado:accumulated,
   antiplagio:antiplagio,codigoTitulacion:txt(get(r,"codigoTitulacion")),
   calculado:computed,calculados:calculados,noCuadra:ctx.noCuadra,errors:errors,warnings:warnings,raw:raw};
}
root.CargaNotasRules=Object.freeze({version:"2.0.0",grade:grade,period:period,modality:modality,parse:parse,round:round,compare:compare,cid:cid});
})(typeof window!=="undefined"?window:globalThis);
