"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const W={},context=vm.createContext({window:W});
for(const f of ["ncomplex.config.js","ncomplex.calculator.js","ncomplex.parser.js","ncomplex.matcher.js"]){
 vm.runInContext(fs.readFileSync(path.join(__dirname,"../Ncomplex",f),"utf8"),context,{filename:f});
}
const students=[
 {id:"1",cedula:"0100000001",Nombres:"VEGA ALVAREZ MARIA SOLEDAD"},
 {id:"2",cedula:"0100000002",Nombres:"MENA SOTO CARLOS ANDRES"},
 {id:"3",cedula:"0100000003",Nombres:"PEREZ LUNA ANA ISABEL",notaTeorica:6}
];
const imported=[
 {rowNumber:1,nombreCompleto:"MARIA SOLEDAD VEGA ALVAR",notaTeorica:8,notaPractica:9},
 {rowNumber:2,nombreCompleto:"CARLOS ANDRE MENA SOTO",notaTeorica:8,notaPractica:9},
 {rowNumber:3,nombreCompleto:"ANA ISABEL PEREZ LUNA",notaTeorica:8,notaPractica:9}
];
const m=W.NcomplexMatcher;
const first=m.match(imported,students,{});
assert.equal(first.totalMatched,1);assert.equal(first.totalUnmatched,2);
assert.ok(first.unmatched[0].suggestions.some(x=>x.cedula==="0100000001"));
const confirmed=m.match(imported,students,{manualOverrides:{1:"1",2:"2"}});
assert.equal(confirmed.totalMatched,3);assert.equal(confirmed.matchedByManual,2);
assert.equal(confirmed.totalConflicts,1);
assert.equal(m.apply(confirmed.matches,students,{}).changed.length,2);
const unknown=m.match([imported[0]],students,{manualOverrides:{1:"unknown"}});
assert.equal(unknown.totalMatched,0);
const blocked=m.match([{...imported[0],blocked:true,issues:["Notas sin conciliar"]}],students,{manualOverrides:{1:"1"}});
assert.equal(blocked.totalReview,1);
console.log("VERIFICACIÓN VINCULACIÓN SUPERVISADA NCOMPLEX: OK");
