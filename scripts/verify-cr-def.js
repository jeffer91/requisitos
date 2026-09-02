"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const ROOT=path.resolve(__dirname,".."),errors=[];
function read(file){return fs.readFileSync(path.join(ROOT,file),"utf8");}
function check(v,m){if(!v)errors.push(m);}
function syntax(file){try{new vm.Script(read(file),{filename:file});}catch(error){errors.push(`${file}: ${error.message}`);}}
["BDLocal/rules/bdl.rules.defense-eligibility.js","BDLocal/repositories/bdl.repo.cronograma-defensas.js","Cr-def/cr-def.rules.js","Cr-def/cr-def.data.js","Cr-def/cr-def.scheduler.js","Cr-def/cr-def.scheduler.bridge.js","Cr-def/cr-def.templates.js","BDLocal/conexiones/cone.crdef.js"].forEach(syntax);

const sandbox={console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Set};sandbox.window=sandbox;
let ctx=vm.createContext(sandbox);new vm.Script(read("BDLocal/rules/bdl.rules.defense-eligibility.js")).runInContext(ctx);
const base={tipoPeriodo:"PVC",Academico:"CUMPLE",Documentacion:"APROBADO",Financiero:"CUMPLE","PrácticasVinculacion":"CUMPLE",Vinculacion:"CUMPLE",SeguimientoGraduados:"CUMPLE",Ingles:"CUMPLE","ActualizaciónDatos":"CUMPLE",Notart:8};
let d=sandbox.BDLDefenseEligibility.evaluate(base);
check(d.requirementsOk===true&&d.eligibleForSchedule===true&&d.intento===1,"PVC completo con N-ART >=7 debe quedar apto sin Titulación.");
d=sandbox.BDLDefenseEligibility.evaluate(Object.assign({},base,{tipoPeriodo:"REGULAR"}));
check(d.requirementsOk===false&&(d.missingRequirements||[]).some(x=>/Titul/i.test(x)),"Regular debe exigir Titulación.");
d=sandbox.BDLDefenseEligibility.evaluate(Object.assign({},base,{Notdef:6}));
check(d.eligibleForSchedule===true&&d.intento===2&&d.noteState==="DEFENSA_NO_APROBADA","N-DEF <7 debe ser supletorio.");
d=sandbox.BDLDefenseEligibility.evaluate(Object.assign({},base,{Notdef:7}));
check(d.eligibleForSchedule===false&&d.noteState==="APROBADO","N-DEF >=7 no debe volver a cronogramarse.");

const tpl={duration:30,detectCareerKey:c=>c==="Carrera A"?"a":"b",templatesPorCarrera:c=>[{id:"t",sede:"Matriz",duracionMinutos:30,bloques:[{dia:"",aula:"301",inicio:"10:00",fin:"11:00",tribunalId:c==="Carrera A"?"ta":"tb"}]}],tribunalPorId:id=>id==="ta"?{tribunal1:"J1",tribunal2:"J2",tribunal3:"J3"}:{tribunal1:"K1",tribunal2:"K2",tribunal3:"K3"},tribunalesPorCarrera:()=>[]};
const ss={console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Set,CR_DEF_CONFIG:{duracionMinutos:30},CR_DEF_TEMPLATES:tpl};ss.window=ss;ctx=vm.createContext(ss);new vm.Script(read("Cr-def/cr-def.scheduler.js")).runInContext(ctx);
check(ss.CR_DEF_SCHEDULER.fechas("31/02/2026").length===0,"Debe rechazar fechas imposibles.");
const occupied=[{dia:"10/09/2026",hora:"10:00 a 10:30",sede:"Matriz",aula:"301",tribunal1:"X",tribunal2:"Y",tribunal3:"Z"}];
const generated=ss.CR_DEF_SCHEDULER.generar([{id:"2",carrera:"Carrera B",sede:"Matriz",estadoClave:"apto",alertas:[]}],{diasGlobal:"10/09/2026",existingRows:occupied});
check(generated.rows[0].hora==="10:30 a 11:00","Generación filtrada debe respetar ocupación externa.");
const data=read("Cr-def/cr-def.data.js"),app=read("Cr-def/cr-def.js"),templates=read("Cr-def/cr-def.templates.js"),connector=read("BDLocal/conexiones/cone.crdef.js");
check(data.includes('matricula:"ACTIVO"'),"Cr-def debe solicitar matrículas activas.");
check(app.includes("cacheStale"),"Cr-def debe bloquear cache obsoleta.");
check(!app.includes("if(!window.BL2DB)"),"Cr-def no debe depender directamente de BL2DB.");
check(templates.includes('return "sin_carrera"'),"Carrera vacía no debe caer en Administración.");
check(templates.includes("allowedCareerKeys"),"Plantillas mixtas deben restringirse.");
check(connector.includes("cronograma_defensas")&&connector.includes("saveSchedules"),"Cronograma debe persistirse.");
if(errors.length){console.error("\nVERIFICACIÓN CR-DEF: ERROR\n");errors.forEach((e,i)=>console.error(`${i+1}. ${e}`));process.exit(1);}
console.log("VERIFICACIÓN CR-DEF: OK");
