"use strict";
/* Prueba del lector estricto de notas remotas para Actas. Sin datos reales. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../Actas/actas.grades.js"),"utf8");
const period="2025-10__2026-03",other="2026-04__2026-09";
const student={cedula:"0101234567",Nombres:"JOSÉ EDUARDO PÉREZ",periodoId:period};
const otherStudent={cedula:"0201234567",Nombres:"ANA PAREDES",periodoId:period};
const dbState={notas_nucleos:[],notas_complexivo:[]};
let online=true;
const db={
 collection(name){return {where(field,operator,value){
  assert.equal(field,"periodoId");assert.equal(operator,"==");assert.equal(value,period);
  return {async get(options){
   assert.equal(options.source,"server");
   if(!online)throw Error("offline");
   return {docs:dbState[name].filter(x=>x.periodoId===value).map((row,i)=>({id:"test_"+name+"_"+i,data:()=>row}))};
  }};
 }};}
};
const sandbox={window:{BL2Sync:{async ensureFirebase(){return db;}}}};
vm.createContext(sandbox);vm.runInContext(source,sandbox,{filename:"actas.grades.js"});
const reader=sandbox.window.ActasGrades;
const grade=(n,value=8.5)=>({periodoId:period,cedula:student.cedula,nucleo:n,notaFinal:value,verificado:true,modalidad:"presencial"});
const exam={periodoId:period,cedula:student.cedula,modalidadTitulacion:"EXAMEN_COMPLEXIVO",estadoEvaluacion:"APROBADO",
 notaTeorica:8,notaPractica:9,notaOficial:8.6,oportunidadAplicada:"ORDINARIA"};
async function main(){
 dbState.notas_nucleos=[1,2,3,4].map(n=>grade(n));
 dbState.notas_nucleos.push({...grade(3),periodoId:other});
 dbState.notas_complexivo=[exam];
 let [s,t]=await reader.enrich(period,[student,otherStudent]);
 assert.equal(s._actasNuclei.length,4,"Solo incorpora los cuatro núcleos del período");
 assert.equal(s._actasComplexivo.notaOficial,8.6,"Recupera examen de la misma identidad");
 assert.equal(t._actasNuclei.length,0,"No comparte notas entre estudiantes");
 assert.equal(t._actasComplexivo,null,"No comparte exámenes");
 dbState.notas_nucleos.push(grade(3,9));
 [s]=await reader.enrich(period,[student]);
 assert.equal(s._actasNuclei.filter(x=>x.nucleo===3).length,2,"No descarta silenciosamente duplicados");
 dbState.notas_nucleos=[1,2,3,4].map(n=>grade(n));
 dbState.notas_complexivo.push({...exam,notaOficial:9});
 [s]=await reader.enrich(period,[student]);
 assert.equal(s._actasComplexivo,null,"Exámenes duplicados se bloquean");
 dbState.notas_complexivo=[];
 [s]=await reader.enrich(period,[student]);
 assert.equal(s._actasComplexivo,null,"Sin examen no se inventan datos");
 online=false;
 await assert.rejects(()=>reader.enrich(period,[student]),/offline/,"La desconexión no se interpreta como aprobación");
 console.log("VERIFICACIÓN LECTOR ACTAS: OK (4 núcleos, examen, duplicados, período y offline)");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
