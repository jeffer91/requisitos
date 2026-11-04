"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const window={},context=vm.createContext({window,Date,Math});
for(const file of ["ncomplex.config.js","ncomplex.calculator.js","ncomplex.parser.js"]){
 vm.runInContext(fs.readFileSync(path.join(__dirname,"../Ncomplex",file),"utf8"),context,{filename:file});
}
const h=[
 "Examen Complexivo Educación Inicial abril septiembre 2026]",
 "Nombre / Apellido(s)","Dirección de correo",
 "CuestionarioCOMPONENTE TEÓRICO EXAMEN COMPLEXIVO",
 "Media de calificacionesTotal Teórico",
 "CuestionarioCOMPONENTE PRACTICO EXAMEN COMPLEXIVO",
 "Media de calificacionesTotal Práctico",
 "SumaTotal del curso"
].join("\n");
const mixed=h+"\nKAKIMBERLY MICHELLE AGUILAR MANYA\nkiaguilar@itsqmet.edu.ec\n9,70\n38,80\n90,00\n54,00\n92,80"+
 "\nMAMAGALIA JACQUELINE ANGUASHA AYUY\nmanguasha@itsqmet.edu.ec\n6,00\n24,00\n91,00\n54,60\n78,60\nPromedio general";
const a=window.NcomplexParser.parse(mixed);
assert.equal(a.ok,true);
assert.equal(a.rows.length,2);
assert.ok(a.rows.every(row=>!row.blocked));
assert.equal(a.componentScales.te1,10);
assert.equal(a.componentScales.pr1,100);
assert.equal(a.rows[0].notaTeorica,9.7);
assert.equal(a.rows[0].notaPractica,9);
assert.equal(a.rows[1].notaTeorica,6);
assert.equal(a.rows[1].notaPractica,9.1);
assert.equal(a.rows[0].moodleTotalCurso,9.28);
assert.equal(a.rows[1].moodleTotalCurso,7.86);
const noEvidence=[
 "Nombre / Apellido(s)","Dirección de correo",
 "CuestionarioCOMPONENTE TEÓRICO EXAMEN COMPLEXIVO",
 "CuestionarioCOMPONENTE PRACTICO EXAMEN COMPLEXIVO",
 "ESTUDIANTE DE PRUEBA","prueba@example.edu","8,00","9,00"
].join("\n");
const uncertain=window.NcomplexParser.parse(noEvidence);
assert.equal(uncertain.rows[0].blocked,true);
assert.match(uncertain.rows[0].issues.join(" "),/escala 0–10 o 0–100/);
const wrong=mixed.replace("38,80","37,80");
assert.equal(window.NcomplexParser.parse(wrong).rows[0].blocked,true);
console.log("VERIFICACIÓN MOODLE ESCALAS MIXTAS: OK (10/100, 40/60, incertidumbre y subtotales)");
