"use strict";
// Consistencia: matrícula por período, requisitos y notas entre Stats y Stat Not.
const assert=require("assert");
const fs=require("fs");
const path=require("path");
const vm=require("vm");
const ROOT=path.join(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(ROOT,relative),"utf8");
const PERIOD="2026-02__2026-08";
const BASE=["academico","documentacion","financiero","practicasvinculacion","vinculacion","seguimientograduados","ingles","actualizaciondatos"];
const students=[
  {cedula:"0100000001",periodoId:PERIOD,estadoMatricula:"ACTIVO",retirado:true,Notart:8,Notdef:9},
  {cedula:"0100000002",periodoId:PERIOD,estadoMatricula:"ACTIVO",Notart:5,Notdef:null},
  {cedula:"0100000003",periodoId:PERIOD,estadoMatricula:"RETIRADO",Notart:9,Notdef:8}
];
const requirements=[];
BASE.forEach(function(key){
  requirements.push({cedula:"0100000001",periodoId:PERIOD,requisitoKey:key,valor:"CUMPLE"});
  requirements.push({cedula:"0100000002",periodoId:PERIOD,requisitoKey:key,valor:key==="financiero"?"NO CUMPLE":"CUMPLE"});
  requirements.push({cedula:"0100000001",periodoId:"2025-02__2025-08",requisitoKey:key,valor:"NO CUMPLE"});
});
const rules={};rules.window=rules;
vm.runInNewContext(read("BDLocal/rules/bdl.rules.defense-eligibility.js"),rules);
const readPeriods=[];
const win={
  BDLRepoRequisitos:{list:function(query){
    readPeriods.push(query.periodoId);
    return Promise.resolve(requirements.filter(row=>row.periodoId===query.periodoId));
  }},
  BDLDefenseEligibility:rules.BDLDefenseEligibility,
  BDLServiceDefensas:{getFiltered:function(filters){
    return Promise.resolve(students.filter(function(row){
      return row.periodoId===filters.periodoId&&(!filters.matricula||row.estadoMatricula===filters.matricula);
    }));
  }},
  BDLServicePeriodos:{list:()=>Promise.resolve([{id:PERIOD}])},
  BDLocalScreenDeps:{ready:()=>Promise.resolve({ok:true})},
  BDLocalRuntimeDeps:{ensure:()=>Promise.resolve({ok:true})}
};
win.window=win;
const doc={baseURI:"file:///app/BDLocal/conexiones/cone.statnot.js",currentScript:null,scripts:[],documentElement:{}};
vm.runInNewContext(read("BDLocal/conexiones/cone.statnot.js"),{window:win,document:doc,Promise,Date,URL});
(async function(){
  const rows=await win.ConStatNot.listStudents({periodoId:PERIOD,matricula:"ACTIVO"});
  assert.strictEqual(rows.length,2,"Solo estudiantes activos");
  assert.strictEqual(readPeriods.length,1,"Una consulta de requisitos por período");
  assert.strictEqual(readPeriods[0],PERIOD,"No mezclar requisitos de otra cohorte");
  const evaluated=rows.map(row=>rules.BDLDefenseEligibility.evaluate(row));
  assert.strictEqual(evaluated[0].requirementsOk,true,"Reconocer requisitos completos");
  assert.strictEqual(evaluated[0].canDef,true,"Artículo aprobado + requisitos completos habilita defensa");
  assert.strictEqual(evaluated[1].requirementsOk,false,"Detectar requisitos incompletos");
  assert.strictEqual(evaluated[1].canArt,true,"Artículo permitido aunque falten requisitos");
  assert.strictEqual(evaluated[1].canDef,false,"Defensa bloqueada");
  assert.strictEqual(evaluated[1].noteState,"ARTICULO_NO_APROBADO","Calificación menor a siete");
  const modelWindow={BDLDefenseEligibility:rules.BDLDefenseEligibility};
  vm.runInNewContext(read("StatNot/stat-not.model.js"),{window:modelWindow});
  const decorated=rows.map(row=>modelWindow.StatNotModel.decorate(row));
  const summary=modelWindow.StatNotModel.summarize(decorated);
  assert.strictEqual(summary.total,2);
  assert.strictEqual(summary.requirementsComplete,1,"Requisitos reales visibles en Stat Not");
  assert.strictEqual(summary.eligible,1,"Habilitados N-DEF");
  assert.strictEqual(summary.approved,1,"Conservar aprobado por notas");
  assert.strictEqual(summary.failed,1,"Conservar supletorio por artículo");
  // La cohorte que llegó se determina por los ocho requisitos previos, no por Titulación.
  assert.strictEqual(summary.reached,1,"Solo el estudiante con los ocho requisitos previos completos llegó");
  assert.strictEqual(summary.approvedReached,1,"Aprobó un estudiante de quienes llegaron");
  assert.strictEqual(summary.failedReached,0,"El reprobado con requisito pendiente no integra los que llegaron");
  assert.strictEqual(summary.reachPct,50,"Llegada: 1/2");
  assert.strictEqual(summary.approvalReachedPct,100,"Aprobación entre los que llegaron: 1/1");
  const rowWithRegularPendingTit=Object.assign({},rows[0],{
    tipoPeriodo:"REGULAR",Titulacion:"NO CUMPLE"
  });
  const regularDecorated=modelWindow.StatNotModel.decorate(rowWithRegularPendingTit);
  assert.strictEqual(regularDecorated._snReached,true,"Titulación pendiente NO excluye al que completó requisitos previos");
  assert.strictEqual(regularDecorated._snEligible,false,"Titulación sí puede bloquear la habilitación ordinaria");
  const approvedWithoutBase=Object.assign({},rows[1],{Notart:8,Notdef:9});
  const failedButReached=Object.assign({},rows[0],{Notart:5,Notdef:null});
  const controlled=[
    modelWindow.StatNotModel.decorate(rows[0]),
    modelWindow.StatNotModel.decorate(approvedWithoutBase),
    modelWindow.StatNotModel.decorate(failedButReached)
  ];
  const cohort=modelWindow.StatNotModel.summarize(controlled);
  assert.strictEqual(cohort.total,3);
  assert.strictEqual(cohort.reached,2);
  assert.strictEqual(cohort.approved,2,"Aprobados generales incluyen resultados fuera de la cohorte previa");
  assert.strictEqual(cohort.approvedReached,1,"No usar aprobados globales en el numerador de fase final");
  assert.strictEqual(cohort.failedReached,1);
  assert.strictEqual(cohort.approvalReachedPct,50,"Aprobación de fase final: 1/2");
  assert.strictEqual(cohort.reachPct,66.7,"Llegada del período: 2/3");
  const noReached=modelWindow.StatNotModel.summarize([controlled[1]]);
  assert.strictEqual(noReached.reached,0);
  assert.strictEqual(noReached.approvedReached,0);
  assert.strictEqual(noReached.approvalReachedPct,0);

  const closureWindow={
    StatsApp:{getState:()=>({periodId:PERIOD,sede:"",division:"",career:""})},
    StatsRules:{
      BASE_REQUIREMENTS:[],FINAL_REQUIREMENTS:[],
      requirementStatus:()=>({cumple:true,applies:true}),
      valueOf:()=>"CUMPLE",isCumple:()=>true
    },
    StatsCore:{resumen:()=>({rows:students})}
  };
  const closureDoc={readyState:"loading",addEventListener(){},getElementById(){return null;}};
  vm.runInNewContext(read("Stats/stats.closure.js"),{window:closureWindow,document:closureDoc,Date,Math,JSON,Object,Array,String,Number,setTimeout,console});
  const closure=closureWindow.StatsClosure.build();
  assert.strictEqual(closure.total,3,"Conservar cohorte");
  assert.strictEqual(closure.active,2,"ACTIVO oficial prevalece sobre retirado histórico");
  assert.strictEqual(closure.retired,1,"RETIRADO oficial");
  delete win.BDLRepoRequisitos;
  await assert.rejects(win.ConStatNot.listStudents({periodoId:PERIOD,matricula:"ACTIVO"}),/requisitos_estudiante/,"No reportar ceros falsos si falla el repositorio");
  console.log("VERIFICACION STATS STATNOT: OK");
})().catch(error=>{console.error("VERIFICACION STATS STATNOT: ERROR",error);process.exitCode=1;});
