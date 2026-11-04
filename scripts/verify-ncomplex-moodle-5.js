"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const window={},ctx=vm.createContext({window});
for(const name of ["ncomplex.config.js","ncomplex.calculator.js","ncomplex.parser.js","ncomplex.matcher.js"])
 vm.runInContext(fs.readFileSync(path.join(__dirname,"../Ncomplex",name),"utf8"),ctx);
const head=["Nombre / Apellido(s)","Dirección de correo","CuestionarioCOMPONENTE TEÓRICO EXAMEN COMPLEXIVO",
 "Media de calificacionesTotal Teórico","CuestionarioCOMPONENTE PRACTICO EXAMEN COMPLEXIVO",
 "Media de calificacionesTotal Práctico","SumaTotal del curso"].join("\n");
const data=["XALMA MARIA LOPEZ DIAZ","alma@ejemplo.edu","21,00","8,40","60,00","36,00","44,40",
 "BEATRIZ ELENA ROJAS PEREZ","beatriz@ejemplo.edu","38,00","15,20","60,00","36,00","51,20",
 "Promedio general","29,50"].join("\n");
const rows=window.NcomplexParser.parse(head+"\n"+data);
assert.equal(rows.rows.length,2);
assert.equal(rows.rows[0].layout,"moodle_5");
assert.deepEqual(Array.from(rows.headers),["te1","totalT","pr1","totalP","totalCurso"]);
assert.ok(rows.rows.every(r=>!r.blocked));
assert.deepEqual(Array.from(rows.rows,r=>r.notaTeorica),[2.1,3.8]);
assert.deepEqual(Array.from(rows.rows,r=>r.notaPractica),[6,6]);
const students=[{id:"a",cedula:"0000000001",Nombres:"LOPEZ DIAZ ALMA MARIA",modalidadTitulacion:"EXAMEN_COMPLEXIVO"},
 {id:"b",cedula:"0000000002",Nombres:"ROJAS PEREZ BEATRIZ ELENA",modalidadTitulacion:"EXAMEN_COMPLEXIVO"}];
const matched=window.NcomplexMatcher.match(rows.rows,students,{});
assert.equal(matched.totalMatched,2);
assert.deepEqual(Array.from(matched.matches,r=>r.proposed.notaOficial),[4.44,5.12]);
assert.ok(matched.matches.every(r=>r.proposed.estadoEvaluacion==="NO_APROBADO"));
assert.ok(window.NcomplexParser.parse((head+"\n"+data).replace("8,40","8,90")).rows[0].blocked);
const md=[
 "| Nombre / Apellido(s) | Dirección de correo | [CuestionarioCOMPONENTE TEÓRICO EXAMEN COMPLEXIVO](https://example.org/t) | [Media de calificaciones](https://example.org/mt)Total Teórico | [CuestionarioCOMPONENTE PRACTICO EXAMEN COMPLEXIVO](https://example.org/p) | [Media de calificaciones](https://example.org/mp)Total Práctico | [Suma](https://example.org/s)Total del curso |",
 "| --- | --- | --- | --- | --- | --- | --- |",
 "| [XALMA MARIA LOPEZ DIAZ](https://example.org/u1) | alma@ejemplo.edu | 21,00 | 8,40 | 60,00 | 36,00 | 44,40 |",
 "| [imageBEATRIZ ELENA ROJAS PEREZ](https://example.org/u2) | beatriz@ejemplo.edu | 38,00 | 15,20 | 60,00 | 36,00 | 51,20 |",
 "| **Promedio general** | 29,50 | 11,80 | 60,00 | 36,00 | 47,80 |  |"
].join("\n");
const markdown=window.NcomplexParser.parse(md);
assert.equal(markdown.rows.length,2);
assert.ok(markdown.rows.every(r=>!r.blocked));
assert.equal(markdown.rows[1].nombreCompleto,"BEATRIZ ELENA ROJAS PEREZ");
assert.equal(window.NcomplexMatcher.match(markdown.rows,students,{}).totalMatched,2);
console.log("MOODLE 5 COLUMNAS: OK");
