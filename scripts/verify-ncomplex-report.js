"use strict";
/* Reporte institucional: cohortes completas, requisitos, ponderación y estructura PDF.
 * Los datos son sintéticos, sin acceso a Firestore ni datos personales reales.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,".."),window={},document={getElementById(){return null;}};
const context=vm.createContext({window,document,console,Date});
for(const file of ["Ncomplex/ncomplex.report.model.js","Ncomplex/ncomplex.report.document.js","Ncomplex/ncomplex.report.pdf.js"])
 vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),context,{filename:file});
const ruleNames=["Académico","Documentación","Financiero","Prácticas","Vinculación",
 "Seguimiento graduados","Inglés","Actualización de datos","Titulación"];
function eligibility(changed){
 const requirements=ruleNames.map(label=>({label,status:label===changed?"PENDIENTE":"CUMPLE"}));
 return {eligible:!changed,complete:changed?8:9,total:9,requirements,reason:changed?changed+" (PENDIENTE)":""};
}
const period="2026-04__2026-09",other="2025-10__2026-03",base={
 periodoId:period,NombreCarrera:"EDUCACIÓN INICIAL",estadoMatricula:"ACTIVO",
 modalidadTitulacion:"EXAMEN_COMPLEXIVO",_ncomplexHasSavedEvaluation:true,
 _ncomplexRequirements:eligibility(),oportunidadAplicada:"ORDINARIA",
 notaTeorica:9.7,notaPractica:9,notaOficial:9.28
};
const record=(cedula,name,changes)=>Object.assign({},base,{cedula,Nombres:name},changes||{});
const rows=[record("0100000001","ALUMNA VALIDA"),
 record("0100000002","ALUMNA REQUISITOS",{_ncomplexRequirements:eligibility("Financiero")}),
 record("0100000003","ALUMNA SIN NOTAS",{_ncomplexHasSavedEvaluation:false}),
 record("0100000004","ALUMNA NOTA INCONSISTENTE",{notaOficial:9.9}),
 record("0100000005","ALUMNA SUPLETORIO",{oportunidadAplicada:"SUPLETORIO",
 notaTeorica:6,notaPractica:7,notaComplexivo:6.6,
 notaTeoricaSupletorio:7,notaPracticaSupletorio:8,notaOficial:7.6}),
 record("0100000006","ALUMNA ORDINARIA BAJA",{notaTeorica:6,notaPractica:7,notaOficial:6.6}),
 record("0100000007","DUPLICADA"),record("0100000007","DUPLICADA"),
 record("0100000008","OTRO PERIODO",{periodoId:other}),
 record("0100000009","OTRA MODALIDAD",{modalidadTitulacion:"TRABAJO_TITULACION"}),
 record("0100000010","RETIRADA",{estadoMatricula:"RETIRADO"})];
const model=window.NcomplexReportModel,report=model.build(rows,period);
assert.equal(report.summary.registered,8,"Solo estudiantes activos y complexivo del período");
assert.equal(report.summary.qualified,3,"Se incluyen únicamente expedientes completos");
assert.equal(report.summary.approved,2);
assert.equal(report.summary.pending,1);
assert.equal(report.summary.excluded.requisitos,1);
assert.equal(report.summary.excluded.sinNotas,1);
assert.equal(report.summary.excluded.incidencia,1);
assert.equal(report.summary.excluded.duplicados,2);
assert.equal(report.careers.length,1);
assert.equal(report.careers[0].rows[0].name,"ALUMNA ORDINARIA BAJA");
assert.equal(report.careers[0].rows.find(x=>x.name==="ALUMNA VALIDA").final,9.28);
assert.equal(report.careers[0].rows.find(x=>x.name==="ALUMNA SUPLETORIO").final,7.6);
assert.equal(report.careers[0].rows.find(x=>x.name==="ALUMNA ORDINARIA BAJA").status,"SUPLETORIO PENDIENTE");
assert.ok(!report.careers[0].rows.some(x=>x.name==="ALUMNA REQUISITOS"));
const pages=window.NcomplexReportPDF.contentPages(report,"Abril 2026 a Septiembre 2026","Fecha de ensayo");
assert.equal(pages[0].title,"Portada","Debe iniciar con portada institucional");
assert.equal(pages[1].title,"Resumen ejecutivo","El resumen ejecutivo sigue a la portada");
assert.ok(pages.some(p=>p.title==="Comparativo práctico"));
assert.ok(pages.some(p=>p.title==="Comparativo teórico"));
assert.ok(pages.some(p=>p.title==="Comparativo final"));
assert.ok(pages.some(p=>p.title==="EDUCACIÓN INICIAL · práctico · tabla"));
assert.ok(pages.some(p=>p.title==="EDUCACIÓN INICIAL · práctico · análisis"));
assert.ok(pages.some(p=>p.title==="EDUCACIÓN INICIAL · teórico · tabla"));
assert.ok(pages.some(p=>p.title==="EDUCACIÓN INICIAL · teórico · análisis"));
assert.ok(pages.some(p=>p.title==="EDUCACIÓN INICIAL · finales · tabla"));
assert.ok(pages.some(p=>p.title==="EDUCACIÓN INICIAL · finales · análisis"));
assert.ok(pages.some(p=>p.title==="EDUCACIÓN INICIAL · consolidado"));
assert.ok(pages.some(p=>p.title==="EDUCACIÓN INICIAL · conclusiones"));
const concatenated=pages.map(p=>p.body).join("\n");
const wrongSupplementary=model.classify(record("0100000091","SUPLETORIO INCORRECTO",{
 oportunidadAplicada:"SUPLETORIO",notaTeorica:8,notaPractica:8,
 notaTeoricaSupletorio:7,notaPracticaSupletorio:8,notaOficial:7.6
}));
assert.equal(wrongSupplementary.status,"incidencia","No aplicar supletorio si el ordinario ya aprobó");
const staleOrdinary=model.classify(record("0100000092","SUPLETORIO SIN APLICAR",{
 notaTeorica:6,notaPractica:7,notaOficial:6.6,
 notaTeoricaSupletorio:8,notaPracticaSupletorio:8
}));
assert.equal(staleOrdinary.status,"incidencia","No presentar ordinario si hay un supletorio completo");
const excludedOnly=model.build([record("0100000093","PENDIENTE TITULACIÓN",{
 _ncomplexRequirements:eligibility("Titulación")
})],period);
assert.equal(excludedOnly.summary.qualified,0);
assert.ok(window.NcomplexReportPDF.contentPages(excludedOnly,"Abril 2026","Fecha de ensayo").length>0);
assert.ok(concatenated.includes("ALUMNA VALIDA"));
assert.ok(!concatenated.includes("ALUMNA REQUISITOS"));
assert.ok(concatenated.includes("Gráfico de distribución de calificaciones práctico"));
assert.ok(concatenated.includes("Gráfico de distribución de calificaciones teórico"));
assert.ok(concatenated.includes("Distribución por condición académica"));
assert.ok(concatenated.includes("Teórico × 0,40) + (Práctico × 0,60)"));
assert.ok(concatenated.includes("Resumen estadístico consolidado"));
assert.ok(concatenated.includes("Mediana /100"));
assert.ok(concatenated.includes("Conclusión general"));
assert.ok(concatenated.includes("Calificación /100"));
assert.ok(concatenated.includes("Teórico /100"));
assert.ok(concatenated.includes("Práctico /100"));
assert.ok(concatenated.includes("Final /100"));
assert.ok(!concatenated.includes("ALUMNA REQUISITOS"),"No publicar nombres de excluidos");
assert.ok(concatenated.includes("ALUMNA VALID"));
const stats=model.build([record("0100000071","ESTUDIANTE CON 70",{notaTeorica:7,notaPractica:7,notaOficial:7}),
 record("0100000072","ESTUDIANTE CON 90",{notaTeorica:9,notaPractica:9,notaOficial:9})],period);
const metric=window.NcomplexReportDocument.stats(stats.careers[0].rows,"final");
assert.equal(metric.mean,8);
assert.equal(metric.median,8);
assert.equal(metric.min,7);
assert.equal(metric.max,9);
assert.equal(metric.above,2);
const printed=window.NcomplexReportPDF.pageHtml(pages[0],1,pages.length,
 {period:"Abril 2026",date:"Fecha de ensayo"},"../Global/assets/branding/logo-instituto.png");
assert.ok(printed.includes("logo-instituto.png"));
assert.ok(printed.includes("nr-pdf-cover"));
assert.ok(printed.includes("RESULTADOS DE LOS EXÁMENES COMPLEXIVOS"));
assert.ok(printed.includes("UNIDAD DE TITULACIÓN"));
const inner=window.NcomplexReportPDF.pageHtml(pages[1],2,pages.length,
 {period:"Abril 2026",date:"Fecha de ensayo"},"../Global/assets/branding/logo-instituto.png");
assert.ok(inner.includes("Página 2 de "+pages.length));
const many=Array.from({length:57},(_,i)=>record(String(1000000000+i),"ESTUDIANTE "+i));
const full=model.build(many,period);
const fullPages=window.NcomplexReportPDF.contentPages(full,"Abril 2026 a Septiembre 2026","Fecha de ensayo");
assert.equal(full.summary.qualified,57,"No limitar el informe a las primeras 25 filas");
const roster=fullPages.filter(p=>p.title==="EDUCACIÓN INICIAL · finales · tabla");
assert.equal(roster.length,5,"Cohorte larga dividida en cinco páginas finales");
assert.equal((roster.map(p=>p.body).join("").match(/92,80/g)||[]).length,57,"La nota 9,28/10 se presenta como 92,80/100 en el informe");
assert.ok(fullPages.some(p=>p.kind==="cover"));
console.log("VERIFICACIÓN INFORME COMPLEXIVOS: OK (9/9, excluidos, 40/60, 57 estudiantes, gráficos, logo y páginas)");
