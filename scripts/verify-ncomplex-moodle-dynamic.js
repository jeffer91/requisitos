"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const window={},context=vm.createContext({window});
["ncomplex.config.js","ncomplex.calculator.js","ncomplex.parser.js","ncomplex.matcher.js"].forEach(name=>{
 vm.runInContext(fs.readFileSync(path.join(__dirname,"../Ncomplex",name),"utf8"),context,{filename:name});
});
const parser=window.NcomplexParser;
const te="CuestionarioCOMPONENTE TEÓRICO EXAMEN COMPLEXIVO";
const pr="CuestionarioCOMPONENTE PRACTICO EXAMEN COMPLEXIVO";
const tt="Media de calificacionesTotal Teórico";
const tp="Media de calificacionesTotal Práctico";
const total="SumaTotal del curso";
function book(headers,grades,name){
 return ["Examen Complexivo Curso Experimental 2026","Nombre / Apellido(s)","Dirección de correo"]
  .concat(headers,[name||"MARIA ELENA ROJAS VEGA","maria@ejemplo.edu"],grades,["Promedio general"]).join("\n");
}
const varying=[
 {h:[pr,te],v:["60,00","80,00"],result:6.8},
 {h:[te,pr,tt,total],v:["70,00","60,00","28,00","64,00"],result:6.4},
 {h:[te,te+" (VERSION 2)",tt,pr,tp,total],v:["-","96,00","38,40","95,00","57,00","95,40"],result:9.54},
 {h:[pr,tp,te,tt,total],v:["60,00","36,00","21,00","8,40","44,40"],result:4.44}
];
varying.forEach((data,index)=>{
 const parsed=parser.parse(book(data.h,data.v));
 assert.equal(parsed.rows.length,1,"Formato "+index);
 assert.equal(parsed.rows[0].blocked,false,"No debe rechazar formato "+index);
 assert.equal(Math.round((parsed.rows[0].notaTeorica*.4+parsed.rows[0].notaPractica*.6)*100)/100,data.result);
});
const nine=book([te,te+" (VERSION 2)",tt,pr,pr+" (VERSION 2)",tp,total,te+" Supletorio",pr+" Supletorio"],
 ["72,00","-","28,80","75,00","-","45,00","73,80","-","-"]);
assert.equal(parser.parse(nine).rows[0].blocked,false);
assert.equal(parser.parse(nine).rows[0].layout,"moodle_dinamico");
const twoVersions=book([te,te+" (VERSION 2)",pr],["80,00","90,00","80,00"]);
assert.equal(parser.parse(twoVersions).rows[0].blocked,true,"No seleccionar dos versiones simultáneas");
const unknown=book([te,"Cuestionario SIMULACRO EXTRA",pr],["80,00","70,00","90,00"]);
assert.equal(parser.parse(unknown).rows[0].blocked,true,"No reasignar actividad desconocida");
const broken=book([te,pr,tt],["80,00","90,00"]);
assert.equal(parser.parse(broken).rows[0].blocked,true,"No interpretar columnas desalineadas");
const tsvHeaders=["Nombre / Apellido(s)","Dirección de correo",te,te+" (VERSION 2)",tt,pr,tp,total].join("\t");
const tsvScores=["MARIA ELENA ROJAS VEGA","maria@ejemplo.edu","","96,00","38,40","95,00","57,00","95,40"].join("\t");
const tsv=parser.parse(["Examen Complexivo Curso 2026",tsvHeaders,tsvScores,"Promedio general"].join("\n"));
assert.equal(tsv.rows.length,1,"Debe leer filas horizontales con tabs");
assert.equal(tsv.rows[0].blocked,false,JSON.stringify(tsv.rows[0].issues));
assert.equal(tsv.rows[0].notaTeorica,9.6);
assert.equal(tsv.rows[0].notaPractica,9.5);
const emDash=parser.parse(book([te,te+" (VERSION 2)",pr],["—","96,00","80,00"]));
assert.equal(emDash.rows[0].blocked,false,"Los guiones Unicode significan nota ausente");
assert.equal(emDash.rows[0].notaTeorica,9.6);
const percent=parser.parse(book([te,pr],["80,00%","90,00%"]));
assert.equal(percent.rows[0].blocked,false,"Porcentajes explícitos válidos");
assert.equal(percent.rows[0].notaTeorica,8);
console.log("VERIFICACIÓN NCOMPLEX ESQUEMA DINÁMICO: OK (2/3/4/5/6/9, reordenados, TSV, versiones y conflictos)");
