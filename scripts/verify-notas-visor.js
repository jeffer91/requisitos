/* scripts/verify-notas-visor.js — Visualizadores de Notas (solo lectura). Datos ficticios. */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const read=f=>fs.readFileSync(path.join(root,f),"utf8");
// 1) Solo lectura: el visor no contiene ninguna operación de escritura.
const app=read("NotasVisor/visor.app.js")+read("NotasVisor/visor.config.js");
["writeChecked","saveMany","saveEvaluation",".set(","runTransaction",".update(","publish(","deleteDoc","batch("].forEach(w=>
 assert.ok(!app.includes(w),"El visor no debe escribir: "+w));
// 2) Menú: las cuatro pestañas abren el visor; solo Cargado de notas sube.
const core=read("Maqueta/maq-core.js"),reg=read("Maqueta/maq-modulos-registry.js"),menu=read("Maqueta/maq-menu.js");
["nucleos","complexivo","trabajo","articulo"].forEach(t=>{
 assert.ok(core.includes("../NotasVisor/visor.html?tipo="+t),"maq-core → "+t);
 assert.ok(reg.includes("/NotasVisor/visor.html?tipo="+t),"registro → "+t);
});
assert.ok(menu.includes('moduloId:"notas_articulo",etiqueta:"Artículo"'));
assert.ok(menu.includes('moduloId:"carga_notas",etiqueta:"Cargado de notas"'));
const html=read("NotasVisor/visor.html");
assert.ok(html.includes('id="nv-period" data-periodo-global="true"'),"El visor sigue el período global");
// 3) Armado de filas.
const sb={window:{}};vm.runInNewContext(read("NotasVisor/visor.config.js"),sb);
const T=sb.window.NotasVisorConfig.types,P="2025-10__2026-03";
const nuc=[1,2,3,4].map(n=>({periodoId:P,cedula:"0000000001",nucleo:n,totalMoodle:[9.8,9.52,8.9,9.9][n-1],evaluaciones:[1,1,1,1].map(()=>[9.8,9.52,8.9,9.9][n-1]),casoEstudio:[9.8,9.52,8.9,9.9][n-1],desgloseCalculado:true}))
 .concat([{periodoId:P,cedula:"0000000002",nucleo:1,totalMoodle:8}]);
const cx=[{periodoId:P,cedula:"0000000001",oportunidadAplicada:"SUPLETORIO",promedioNucleos:9.53,notaTeorica:4.3,notaPractica:4.3,
 notaOrdinaria:4.3,notaSupletorio:7.53,notaTeoricaSupletorio:9.25,notaPracticaSupletorio:6.39,notaOficial:7.53,notaFinalIntegral:8.53,
 estadoEvaluacion:"APROBADO",camposCalculados:["Teórico ordinario","Práctico ordinario"]}];
let rows=T.complexivo.rows({notas_complexivo:cx,notas_nucleos:nuc});
assert.equal(rows.length,2,"Incluye a quien solo tiene núcleos");
let r=rows.find(x=>x.cedula==="0000000001");
assert.deepEqual(Array.from(r.cells.map(c=>c.v)),[9.53,4.3,4.3,4.3,7.53,7.53,8.53]);
assert.equal(r.cells[1].calc,true,"Teórico del ordinario marcado como calculado");
assert.equal(r.state,"APROBADO");
assert.equal(rows.find(x=>x.cedula==="0000000002").state,"PENDIENTE");
rows=T.nucleos.rows({notas_nucleos:nuc,notas_complexivo:cx});
r=rows.find(x=>x.cedula==="0000000001");
assert.equal(r.promedio,9.53,"Promedio oficial del sistema");
const det=T.nucleos.detail(r);assert.equal(det.table.rows[0][1].calc,true);assert.ok(det.note.includes("calculó"));
rows=T.trabajo.rows({notas_trabajo:[{periodoId:P,cedula:"0000000003",calificacionTutor:8,calificacionLector:8,promedioTrabajoEscrito:8,
 promedioEvaluacionPractica:7,promedioEvaluacionDefensa:7,promedioDefensaOral:7,notaFinal:7.6,vocales:[{numero:1,nombre:"VOCAL",practica:7,defensa:7}]}]});
assert.equal(rows[0].final,7.6);assert.equal(rows[0].state,"APROBADO");assert.equal(T.trabajo.detail(rows[0]).table.rows.length,1);
rows=T.articulo.rows({notas_articulo:[{periodoId:P,cedula:"0000000004",notaArticulo:6,notaDefensa:7,notaFinal:6.3}]});
assert.equal(rows[0].state,"NO_APROBADO");
rows=T.articulo.rows({notas_articulo:[{periodoId:P,cedula:"0000000005",notaArticulo:8}]});
assert.equal(rows[0].state,"PENDIENTE");
console.log("VISUALIZADORES DE NOTAS: OK — solo lectura, menú, período global, filas y cálculos marcados.");
