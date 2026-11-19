/* Pruebas de datos sintéticos: ejecutar con node Inf/tests/verify-pvc.js */
"use strict";
const assert=require("node:assert/strict");
const model=require("../core/inf.pvc.js");
const p="2026-02__2026-05";
const all={Academico:"CUMPLE",Documentacion:"CUMPLE",Financiero:"CUMPLE",PracticasVinculacion:"CUMPLE",Vinculacion:"CUMPLE",SeguimientoGraduados:"CUMPLE",Ingles:"CUMPLE",ActualizacionDatos:"CUMPLE",Titulacion:"CUMPLE"};
const snapshot={source:"Datos de prueba",students:[
 {cedula:"0000000001",periodoId:p,NombreCarrera:"Administración",estadoMatricula:"ACTIVO",modalidadTitulacion:"ARTICULO_ACADEMICO"},
 {cedula:"0000000002",periodoId:p,NombreCarrera:"Administración",estadoMatricula:"ACTIVO",modalidadTitulacion:"ARTICULO_ACADEMICO"},
 {cedula:"0000000003",periodoId:p,NombreCarrera:"Contabilidad",estadoMatricula:"ACTIVO"},
 {cedula:"0000000004",periodoId:p,NombreCarrera:"Ventas",estadoMatricula:"RETIRADO"},
 {cedula:"0000000005",periodoId:p,NombreCarrera:"Mecánica",estadoMatricula:"ACTIVO",modalidadTitulacion:"EXAMEN_COMPLEXIVO"}],
 requirements:Object.keys(all).map(key=>({cedula:"0000000001",periodoId:p,requisitoKey:key,estado:all[key]})),
 notes:[
 {cedula:"0000000001",periodoId:p,modalidadTitulacion:"ARTICULO",Notart:8,Notdef:9,Notafinal:8.3},
 {cedula:"0000000002",periodoId:p,modalidadTitulacion:"ARTICULO",Notart:9,Notdef:7},
 {cedula:"0000000003",periodoId:p,notaFinal:6.5},
 {cedula:"0000000008",periodoId:p,notaFinal:9},
 {cedula:"0000000002",periodoId:"2026-10__2027-03",notaFinal:10}]};
const result=model.build(snapshot,{periodoId:p,periodoLabel:"Febrero a Mayo 2026"});
assert.equal(result.ok,true);
assert.equal(result.counts.total,2);
assert.equal(result.careers.length,1);
assert.equal(result.counts.evaluados,2);
assert.equal(result.counts.aprobados,2);
assert.equal(result.counts.reprobados,0);
assert.equal(result.counts.notasOficiales,1);
assert.equal(result.counts.notasCalculadas,1);
assert.equal(result.counts.requisitosCompletos,1);
assert.equal(result.counts.habilitados,1);
assert.equal(result.students.find(x=>x.cedula==="0000000002").nota,8.4);
assert.equal(result.counts.tasaEvaluados,100);
assert.ok(result.issues.some(x=>x.includes("no se asociaron")));
assert.deepEqual(result.stages.map(x=>x.count),[2,1,1,1,1,1]);
assert.equal(result.validation.some(x=>x.critical),false);
const failed=model.build({students:[{cedula:"0000000010",periodoId:p,modalidadTitulacion:"ARTICULO"}],notes:[{cedula:"0000000010",periodoId:p,modalidadTitulacion:"ARTICULO",Notart:9,Notdef:6,Notafinal:8.1}],requirements:[]},{periodoId:p});
assert.equal(failed.counts.aprobados,0,"Una defensa menor a 7 no se compensa con el promedio");
assert.equal(failed.counts.reprobados,1);
const empty=model.build({students:[],notes:[],requirements:[]},{periodoId:p});
assert.equal(empty.ok,false);
assert.equal(empty.counts.total,0);
console.log("INF PVC: datos de prueba correctos.");
