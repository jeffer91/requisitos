/* scripts/verify-notas-reportes.js — Notas → Modalidad y Descargas. Datos ficticios. */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");const read=f=>fs.readFileSync(path.join(root,f),"utf8");
const sb={};vm.runInNewContext(read("NotasReportes/reportes.rules.js"),sb);const R=sb.NotasReportesRules;
// Tipos de período
assert.equal(R.periodKind("2025-10__2026-03"),"REGULAR");assert.equal(R.periodKind("2026-04__2026-09"),"REGULAR");
["2025-11__2026-05","2026-02__2026-08","2025-02__2025-05","2026-05__2026-11"].forEach(p=>assert.equal(R.periodKind(p),"PVC",p));
assert.equal(R.GATE.length,8);assert.ok(R.GATE.includes("PracticasVinculacion"));
const ALL=Object.fromEntries(R.AREAS.map(a=>[a.key,"CUMPLE"]));
function st(c,code,carrera){return {cedula:c,Nombres:"ESTUDIANTE "+c,NombreCarrera:carrera||"ADMINISTRACION",CodigoCarrera:code||"550413A02-P-1701",estadoMatricula:"ACTIVO"};}
function req(c,over){return {cedula:c,periodoId:P,valores:Object.assign({},ALL,over||{})};}
const P="2025-10__2026-03";
const data={periodoId:P,
 matriculas:[st("0000000001"),st("0000000002"),st("0000000003","550413A02-L-1701","ADMINISTRACION ONLINE"),st("0000000004"),st("0000000005"),
  Object.assign(st("0000000006"),{estadoMatricula:"RETIRADO"}),st("0000000007")],
 requisitos:[req("0000000001"),req("0000000002",{Titulacion:"NO CUMPLE"}),req("0000000003"),req("0000000004",{Ingles:"NO CUMPLE"}),
  req("0000000005"),req("0000000006"),req("0000000007")],
 modalidades:[{periodoId:P,cedula:"0000000005",modalidadTitulacion:"TRABAJO_TITULACION"},{periodoId:P,cedula:"0000000007",modalidadTitulacion:"EXAMEN_COMPLEXIVO"}],
 notas_trabajo:[{periodoId:P,cedula:"0000000007",notaFinal:8},{periodoId:P,cedula:"0000000005",notaFinal:7.6,calificacionTutor:8}],
 notas_nucleos:[1,2,3,4].map(n=>({periodoId:P,cedula:"0000000001",nucleo:n,totalMoodle:9,evaluaciones:[9,9,9,9],casoEstudio:9,desgloseCalculado:true})),
 notas_complexivo:[{periodoId:P,cedula:"0000000001",promedioNucleos:9,notaTeorica:8,notaPractica:9,notaOrdinaria:8.6,notaOficial:8.6,notaFinalIntegral:8.8,oportunidadAplicada:"ORDINARIA"}],
 notas_articulo:[]};
const list=R.students(data);
assert.equal(list.length,6,"Sin retirados");
const by=Object.fromEntries(list.map(x=>[x.cedula,x]));
assert.equal(by["0000000005"].modalidad,"TRABAJO_TITULACION","Marcado en Modalidad");
assert.equal(by["0000000007"].modalidad,"EXAMEN_COMPLEXIVO","La marca manda sobre las notas de trabajo");
assert.equal(by["0000000003"].grupo,"ONLINE");assert.equal(by["0000000004"].habilitado,false);
const plan=R.plan(list,P),f=Object.fromEntries(plan.files.map(x=>[x.id,x]));
assert.equal(plan.files.length,7);
assert.equal(f.req_PRESENCIAL.count,5,"Requisitos: todos los presenciales (complexivo y trabajo)");
assert.equal(f.req_ONLINE.count,1);
assert.equal(f.nuc_PRESENCIAL.count,3,"Núcleos: complexivo con 8 requisitos (1,2,7)");
assert.equal(f.cx_PRESENCIAL.count,2,"Complexivo: además Titulación CUMPLE (1,7)");
assert.equal(f.trabajo.count,1);
assert.ok(plan.files.every(x=>/^[0-9A-Za-z_-]+\.xlsx$/.test(x.fileName)),"Nombres de archivo sin tildes");
// Contenido
let sheets=f.req_PRESENCIAL.build();
assert.equal(sheets.length,12,"Resumen + 11 áreas");
assert.equal(sheets.map(s=>s.name).slice(1,4).join("|"),"Académico|Documentación|Financiero");
const ing=sheets.find(s=>s.name==="Inglés");assert.equal(ing.rows[1][5],"CUMPLE");assert.equal(ing.rows[5][5],"NO CUMPLE","Primero los que cumplen");
sheets=f.nuc_PRESENCIAL.build();assert.equal(sheets[0].name,"Resumen");assert.equal(sheets[1].name,"ADMINISTRACION");
const row=sheets[1].rows.find(r=>r[1]==="0000000001");assert.equal(row[4],9);assert.equal(row[28],9);assert.equal(row[29],"Aprobado");assert.ok(/calculadas/.test(row[30]));
sheets=f.cx_PRESENCIAL.build();const cx=sheets[1].rows.find(r=>r[1]==="0000000001");assert.equal(cx[11],8.6);assert.equal(cx[12],8.8);assert.equal(cx[14],"Aprobado");
assert.equal(sheets[1].rows.find(r=>r[1]==="0000000007")[14],"Sin nota");
sheets=f.trabajo.build();assert.equal(sheets[1].rows[1][11],7.6);assert.equal(sheets[1].rows[1][13],"CUMPLE");
// PVC
const pvc=R.plan(R.students(Object.assign({},data,{periodoId:"2026-02__2026-08",notas_articulo:[{cedula:"0000000003",notaArticulo:8,notaDefensa:9,notaFinal:8.3}]})),"2026-02__2026-08");
assert.equal(pvc.files.map(x=>x.id).join(","),"req_pvc,articulo");assert.equal(pvc.files[1].count,5);
const art=pvc.files[1].build();assert.equal(art.find(s=>s.name==="ADMINISTRACION ONLINE").rows[1][6],8.3);
// Nombres de hoja válidos y únicos (máx. 31)
const used={};const s1=R.sheetName("A".repeat(40),used),s2=R.sheetName("A".repeat(40),used);assert.equal(s1.length,31);assert.ok(s2.length<=31&&s1!==s2);assert.equal(R.sheetName("A/B:C",{}),"A B C");
// Menú
["maq-core.js","maq-modulos-registry.js"].forEach(file=>{const s=read("Maqueta/"+file);assert.ok(s.includes("NotasReportes/modalidad.html")&&s.includes("NotasReportes/descargas.html"),file);});
assert.ok(read("Maqueta/maq-menu.js").includes('moduloId:"notas_descargas",etiqueta:"Descargas"'));
assert.ok(read("Maqueta/maq-menu.js").includes('moduloId:"notas_modalidad",etiqueta:"Modalidad"'));
assert.ok(!/writeChecked|\.update\(|batch\(/.test(read("NotasReportes/descargas.app.js")),"Descargas no escribe");
console.log("NOTAS · MODALIDAD Y DESCARGAS: OK — períodos regular/PVC, etapas, Presencial/Online, Trabajo y contenido de los Excels.");
