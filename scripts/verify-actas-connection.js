"use strict";
/* Prueba de reconciliación de requisitos V2, legacy y nota Ncomplex, sin datos de alumnos reales. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../BDLocal/conexiones/cone.actas.js"),"utf8");
const period="2025-10__2026-03",another="2026-04__2026-09";
const students=[
 {cedula:"987654321",periodoId:period,Nombres:"ESTUDIANTE PRUEBA UNO",modalidadTitulacion:"EXAMEN_COMPLEXIVO",estadoMatricula:"ACTIVO"},
 {cedula:"0000000002",periodoId:period,Nombres:"ESTUDIANTE PRUEBA DOS",modalidadTitulacion:"EXAMEN_COMPLEXIVO",estadoMatricula:"ACTIVO"}
];
const req=(cedula,key,value,p=period)=>({cedula,periodoId:p,requisitoKey:key,valor:value});
const primary=[req("0987654321","academico","NO CUMPLE"),req("0987654321","aprobacionTitulacion","CUMPLE"),req("0987654321","aprobacionComplexivoProyecto","CUMPLE")];
const legacy=[
 req("0987654321","academico","CUMPLE"),req("0987654321","documentacion","CUMPLE"),
 req("0987654321","practicasVinculacion","CUMPLE"),req("0987654321","vinculacion","CUMPLE"),
 req("0987654321","seguimientoGraduados","CUMPLE"),req("0987654321","ingles","CUMPLE"),
 req("0987654321","financiero","CUMPLE"),req("0987654321","titulacion","CUMPLE"),
 req("0000000002","academico","CUMPLE"),
 req("0987654321","financiero","NO CUMPLE",another)
];
const fromCache=[req("0987654321","actualizacionDatos","CUMPLE")];
const evals=[
 {cedula:"0987654321",periodoId:period,modalidadTitulacion:"EXAMEN_COMPLEXIVO",estadoEvaluacion:"APROBADO",notaTeorica:8,notaPractica:9,notaOficial:8.6},
 {cedula:"0000000002",periodoId:another,modalidadTitulacion:"EXAMEN_COMPLEXIVO",estadoEvaluacion:"APROBADO",notaOficial:8.9}
];
const mirror=[{cedula:"0000000002",periodoId:period,origen:"ncomplex",modalidadTitulacion:"EXAMEN_COMPLEXIVO",estadoEvaluacion:"APROBADO",notaTeorica:7,notaPractica:8,notaOficial:7.6}];
const con={
 document:{currentScript:{src:"https://test.local/BDLocal/conexiones/cone.actas.js"},baseURI:"https://test.local/Actas/actas.html"},
 window:{
  BDLRulesRequisitos:{},
  BDLRepoRequisitos:{list:async()=>primary},
  BDLRepoNotas:{list:async()=>{throw Error("No consultar espejo de notas desde Actas");}},
  BDLRepositories:{storeName:()=> "requisitos",safeGetAll:async store=>store==="requisitos"?legacy:[]},
  BDLServices:{get:()=>({list:async()=>students})},
  ConNcomplex:{ready:async()=>({ok:true}),listPeriods:async()=>[{periodoId:period}],listEvaluations:async()=>{throw Error("No consultar evaluaciones desde Actas");}},
  ConCoordi:{getRequirements:()=>fromCache}
 },
 URL,Promise,Map,Set,Date,console
};
vm.runInNewContext(source,con,{filename:"cone.actas.js"});
(async()=>{
 const result=await con.window.ConActas.read({periodoId:period});
 assert.equal(result.ok,true);
 assert.equal(result.data.students.length,2);
 assert.equal(result.data.students[0]._ncomplexEvaluation,undefined,"Actas no carga calificaciones");
  assert.equal(result.data.students[1]._ncomplexEvaluation,undefined,"Actas no recupera notas de respaldo");
  assert.equal(result.meta.diagnostics.matchedEvaluations,undefined);
  assert.equal(result.meta.diagnostics.matchedMirrors,undefined);
  assert.match(result.meta.source,/sin calificaciones/);
  const first=result.data.requirements.filter(r=>r.cedula==="0987654321");
 assert.equal(first.length,11,"Une campos V2, legacy y caché sin duplicar");
 const byKey=Object.fromEntries(first.map(r=>[r.requisitoKey,r.valor]));
 assert.equal(byKey.academico,"NO CUMPLE","El registro V2 prevalece sobre el legacy más antiguo");
 assert.equal(byKey.actualizaciondatos,"CUMPLE","Recupera clave ausente en V2 desde la caché");
 assert.equal(byKey.practicasvinculacion,"CUMPLE");
 assert.equal(byKey.financiero,"CUMPLE","Rechaza requisitos de otros períodos");
 assert.equal(byKey.aprobaciontitulacion,"CUMPLE");
 assert.ok(!result.data.requirements.some(r=>r.periodoId===another));
 let saved=null;
 con.window.ConFicha={
  ready:async()=>({ok:true}),
  updateGraduationModality:async(id,mode,options)=>{
   saved={id,mode,options};
   return {ok:true,value:mode};
  }
 };
 const changed=await con.window.ConActas.setModality({
  periodoId:period,periodoLabel:"Octubre 2025 a Marzo 2026",
  cedula:"0987654321",studentId:"0987654321__"+period,mode:"TRABAJO_TITULACION"
 });
 assert.equal(changed.ok,true);
 assert.equal(saved.id,"0987654321__"+period);
 assert.equal(saved.mode,"TRABAJO_TITULACION");
 assert.equal(saved.options.periodoId,period,"La variable periodoId está definida");
 assert.equal(saved.options.periodId,period,"Ficha recibe también periodId");
 assert.equal(saved.options.periodoLabel,"Octubre 2025 a Marzo 2026");
 console.log("VERIFICACIÓN CONEXIÓN ACTAS: OK (cédula/período, V2, legacy, caché, independencia de Ncomplex, prioridades)");
})().catch(err=>{console.error(err);process.exitCode=1;});
