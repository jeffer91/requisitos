"use strict";
/* Verifica flujo del módulo Actas con datos simulados y sin bases de estudiantes reales. */
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const context={URL,Promise,Set,Map,JSON,Date,console,Blob,setTimeout,clearTimeout};
const storage=new Map(),elements=new Map(),printed=[],words=[],delays=new Map(),calls=[];
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
const dataset1={
students:[student("0001","EXAMEN APROBADO"),student("0002","EXAMEN FALTANTE"),student("0003","TRABAJO APROBADO","TRABAJO_TITULACION"),student("0004","RETIRADO","EXAMEN_COMPLEXIVO",{estadoMatricula:"RETIRADO"}),student("0005","NOTA REPROBADA","EXAMEN_COMPLEXIVO",{_ncomplexHasSavedEvaluation:true,estadoEvaluacion:"NO_APROBADO"})],
requirements:[req("0001",per1,field1),req("0001",per1,field2),req("0002",per1,field1),req("0003",per1,field1),req("0003",per1,field2),req("0004",per1,field1),req("0004",per1,field2),req("0005",per1,field1),req("0005",per1,field2)]};
const dataset2={students:[student("0006","OTRO PERIODO",undefined,{periodoId:per2})],requirements:[req("0006",per2,field1),req("0006",per2,field2)]};
const document={readyState:"complete",getElementById:elem,addEventListener(){},body:{appendChild(){}},createElement(){return {click(){},remove(){}}}};
const win={
 location:{href:"https://example.test/requisitos/Actas/actas.html"},
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
 confirm:()=>true,
 ConActas:{
  async ready(){return {ok:true}},
  async listPeriods(){return [{periodoId:per1,nombre:"Octubre 2025 a Marzo 2026"},{periodoId:per2,nombre:"Abril 2026 a Septiembre 2026"}]},
  async read(opts){calls.push(opts.periodoId); if(delays.has(opts.periodoId))return delays.get(opts.periodoId).promise;return {data:opts.periodoId===per1?dataset1:dataset2};}
 },
 ActasDocument:{preview:items=>printed.push(items),word:items=>words.push(items)}
};
context.window=win;context.document=document;
vm.createContext(context);
vm.runInContext(read("Actas/actas.catalog.js"),context);
vm.runInContext(read("Actas/actas.app.js"),context);
const tick=()=>new Promise(r=>setTimeout(r,0));
async function main(){
await tick();await tick();
assert.equal(elem("actas-aprobados").textContent,1,"Complexivo filtra quienes cumplen ambos y bloquea retirados/reprobados");
assert.match(elem("actas-estudiantes").innerHTML,/EXAMEN APROBADO/);
assert.doesNotMatch(elem("actas-estudiantes").innerHTML,/EXAMEN FALTANTE/);
assert.doesNotMatch(elem("actas-estudiantes").innerHTML,/RETIRADO/);
assert.doesNotMatch(elem("actas-estudiantes").innerHTML,/NOTA REPROBADA/);
trigger("actas-seleccionar","click");
assert.equal(elem("actas-lote").disabled,false);
trigger("actas-lote","click");
assert.equal(printed.length,1);
assert.equal(printed[0].length,1);
assert.equal(printed[0][0].student.cedula,"0001");
assert.ok(storage.has("UTET_ACTAS_BORRADORES_V1"),"Guarda consecutivo de borrador");
trigger("actas-modalidad","change",{target:{value:"TRABAJO_TITULACION"}});
assert.equal(elem("actas-aprobados").textContent,1,"Trabajo muestra solo su modalidad");
assert.match(elem("actas-estudiantes").innerHTML,/TRABAJO APROBADO/);
assert.ok(elem("actas-actividades").innerHTML.includes("Fase 3: Defensa final"));
trigger("actas-guardar","click");
assert.ok(storage.has("UTET_ACTAS_CRONO_V1__"+per1+"__TRABAJO_TITULACION"),"Guarda cronograma por modalidad y periodo");
const all=JSON.parse(storage.get("UTET_ACTAS_CRONO_V1__"+per1+"__TRABAJO_TITULACION"));
assert.equal(all.groups.flatMap(g=>g.actividades).length,20);
trigger("actas-modalidad","change",{target:{value:"EXAMEN_COMPLEXIVO"}});
assert.equal(elem("actas-actividades").innerHTML.includes("Núcleo 1"),true);
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
trigger("actas-ejemplo","click");
assert.match(elem("actas-alert").textContent,/exclusivamente al período Octubre 2025 a Marzo 2026/);
assert.equal(elem("actas-cronograma-estado").textContent,"Sin fechas guardadas","No inyecta fechas de otro periodo");
console.log("VERIFICACIÓN DE ACTAS RUNTIME: OK (doble aprobación, bloqueos, modalides, lotes, cronogramas y carrera de carga)");
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});