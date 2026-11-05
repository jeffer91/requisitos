"use strict";
/* Comprobar la pantalla Ncomplex sin Electron ni datos institucionales reales:
 * el selector debe mostrar períodos de BDLocal aun cuando no haya tabla de núcleos. */
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const source=fs.readFileSync(path.join(__dirname,"../Ncomplex/ncomplex.center.js"),"utf8");
class Element {
 constructor(tag,id){
  this.tagName=tag;this.id=id||"";this.children=[];this.handlers={};
  this.options=[];this.value="";this.hidden=false;this.dataset={};this.className="";
  this._text="";this.attributes={};this.classList={toggle(){}};
 }
 set textContent(value){this._text=String(value);this.children=[];this.options=[];}
 get textContent(){return this._text;}
 appendChild(el){this.children.push(el);if(this.tagName==="select"&&el.tagName==="option")this.options.push(el);return el;}
 addEventListener(name,handler){this.handlers[name]=handler;}
 setAttribute(key,value){this.attributes[key]=value;}
 querySelector(key){
  if(key==="thead"||key==="tbody")return this.children.find(x=>x.tagName===key)||null;
  return null;
 }
 querySelectorAll(){return this.buttons||[];}
 dispatchEvent(ev){if(this.handlers[ev.type])return this.handlers[ev.type]();}
 scrollIntoView(){}
}
const ids=[
 "nc-period","nc-career","nc-group","nc-tab-nucleos","nc-tab-complexivo","nc-nucleus-picker",
 "nc-cloud-state","nc-message","nc-import","nc-paste","nc-review","nc-save","nc-publish",
 "nc-table","nc-table-more","nc-search","nc-table-title","nc-students","nc-loaded","nc-missing",
 "nc-sync-pending","nc-show-conflicts","nc-open-import","nc-show-pending","nc-connect-firebase",
 "nc-login-cancel","nc-firebase-login","nc-close-import","nc-analyze","nc-show-advanced","nc-legacy",
 "nc-firebase-login","nc-login-password","nc-login-email","nc-conflict-panel","nc-pending-panel"
];
const elements={};
ids.forEach(id=>{
 const tag=/^nc-(period|career|group)$/.test(id)?"select":id==="nc-table"?"table":"div";
 elements[id]=new Element(tag,id);
});
elements["nc-table"].appendChild(new Element("thead"));
elements["nc-table"].appendChild(new Element("tbody"));
elements["nc-nucleus-picker"].buttons=[1,2,3,4].map(i=>{const b=new Element("button");b.dataset.ncNucleus=String(i);return b;});
const document={
 getElementById(id){return elements[id]||null;},
 createElement(tag){return new Element(tag);},
 body:{classList:{toggle(){}}}
};
let periodsRead=0,studentsRead=0,evaluationRead=0,nucleusRead=0;
const period="2025-10__2026-03";
const window={
 addEventListener(){},
 ConNcomplex:{
  async listPeriods(){periodsRead++;return[
   {id:period,label:"Octubre 2025 a Marzo 2026"},
   {id:"2026-04__2026-09",label:"Abril 2026 a Septiembre 2026"}
  ];},
  async listStudents(o){assert.equal(o.periodoId,period);studentsRead++;return [{
   cedula:"0100000001",Nombres:"ESTUDIANTE DEMOSTRACIÓN",CodigoCarrera:"AD01",
   NombreCarrera:"Administración",estadoMatricula:"ACTIVO",
   modalidadEstudio:"Presencial"
  }];},
  async listEvaluations(){evaluationRead++;return [];}
 },
 NcomplexNucleosStore:{
  async ready(){throw Error("Nunca debe migrar al abrir.");},
  async list(){nucleusRead++;throw Error("La tabla antigua no existe aún.");}
 },
 NcomplexState:{get(){return {selectedPeriodId:""};}},
 NcomplexNucleosPolicy:{check(){return {eligible:false,missing:["No verificado"]};}},
 InfNuclei:{careers(){return[];}}
};
const context=vm.createContext({window,document,console,Event:class{constructor(type){this.type=type;}},Date,Math,Promise});
new vm.Script(source,{filename:"ncomplex.center.js"}).runInContext(context);
async function run(){
 await window.NcomplexCenter.init();
 assert.equal(elements["nc-period"].options.length,3,"Selector debe contener dos períodos reales.");
 assert.equal(elements["nc-period"].options[1].value,period);
 assert.equal(periodsRead,1);
 assert.equal(nucleusRead,0,"No consultar ni migrar núcleos antes de elegir período.");
 elements["nc-period"].value=period;
 await elements["nc-period"].handlers.change();
 assert.equal(studentsRead,1);
 assert.equal(evaluationRead,1);
 assert.equal(nucleusRead,1,"La falta de núcleos no bloquea los estudiantes.");
 assert.equal(elements["nc-career"].options.length,2);
 assert.equal(elements["nc-career"].options[1].textContent,"Administración");
 assert.match(elements["nc-message"].textContent,/No se pudieron leer las notas de núcleos/);
 console.log("NCOMPLEX SELECTOR: OK (períodos reales, estudiante y carrera visibles sin migrar núcleos)");
}
run().catch(e=>{console.error(e);process.exitCode=1;});
