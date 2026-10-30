"use strict";
/* Verifica flujo del módulo Actas con datos simulados y sin bases de estudiantes reales. */
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
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
const student=(c,n,m=undefined,extra={})=>Object.assign({cedula:c,Nombres:n,periodoId:per1,NombreCarrera:"ADMINISTRACIÓN",modalidadTitulacion:m||"EXAMEN_COMPLEXIVO",estadoMatricula:"ACTIVO"},extra);
const req=(cedula,periodoId,field,state="CUMPLE")=>({cedula,periodoId,requisitoKey:field,valor:state});
const field1="aprobaciontitulacion",field2="aprobacioncomplexivoproyecto";
const eight=["academico","documentacion","practicasvinculacion","vinculacion","seguimientograduados","ingles","actualizaciondatos","financiero"];
const grades=mode=>mode==="TRABAJO_TITULACION"?{modalidadTitulacion:mode,estadoEvaluacion:"APROBADO",notaEscrito:8,notaDefensaTrabajo:9,notaOficial:8.4,oportunidadAplicada:"ORDINARIA"}:{modalidadTitulacion:mode,estadoEvaluacion:"APROBADO",notaTeorica:8,notaPractica:9,notaOficial:8.6,oportunidadAplicada:"ORDINARIA"};
const dataset1={
students:[student("0001","EXAMEN APROBADO","EXAMEN_COMPLEXIVO",{_ncomplexHasSavedEvaluation:true,estadoEvaluacion:"APROBADO",_ncomplexEvaluation:grades("EXAMEN_COMPLEXIVO"),...Object.fromEntries(eight.concat(["titulacion"]).map(k=>[k,"CUMPLE"]))}),student("0002","EXAMEN FALTANTE"),student("0003","TRABAJO APROBADO","TRABAJO_TITULACION",{_ncomplexHasSavedEvaluation:true,estadoEvaluacion:"APROBADO",_ncomplexEvaluation:grades("TRABAJO_TITULACION")}),student("0004","RETIRADO","EXAMEN_COMPLEXIVO",{estadoMatricula:"RETIRADO"}),student("0005","NOTA REPROBADA","EXAMEN_COMPLEXIVO",{_ncomplexHasSavedEvaluation:true,estadoEvaluacion:"NO_APROBADO"}),student("0007","ARTÍCULO PVC","TRABAJO_TITULACION",{tipoTitulacion:"ARTICULO_ACADEMICO",_ncomplexHasSavedEvaluation:false}),student("0008","DOS APROBACIONES SIN NOTAS"),student("0009","DOS APROBACIONES EVALUACIÓN INCOMPLETA","EXAMEN_COMPLEXIVO",{_ncomplexHasSavedEvaluation:true,estadoEvaluacion:"INCOMPLETO",_ncomplexEvaluation:{modalidadTitulacion:"EXAMEN_COMPLEXIVO",estadoEvaluacion:"INCOMPLETO",notaTeorica:8}})],
requirements:[req("0001",per1,field1),req("0001",per1,field2),req("0002",per1,field1),req("0003",per1,field1),req("0003",per1,field2),req("0004",per1,field1),req("0004",per1,field2),req("0005",per1,field1),req("0005",per1,field2),req("0007",per1,field1),req("0007",per1,field2),req("0008",per1,field1),req("0008",per1,field2),req("0009",per1,field1),req("0009",per1,field2),...["0003"].flatMap(id=>eight.concat(["titulacion"]).map(key=>req(id,per1,key)))]};
const dataset2={students:[student("0006","OTRO PERIODO",undefined,{periodoId:per2})],requirements:[req("0006",per2,field1),req("0006",per2,field2)]};
const document={readyState:"complete",getElementById:elem,addEventListener(){},body:{appendChild(){}},createElement(){return {click(){},remove(){}}}};
const win={
 location:{href:"https://example.test/requisitos/Actas/actas.html"},
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
 confirm:()=>true,
 ConActas:{
  async ready(){return {ok:true}},
  async listPeriods(){return [{periodoId:per1,nombre:"Octubre 2025 a Marzo 2026"},{periodoId:per2,nombre:"Abril 2026 a Septiembre 2026"}]},
  async read(opts){calls.push(opts.periodoId); if(delays.has(opts.periodoId))return delays.get(opts.periodoId).promise;return {data:opts.periodoId===per1?dataset1:dataset2};},async setModality(opts){modalityWrites.push(opts);return {ok:true}}
 },
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
assert.equal(elem("actas-aprobados").textContent,4,"Autoriza borradores con ambas aprobaciones, aunque falten registros de Ncomplex");
assert.match(elem("actas-estudiantes").innerHTML,/EXAMEN APROBADO/);
assert.match(elem("actas-estudiantes").innerHTML,/EXAMEN FALTANTE/,"El buscador/listado muestra pendientes");
assert.match(elem("actas-estudiantes").innerHTML,/RETIRADO/,"Muestra retirados sin permitir descargar");
assert.match(elem("actas-estudiantes").innerHTML,/NOTA REPROBADA/,"Muestra evaluaciones pendientes de revisión");
trigger("actas-seleccionar","click");
assert.equal(elem("actas-lote").disabled,false);
trigger("actas-lote","click");await tick();
assert.equal(printed.length,1);
assert.equal(printed[0].length,4,"PDF masivo incluye ambas modalidades y borradores con evidencias pendientes");
assert.equal(printed[0][0].student.cedula,"0001");
assert.equal(new Set(printed[0].filter(x=>x.record.numeroActa).map(x=>x.record.numeroActa)).size,2,"Cada registro central usa un número distinto");
assert.equal(printed[0].filter(x=>!x.record.numeroActa).length,2,"Los pendientes siguen sin numerar");
assert.equal(printed[0][0].evidence.requirements.length,8,"Acta incorpora ocho requisitos");
assert.ok(printed[0][0].evidence.requirements.every(r=>r.status==="CUMPLE"),"Lee ocho requisitos directamente desde el registro del estudiante");
assert.equal(printed[0][0].evidence.evaluation.official,8.6,"Usa nota oficial de Ncomplex");
assert.equal(printed[0][1].evidence.titulationStatus,"CUMPLE","Núcleos acreditados por Titulación");
assert.ok(printed[0].some(item=>item.student.cedula==="0008"&&!item.evidence.eligible),"Permite borrador sin nota oficial y advierte lo pendiente");
assert.ok(printed[0].some(item=>item.student.cedula==="0009"&&!item.evidence.eligible),"Permite borrador con evaluación incompleta");
assert.ok(storage.has("UTET_ACTAS_BORRADORES_V1"),"Guarda consecutivo de borrador");
trigger("actas-zip","click");await tick();assert.equal(zips.length,1,"Genera ZIP del período");assert.equal(zips[0].items.length,4,"ZIP incorpora borradores pendientes de verificar");assert.equal(zips[0].summary.length,8,"ZIP registra también excluidos");
assert.deepEqual(zips[0].items.map(x=>x.record.numeroActa||""),printed[0].map(x=>x.record.numeroActa||""),"ZIP conserva el mismo número que los PDF iniciales");
trigger("actas-modalidad","change",{target:{value:"TRABAJO_TITULACION"}});
assert.equal(elem("actas-aprobados").textContent,4,"La métrica incluye borradores descargables de ambas modalidades");
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
resolveSlow({data:dataset1});
await tick();await tick();
assert.match(elem("actas-estudiantes").innerHTML,/OTRO PERIODO/,"Lectura tardía no reemplaza período actual");
assert.doesNotMatch(elem("actas-estudiantes").innerHTML,/EXAMEN APROBADO/);
const selector={value:"TRABAJO_TITULACION",disabled:false,dataset:{mode:"0"},matches:s=>s==="[data-mode]"};
await trigger("actas-estudiantes","change",{target:selector});await tick();
assert.equal(modalityWrites.length,1,"Guarda modalidad mediante conector");
assert.equal(modalityWrites[0].mode,"TRABAJO_TITULACION");
trigger("actas-ejemplo","click");
assert.match(elem("actas-alert").textContent,/exclusivamente al período Octubre 2025 a Marzo 2026/);
assert.equal(elem("actas-cronograma-estado").textContent,"Sin fechas guardadas","No inyecta fechas de otro periodo");
console.log("VERIFICACIÓN ACTAS V2: OK (búsqueda global, selector, PDF, ZIP, bloqueo de actas, cronograma y carrera de carga)");
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});