"use strict";

/* =========================================================
Archivo: verify-ncomplex-moodle-import.js
Ruta: /scripts/verify-ncomplex-moodle-import.js
Función:
- Verificar el texto bruto copiado desde el libro de calificaciones de Moodle.
- Confirmar la conversión de escala 0-100 a 0-10.
- Probar el cruce por correo y por nombre sin cédula.
- Validar notas ordinarias, supletorias, conflictos y aplicación.
========================================================= */

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const ROOT=path.resolve(__dirname,"..");
const errors=[];
const checks=[];

function check(value,message){
  checks.push({ok:!!value,message});
  if(!value){errors.push(message);console.error("[verify-ncomplex-moodle-import] ERROR:",message);}
  else{console.log("[OK]",message);}
}

function load(context,file){
  const source=fs.readFileSync(path.join(ROOT,file),"utf8");
  new vm.Script(source,{filename:file}).runInContext(context);
}

const sandbox={
  console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Set,
  setTimeout,clearTimeout
};
sandbox.window=sandbox;
const context=vm.createContext(sandbox);

load(context,"Ncomplex/ncomplex.config.js");
load(context,"Ncomplex/ncomplex.calculator.js");
load(context,"Ncomplex/ncomplex.parser.js");
load(context,"Ncomplex/ncomplex.matcher.js");

const moodleText=`Examen Complexivo Redes y Telecomunicaciones octubre marzo 2026]Mostrando calificaciones y totales
TeóricoMostrando calificaciones y totales
PrácticoMostrando calificaciones y totales
Nombre / Apellido(s)
Dirección de correo
CuestionarioCOMPONENTE TEÓRICO EXAMEN COMPLEXIVO
Ocultar
CuestionarioCOMPONENTE TEÓRICO EXAMEN COMPLEXIVO -SUPLETORIO
Ocultar
Media de calificacionesTotal Teórico
CuestionarioCOMPONENTE PRACTICO EXAMEN COMPLEXIVO
Ocultar
CuestionarioCOMPONENTE PRACTICO EXAMEN COMPLEXIVO -SUPLETORIO
Media de calificacionesTotal Práctico
SumaTotal del curso
CA
CARLOS VIDAL AGILA SOTO
cagila@itsqmet.edu.ec
65,00
Ocultar
-
Ocultar
26,00
75,00
Ocultar
-
45,00
71,00
KB
KEVIN MAURICIO BENAVIDES BATALLAS
kebenavides@itsqmet.edu.ec
87,50
Ocultar
80,00
Ocultar
33,50
15,00
Ocultar
67,00
24,60
58,10
KATHERINE MICHELLE CAICEDO GALARRAGA
kcaicedo@itsqmet.edu.ec
67,50
Ocultar
97,50
Ocultar
33,00
13,00
Ocultar
68,40
24,42
57,42
Promedio general
65,98
76,95
28,32
53,56
75,09
40,50
68,81`;

const parsed=sandbox.NcomplexParser.parse(moodleText);
check(parsed.ok===true,"El texto de Moodle se reconoce como válido.");
check(parsed.format==="moodle_gradebook","El parser identifica el formato Moodle.");
check(parsed.rows.length===3,"Se detectan los tres estudiantes por sus correos.");

const carlos=parsed.rows[0];
const kevin=parsed.rows[1];
const katherine=parsed.rows[2];

check(carlos.nombreCompleto==="CARLOS VIDAL AGILA SOTO","Se ignoran las iniciales anteriores al nombre.");
check(carlos.correo==="cagila@itsqmet.edu.ec","Se conserva el correo institucional.");
check(carlos.notaTeorica===6.5&&carlos.notaPractica===7.5,"Las notas ordinarias se convierten de 100 a 10.");
check(carlos.notaTeoricaSupletorio===null&&carlos.notaPracticaSupletorio===null,"El guion se interpreta como nota vacía.");
check(carlos.moodleTotalCurso===7.1,"El total Moodle se conserva como referencia en escala 10.");

check(kevin.notaTeorica===8.75&&kevin.notaTeoricaSupletorio===8,"Se detecta el teórico ordinario y supletorio.");
check(kevin.notaPractica===1.5&&kevin.notaPracticaSupletorio===6.7,"Se detecta el práctico ordinario y supletorio.");
check(kevin.moodleTotalCurso===5.81,"Se conserva el total del curso copiado de Moodle.");
check(katherine.nombreCompleto==="KATHERINE MICHELLE CAICEDO GALARRAGA","También se reconoce un nombre sin línea de iniciales.");

const students=[
  {
    idEstudiantePeriodo:"0101010101__2025-10__2026-03",
    cedula:"0101010101",
    CorreoInstitucional:"cagila@itsqmet.edu.ec",
    Nombres:"AGILA SOTO CARLOS VIDAL",
    modalidadTitulacion:"EXAMEN_COMPLEXIVO"
  },
  {
    idEstudiantePeriodo:"0202020202__2025-10__2026-03",
    cedula:"0202020202",
    Nombres:"BENAVIDES BATALLAS KEVIN MAURICIO",
    modalidadTitulacion:"EXAMEN_COMPLEXIVO"
  },
  {
    idEstudiantePeriodo:"0303030303__2025-10__2026-03",
    cedula:"0303030303",
    Email:"kcaicedo@itsqmet.edu.ec",
    Nombres:"KATHERINE MICHELLE CAICEDO GALARRAGA",
    modalidadTitulacion:"EXAMEN_COMPLEXIVO"
  }
];

const matched=sandbox.NcomplexMatcher.match(parsed.rows,students,{periodoId:"2025-10__2026-03"});
check(matched.totalMatched===3,"Los tres estudiantes se cruzan sin cédula importada.");
check(matched.totalUnmatched===0,"No quedan estudiantes sin identificar.");
check(matched.matchedByEmail===2,"Se prioriza el correo cuando está disponible.");
check(matched.matchedByName===1,"El nombre se usa como respaldo cuando falta el correo local.");
check(matched.matches[1].matchReorderedName===true,"El nombre coincide aunque apellidos y nombres estén en orden diferente.");
check(matched.matches[1].cedula==="0202020202","La propuesta conserva la cédula almacenada en BDLocal.");
check(matched.matches[1].incoming.notaTeoricaSupletorio===8,"El cruce incluye el teórico supletorio.");
check(matched.matches[1].incoming.notaPracticaSupletorio===6.7,"El cruce incluye el práctico supletorio.");
check(matched.matches[1].proposed.notaComplexivo===4.4,"Ncomplex recalcula el complexivo ordinario con 40/60.");
check(matched.matches[1].proposed.notaSupletorio===7.22,"Ncomplex recalcula el supletorio con 40/60.");
check(matched.matches[1].proposed.notaOficial===7.22,"La oportunidad supletoria se usa cuando supera al ordinario reprobado.");
check(matched.matches[1].proposed.estadoEvaluacion==="APROBADO","El estado se recalcula con la nota institucional.");

const applied=sandbox.NcomplexMatcher.apply(matched.matches,students,{});
check(applied.changed.length===3,"Las tres coincidencias sin conflicto se pueden aplicar.");

const conflictStudents=students.map((student,index)=>index===0?{...student,notaTeorica:7}:student);
const withConflict=sandbox.NcomplexMatcher.match(parsed.rows,conflictStudents,{});
check(withConflict.totalConflicts===1,"Una nota local diferente se presenta como conflicto.");
check(withConflict.conflicts[0].conflicts[0].field==="notaTeorica","El conflicto identifica el campo exacto.");
check(sandbox.NcomplexMatcher.apply(withConflict.matches,conflictStudents,{}).changed.length===2,"Los conflictos no se sobrescriben automáticamente.");

if(errors.length){
  console.error(`\nVERIFICACIÓN IMPORTACIÓN MOODLE NCOMPLEX: ERROR (${errors.length})`);
  errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
  process.exit(1);
}

console.log(`\nVERIFICACIÓN IMPORTACIÓN MOODLE NCOMPLEX: OK (${checks.length} comprobaciones)`);
