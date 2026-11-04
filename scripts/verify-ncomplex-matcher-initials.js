"use strict";
/* Regresión: iniciales concatenadas de Moodle y nombres/apellidos reordenados. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,".."),w={};
const sandbox={window:w};
vm.createContext(sandbox);
for(const p of ["Ncomplex/ncomplex.config.js","Ncomplex/ncomplex.calculator.js","Ncomplex/ncomplex.parser.js","Ncomplex/ncomplex.matcher.js"]){
 vm.runInContext(fs.readFileSync(path.join(root,p),"utf8"),sandbox,{filename:p});
}
const match=w.NcomplexMatcher.match;
const period="2025-10__2026-03";
const students=[
 {id:"01",cedula:"0100000001",Nombres:"TORRES LEON VIVIANA NORA",CorreoInstitucional:"vnora@example.edu"},
 {id:"02",cedula:"0100000002",Nombres:"PEREZ ROJO SOFIA ISABEL"},
 {id:"03",cedula:"0100000003",Nombres:"SOTO VEGA CAMILA ELENA"},
 {id:"04",cedula:"0100000004",Nombres:"RAMIREZ PEREZ ALMA CELIA",correoPersonal:"alma@example.edu"}
];
const row=(name,email)=>({nombreCompleto:name,correo:email||"",notaTeorica:8,notaPractica:9});
const imported=[
 row("TVVIVIANA NORA TORRES LEON"),
 row("KOSOFIA ISABEL PEREZ ROJO"),
 row("XKOCAMILA ELENA SOTO VEGA"),
 row("ALMA CELIA RAMIREZ PEREZ","alma@example.edu")
];
const result=match(imported,students,{periodoId:period});
assert.equal(result.totalMatched,4,"Se deben recuperar 4 estudiantes");
assert.equal(result.totalUnmatched,0);
assert.equal(result.matchedByInitials,3,"Distingue 1, 2 y 3 iniciales concatenadas");
assert.equal(result.matches[0].student.cedula,"0100000001");
assert.equal(result.matches[0].normalizedMoodleName,"viviana nora torres leon");
assert.equal(result.matches[1].student.cedula,"0100000002");
assert.equal(result.matches[2].student.cedula,"0100000003");
assert.equal(result.matches[3].matchMethod,"correo");
assert.equal(w.NcomplexMatcher.studentEmails(students[3]).includes("alma@example.edu"),true);
assert.equal(match([row("TVVIVIANA NORA TORRES LEON","vnora@example.edu")],students,{}).totalMatched,1);
const ambiguous=[
 {id:"05",cedula:"0100000005",Nombres:"PEREZ ROJO CELENA MARIA"},
 {id:"06",cedula:"0100000006",Nombres:"PEREZ ROJO ELENA MARIA"}
];
const conflict=match([row("ABCELENA MARIA PEREZ ROJO")],ambiguous);
assert.equal(conflict.totalMatched,0,"Nunca elegir por intuición entre nombres alternativos");
assert.equal(conflict.totalUnmatched,1);
const contradictory=match([row("TVVIVIANA NORA TORRES LEON","alma@example.edu")],students);
assert.equal(contradictory.totalMatched,0,"Correo de otra persona y nombre confirmado no se asignan");
console.log("VERIFICACIÓN NCOMPLEX NOMBRES: OK (iniciales 1-3, apellidos reordenados, varios correos, conflictos)");
