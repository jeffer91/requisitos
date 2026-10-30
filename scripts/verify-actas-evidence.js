"use strict";
/* Prueba de reglas de cierre: ocho requisitos, Titulación y notas oficiales sin inferencias. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const context={window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,"../Actas/actas.evidence.js"),"utf8"),context);
const model=context.window.ActasEvidence;
const all=["academico","documentacion","practicasvinculacion","vinculacion","seguimientograduados","ingles","actualizaciondatos","financiero","titulacion","aprobaciontitulacion","aprobacioncomplexivoproyecto"];
const ok=Object.fromEntries(all.map(k=>[k,"CUMPLE"]));
function record(mode="EXAMEN_COMPLEXIVO"){
 const evalRow=mode==="EXAMEN_COMPLEXIVO"?{modalidadTitulacion:mode,estadoEvaluacion:"APROBADO",notaTeorica:8,notaPractica:9,notaOficial:8.6,oportunidadAplicada:"ORDINARIA"}:{modalidadTitulacion:mode,estadoEvaluacion:"APROBADO",notaEscrito:8,notaDefensaTrabajo:9,notaOficial:8.4};
 return {mode,student:{Nombres:"PERSONA PRUEBA",_ncomplexHasSavedEvaluation:true,_ncomplexEvaluation:evalRow},requirementValues:ok};
}
const a=model.assess(record());
assert.equal(a.eligible,true);
assert.equal(a.requirements.length,8);
assert.equal(a.evaluation.official,8.6);
assert.equal(a.titulationStatus,"CUMPLE");
assert.equal(a.evaluation.rows[0].value,"8,00/10");
assert.equal(a.evaluation.rows[2].value,"8,60/10");
assert.match(a.nucleiText,/no dispone de calificaciones independientes/);
const missing=model.assess({...record(),requirementValues:{...ok,financiero:"PENDIENTE"}});
assert.equal(missing.eligible,false);
assert.ok(missing.missing.some(x=>x.includes("Financiero")));
const noTitle=model.assess({...record(),requirementValues:{...ok,titulacion:"NO CUMPLE"}});
assert.equal(noTitle.eligible,false);
const noEvaluation=model.assess({...record(),student:{Nombres:"SIN EVALUACIÓN"}});
assert.equal(noEvaluation.eligible,false);
const contradictory=model.assess({...record(),student:{_ncomplexHasSavedEvaluation:true,_ncomplexEvaluation:{...record().student._ncomplexEvaluation,notaOficial:9.7}}});
assert.equal(contradictory.eligible,false);
assert.ok(contradictory.missing.some(x=>x.includes("Inconsistencia")));
const work=model.assess(record("TRABAJO_TITULACION"));
assert.equal(work.eligible,true);
assert.equal(work.evaluation.official,8.4);
const supl=model.assess({...record(),student:{_ncomplexHasSavedEvaluation:true,_ncomplexEvaluation:{modalidadTitulacion:"EXAMEN_COMPLEXIVO",estadoEvaluacion:"APROBADO",oportunidadAplicada:"SUPLETORIO",notaTeoricaSupletorio:7,notaPracticaSupletorio:8,notaOficial:7.6}}});
assert.equal(supl.eligible,true);
assert.equal(supl.evaluation.opportunity,"SUPLETORIO");
assert.equal(supl.evaluation.rows[2].value,"7,60/10");
console.log("VERIFICACIÓN ACTAS EVIDENCIAS: OK (malla, ocho requisitos, núcleos, Ncomplex, supletorio y casos bloqueados)");
