"use strict";
/* Verifica flujo del módulo Actas con datos simulados y sin bases de estudiantes reales. */
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const html=read("Actas/actas.html");
const issueLoaded=html.indexOf('src="actas.issue-date.js"');
const appLoaded=html.indexOf('src="actas.app.js"');
assert.ok(issueLoaded>=0&&appLoaded>issueLoaded,
 "Actas debe cargar actas.issue-date.js antes de actas.app.js para generar PDF sin error forPeriod");
const context={URL,Promise,Set,Map,JSON,Date,console,Blob,setTimeout,clearTimeout};
const storage=new Map(),elements=new Map(),printed=[],zips=[],modalityWrites=[],delays=new Map(),calls=[];
const centralNumbers=new Map();let centralCounter=0;
function elem(id){if(!elements.has(id))elements.set(id,{
 id,value:"",innerHTML:"",textContent:"",disabled:false,checked:false,handlers:{},classList:{toggle(){},add(){},remove(){}},
 addEventListener(type,fn){this.handlers[type]=fn;},
 querySelector(selector){
  const mt=selector.match(/data-acta-id="([^"]+)"\]\[data-fecha="([^"]+)"/);
  if(!mt)return null;
  const regex=new RegExp('data-acta-id="'+mt[1]+'" data-fecha="'+mt[2]+'" value="([^"]*)"');
  const found=this.innerHTML.match(regex);
  return found?{value:found[1]}:null;
 }
});return elements.get(id);}
function trigger(id,type,event){const fn=elem(id).handlers[type];assert.equal(typeof fn,"function",id+" "+type+" tiene controlador");return fn(Object.assign({target:elem(id)},event||{}));}
const per1="2025-10__2026-03",per2="2026-04__2026-09";
const student=(c,n,m=undefined,extra={})=>Object.assign({cedula:c,Nombres:n,periodoId:per1,NombreCarrera:"ADMINISTRACIÓN",modalidadTitulacion:m===undefined?"EXAMEN_COMPLEXIVO":m,estadoMatricula:"ACTIVO"},extra);
const req=(cedula,periodoId,field,state="CUMPLE")=>({cedula,periodoId,requisitoKey:field,valor:state});
const field1="aprobaciontitulacion",field2="aprobacioncomplexivoproyecto";
const eight=["academico","documentacion","practicasvinculacion","vinculacion","seguimientograduados","ingles","actualizaciondatos","financiero"];
const grades=mode=>mode==="TRABAJO_TITULACION"?{modalidadTitulacion:mode,estadoEvaluacion:"APROBADO",notaEscrito:8,notaDefensaTrabajo:9,notaOficial:8.4,oportunidadAplicada:"ORDINARIA"}:{modalidadTitulacion:mode,estadoEvaluacion:"APROBADO",notaTeorica:8,notaPractica:9,notaOficial:8.6,oportunidadAplicada:"ORDINARIA"};
const dataset1={
students:[student("0001","EXAMEN APROBADO","EXAMEN_COMPLEXIVO",{_ncomplexHasSavedEvaluation:true,estadoEvaluacion:"APROBADO",_ncomplexEvaluation:grades("EXAMEN_COMPLEXIVO"),...Object.fromEntries(eight.concat(["titulacion"]).map(k=>[k,"CUMPLE"]))}),student("0002","EXAMEN FALTANTE"),student("0003","TRABAJO APROBADO","TRABAJO_TITULACION",{_ncomplexHasSavedEvaluation:true,estadoEvaluacion:"APROBADO",_ncomplexEvaluation:grades("TRABAJO_TITULACION")}),student("0004","RETIRADO","EXAMEN_COMPLEXIVO",{estadoMatricula:"RETIRADO"}),student("0005","NOTA REPROBADA","EXAMEN_COMPLEXIVO",{_ncomplexHasSavedEvaluation:true,estadoEvaluacion:"NO_APROBADO"}),student("0007","ARTÍCULO PVC","TRABAJO_TITULACION",{tipoTitulacion:"ARTICULO_ACADEMICO",_ncomplexHasSavedEvaluation:false}),student("0008","DOS APROBACIONES SIN NOTAS"),student("0009","DOS APROBACIONES EVALUACIÓN INCOMPLETA","EXAMEN_COMPLEXIVO",{_ncomplexHasSavedEvaluation:true,estadoEvaluacion:"INCOMPLETO",_ncomplexEvaluation:{modalidadTitulacion:"EXAMEN_COMPLEXIVO",estadoEvaluacion:"INCOMPLETO",notaTeorica:8}})],
requirements:[req("0001",per1,field1),req("0001",per1,field2),req("0002",per1,field1),req("0003",per1,field1),req("0003",per1,field2),req("0004",per1,field1),req("0004",per1,field2),req("0005",per1,field1),req("0005",per1,field2),req("0007",per1,field1),req("0007",per1,field2),req("0008",per1,field1),req("0008",per1,field2),req("0009",per1,field1),req("0009",per1,field2),...["0003"].flatMap(id=>eight.concat(["titulacion"]).map(key=>req(id,per1,key)))]};
dataset1.students[0]._actasNuclei=[1,2,3,4].map(n=>({nucleo:n,notaFinal:8,estado:"APROBADO"}));
dataset1.students[0]._actasComplexivo=grades("EXAMEN_COMPLEXIVO");
const dataset2={students:[student("0006","OTRO PERIODO",undefined,{periodoId:per2,modalidadTitulacion:""})],requirements:[req("0006",per2,field1),req("0006",per2,field2)]};
const document={readyState:"complete",getElementById:elem,addEventListener(){},body:{appendChild(){}},createElement(){return {click(){},remove(){}}}};
const win={
 location:{href:"https://example.test/requisitos/Actas/actas.html"},
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
 confirm:()=>true,
 ConActas:{
  async ready(){return {ok:true}},
  async listPeriods(){return [{periodoId:per1,nombre:"Octubre 2025 a Marzo 2026"},{periodoId:per2,nombre:"Abril 2026 a Septiembre 2026"}]},
  async read(opts){calls.push(opts.periodoId); if(delays.has(opts.periodoId))return delays.get(opts.periodoId).promise;return {data:opts.periodoId===per1?dataset1:dataset2};},
   async setModality(opts){
    modalityWrites.push(opts);
    const list=opts.periodoId===per1?dataset1.students:dataset2.students;
    const row=list.find(s=>s.cedula===opts.cedula&&s.periodoId===opts.periodoId);
    if(row)row.modalidadTitulacion=opts.mode;
    return {ok:true};
   }
 },
 ActasIssueDate:{forPeriod:()=>({date:"2026-05-29",year:"2026",month:"05",monthKey:"2026-05",holidaysVerified:true}),mayRegister:()=>true},
 ActasNumbering:{
  async list(periodoId){return [...centralNumbers.values()].filter(x=>x.periodoId===periodoId);},
  async getOrAssign(input){const key=input.periodoId+"__"+input.cedula;if(centralNumbers.has(key))return centralNumbers.get(key);
   centralCounter++;const entry={identidad:key,periodoId:input.periodoId,cedula:input.cedula,modalidad:input.modalidad,numeroActa:"2026-"+input.cedula.slice(0,4)+"-10-"+String(centralCounter).padStart(4,"0"),fechaCliente:"2026-10-30"};
   centralNumbers.set(key,entry);return entry;},
  readableError:e=>String(e&&e.message||e)
 },
 ActasPDF:{download:async items=>{printed.push(items);return {ok:true,count:Array.isArray(items)?items.length:1}},downloadZip:async(items,summary,periodoId)=>{zips.push({items,summary,periodoId});return {ok:true,generated:items.length,excluded:summary.length-items.length,errors:0}}},ActasBrand:{resolve:async()=>null},
};
context.window=win;context.document=document;
vm.createContext(context);
vm.runInContext(read("Actas/actas.catalog.js"),context);
vm.runInContext(read("Actas/actas.evidence.js"),context);
vm.runInContext(read("Actas/actas.app.js"),context);
const tick=()=>new Promise(r=>setTimeout(r,0));
async function main(){
await tick();await tick();
assert.equal(elem("actas-aprobados").textContent,5,"Autoriza borradores con ambas aprobaciones, aunque falten registros de Ncomplex");
assert.match(elem("actas-estudiantes").innerHTML,/EXAMEN APROBADO/);
assert.match(elem("actas-estudiantes").innerHTML,/EXAMEN FALTANTE/,"El buscador/listado muestra pendientes");
win.ActasNumbering.listDetailed=async()=>({
 entries:[{cedula:"0001",periodoId:per1,numeroActa:"2026-0001-05-0001"}],
 verified:false,source:"cache",warning:"Failed to get documents from server"
});
trigger("actas-recargar","click");await tick();await tick();
assert.match(elem("actas-alert").textContent,/Libro central NO VERIFICADO/,"Aviso diferenciado cuando falla el servidor");
assert.equal(elem("actas-registrar-lote").disabled,true,"No habilitar numeración masiva con caché");
assert.match(elem("actas-estudiantes").innerHTML,/servidor no verificado/,"El estado nominal revela falta de verificación");
assert.doesNotMatch(elem("actas-estudiantes").innerHTML,/N.º 2026-0001-05-0001/,"Un número en caché no aparece como folio oficial");
assert.ok(elem("actas-estudiantes").innerHTML.includes("data-register=\"0\" disabled"),"No registrar número individual cuando el libro está sin verificar");
delete win.ActasNumbering.listDetailed;
trigger("actas-recargar","click");await tick();await tick();
assert.doesNotMatch(elem("actas-alert").textContent,/NO VERIFICADO/,"La reconexión restaura el estado del libro central");
assert.match(elem("actas-estudiantes").innerHTML,/RETIRADO/,"Muestra retirados sin permitir descargar");
assert.match(elem("actas-estudiantes").innerHTML,/NOTA REPROBADA/,"Muestra evaluaciones pendientes de revisión");
trigger("actas-seleccionar","click");
assert.equal(elem("actas-lote").disabled,false);
trigger("actas-lote","click");await tick();
assert.equal(printed.length,1);
assert.equal(printed[0].length,6,"PDF masivo admite todas las matrículas activas de COMPLEX y TRAB, incluso sin notas");
assert.equal(printed[0][0].student.cedula,"0001");
assert.equal(printed[0].filter(x=>x.record.numeroActa).length,0,"Descargar borradores no asigna folios automáticamente");
assert.equal(printed[0].filter(x=>!x.record.numeroActa).length,6,"Antes de numerar, todos son borradores sin folio");
assert.ok(printed[0].every(x=>x.issue==="2026-05-29"),"Fecha común de emisión según el período seleccionado");
 assert.ok(printed[0].every(x=>x.record.codigo==="AT-ITSQMET-UTET-2026-05"),
  "El código del encabezado corresponde al año y mes de emisión, sin día ni consecutivo");
 assert.ok(printed[0].some(x=>x.student.cedula==="0008"&&x.evidence.eligible===false),"Incluye borradores con aprobaciones pero requisitos pendientes");
assert.equal(printed[0][0].evidence.requirements.length,9,"Acta muestra nueve requisitos");
assert.ok(printed[0][0].evidence.requirements.every(r=>r.status==="CUMPLE"),"Lee nueve requisitos del expediente");
assert.equal(printed[0][0].evidence.evaluation,undefined,"Actas no recibe ni conserva calificaciones");
assert.equal(printed[0].find(x=>x.student.cedula==="0003").evidence.titulationStatus,"CUMPLE","Titulación se verifica mediante requisito institucional, no notas de núcleos");
assert.ok(storage.has("UTET_ACTAS_BORRADORES_V1"),"Guarda consecutivo de borrador");
const regClick={dataset:{register:"0"},disabled:false};
await trigger("actas-estudiantes","click",{target:{closest:sel=>sel==="button[data-register]"?regClick:null}});await tick();
assert.equal(centralNumbers.size,1,"Registrar N.º asigna un único registro central");
await trigger("actas-estudiantes","click",{target:{closest:sel=>sel==="button[data-register]"?regClick:null}});await tick();
assert.equal(centralNumbers.size,1,"Registrar nuevamente no duplica el número");
 const beforeLocked=modalityWrites.length,registeredSelector={value:"TRABAJO_TITULACION",disabled:false,dataset:{mode:"0"},matches:s=>s==="[data-mode]"};
 await trigger("actas-estudiantes","change",{target:registeredSelector});await tick();
 assert.equal(modalityWrites.length,beforeLocked,"Un acta numerada no permite cambio de modalidad");
 assert.match(elem("actas-alert").textContent,/número oficial/);
// La presentación de un borrador antiguo usa el código normalizado sin modificar el folio.
const earlier=JSON.parse(storage.get("UTET_ACTAS_BORRADORES_V1"));
const oldEntry=earlier[per1+"__0001"];
assert.ok(oldEntry,"Existe el borrador previo para comprobar compatibilidad");
oldEntry.codigo="AT-ITSQMET-UTET-2026-10-02";
storage.set("UTET_ACTAS_BORRADORES_V1",JSON.stringify(earlier));
trigger("actas-zip","click");await tick();assert.equal(zips.length,1,"Genera ZIP del período");
assert.equal(zips[0].items[0].record.codigo,"AT-ITSQMET-UTET-2026-05",
 "El ZIP corrige en pantalla el código de un borrador antiguo");
assert.equal(JSON.parse(storage.get("UTET_ACTAS_BORRADORES_V1"))[per1+"__0001"].codigo,
 "AT-ITSQMET-UTET-2026-10-02","El registro local histórico permanece sin modificar");assert.equal(zips[0].items.length,6,"ZIP incorpora borradores sin notas");assert.equal(zips[0].summary.length,8,"ZIP registra también excluidos");
assert.equal(centralNumbers.size,1,"El ZIP no crea números nuevos");
assert.equal(zips[0].items[0].record.numeroActa,centralNumbers.get(per1+"__0001").numeroActa,"El ZIP reutiliza el número previamente registrado");
assert.equal(zips[0].items.filter(x=>!x.record.numeroActa).length,5,"Los demás PDF siguen como borradores sin folio");
trigger("actas-modalidad","change",{target:{value:"TRABAJO_TITULACION"}});
assert.equal(elem("actas-aprobados").textContent,5,"La métrica mantiene separadas las dos aprobaciones finales");
assert.match(elem("actas-estudiantes").innerHTML,/TRABAJO APROBADO/);
assert.doesNotMatch(elem("actas-estudiantes").innerHTML,/ARTÍCULO PVC/,"El filtro TRAB no convierte Artículo Académico en Trabajo");
assert.ok(elem("actas-actividades").innerHTML.includes("Fase 3: Defensa final"));
trigger("actas-guardar","click");
assert.ok(storage.has("UTET_ACTAS_CRONO_V1__"+per1+"__TRABAJO_TITULACION"),"Guarda cronograma por modalidad y periodo");
const all=JSON.parse(storage.get("UTET_ACTAS_CRONO_V1__"+per1+"__TRABAJO_TITULACION"));
assert.equal(all.groups.flatMap(g=>g.actividades).length,20);
trigger("actas-modalidad","change",{target:{value:"EXAMEN_COMPLEXIVO"}});
assert.equal(elem("actas-actividades").innerHTML.includes("Núcleo 1"),true);
trigger("actas-busqueda","input",{target:{value:"TRABAJO APROBADO"}});
assert.match(elem("actas-estudiantes").innerHTML,/TRABAJO APROBADO/,"La búsqueda encuentra estudiantes de cualquier modalidad");
trigger("actas-busqueda","input",{target:{value:""}});
let resolveSlow;
delays.set(per1,{promise:new Promise(resolve=>{resolveSlow=resolve;})});
trigger("actas-recargar","click");
trigger("actas-periodo","change",{target:{value:per2}});
await tick();await tick();
assert.match(elem("actas-estudiantes").innerHTML,/OTRO PERIODO/,"Lee segundo período");
 assert.match(elem("actas-estudiantes").innerHTML,/value="EXAMEN_COMPLEXIVO" selected/,"Se muestra Complexivo por defecto sin modalidad guardada");
 assert.doesNotMatch(elem("actas-estudiantes").innerHTML,/data-pdf="0" disabled/,"El borrador se descarga con Complexivo por defecto");
 assert.match(elem("actas-estudiantes").innerHTML,/data-register="0" disabled/,"Los requisitos siguen bloqueando la numeración");
const defaultDownload={dataset:{pdf:"0"},disabled:false};
await trigger("actas-estudiantes","click",{target:{closest:selector=>selector==="button[data-pdf]"?defaultDownload:null}});await tick();
assert.equal(printed.length,2,"Se descarga un PDF individual sin guardar una modalidad explícita");
assert.equal(printed[1].mode,"EXAMEN_COMPLEXIVO","El borrador usa Examen Complexivo por defecto");
resolveSlow({data:dataset1});
await tick();await tick();
assert.match(elem("actas-estudiantes").innerHTML,/OTRO PERIODO/,"Lectura tardía no reemplaza período actual");
assert.doesNotMatch(elem("actas-estudiantes").innerHTML,/EXAMEN APROBADO/);
const selector={value:"TRABAJO_TITULACION",disabled:false,dataset:{mode:"0"},matches:s=>s==="[data-mode]"};
win.confirm=()=>false;
await trigger("actas-estudiantes","change",{target:selector});await tick();
assert.equal(modalityWrites.length,0,"No modificar modalidad al cancelar la advertencia sobre Ncomplex");
assert.equal(selector.value,"EXAMEN_COMPLEXIVO","Restaurar modalidad por defecto al cancelar");
win.confirm=()=>true;selector.value="TRABAJO_TITULACION";
await trigger("actas-estudiantes","change",{target:selector});await tick();
assert.equal(modalityWrites.length,1,"Guarda modalidad mediante conector");
assert.equal(modalityWrites[0].mode,"TRABAJO_TITULACION");
trigger("actas-modalidad","change",{target:{value:"TODAS"}});
assert.match(elem("actas-estudiantes").innerHTML,/value="TRABAJO_TITULACION" selected/,"Tras cambiar la modalidad debe conservarse al recargar");
assert.doesNotMatch(elem("actas-estudiantes").innerHTML,/data-pdf="0" disabled/,"También puede descargarse borrador TRAB");
const updatedDownload={dataset:{pdf:"0"},disabled:false};
await trigger("actas-estudiantes","click",{target:{closest:selector=>selector==="button[data-pdf]"?updatedDownload:null}});await tick();
assert.equal(printed.length,3,"Se descarga el segundo borrador tras cambiar a Trabajo");
assert.equal(printed[2].mode,"TRABAJO_TITULACION","El segundo borrador usa la modalidad guardada");
const drafts=JSON.parse(storage.get("UTET_ACTAS_BORRADORES_V1"));
assert.ok(Object.keys(drafts).some(key=>key.includes("__ANTERIOR__EXAMEN_COMPLEXIVO__")),
 "Se conserva el borrador anterior como historial al cambiar modalidad");
trigger("actas-modalidad","change",{target:{value:"EXAMEN_COMPLEXIVO"}});
trigger("actas-ejemplo","click");
assert.match(elem("actas-alert").textContent,/exclusivamente al período Octubre 2025 a Marzo 2026/);
assert.equal(elem("actas-cronograma-estado").textContent,"Sin fechas guardadas","No inyecta fechas de otro periodo");
dataset2.students.push(student("0010","MODALIDAD GUARDADA COMPLEX","EXAMEN_COMPLEXIVO",{
 periodoId:per2,tipoTitulacion:"TRABAJO_TITULACION"
}));
dataset2.students.push(student("0011","MODALIDAD GUARDADA TRAB","TRABAJO_TITULACION",{
 periodoId:per2,tipoTitulacion:"EXAMEN_COMPLEXIVO"
}));
trigger("actas-recargar","click");await tick();await tick();
trigger("actas-modalidad","change",{target:{value:"TODAS"}});
assert.match(elem("actas-estudiantes").innerHTML,/MODALIDAD GUARDADA COMPLEX/);
assert.match(elem("actas-estudiantes").innerHTML,/MODALIDAD GUARDADA TRAB/);
assert.doesNotMatch(elem("actas-estudiantes").innerHTML,/Revisar identidad, matrícula o modalidad/,
 "La modalidad guardada en Ficha prevalece sobre el tipo histórico");
assert.match(elem("actas-estudiantes").innerHTML,/value="TRABAJO_TITULACION" selected/,
 "El cambio explícito a Trabajo no se revierte");
console.log("VERIFICACIÓN ACTAS V2: OK (búsqueda global, selector, PDF, ZIP, bloqueo de actas, cronograma y carrera de carga)");
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});