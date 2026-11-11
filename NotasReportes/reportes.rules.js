/* reportes.rules.js — /NotasReportes
 * Reglas puras (sin DOM ni red) para los Excels de Notas → Descargas.
 *
 * Períodos
 *   REGULAR: Abril–Septiembre y Octubre–Marzo → Complexivo (Presencial / Online) y Trabajo.
 *   PVC:     cualquier otro → Artículo académico, sin separar Presencial / Online.
 *
 * Etapas (requisitos de la base local)
 *   Habilitado = 8 requisitos en CUMPLE: Académico, Documentación, Financiero,
 *                Prácticas, Vinculación, Seguimiento a graduados, Inglés, Actualización de datos.
 *   Complexivo: habilitado → Núcleos;  Titulación CUMPLE (aprobó núcleos) → Complexivo.
 *   Trabajo y Artículo: habilitado → Notas;  Titulación CUMPLE = título subido.
 */
(function(root){
"use strict";
var AREAS=[
 {key:"Academico",label:"Académico"},
 {key:"Documentacion",label:"Documentación"},
 {key:"Financiero",label:"Financiero"},
 {key:"PracticasVinculacion",label:"Prácticas",aliases:["Practicas","PracticasPreprofesionales"]},
 {key:"Vinculacion",label:"Vinculación"},
 {key:"SeguimientoGraduados",label:"Seguimiento a graduados",aliases:["Seguimiento"]},
 {key:"Ingles",label:"Inglés",aliases:["SegundaLengua"]},
 {key:"ActualizacionDatos",label:"Actualización de datos"},
 {key:"Titulacion",label:"Titulación"},
 {key:"AprobacionComplexivoProyecto",label:"Aprobación complexivo-proyecto"},
 {key:"AprobacionTitulacion",label:"Aprobación titulación"}
];
var GATE=AREAS.slice(0,8).map(function(a){return a.key;});
var MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
var CORTO=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function txt(v){return String(v==null?"":v).trim();}
function key(v){return txt(v).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");}
function num(v){if(v===null||v===undefined||v==="")return null;var n=Number(String(v).replace(",","."));return isFinite(n)?Math.round(n*100)/100:null;}
function ced(v){var c=txt(v).replace(/\D/g,"");return c&&c.length<10?c.padStart(10,"0"):c;}

function parsePeriod(id){var m=txt(id).match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);return m?{y1:+m[1],m1:+m[2],y2:+m[3],m2:+m[4]}:null;}
function periodKind(id){
 var p=parsePeriod(id);if(!p)return "";
 if((p.m1===4&&p.m2===9)||(p.m1===10&&p.m2===3))return "REGULAR";
 return "PVC";
}
function periodShort(id){var p=parsePeriod(id);return p?CORTO[p.m1-1]+p.y1+"-"+CORTO[p.m2-1]+p.y2:txt(id);}
function periodLong(id){var p=parsePeriod(id);return p?MESES[p.m1-1]+" "+p.y1+" a "+MESES[p.m2-1]+" "+p.y2:txt(id);}

/* Presencial / Online por el código de carrera (-P- / -L-). Un código incompleto
   sin «ONLINE» en el nombre se toma como Presencial (igual que Cargado de notas). */
function group(student){
 var c=txt(student&&(student.CodigoCarrera||student.codigoCarrera)).toUpperCase(),n=key(student&&(student.NombreCarrera||student.nombreCarrera));
 if(/-L-/.test(c)||/online|enlinea/.test(n))return "ONLINE";
 return "PRESENCIAL";
}
function status(v){
 var raw=key(v&&typeof v==="object"?(v.valor!==undefined?v.valor:v.estado!==undefined?v.estado:v.value):v);
 return raw==="cumple"||raw==="aprobado"||raw==="si"?"CUMPLE":raw==="nocumple"||raw==="reprobado"||raw==="no"?"NO CUMPLE":"SIN DATO";
}
// Valor de un área en el mapa «valores» del requisito (tolerante a mayúsculas y tildes).
function areaValue(valores,area){
 var map={};Object.keys(valores||{}).forEach(function(k){map[key(k)]=valores[k];});
 var names=[area.key].concat(area.aliases||[]);
 for(var i=0;i<names.length;i++){if(map[key(names[i])]!==undefined)return status(map[key(names[i])]);}
 return "SIN DATO";
}
function requirements(valores){var out={};AREAS.forEach(function(a){out[a.key]=areaValue(valores,a);});return out;}
function enabled(req){return GATE.every(function(k){return req[k]==="CUMPLE";});}
function active(st){var s=txt(st&&(st.estadoMatricula||st._estadoMatricula)).toUpperCase();return st&&st.retirado!==true&&s!=="RETIRADO";}
function gradeState(v){return v===null||v===undefined?"Sin nota":v>=7?"Aprobado":"Reprobado";}

/* Estudiantes del período con todo lo que necesitan los Excels. */
function students(input){
 var kind=periodKind(input.periodoId),reqBy={},mod={},nuc={},cx={},tr={},ar={};
 (input.requisitos||[]).forEach(function(r){var c=ced(r.cedula||r.numeroIdentificacion);if(c&&!r.eliminado)reqBy[c]=Object.assign(reqBy[c]||{},r.valores||{});});
 (input.modalidades||[]).forEach(function(m){var c=ced(m.cedula);if(c)mod[c]=txt(m.modalidadTitulacion).toUpperCase();});
 (input.notas_nucleos||[]).forEach(function(d){var c=ced(d.cedula);(nuc[c]=nuc[c]||[null,null,null,null])[Number(d.nucleo)-1]=d;});
 (input.notas_complexivo||[]).forEach(function(d){cx[ced(d.cedula)]=d;});
 (input.notas_trabajo||[]).forEach(function(d){tr[ced(d.cedula)]=d;});
 (input.notas_articulo||[]).forEach(function(d){ar[ced(d.cedula)]=d;});
 var seen={};
 return (input.matriculas||[]).filter(active).map(function(st){
  var c=ced(st.cedula||st.Cedula||st.numeroIdentificacion);if(!c||seen[c])return null;seen[c]=1;
  var req=requirements(reqBy[c]);
  var modalidad=kind==="PVC"?"ARTICULO_ACADEMICO":(mod[c]==="TRABAJO_TITULACION"||(!mod[c]&&tr[c])?"TRABAJO_TITULACION":"EXAMEN_COMPLEXIVO");
  return {cedula:c,nombre:txt(st.Nombres||st.nombres||st.nombreCompleto)||"(sin nombre)",
   carrera:txt(st.NombreCarrera||st.nombreCarrera)||"SIN CARRERA",codigo:txt(st.CodigoCarrera||st.codigoCarrera),
   grupo:group(st),req:req,habilitado:enabled(req),modalidad:modalidad,modalidadMarcada:!!mod[c],
   nucleos:nuc[c]||[null,null,null,null],complexivo:cx[c]||null,trabajo:tr[c]||null,articulo:ar[c]||null};
 }).filter(Boolean).sort(function(a,b){return a.carrera.localeCompare(b.carrera,"es")||a.nombre.localeCompare(b.nombre,"es");});
}

/* ---------- Hojas ---------- */
function sheetName(name,used){
 var base=txt(name).replace(/[\[\]\*\?\/\\:]/g," ").replace(/\s+/g," ").trim()||"Hoja";
 base=base.slice(0,31);var out=base,i=2;
 while(used[out.toUpperCase()]){var suf=" ("+i+")";out=base.slice(0,31-suf.length)+suf;i++;}
 used[out.toUpperCase()]=1;return out;
}
function byCareer(list){var m={},order=[];list.forEach(function(s){if(!m[s.carrera]){m[s.carrera]=[];order.push(s.carrera);}m[s.carrera].push(s);});
 return order.sort(function(a,b){return a.localeCompare(b,"es");}).map(function(c){return {carrera:c,list:m[c]};});}
function modLabel(m){return m==="TRABAJO_TITULACION"?"Trabajo de titulación":m==="ARTICULO_ACADEMICO"?"Artículo académico":"Examen complexivo";}
function grpLabel(g){return g==="ONLINE"?"Online":g==="PRESENCIAL"?"Presencial":g;}

function requisitosBook(list,ctx){
 var used={},sheets=[],showMod=ctx.kind==="REGULAR";
 var sum=[["Requisitos · "+ctx.titulo],["Período: "+periodLong(ctx.periodoId)+" · "+list.length+" estudiantes"],[],
  ["Área","Cumple","No cumple","Sin dato","Total"]];
 AREAS.forEach(function(a){
  var c=0,n=0,s=0;list.forEach(function(x){var v=x.req[a.key];if(v==="CUMPLE")c++;else if(v==="NO CUMPLE")n++;else s++;});
  sum.push([a.label,c,n,s,list.length]);
 });
 sheets.push({name:sheetName("Resumen",used),rows:sum,cols:[30,10,12,10,8]});
 var order={"CUMPLE":0,"NO CUMPLE":1,"SIN DATO":2};
 AREAS.forEach(function(a){
  var head=["#","Cédula","Estudiante","Carrera"].concat(showMod?["Modalidad"]:[]).concat(["Estado"]);
  var rows=list.slice().sort(function(x,y){return order[x.req[a.key]]-order[y.req[a.key]]||x.carrera.localeCompare(y.carrera,"es")||x.nombre.localeCompare(y.nombre,"es");})
   .map(function(x,i){return [i+1,x.cedula,x.nombre,x.carrera].concat(showMod?[modLabel(x.modalidad)]:[]).concat([x.req[a.key]]);});
  sheets.push({name:sheetName(a.label,used),rows:[head].concat(rows),cols:[5,13,40,42].concat(showMod?[22]:[]).concat([12]),filter:true});
 });
 return sheets;
}
function careerSummary(groups,ctx,label,finalOf){
 var rows=[[label+" · "+ctx.titulo],["Período: "+periodLong(ctx.periodoId)],[],["Carrera","Estudiantes","Con nota","Aprobados","Reprobados","Promedio"]];
 var tot={n:0,c:0,a:0,r:0,s:0};
 groups.forEach(function(g){
  var vals=g.list.map(finalOf).filter(function(v){return v!==null;});
  var a=vals.filter(function(v){return v>=7;}).length,avg=vals.length?Math.round(vals.reduce(function(x,y){return x+y;},0)/vals.length*100)/100:"";
  rows.push([g.carrera,g.list.length,vals.length,a,vals.length-a,avg]);
  tot.n+=g.list.length;tot.c+=vals.length;tot.a+=a;tot.r+=vals.length-a;vals.forEach(function(v){tot.s+=v;});
 });
 rows.push(["TOTAL",tot.n,tot.c,tot.a,tot.r,tot.c?Math.round(tot.s/tot.c*100)/100:""]);
 return {name:"Resumen",rows:rows,cols:[44,12,10,11,12,10]};
}
function g(v){return v===null||v===undefined?"":v;}
function promedioNucleos(x){
 var p=num(x.complexivo&&x.complexivo.promedioNucleos);if(p!==null)return p;
 var t=x.nucleos.map(function(d){return d?num(d.totalMoodle):null;});
 return t.every(function(v){return v!==null;})?Math.round(t.reduce(function(a,b){return a+b;},0)/4*100)/100:null;
}
function nucleosBook(list,ctx){
 var used={},groups=byCareer(list),sheets=[careerSummary(groups,ctx,"Núcleos",promedioNucleos)];used.RESUMEN=1;
 var head=["#","Cédula","Estudiante","Carrera"];
 [1,2,3,4].forEach(function(n){head.push("N"+n+" Ev.1","N"+n+" Ev.2","N"+n+" Ev.3","N"+n+" Ev.4","N"+n+" Caso estudio","N"+n+" Nota");});
 head.push("Promedio núcleos","Estado","Desglose");
 groups.forEach(function(gr){
  var rows=gr.list.map(function(x,i){
   var r=[i+1,x.cedula,x.nombre,x.carrera],calc=false;
   x.nucleos.forEach(function(d){
    var ev=d&&Array.isArray(d.evaluaciones)?d.evaluaciones:[];
    for(var k=0;k<4;k++)r.push(g(num(ev[k])));
    r.push(g(d?num(d.casoEstudio):null),g(d?num(d.totalMoodle):null));
    if(d&&d.desgloseCalculado===true)calc=true;
   });
   var p=promedioNucleos(x);
   r.push(g(p),gradeState(p),calc?"Evaluaciones calculadas desde la nota del núcleo":"");
   return r;
  });
  var cols=[5,13,40,40];for(var k=0;k<24;k++)cols.push(9);cols.push(11,11,44);
  sheets.push({name:sheetName(gr.carrera,used),rows:[head].concat(rows),cols:cols,filter:true});
 });
 return sheets;
}
function complexivoBook(list,ctx){
 var oficial=function(x){return x.complexivo?num(x.complexivo.notaFinalIntegral!==undefined&&x.complexivo.notaFinalIntegral!==null?x.complexivo.notaFinalIntegral:x.complexivo.notaOficial):null;};
 var used={RESUMEN:1},groups=byCareer(list),sheets=[careerSummary(groups,ctx,"Examen complexivo",oficial)];
 var head=["#","Cédula","Estudiante","Carrera","Promedio núcleos","Teórico","Práctico","Ordinario","Teórico supletorio","Práctico supletorio","Supletorio",
  "Examen que vale","Nota titulación","Oportunidad","Estado","Aprobación complexivo-proyecto","Aprobación titulación"];
 groups.forEach(function(gr){
  var rows=gr.list.map(function(x,i){
   var d=x.complexivo||{},exam=num(d.notaOficial),fin=num(d.notaFinalIntegral);
   var sup=d.oportunidadAplicada==="SUPLETORIO"||num(d.notaSupletorio)!==null;
   var estado=exam===null?"Sin nota":exam>=7?"Aprobado":"Reprobado";
   return [i+1,x.cedula,x.nombre,x.carrera,g(promedioNucleos(x)),g(num(d.notaTeorica)),g(num(d.notaPractica)),
    g(num(d.notaOrdinaria!==undefined?d.notaOrdinaria:d.notaComplexivo)),g(num(d.notaTeoricaSupletorio)),g(num(d.notaPracticaSupletorio)),g(num(d.notaSupletorio)),
    g(exam),g(fin),x.complexivo?(sup?"Supletorio":"Ordinaria"):"",estado,x.req.AprobacionComplexivoProyecto,x.req.AprobacionTitulacion];
  });
  sheets.push({name:sheetName(gr.carrera,used),rows:[head].concat(rows),cols:[5,13,40,40,11,9,9,10,11,11,11,11,11,12,11,16,14],filter:true});
 });
 return sheets;
}
function trabajoBook(list,ctx){
 var fin=function(x){return x.trabajo?num(x.trabajo.notaFinal):null;};
 var used={RESUMEN:1},groups=byCareer(list),sheets=[careerSummary(groups,ctx,"Trabajo de titulación",fin)];
 var head=["#","Cédula","Estudiante","Carrera","Grupo","Tutor","Lector","Escrito (60 %)","Práctica","Defensa","Oral (40 %)","Nota final","Estado","Titulación","Aprobación titulación"];
 groups.forEach(function(gr){
  var rows=gr.list.map(function(x,i){var d=x.trabajo||{};
   return [i+1,x.cedula,x.nombre,x.carrera,grpLabel(x.grupo),g(num(d.calificacionTutor)),g(num(d.calificacionLector)),g(num(d.promedioTrabajoEscrito)),
    g(num(d.promedioEvaluacionPractica)),g(num(d.promedioEvaluacionDefensa)),g(num(d.promedioDefensaOral)),g(fin(x)),gradeState(fin(x)),x.req.Titulacion,x.req.AprobacionTitulacion];});
  sheets.push({name:sheetName(gr.carrera,used),rows:[head].concat(rows),cols:[5,13,40,40,11,8,8,11,9,9,10,10,11,12,14],filter:true});
 });
 return sheets;
}
function articuloBook(list,ctx){
 var fin=function(x){return x.articulo?num(x.articulo.notaFinal):null;};
 var used={RESUMEN:1},groups=byCareer(list),sheets=[careerSummary(groups,ctx,"Artículo académico",fin)];
 var head=["#","Cédula","Estudiante","Carrera","Escrito (70 %)","Defensa (30 %)","Nota final","Estado","Titulación"];
 groups.forEach(function(gr){
  var rows=gr.list.map(function(x,i){var d=x.articulo||{};
   return [i+1,x.cedula,x.nombre,x.carrera,g(num(d.notaArticulo)),g(num(d.notaDefensa)),g(fin(x)),gradeState(fin(x)),x.req.Titulacion];});
  sheets.push({name:sheetName(gr.carrera,used),rows:[head].concat(rows),cols:[5,13,40,40,12,12,10,11,12],filter:true});
 });
 return sheets;
}

/* Lista de Excels del período con quién entra en cada uno. */
function plan(all,periodoId){
 var kind=periodKind(periodoId),short=periodShort(periodoId),files=[];
 function file(id,titulo,grupo,list,builder,regla){
  files.push({id:id,titulo:titulo,grupo:grupo,regla:regla,count:list.length,
   // Nombre sin tildes: algunos navegadores descartan nombres no ASCII y guardan «download».
   fileName:titulo.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^0-9A-Za-z]+/g,"_").replace(/_+$/,"")+"_"+short+".xlsx",
   build:function(){return builder(list,{kind:kind,periodoId:periodoId,titulo:titulo});}});
 }
 if(kind==="REGULAR"){
  ["PRESENCIAL","ONLINE"].forEach(function(gr){
   var gl=grpLabel(gr),mine=all.filter(function(x){return x.grupo===gr;});
   var cx=mine.filter(function(x){return x.modalidad==="EXAMEN_COMPLEXIVO";});
   file("req_"+gr,"Requisitos "+gl,gl,mine,requisitosBook,"Todos los estudiantes activos (complexivo y trabajo).");
   file("nuc_"+gr,"Núcleos "+gl,gl,cx.filter(function(x){return x.habilitado;}),nucleosBook,"Complexivo con los 8 requisitos en CUMPLE.");
   file("cx_"+gr,"Complexivo "+gl,gl,cx.filter(function(x){return x.habilitado&&x.req.Titulacion==="CUMPLE";}),complexivoBook,"Complexivo con Titulación en CUMPLE (aprobó núcleos).");
  });
  file("trabajo","Trabajo de titulación","Trabajo de titulación",all.filter(function(x){return x.modalidad==="TRABAJO_TITULACION"&&x.habilitado;}),trabajoBook,
   "Marcados como Trabajo con los 8 requisitos en CUMPLE.");
 }else if(kind==="PVC"){
  file("req_pvc","Requisitos PVC","PVC",all,requisitosBook,"Todos los estudiantes activos.");
  file("articulo","Artículo académico","PVC",all.filter(function(x){return x.habilitado;}),articuloBook,"Con los 8 requisitos en CUMPLE.");
 }
 return {kind:kind,files:files};
}
root.NotasReportesRules=Object.freeze({version:"1.0.0",AREAS:AREAS,GATE:GATE,periodKind:periodKind,periodShort:periodShort,periodLong:periodLong,
 group:group,status:status,requirements:requirements,enabled:enabled,students:students,plan:plan,sheetName:sheetName,
 requisitosBook:requisitosBook,nucleosBook:nucleosBook,complexivoBook:complexivoBook,trabajoBook:trabajoBook,articuloBook:articuloBook});
})(typeof window!=="undefined"?window:globalThis);
