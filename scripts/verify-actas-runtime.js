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
   async lookup(input){return centralNumbers.get(input.periodoId+"__"+input.cedula)||null;},
  async getOrAssign(input){const key=input.periodoId+"__"+input.cedula;if(centralNumbers.has(key))return centralNumbers.get(key);
   centralCounter++;const entry={identidad:key,periodoId:input.periodoId,cedula:input.cedula,modalidad:input.modalidad,numeroActa:(input.modalidad==="TRABAJO_TITULACION"?"TT-":"CX-")+"2026-"+input.cedula.slice(0,4)+"-10-"+String(centralCounter).padStart(4,"0"),fechaCliente:"2026-10-30"};
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
 assert.equal(elem("actas-aprobados").textContent,5,"Se mantienen las aprobaciones documentales");
 assert.equal(elem("actas-numeradas").textContent,0,"No se inventan folios locales");
 assert.match(elem("actas-estudiantes").innerHTML,/EXAMEN APROBADO/);
 assert.match(elem("actas-estudiantes").innerHTML,/EXAMEN FALTANTE/);
 win.ActasNumbering.listDetailed=async()=>({
  entries:[{cedula:"0001",periodoId:per1,numeroActa:"2026-0001-05-0001"}],
  verified:false,source:"cache",warning:"Failed to get documents from server"
 });
 await trigger("actas-recargar","click");await tick();await tick();
 assert.match(elem("actas-alert").textContent,/Libro central NO VERIFICADO/);
 assert.equal(elem("actas-registrar-lote").disabled,true,"Caché no autoriza numeración");
 assert.equal(elem("actas-lote").disabled,true,"Caché no autoriza PDF final");
 assert.equal(elem("actas-zip").disabled,true,"Caché no autoriza ZIP final");
 assert.match(elem("actas-estudiantes").innerHTML,/data-pdf="0" disabled/,"No descargar acta sin folio central");
 assert.doesNotMatch(elem("actas-estudiantes").innerHTML,/N.º 2026-0001-05-0001/,"Caché no acredita folios");
 delete win.ActasNumbering.listDetailed;
 await trigger("actas-recargar","click");await tick();await tick();
 assert.doesNotMatch(elem("actas-alert").textContent,/NO VERIFICADO/);
 assert.match(elem("actas-estudiantes").innerHTML,/RETIRADO/);
 assert.match(elem("actas-estudiantes").innerHTML,/NOTA REPROBADA/);
 assert.match(elem("actas-estudiantes").innerHTML,/data-pdf="1" disabled/,"Requisitos incompletos impiden emitir");
 trigger("actas-seleccionar","click");
 assert.equal(elem("actas-lote").disabled,false);
 await trigger("actas-lote","click");await tick();
 assert.equal(printed.length,1);
 assert.equal(printed[0].length,2,"Solo se emiten las actas con nueve requisitos y dos aprobaciones");
 assert.equal(printed[0].map(x=>x.student.cedula).join(","),"0001,0003");
 assert.ok(printed[0].every(x=>x.evidence.eligible===true&&x.record.numeroActa));
 assert.equal(new Set(printed[0].map(x=>x.record.numeroActa)).size,2,"Cada acta tiene un número distinto");
 assert.equal(centralNumbers.size,2,"La exportación asigna folios únicos centralmente");
 assert.equal(elem("actas-numeradas").textContent,2,"Las métricas cuentan los folios centrales");
 assert.ok(printed[0].every(x=>x.issue==="2026-05-29"),"Fecha institucional del período");
 assert.ok(printed[0].every(x=>x.record.codigo==="AT-ITSQMET-UTET-2026-05"),"Código de plantilla, distinto del folio individual");
 assert.ok(printed[0].every(x=>x.evidence.requirements.length===9&&x.evidence.requirements.every(r=>r.status==="CUMPLE")));
 assert.equal(printed[0][0].evidence.evaluation,undefined,"Actas no recibe calificaciones");
 assert.equal(storage.has("UTET_ACTAS_BORRADORES_V1"),false,"No se crean registros de borradores locales");
 const firstNumber=centralNumbers.get(per1+"__0001").numeroActa;
 const firstClick={dataset:{register:"0"},disabled:false};
 await trigger("actas-estudiantes","click",{target:{closest:sel=>sel==="button[data-register]"?firstClick:null}});await tick();
 assert.equal(centralNumbers.size,2,"Registrar de nuevo conserva el folio");
 const beforeLocked=modalityWrites.length,lockedSelector={value:"TRABAJO_TITULACION",disabled:false,dataset:{mode:"0"},matches:sel=>sel==="[data-mode]"};
 await trigger("actas-estudiantes","change",{target:lockedSelector});await tick();
 assert.equal(modalityWrites.length,beforeLocked,"No se cambia la modalidad de un acta numerada");
 assert.match(elem("actas-alert").textContent,/número oficial/);
 await trigger("actas-zip","click");await tick();
 assert.equal(zips.length,1);
 assert.equal(zips[0].items.length,2,"ZIP solo contiene actas finales elegibles");
 assert.equal(zips[0].summary.length,8,"El consolidado incluye expedientes excluidos");
 assert.ok(zips[0].items.every(x=>x.evidence.eligible&&x.record.numeroActa));
 assert.equal(zips[0].items[0].record.numeroActa,firstNumber,"El ZIP conserva el número anterior");
 assert.equal(centralNumbers.size,2,"Reexportar no duplica los folios");
 trigger("actas-modalidad","change",{target:{value:"TRABAJO_TITULACION"}});
 assert.match(elem("actas-estudiantes").innerHTML,/TRABAJO APROBADO/);
 assert.doesNotMatch(elem("actas-estudiantes").innerHTML,/ARTÍCULO PVC/);
 assert.ok(elem("actas-actividades").innerHTML.includes("Fase 3: Defensa final"));
 trigger("actas-guardar","click");
 assert.ok(storage.has("UTET_ACTAS_CRONO_V1__"+per1+"__TRABAJO_TITULACION"));
 trigger("actas-modalidad","change",{target:{value:"EXAMEN_COMPLEXIVO"}});
 assert.ok(elem("actas-actividades").innerHTML.includes("Núcleo 1"));
 trigger("actas-busqueda","input",{target:{value:"TRABAJO APROBADO"}});
 assert.match(elem("actas-estudiantes").innerHTML,/TRABAJO APROBADO/,"La búsqueda global sigue disponible");
 trigger("actas-busqueda","input",{target:{value:""}});
 let resolveSlow;
 delays.set(per1,{promise:new Promise(resolve=>{resolveSlow=resolve;})});
 trigger("actas-recargar","click");
 await trigger("actas-periodo","change",{target:{value:per2}});await tick();await tick();
 assert.match(elem("actas-estudiantes").innerHTML,/OTRO PERIODO/);
 assert.match(elem("actas-estudiantes").innerHTML,/value="EXAMEN_COMPLEXIVO" selected/,"Modalidad predeterminada visible");
 assert.match(elem("actas-estudiantes").innerHTML,/data-pdf="0" disabled/,"La modalidad predeterminada no suple los requisitos");
 assert.match(elem("actas-estudiantes").innerHTML,/data-register="0" disabled/);
 const invalidDownload={dataset:{pdf:"0"},disabled:false};
 await trigger("actas-estudiantes","click",{target:{closest:sel=>sel==="button[data-pdf]"?invalidDownload:null}});await tick();
 assert.equal(printed.length,1,"Incluso invocada directamente, la descarga rechaza un expediente incompleto");
 resolveSlow({data:dataset1});await tick();await tick();
 assert.match(elem("actas-estudiantes").innerHTML,/OTRO PERIODO/,"Las consultas tardías no cruzan períodos");
 const selector={value:"TRABAJO_TITULACION",disabled:false,dataset:{mode:"0"},matches:sel=>sel==="[data-mode]"};
 win.confirm=()=>false;
 await trigger("actas-estudiantes","change",{target:selector});await tick();
 assert.equal(modalityWrites.length,0,"Cancelar la modificación no escribe en Ficha");
 assert.equal(selector.value,"EXAMEN_COMPLEXIVO");
 win.confirm=()=>true;selector.value="TRABAJO_TITULACION";
 await trigger("actas-estudiantes","change",{target:selector});await tick();
 assert.equal(modalityWrites.length,1,"Se conserva el selector de modalidad");
 assert.equal(modalityWrites[0].mode,"TRABAJO_TITULACION");
 trigger("actas-modalidad","change",{target:{value:"TODAS"}});
 assert.match(elem("actas-estudiantes").innerHTML,/value="TRABAJO_TITULACION" selected/);
 assert.match(elem("actas-estudiantes").innerHTML,/data-pdf="0" disabled/,"Trabajo tampoco se emite sin requisitos");
 trigger("actas-modalidad","change",{target:{value:"EXAMEN_COMPLEXIVO"}});
 trigger("actas-ejemplo","click");
 assert.match(elem("actas-alert").textContent,/exclusivamente al período Octubre 2025 a Marzo 2026/);
 dataset2.students.push(student("0010","MODALIDAD GUARDADA COMPLEX","EXAMEN_COMPLEXIVO",{periodoId:per2,tipoTitulacion:"TRABAJO_TITULACION"}));
 dataset2.students.push(student("0011","MODALIDAD GUARDADA TRAB","TRABAJO_TITULACION",{periodoId:per2,tipoTitulacion:"EXAMEN_COMPLEXIVO"}));
 await trigger("actas-recargar","click");await tick();await tick();
 trigger("actas-modalidad","change",{target:{value:"TODAS"}});
 assert.match(elem("actas-estudiantes").innerHTML,/MODALIDAD GUARDADA COMPLEX/);
 assert.match(elem("actas-estudiantes").innerHTML,/MODALIDAD GUARDADA TRAB/);
 assert.doesNotMatch(elem("actas-estudiantes").innerHTML,/Revisar identidad, matrícula o modalidad/);
 console.log("VERIFICACIÓN ACTAS FINAL: OK (numeración central, elegibilidad, PDF, ZIP, offline, modalidad y cronograma)");
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});