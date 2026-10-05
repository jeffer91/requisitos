"use strict";
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const errors=[];
function read(file){return fs.readFileSync(path.join(root,file),"utf8");}
function ok(condition,message){if(!condition)errors.push(message);}
function syntax(file){try{new vm.Script(read(file),{filename:file});}catch(error){errors.push(`${file}: ${error.message}`);}}
[
  "StatNot/stat-not.bootstrap.js","StatNot/stat-not.model.js","StatNot/stat-not.app.js",
  "BDLocal/conexiones/cone.statnot.js","BDLocal/conexiones/cone.registry.js",
  "BDLocal/conexiones/cone.screen-map.js","Maqueta/maq-core.js","Maqueta/maq-menu.js","Maqueta/maq-config-service.js","Maqueta/maq-modulos-registry.js","electron/smoke-navigation-main.js"
].forEach(syntax);

const sandbox={window:{},console};sandbox.window.window=sandbox.window;
vm.runInNewContext(read("BDLocal/rules/bdl.rules.defense-eligibility.js"),sandbox,{filename:"defense-rule.js"});
vm.runInNewContext(read("StatNot/stat-not.model.js"),sandbox,{filename:"stat-not.model.js"});
const M=sandbox.window.StatNotModel;
const goodReq={tipoPeriodo:"PVC",academico:"CUMPLE",documentacion:"CUMPLE",financiero:"CUMPLE",practicasvinculacion:"CUMPLE",vinculacion:"CUMPLE",seguimientograduados:"CUMPLE",ingles:"CUMPLE",actualizaciondatos:"CUMPLE"};
function row(extra){return Object.assign({cedula:"1",Nombres:"Prueba",carrera:"Carrera A"},goodReq,extra||{});}
const eligibleMissingDef=M.decorate(row({Notart:8}));
ok(eligibleMissingDef._snEligible===true,"N-ART >= 7 + requisitos completos debe habilitar N-DEF");
ok(eligibleMissingDef._snMissingDef===true,"Habilitado sin N-DEF debe contar como falta N-DEF");
const blocked=M.decorate(row({Notart:8,financiero:"NO CUMPLE"}));
ok(blocked._snEligible===false,"Requisitos incompletos deben bloquear N-DEF");
ok(blocked._snMissingDef===false,"Bloqueado no debe inflar Falta N-DEF");
const failedArt=M.decorate(row({Notart:6.5}));
ok(failedArt._snFailedArt&&failedArt._snSupplement,"N-ART < 7 debe clasificar supletorio Art");
const failedDef=M.decorate(row({Notart:8,Notdef:6}));
ok(failedDef._snFailedDef&&failedDef._snSupplement,"N-DEF < 7 debe clasificar supletorio Def");
const approved=M.decorate(row({Notart:8,Notdef:9}));
ok(approved._snApproved===true&&approved._snNfin===8.3,"N-FIN debe calcular 70/30 y aprobar");
const summary=M.summarize([eligibleMissingDef,blocked,failedArt,failedDef,approved]);
ok(summary.missingDef===1,"Resumen debe contar solo una N-DEF realmente pendiente");
ok(summary.supplement===2,"Resumen debe separar dos estudiantes en supletorio");

const config=read("Maqueta/maq-config-service.js");
ok(config.indexOf('moduloId:"defart"')<config.indexOf('moduloId:"stat_not"'),"Stat Not debe ir después de Defensas");
ok(config.indexOf('moduloId:"stat_not"')<config.indexOf('moduloId:"ncomplex"'),"Stat Not debe ir antes de Ncomplex");
ok(!config.includes('moduloId:"titulacion"'),"InPVC ya no debe aparecer en el menú efectivo");
const connector=read("BDLocal/conexiones/cone.statnot.js");
ok(connector.includes("canWrite:false"),"ConStatNot debe ser solo lectura");
ok(!/\bsaveNota\b|\bsaveMany\b/.test(connector),"ConStatNot no debe exponer guardado de notas");
ok(read("Maqueta/maq-core.js").includes('stat_not:{id:"stat_not"'),"El router principal debe poder abrir Stat Not incluso con fallback");

if(errors.length){console.error("VERIFICACIÓN STAT NOT: ERROR\n"+errors.map((e,i)=>`${i+1}. ${e}`).join("\n"));process.exit(1);}
console.log("VERIFICACIÓN STAT NOT: OK");
