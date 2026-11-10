/* scripts/verify-carga-notas.js — Pruebas de ponderaciones y protección de la importación */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,"CargaNotas/carga-notas.rules.js"),"utf8"),sandbox,{filename:"carga-notas.rules.js"});
const {spawnSync}=require("node:child_process");
["CargaNotas/carga-notas.app.js","CargaNotas/carga-notas.rules.js",
 "CargaNotas/carga-notas.firebase.js"].forEach(file=>{
 const result=spawnSync(process.execPath,["--check",path.join(root,file)],{encoding:"utf8"});
 assert.equal(result.status,0,file+": "+(result.stderr||"error de sintaxis"));
});
const html=fs.readFileSync(path.join(root,"CargaNotas/carga-notas.html"),"utf8");
["cone.ncomplex.js","carga.reader.file.js","carga-notas.app.js","carga-notas.firebase.js"].forEach(name=>
 assert.ok(html.includes(name),"Dependencia no cargada: "+name));
const rules=fs.readFileSync(path.join(root,"firestore.rules"),"utf8");
assert.ok(rules.includes("CONSOLIDADO_INSTITUCIONAL"),"Falta el contrato de Trabajo institucional");
const R=sandbox.window.CargaNotasRules;
function row(overrides){return Object.assign({
 identificacion_estudiante:"1725633638",periodo_academico:"OCTUBRE 2025 - MARZO 2026",
 trabajoTitulacion:"Examen Complexivo",tipo_titulacion:"Examen Complexivo",
 nota1:"9.53",nota2:"8.50",notaTrabajoTitulacion:"9.02",
 nota_nucleo1:"9.80",nota_nucleo2:"9.52",nota_nucleo3:"8.90",nota_nucleo4:"9.90",
 notaTeorico:"10.00",notaPractico:"7.50"
},overrides||{});}
let p=R.parse(row());
assert.equal(p.cedula,"1725633638");assert.equal(p.periodoId,"2025-10__2026-03");
assert.equal(p.tipo,"EXAMEN_COMPLEXIVO");assert.equal(p.promedioNucleos,9.53);
assert.equal(p.notaExamenAplicada,8.5);assert.equal(p.calculado,9.02);
assert.equal(p.errors.length,0,p.errors.join(" | "));
p=R.parse(row({identificacion_estudiante:"0105266837",nota1:"8.24",nota2:"4.30",
 notaTrabajoTitulacion:"7.89",notaSupletorio:"7.53",notaTeorico:"9.25",
 notaPractico:"6.39",nota_nucleo1:"8.37",nota_nucleo2:"7.50",
 nota_nucleo3:"8.16",nota_nucleo4:"8.92"}));
assert.equal(p.notaExamenAplicada,7.53);
assert.equal(p.nota2,4.3);
assert.equal(p.calculado,7.89);
assert.equal(p.errors.length,0,p.errors.join(" | "));
p=R.parse(row({trabajoTitulacion:"Artículo académico",tipo_titulacion:"Artículo académico",
 nota1:"8.00",nota2:"9.00",notaTrabajoTitulacion:"8.30",
 notaTeorico:"",notaPractico:"",nota_nucleo1:"",nota_nucleo2:"",
 nota_nucleo3:"",nota_nucleo4:""}));
assert.equal(p.tipo,"ARTICULO_ACADEMICO");assert.equal(p.calculado,8.3);assert.equal(p.errors.length,0,p.errors.join(" | "));
p=R.parse(row({trabajoTitulacion:"Trabajo Titulación",tipo_titulacion:"Trabajo Titulación",
 nota1:"8.00",nota2:"9.00",notaTrabajoTitulacion:"8.40",
 notaTeorico:"",notaPractico:"",nota_nucleo1:"",nota_nucleo2:"",
 nota_nucleo3:"",nota_nucleo4:""}));
assert.equal(p.tipo,"TRABAJO_TITULACION");assert.equal(p.calculado,8.4);assert.equal(p.errors.length,0,p.errors.join(" | "));
p=R.parse(row({tipo_titulacion:"Artículo académico"}));
assert.ok(p.errors.some(x=>x.includes("contradictoria")));
p=R.parse(row({nota_nucleo2:"7.00"}));
assert.ok(p.errors.some(x=>x.includes("Promedio de núcleos")));
p=R.parse(row({notaTeorico:"9.00"}));
assert.ok(p.errors.some(x=>x.includes("Ordinario no coincide")));
p=R.parse(row({notaSupletorio:"7.00",notaTeorico:"",notaPractico:""}));
assert.ok(p.errors.some(x=>x.includes("supletorio no tiene componentes")));
p=R.parse(row({nota1:"15.00"}));
assert.ok(p.errors.some(x=>x.includes("fuera de la escala")));
assert.equal(R.cid("123456789"),"0123456789");
assert.equal(R.period("ABRIL 2026 - SEPTIEMBRE 2026"),"2026-04__2026-09");
console.log("CARGAR NOTAS: OK — cédula, períodos, núcleos, 40/60, supletorio, 50/50, artículo 70/30, trabajo 60/40, bloqueos.");
