/* scripts/verify-notas-visor.js — Visualizadores de Notas y edición controlada de Artículo. Datos ficticios. */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const read=f=>fs.readFileSync(path.join(root,f),"utf8");
// 1) Las pantallas de consulta nunca escriben directamente: el guardado está aislado en visor.editor.js.
const app=read("NotasVisor/visor.app.js")+read("NotasVisor/visor.config.js");
["writeChecked","saveMany","saveEvaluation",".set(","runTransaction",".update(","publish(","deleteDoc","batch("].forEach(w=>
 assert.ok(!app.includes(w),"El visor no debe escribir: "+w));
// 2) Menú: las cuatro pestañas abren el visor, y Artículo admite corrección manual.
const core=read("Maqueta/maq-core.js"),reg=read("Maqueta/maq-modulos-registry.js"),menu=read("Maqueta/maq-menu.js");
["nucleos","complexivo","trabajo","articulo"].forEach(t=>{
 assert.ok(core.includes("../NotasVisor/visor.html?tipo="+t),"maq-core → "+t);
 assert.ok(reg.includes("/NotasVisor/visor.html?tipo="+t),"registro → "+t);
});
assert.ok(menu.includes('moduloId:"notas_articulo",etiqueta:"Artículo"'));
assert.ok(menu.includes('moduloId:"carga_notas",etiqueta:"Cargado de notas"'));
const html=read("NotasVisor/visor.html");
assert.ok(html.includes('id="nv-period" data-periodo-global="true"'),"El visor sigue el período global");
assert.ok(html.includes('id="nv-editor"'),"Formulario de edición de Artículo");
assert.ok(html.includes('src="visor.editor.js"'),"Dependencia del editor de notas");
assert.ok(html.includes('id="nv-missing"'),"Popup de estudiantes sin notas");
assert.ok(html.includes('id="nv-missing-others"'),"Búsqueda ampliada de matrículas");
assert.ok(app.includes("state.missing=rows.filter"),"Detecta notas pendientes");
assert.ok(app.includes("makeBlankArticle"),"Permite incluir estudiantes sin documento");
assert.ok(app.includes('create:current.create'),"Envia la opción de alta al guardado seguro");
assert.ok(app.includes('TIPO==="articulo"'),"El botón editar se limita a Artículo");
const edcode=read("NotasVisor/visor.editor.js");
["runTransaction","historialCorrecciones","notas_articulo","notas","validateDocument","FIREBASE_CONFLICT"].forEach(s=>
 assert.ok(edcode.includes(s),"La corrección debe ser atómica, auditada y segura: "+s));
const ew={window:{}};
vm.runInNewContext(edcode,ew,{filename:"visor.editor.js"});
const ED=ew.window.NotasVisorEditor;
let original=ED.valuesOf({calificacionTutor:7,calificacionLector:7,notaArticulo:7,
 promedioEvaluacionPractica:8,promedioEvaluacionDefensa:8,notaDefensa:8,notaFinal:7.3});
let changed=ED.applyChange(original,"calificacionTutor","9.00",0.7);
assert.equal(changed.notaArticulo,8,"Recalcula escrito al cambiar tutor");
assert.equal(changed.notaFinal,8,"Recalcula final con ponderación 70/30");
assert.equal(ED.changes(original,changed).length,3,"Detecta todos los cambios");
changed=ED.applyChange(original,"promedioEvaluacionPractica","10",0.5);
assert.equal(changed.notaDefensa,9,"Recalcula defensa oral");
assert.equal(changed.notaFinal,8,"Respeta ponderación 50/50");
changed=ED.applyChange(original,"notaFinal","6.50",0.7);
assert.equal(changed.notaFinal,6.5,"Permite corrección explícita de nota final");
assert.equal(changed.notaArticulo,7,"No altera otras notas al editar la final");
assert.throws(()=>ED.number("10.01"),/0 y 10/,"No acepta notas mayores a 10");
assert.throws(()=>ED.number("-1"),/0 y 10/,"No acepta negativas");
assert.throws(()=>ED.number("8.123"),/dos decimales/,"Máximo dos decimales");
assert.equal(ED.number(""),null,"Permite eliminar una nota incorrecta");
assert.equal(ED.missingKind(null),"SIN_REGISTRO");
assert.equal(ED.missingKind({}),"SIN_NOTAS");
assert.equal(ED.missingKind({notaArticulo:8,notaDefensa:0,notaFinal:5.6}),"INCOMPLETO","Detecta componentes vacíos, no el cero");
assert.equal(ED.missingKind({calificacionTutor:8,calificacionLector:8,notaArticulo:8,promedioEvaluacionPractica:0,promedioEvaluacionDefensa:0,notaDefensa:0,notaFinal:5.6}),"COMPLETO","Cero es una calificación válida");
assert.equal(ED.declaredModality({tipoTitulacion:"Artículo académico",modalidadTitulacion:"TRABAJO_TITULACION"}),"ARTICULO_ACADEMICO");
assert.equal(ED.declaredModality({_ncomplexHasSavedEvaluation:false,modalidadTitulacion:"EXAMEN_COMPLEXIVO"}),"","No convierte el valor por defecto en modalidad declarada");
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
console.log("VISUALIZADORES DE NOTAS: OK — consultas, edición de Artículo, validaciones, fórmulas y guardado auditado.");

/* Integración simulada: dos documentos, creación, edición, verificación, conflictos. */
(async function verifyArticleTransactions(){
 const w={};const context={window:w,CustomEvent:function(){}};
 ["BDLocal/firebase/bdl.firebase.schema.v2.js",
  "BDLocal/firebase/bdl.firebase.identity.js",
  "BDLocal/firebase/bdl.firebase.validator.v2.js",
  "BDLocal/firebase/bdl.firebase.mapper.v2.js",
  "NotasVisor/visor.editor.js"].forEach(file=>vm.runInNewContext(read(file),context,{filename:file}));
 const E=w.NotasVisorEditor,P="2026-02__2026-08",cedula="0000000007",id=P+"__"+cedula;
 const docs=new Map(),keys=[];
 const db={
  collection(name){return {doc(key){return {key:name+"/"+key};}};},
  async runTransaction(fn){
   const changes=[],tx={
    get:async(ref)=>({exists:docs.has(ref.key),data:()=>JSON.parse(JSON.stringify(docs.get(ref.key)))}),
    set:(ref,doc)=>changes.push([ref.key,doc])
   };
   const result=await fn(tx);
   changes.forEach(([key,value])=>{docs.set(key,value);keys.push(key);});
   return result;
  }
 };
 w.RequisitosFirebaseRepository={
  ensureFirestore:async()=>db,
  collectionName:entity=>w.RequisitosFirebaseSchema.collections[entity],
  validateDocument:(entity,doc,id)=>w.RequisitosFirebaseValidator.validate(entity,doc,{documentId:id}),
  getById:async(entity,id)=>({data:JSON.parse(JSON.stringify(docs.get(entity+"/"+id)))})
 };
 const base={periodoId:P,cedula,codigoCarrera:"A-ONLINE",nombreCarrera:"CARRERA DE PRUEBA",grupoInforme:"ONLINE",formula:"70/30"};
 let values=E.applyChange(E.valuesOf(base),"notaArticulo","8.50",0.7);
 const created=await E.persist({create:true,base,period:P,cedula,values,reason:"Calificación inicial"});
 assert.equal(created.ok,true,"Creación exitosa");
 assert.deepEqual(keys,["notas_articulo/"+id,"notas/"+id],"Alta atómica de artículo y resumen");
 const record=docs.get("notas_articulo/"+id),sum=docs.get("notas/"+id);
 assert.equal(record.notaArticulo,8.5);
 assert.equal(record.notaFinal,null,"No inventa nota final si falta defensa");
 assert.equal(record.estadoEvaluacion,"INCOMPLETO");
 assert.equal(sum.notaArticulo,8.5,"Resumen actualizado");
 assert.equal(record.historialCorrecciones.length,1);
 assert.equal(record.historialCorrecciones[0].origen,"registro_manual_notas_articulo");
 assert.equal(record.formula,"70/30");
 assert.equal(record.nombreCarrera,"CARRERA DE PRUEBA");
 values=E.applyChange(E.valuesOf(record),"notaDefensa","9.50",0.7);
 const updated=await E.persist({create:false,base:record,period:P,cedula,values,reason:"Completar nota defensa"});
 assert.equal(updated.ok,true);
 assert.equal(docs.get("notas_articulo/"+id).notaFinal,8.8);
 assert.equal(docs.get("notas/"+id).notaFinal,8.8);
 assert.equal(docs.get("notas_articulo/"+id).historialCorrecciones.length,2);
 const before=keys.length;
 await assert.rejects(E.persist({create:true,base,period:P,cedula,values:E.applyChange(E.valuesOf(base),"notaArticulo",7,0.7),reason:"Crear otra vez"}),e=>e.code==="FIREBASE_CONFLICT");
 assert.equal(keys.length,before,"Intento duplicado no escribe");
 await assert.rejects(E.persist({create:false,base:record,period:P,cedula,values,reason:"Prueba de conflicto"}),e=>e.code==="FIREBASE_CONFLICT");
 assert.equal(keys.length,before,"Edición basada en versión vieja no escribe");
 console.log("EDICIÓN DE ARTÍCULO: OK — alta, edición, historial, validación, conflictos y doble escritura atómica.");
})().catch(error=>{console.error(error);process.exitCode=1;});

