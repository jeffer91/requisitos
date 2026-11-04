"use strict";
/* Reglas documentales: nueve requisitos, dos aprobaciones y borradores sin notas. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,"../Actas/actas.evidence.js"),"utf8"),ctx);
const model=ctx.window.ActasEvidence;
const keys=["academico","documentacion","financiero","practicas","vinculacion","seguimientograduados",
 "ingles","actualizaciondatos","titulacion","aprobaciontitulacion","aprobacioncomplexivoproyecto"];
const complete=Object.fromEntries(keys.map(k=>[k,"CUMPLE"]));
function assess(values=complete,mode="EXAMEN_COMPLEXIVO",student={}){
 return model.assess({mode,student,requirementValues:values});
}
const ok=assess();
assert.equal(ok.eligible,true);assert.equal(ok.requirements.length,9);
assert.equal(ok.titulationStatus,"CUMPLE");assert.equal(ok.finalTitleStatus,"CUMPLE");
assert.equal(ok.finalResultStatus,"CUMPLE");assert.equal(ok.requiredCount,9);
assert.equal(ok.missing.length,0);assert.equal(ok.draftEligible,true);
assert.equal(Object.hasOwn(ok,"evaluation"),false,"Actas no conserva ni muestra notas");
assert.equal(Object.hasOwn(ok,"nuclei"),false,"Actas no carga notas de núcleos");
assert.match(ok.closureText,/nueve requisitos/);
assert.equal(assess(complete,"EXAMEN_COMPLEXIVO",{Nombres:"SIN NOTAS"}).eligible,true,
 "La ausencia de notas no bloquea la aprobación documental");
assert.equal(assess({...complete,financiero:"PENDIENTE"}).eligible,false);
assert.equal(assess({...complete,titulacion:"NO CUMPLE"}).eligible,false);
assert.equal(assess({...complete,aprobaciontitulacion:"PENDIENTE"}).eligible,false);
const pending=assess({});assert.equal(pending.eligible,false);
assert.equal(pending.draftEligible,true,"Se admite borrador sin requisitos completos");
assert.equal(assess(complete,"ARTICULO_ACADEMICO").draftEligible,false);
 const stale={requisitos:[{requisitoKey:"financiero",valor:"CUMPLE"}]};
 assert.equal(assess({...complete,financiero:"PENDIENTE"},"EXAMEN_COMPLEXIVO",stale).eligible,false,
  "Un requisito actual PENDIENTE prevalece sobre la ficha histórica CUMPLE");
 const staleApproval={requisitos:[{requisitoKey:"aprobaciontitulacion",valor:"CUMPLE"}]};
 assert.equal(assess({...complete,aprobaciontitulacion:"PENDIENTE"},"EXAMEN_COMPLEXIVO",staleApproval).eligible,false,
  "La aprobación final actual prevalece sobre aprobaciones antiguas");
 assert.equal(assess(complete,"").draftEligible,false,"No admitir acta sin modalidad definida");
assert.equal(assess({},"EXAMEN_COMPLEXIVO",{Nombres:"ESTUDIANTE",...complete}).eligible,true);
const nested={requisitos:Object.entries(complete).map(([requisitoKey,valor])=>({requisitoKey,valor}))};
assert.equal(assess({},"TRABAJO_TITULACION",nested).eligible,true);
assert.equal(assess({...complete,practicas:undefined,practicasVinculacion:"CUMPLE"}).eligible,true);
assert.equal(assess({...complete,practicas:undefined,vinculacion:undefined,practicasVinculacion:"CUMPLE"}).eligible,false,
 "Prácticas/Vinculación combinado no acredita Vinculación por separado");
console.log("VERIFICACIÓN ACTAS EVIDENCIAS: OK (9 requisitos, 2 aprobaciones y borradores sin notas)");
