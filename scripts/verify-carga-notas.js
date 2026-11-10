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
// tipo_titulacion contradictorio: manda trabajoTitulacion y solo se avisa.
p=R.parse(row({tipo_titulacion:"Artículo académico"}));
assert.equal(p.tipo,"EXAMEN_COMPLEXIVO");assert.equal(p.errors.length,0);
assert.ok(p.warnings.some(x=>x.includes("se usa trabajoTitulacion")));
// El sistema gana: lo que no cuadra se conserva y se avisa.
p=R.parse(row({nota_nucleo2:"7.00"}));
assert.equal(p.errors.length,0);assert.equal(p.nota1,9.53);
assert.ok(p.warnings.some(x=>x.includes("No cuadra")&&x.includes("Promedio de núcleos")));
p=R.parse(row({notaTeorico:"9.00"}));
assert.equal(p.errors.length,0);assert.equal(p.notaExamenAplicada,8.5);
assert.ok(p.warnings.some(x=>x.includes("Examen ordinario")));
// Supletorio sin componentes: se calculan desde la nota del supletorio.
p=R.parse(row({nota2:"5.00",notaSupletorio:"7.00",notaTeorico:"",notaPractico:"",notaTrabajoTitulacion:"8.27"}));
assert.equal(p.errors.length,0,p.errors.join(" | "));
assert.equal(p.teorico,7);assert.equal(p.practico,7);
assert.ok(p.calculados.includes("Teórico supletorio"));
assert.equal(p.ordinarioCalculado.teorico,5);
// Falta un solo dato: se despeja (práctico = (8.5 − 0.4·10) / 0.6 = 7.5).
p=R.parse(row({notaPractico:""}));
assert.equal(p.practico,7.5);assert.ok(p.calculados.includes("Práctico"));
// Desglose de núcleos calculado desde la nota final.
p=R.parse(row());
assert.deepEqual(Array.from(p.desgloseNucleos[0].evaluaciones),[9.8,9.8,9.8,9.8]);
assert.equal(p.desgloseNucleos[0].casoEstudio,9.8);
// Sin nota final: se calcula y se marca.
p=R.parse(row({notaTrabajoTitulacion:""}));
assert.equal(p.final,9.02);assert.ok(p.calculados.includes("Nota de titulación"));
p=R.parse(row({nota1:"15.00"}));
assert.ok(p.errors.some(x=>x.includes("fuera de la escala")));
assert.equal(R.cid("123456789"),"0123456789");
assert.equal(R.period("ABRIL 2026 - SEPTIEMBRE 2026"),"2026-04__2026-09");
// Trabajo con desglose de tutor, lector y vocales (60 % escrito + 40 % defensa).
p=R.parse(row({trabajoTitulacion:"Trabajo Titulación",tipo_titulacion:"Examen Complexivo",
 nota1:"8.00",nota2:"7.00",notaTrabajoTitulacion:"7.60",notaTeorico:"",notaPractico:"",
 nota_nucleo1:"",nota_nucleo2:"",nota_nucleo3:"",nota_nucleo4:"",
 evaluacionTutor:"8.50",evaluacionLector:"7.50",
 sumatoriaEvaluacionPractica_vocal1:"7",sumatoriaEvaluacionPractica_vocal2:"7",sumatoriaEvaluacionPractica_vocal3:"7",
 sumatoriaEvaluacionDefensa_vocal1:"7",sumatoriaEvaluacionDefensa_vocal2:"7",sumatoriaEvaluacionDefensa_vocal3:"7"}));
assert.equal(p.tipo,"TRABAJO_TITULACION");assert.equal(p.errors.length,0,p.errors.join(" | "));
assert.equal(p.final,7.6);assert.equal(p.proyecto.tutor.nota,8.5);assert.equal(p.proyecto.promedioDefensa,7);
assert.equal(p.noCuadra.length,0,p.noCuadra.join(" | "));

/* Integración sin datos reales: BDLocal conciliada, separación de modalidades y
   escritura Firestore simulada con bloqueo de notas existentes diferentes. */
const client={CargaNotasRules:R};
const ctx={window:client,document:{readyState:"loading",addEventListener(){}},console};
for(const file of ["CargaNotas/carga-notas.firebase.js","CargaNotas/carga-notas.app.js"]){
 vm.runInNewContext(fs.readFileSync(path.join(root,file),"utf8"),ctx,{filename:file});
}
const app=client.CargaNotasApp,fb=client.CargaNotasFirebase;
const student={cedula:"1725633638",periodoId:"2025-10__2026-03",Nombres:"ARAUJO PILA NAYDELIN TATIANA",
 NombreCarrera:"ADMINISTRACION",CodigoCarrera:"550413A02-P-1701",
 estadoMatricula:"ACTIVO",aprobacionFinal:true};
let item=app.assess(R.parse(row()),[student],Object.create(null),Object.create(null),Object.create(null));
assert.equal(item.status,"ready",item.errors.join(" | "));
item=app.assess(R.parse(row()),[Object.assign({},student,{CodigoCarrera:"550413A03-P-1701"})],
 Object.create(null),Object.create(null),Object.create(null));
assert.equal(item.status,"ready","La carrera se toma de BDLocal si el Excel no declara código en núcleos.");
item=app.assess(R.parse(row({codigo_nucleo1:"CODIGO-INCORRECTO-714"})),[student],
 Object.create(null),Object.create(null),Object.create(null));
assert.equal(item.status,"ready");assert.ok(item.warnings.some(e=>e.includes("Código de núcleo")));
item=app.assess(R.parse(row()),[student],{"1725633638":{notaOficial:8.0}},
 Object.create(null),Object.create(null));
assert.equal(item.status,"ready","El sistema gana sobre la nota de la app.");
assert.ok(item.replaced.some(e=>e.includes("notaOficial")&&e.includes("se reemplaza")));
// Período del sistema distinto al de la matrícula: aviso, no bloqueo.
item=app.assess(R.parse(row({periodo_academico:"OCTUBRE 2025 - MARZO 2026"})),
 [Object.assign({},student,{periodoId:"2025-11__2026-05"})],Object.create(null),Object.create(null),Object.create(null));
assert.equal(item.status,"ready");assert.ok(item.warnings.some(e=>e.includes("período de su matrícula")));
// Sin Aprobación final: complexivo y trabajo siguen bloqueados.
item=app.assess(R.parse(row()),[Object.assign({},student,{aprobacionFinal:false})],
 Object.create(null),Object.create(null),Object.create(null));
assert.equal(item.status,"blocked");assert.ok(item.errors.some(e=>e.includes("Aprobación final")));
// Varias filas de la misma cédula: gana la del período elegido.
const twins=[R.parse(row({periodo_academico:"ABRIL 2026 - SEPTIEMBRE 2026",notaTrabajoTitulacion:"9.00"})),R.parse(row())];
assert.equal(app.pick(twins,"2025-10__2026-03")[0].final,9.02);
const saved=new Map();
client.RequisitosFirebaseMapper={functionalContent:x=>x,dataHash:x=>JSON.stringify(x).length.toString()};
client.RequisitosFirebaseOperationCenter={ensureNcomplex:async()=>true};
client.RequisitosFirebaseRepository={
 async getById(entity,id){const v=saved.get(entity+"/"+id);return v?{data:JSON.parse(JSON.stringify(v))}:null;},
 async writeChecked(entity,doc){saved.set(entity+"/"+doc.id,JSON.parse(JSON.stringify(doc)));return {ok:true,unchanged:false};}
};
(async()=>{
 const parsed=R.parse(row()),doc=fb.complexivo(parsed,student);
 assert.equal(doc.notaTeorica,10);assert.equal(doc.notaPractica,7.5);
 assert.equal(doc.oportunidadAplicada,"ORDINARIA");
 await fb.preflight([{entity:"notas_complexivo",doc}]);
 const result=await fb.publish("notas_complexivo",doc);assert.equal(result.ok,true);
 assert.equal(saved.get("notas_complexivo/"+doc.id).notaOficial,8.5);
 // El sistema gana: la revisión previa lista el reemplazo y la publicación lo aplica.
 const plan=await fb.preflight([{entity:"notas_complexivo",doc:Object.assign({},doc,{notaOficial:8.01})}]);
 assert.equal(plan.length,1);assert.equal(plan[0].campo,"notaOficial");assert.equal(plan[0].anterior,8.5);
 const again=await fb.publish("notas_complexivo",Object.assign({},doc,{notaOficial:8.01}));
 assert.equal(again.replaced.length,1);assert.equal(saved.get("notas_complexivo/"+doc.id).notaOficial,8.01);
 // Núcleo: evaluaciones calculadas y marcadas; las reales de Moodle se respetan.
 const n1=fb.nucleus(parsed,student,1,null);
 assert.deepEqual(Array.from(n1.evaluaciones),[9.8,9.8,9.8,9.8]);assert.equal(n1.desgloseCalculado,true);
 const moodle=fb.nucleus(parsed,student,1,{evaluaciones:[10,9,9.5,10],casoEstudio:10});
 assert.deepEqual(Array.from(moodle.evaluaciones),[10,9,9.5,10]);assert.equal(moodle.desgloseCalculado,false);
 const ps=R.parse(row({identificacion_estudiante:"0105266837",nota1:"8.24",nota2:"4.30",
  notaTrabajoTitulacion:"7.89",notaSupletorio:"7.53",notaTeorico:"9.25",
  notaPractico:"6.39",nota_nucleo1:"8.37",nota_nucleo2:"7.50",
  nota_nucleo3:"8.16",nota_nucleo4:"8.92"}));
 const supplement=fb.complexivo(ps,student);
 assert.equal(supplement.notaTeorica,4.3,"Ordinario calculado desde la nota 4.30");
 assert.equal(supplement.notaPractica,4.3);
 assert.equal(supplement.notaTeoricaSupletorio,9.25);
 assert.equal(supplement.notaPracticaSupletorio,6.39);
 assert.equal(supplement.notaOrdinaria,4.3);
 assert.equal(supplement.notaOficial,7.53);
 assert.equal(fb.general(ps,student).notaFinalIntegral,7.89);
 const work=fb.trabajo(R.parse(row({trabajoTitulacion:"Trabajo Titulación",
  tipo_titulacion:"Trabajo Titulación",nota1:"8.00",nota2:"9.00",notaTrabajoTitulacion:"8.40"})),student);
 assert.equal(work.tipoRegistro,"CONSOLIDADO_INSTITUCIONAL");
 assert.equal(work.numeroActaSenescyt,undefined);
 console.log("INTEGRACIÓN CARGADO DE NOTAS: OK — conciliación y Firebase simulado.");
})().catch(error=>{console.error(error);process.exitCode=1;});

console.log("CARGADO DE NOTAS: OK — cédula, períodos, núcleos, 40/60, supletorio, 50/50, artículo 70/30, trabajo 60/40, el sistema gana, desglose calculado.");
