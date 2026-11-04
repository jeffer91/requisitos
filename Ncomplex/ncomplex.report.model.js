/* Informe académico de complexivos: cálculos reproducibles, sin acceso a red ni escrituras. */
(function(window){
"use strict";
function text(v){return String(v==null?"":v).trim();}
function period(v){return text(v).replace(/_+/g,"__");}
function num(v){
 if(v===null||v===undefined||text(v)==="")return null;
 var n=Number(typeof v==="string"?v.replace(",","."):v);
 return Number.isFinite(n)&&n>=0&&n<=10?n:null;
}
function round(v){return Math.round((v+Number.EPSILON)*100)/100;}
function mean(rows,key){var a=rows.map(function(r){return r[key];});return a.length?round(a.reduce(function(v,n){return v+n;},0)/a.length):null;}
function name(row){return text(row.Nombres||row.nombres||row.nombreCompleto||row.nombre)||"SIN NOMBRE";}
function career(row){return text(row.NombreCarrera||row.carrera||row.Carrera||row.nombreCarrera)||"SIN CARRERA";}
function id(row){return text(row.cedula||row.numeroIdentificacion||row.Cedula).replace(/[^0-9]/g,"");}
function active(row){return !row.eliminado&&!row.retirado&&text(row.estadoMatricula||"ACTIVO").toUpperCase()!=="RETIRADO";}
function gradeStatus(grade,op){
 return grade>=7?"APROBADO":op==="SUPLETORIO"?"SUPLETORIO INSUFICIENTE":"SUPLETORIO PENDIENTE";
}
function assessment(row){
 var check=row._ncomplexRequirements,items=check&&check.requirements;
 return !!(check&&check.eligible===true&&check.complete===9&&check.total===9&&
   Array.isArray(items)&&items.length===9&&items.every(function(item){return item.status==="CUMPLE";}));
}
function classify(row){
 if(!assessment(row))return {status:"requisitos",reason:text(row.requisitosFaltantes||row._ncomplexRequirements&&row._ncomplexRequirements.reason)||"No se acreditaron nueve requisitos CUMPLE"};
 if(row._ncomplexHasSavedEvaluation!==true)return {status:"sinNotas",reason:"Evaluación sin guardar en BDLocal"};
 var opportunity=text(row.oportunidadAplicada).toUpperCase();
 if(opportunity!=="ORDINARIA"&&opportunity!=="SUPLETORIO")return {status:"incidencia",reason:"Oportunidad académica no identificada"};
 var theor=num(opportunity==="SUPLETORIO"?row.notaTeoricaSupletorio:row.notaTeorica);
 var pract=num(opportunity==="SUPLETORIO"?row.notaPracticaSupletorio:row.notaPractica);
 var official=num(row.notaOficial);
 if(theor===null||pract===null||official===null)return {status:"sinNotas",reason:"Faltan teórico, práctico o nota oficial"};
 var computed=round(theor*.4+pract*.6);
 if(Math.abs(computed-official)>.025)return {status:"incidencia",reason:"Nota oficial "+official.toFixed(2)+" no coincide con cálculo "+computed.toFixed(2)};
 var item={name:name(row),cedula:id(row),career:career(row),teorico:theor,practico:pract,final:computed,opportunity:opportunity};
 item.status=gradeStatus(item.final,opportunity);
 return {status:"valido",item:item};
}
function bins(rows,field){
 var labels=["0–3,99","4–5,99","6–6,99","7–7,99","8–8,99","9–10"],out=labels.map(function(label){return {label:label,count:0};});
 rows.forEach(function(row){var n=row[field],i=n<4?0:n<6?1:n<7?2:n<8?3:n<9?4:5;out[i].count++;});
 return out;
}
function build(rows,periodId){
 var pid=period(periodId);if(!pid)throw Error("Seleccione el período académico para el informe.");
 if(!Array.isArray(rows))throw Error("No se recibieron registros académicos.");
 var relevant=rows.filter(function(row){
   return period(row.periodoId||row.periodId)===pid&&active(row)&&text(row.modalidadTitulacion)==="EXAMEN_COMPLEXIVO";
 });
 var counts=Object.create(null);
 relevant.forEach(function(row){var key=id(row);if(key)counts[key]=(counts[key]||0)+1;});
 var map=Object.create(null),incidents=[],total=0;
 function group(row){
   var label=career(row);
   if(!map[label])map[label]={career:label,registered:0,valid:[],excluded:{requisitos:0,sinNotas:0,incidencia:0,duplicados:0}};
   return map[label];
 }
 relevant.forEach(function(row){
   var g=group(row);g.registered++;total++;
   if(!id(row)||counts[id(row)]>1){
     g.excluded.duplicados++;incidents.push({career:g.career,type:"Identidad duplicada o sin cédula"});return;
   }
   var result=classify(row);
   if(result.status==="valido"){g.valid.push(result.item);}
   else{
     g.excluded[result.status]++;
     incidents.push({career:g.career,type:result.status==="requisitos"?"Requisitos incompletos":result.status==="sinNotas"?"Sin notas oficiales completas":"Diferencia académica"});
   }
 });
 var careers=Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es");}).map(function(label){
   var g=map[label],valid=g.valid;
   valid.sort(function(a,b){return a.name.localeCompare(b.name,"es");});
   return {career:g.career,registered:g.registered,rows:valid,count:valid.length,excluded:g.excluded,
     theoretical:mean(valid,"teorico"),practical:mean(valid,"practico"),final:mean(valid,"final"),
     approved:valid.filter(function(r){return r.final>=7;}).length,
     pending:valid.filter(function(r){return r.final<7&&r.opportunity==="ORDINARIA";}).length,
     insufficient:valid.filter(function(r){return r.final<7&&r.opportunity==="SUPLETORIO";}).length,
     distributions:{theoretical:bins(valid,"teorico"),practical:bins(valid,"practico"),final:bins(valid,"final")}};
 });
 var all=careers.reduce(function(list,g){return list.concat(g.rows);},[]);
 var excluded={requisitos:0,sinNotas:0,incidencia:0,duplicados:0};
 careers.forEach(function(g){Object.keys(excluded).forEach(function(k){excluded[k]+=g.excluded[k];});});
 var summary={periodId:pid,registered:total,qualified:all.length,careers:careers.length,
   theoretical:mean(all,"teorico"),practical:mean(all,"practico"),final:mean(all,"final"),
   approved:all.filter(function(r){return r.final>=7;}).length,
   pending:all.filter(function(r){return r.final<7&&r.opportunity==="ORDINARIA";}).length,
   insufficient:all.filter(function(r){return r.final<7&&r.opportunity==="SUPLETORIO";}).length,
   excluded:excluded};
 return {summary:summary,careers:careers,incidents:incidents};
}
window.NcomplexReportModel=Object.freeze({build:build,classify:classify,assessment:assessment,bins:bins});
})(window);
