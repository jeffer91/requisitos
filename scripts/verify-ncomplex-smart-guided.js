"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,".."),source=p=>fs.readFileSync(path.join(root,p),"utf8");
const w={addEventListener(){}},d={};
const ctx=vm.createContext({window:w,document:d,console});
["Ncomplex/ncomplex.nucleos.parser.js","Ncomplex/ncomplex.smart.js","Ncomplex/ncomplex.nucleos.policy.js"]
.forEach(p=>new vm.Script(source(p),{filename:p}).runInContext(ctx));
const parser=w.NcomplexNucleosParser,smart=w.NcomplexSmart,policy=w.NcomplexNucleosPolicy;
const course="T-NUCLEO - GESTIÓN COMERCIAL [Mod 13, OCT-MAR26 Esp. M-A { l m v s } 19h00-22h00-Matriz]";
const sample=[course,"Curso","Participantes","Calificaciones",
 "Buscar usuarios","Una tabla con los nombres de los estudiantes en la primera columna.",
 course+"Mostrando calificaciones y totales","Nombre / Apellido(s)","Dirección de correo",
 "CuestionarioEVALUACIÓN PARCIAL 1","CuestionarioEVALUACIÓN PARCIAL 2",
 "CuestionarioEVALUACIÓN PARCIAL 3","CuestionarioEVALUACIÓN PARCIAL 4",
 "TareaTALLER PRÁCTICO 1","CuestionarioPRUEBA","Media de calificacionesTotal del curso",
 "MAMALENA RACHELL ALVARADO PEREZ","alumno1@itsqmet.edu.ec",
 "9,00","10,00","10,00","10,00","10,00","10,00","9,83",
 "BRBRIANA ALEJANDRA RECALDE IDROVO","alumno2@itsqmet.edu.ec",
 "9,00","10,00","10,00","10,00","10,00","10,00","9,83",
 "BRBRIANA ALEJANDRA RECALDE IDROVO","alumno3@itsqmet.edu.ec",
 "-","-","-","-","10,00","-","10,00",
 "PROMEDIO GENERAL","9,00","10,00","10,00","10,00","10,00","9,00","9,83"].join("\n");
const parsed=parser.parse(sample);
assert.equal(parsed.ok,true);
assert.equal(parsed.rows.length,3);
assert.deepEqual(Array.from(parsed.headers),["e1","e2","e3","e4","taller","prueba","totalMoodle"]);
assert.equal(parsed.rows[2].evaluaciones[0],null);
assert.equal(parsed.rows[2].totalMoodle,10);
const mixed=[course,"Nombre / Apellido(s)","Dirección de correo",
 "CuestionarioEVALUACIÓN PARCIAL I","CuestionarioEVALUACIÓN PARCIAL 2",
 "CuestionarioEVALUACIÓN PARCIAL III","CuestionarioEVALUACIÓN PARCIAL 4",
 "TareaCASO DE ESTUDIO","TareaTALLER PRÁCTICO 1","TareaTALLER PRÁCTICO 2",
 "Media de calificacionesTotal del curso",
 "ESTUDIANTE EJEMPLO","ejemplo@itsqmet.edu.ec",
 "8,00","9,00","10,00","10,00","9,50","10,00","7,00","9,07"].join("\n");
const extra=parser.parse(mixed);
assert.equal(extra.ok,true,"Admitir calificaciones parciales romanas, caso y taller adicional.");
assert.deepEqual(Array.from(extra.rows[0].evaluaciones),[8,9,10,10]);
assert.equal(extra.rows[0].casoEstudio,9.5);
assert.equal(extra.rows[0].actividadesAdicionales.length,1);
assert.equal(extra.rows[0].actividadesAdicionales[0].nota,7);
const catalog=[{career:"Administración",nuclei:[{number:1,name:"Gestión Estratégica"},{number:4,name:"Gestión Comercial"}]}];
const careers=[{code:"ADMINISTRACION",label:"ADMINISTRACION"},
 {code:"ADMINISTRACION ONLINE",label:"ADMINISTRACION ONLINE"},
 {code:"CONTABILIDAD",label:"CONTABILIDAD"}];
const periods=[{id:"2025-10__2026-03"}];
const diag=smart.identify(sample,parsed,catalog,careers,periods,{career:"ADMINISTRACION"});
assert.equal(diag.kind,"nucleos");
assert.equal(diag.periodId,"2025-10__2026-03");
assert.equal(diag.periodKnown,true);
assert.equal(diag.careerId,"ADMINISTRACION");
assert.equal(diag.nucleus,4,"Mod 13 no significa núcleo 13.");
assert.equal(diag.careers.length,2,"Distinguir presencial de online.");
const ambiguous=smart.identify(sample,parsed,catalog,careers,periods,{career:""});
assert.equal(ambiguous.careerId,"","No elegir carrera con más de una modalidad sin contexto.");
assert.equal(smart.periodId("Octubre 2025 a Marzo 2026"),"2025-10__2026-03");
assert.equal(smart.periodId("Abril 2026 a Septiembre 2026"),"2026-04__2026-09");
assert.equal(smart.periodId("ABR-SEP26"),"2026-04__2026-09");
assert.equal(smart.kind("Examen Complexivo Contabilidad octubre marzo 2026. COMPONENTE TEÓRICO EXAMEN COMPLEXIVO"),"complexivo");
const students=[
 {cedula:"0101010101",Nombres:"ALVARADO PEREZ MALENA RACHELL"},
 {cedula:"0202020202",Nombres:"RECALDE IDROVO BRIANA ALEJANDRA"}
];
const uncertain=parser.match(parsed.rows,students);
assert.equal(uncertain.matched,1);
assert.equal(uncertain.review.length,2);
assert.equal(Object.keys(uncertain.duplicates).length,1);
const decision=parser.match(parsed.rows,students,{_rows:{"0202020202":2}});
assert.equal(decision.matched,2);
assert.equal(decision.review.length,0);
assert.equal(decision.matches[1].imported.correo,"alumno2@itsqmet.edu.ec");
assert.equal(parser.match(parsed.rows,students,{_rows:{"0202020202":3}}).matches[1].imported.correo,
 "alumno3@itsqmet.edu.ec");
const none=policy.check(null,"nucleos");
assert.equal(none.eligible,false);assert.equal(none.verified,false);
assert.equal(none.pending.length,0,"Ausencia de información no es incumplimiento confirmado.");
const keys=["academico","documentacion","financiero","practicas","vinculacion",
 "seguimientograduados","ingles","actualizaciondatos","titulacion"];
const rows={requirements:keys.map(k=>({key:k,status:k==="titulacion"?"NO APLICA":"CUMPLE"}))};
assert.equal(policy.check(rows,"nucleos").eligible,true);
assert.equal(policy.check(rows,"complexivo").eligible,false);
const blocked={requirements:keys.map(k=>({key:k,status:k==="financiero"?"PENDIENTE":"CUMPLE"}))};
assert.equal(policy.check(blocked,"nucleos").verified,true);
assert.equal(policy.check(blocked,"nucleos").pending.length,1);
const actual={CodigoCarrera:"ADMINISTRACION",cedula:"0101010101"};
const next=smart.nextTask(careers,[actual],[],"ADMINISTRACION",4);
assert.equal(next.nucleus,1,"Guiar desde el primer núcleo realmente pendiente.");
const combined=smart.nextTask([{code:"ADMINISTRACION",label:"ADMINISTRACION"}],[
 actual,{CodigoCarrera:"ADMINISTRACION ONLINE",cedula:"0202020202"}
],[],"ADMINISTRACION",4);
assert.equal(combined.total,2,"El siguiente núcleo cuenta presencial y online juntos.");
const savedCombined=smart.nextTask([{code:"ADMINISTRACION",label:"ADMINISTRACION"}],[
 actual,{CodigoCarrera:"ADMINISTRACION ONLINE",cedula:"0202020202"}
],[{cedula:"0101010101",codigoCarrera:"ADMINISTRACION",nucleo:1,estadoCarga:"CONCILIADO",
 habilitado:true,evaluaciones:[9,9,9,9],totalMoodle:9},
 {cedula:"0202020202",codigoCarrera:"ADMINISTRACION ONLINE",nucleo:1,estadoCarga:"CONCILIADO",
 habilitado:true,evaluaciones:[8,8,8,8],totalMoodle:8}],
 "ADMINISTRACION",4);
assert.equal(savedCombined.nucleus,2,"El avance de ambas modalidades se reconoce en conjunto.");
const html=source("Ncomplex/ncomplex.html");
assert.equal((html.match(/<h1>Núcleos<\/h1>/g)||[]).length,1);
assert.ok(html.includes("ncomplex.smart.js"));
assert.ok(html.includes('id="nc-guide-title"'));
const js=source("Ncomplex/ncomplex.center.js");
assert.ok(js.indexOf("var raw=t(ui.paste.value)")>=0);
assert.ok(!js.includes('msg("Confirma el grupo antes de cargar notas.'));
assert.ok(js.includes('var state=label(rawState)'),"Estado de notas separado de requisitos.");
console.log("NCOMPLEX INTELIGENTE: OK (periodos, 2 modalidades, N4, 3 filas, duplicados, requisitos y guía).");
