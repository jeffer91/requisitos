"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
class Element{
 constructor(tag,id){this.tagName=tag;this.id=id||"";this.children=[];this.options=[];this.handlers={};
 this.dataset={};this.attributes={};this.className="";this.hidden=false;this.disabled=false;this.value="";
 this._text="";this.classList={toggle(){},add(){},remove(){}};}
 set textContent(v){this._text=String(v);this.children=[];this.options=[];}
 get textContent(){return this._text;}
 appendChild(node){this.children.push(node);if(this.tagName==="select"&&node.tagName==="option")this.options.push(node);return node;}
 addEventListener(type,cb){this.handlers[type]=cb;}
 setAttribute(k,v){this.attributes[k]=v;}
 querySelector(k){return this.children.find(x=>x.tagName===k)||null;}
 querySelectorAll(){return this.buttons||[];}
 focus(){}
 scrollIntoView(){}
}
const ids=["nc-period","nc-career","nc-group","nc-tab-nucleos","nc-tab-complexivo",
"nc-nucleus-picker","nc-cloud-state","nc-message","nc-import","nc-paste","nc-review",
"nc-save","nc-publish","nc-table","nc-table-more","nc-search","nc-table-title",
"nc-students","nc-loaded","nc-missing","nc-sync-pending","nc-show-conflicts",
"nc-open-import","nc-show-pending","nc-connect-firebase","nc-login-cancel",
"nc-firebase-login","nc-close-import","nc-analyze","nc-show-advanced",
"nc-legacy","nc-login-password","nc-login-email","nc-conflict-panel","nc-pending-panel",
"nc-guide-title","nc-guide-detail","nc-next-task"];
const dom={};
ids.forEach(id=>{
 const kind=["nc-period","nc-career","nc-group"].includes(id)?"select":
  id==="nc-table"?"table":"div";
 dom[id]=new Element(kind,id);
});
dom["nc-import"].hidden=true;
dom["nc-table"].appendChild(new Element("thead"));dom["nc-table"].appendChild(new Element("tbody"));
dom["nc-nucleus-picker"].buttons=[1,2,3,4].map(n=>{
 const b=new Element("button");b.dataset.ncNucleus=String(n);return b;
});
const document={getElementById:id=>dom[id]||null,createElement:tag=>new Element(tag),
 body:{classList:{toggle(){}}}};
const period="2025-10__2026-03";
const roster=[
 {cedula:"0101010101",Nombres:"ALVARADO PEREZ MALENA RACHELL",
  NombreCarrera:"ADMINISTRACION",CodigoCarrera:"ADMINISTRACION",estadoMatricula:"ACTIVO"},
 {cedula:"0202020202",Nombres:"RECALDE IDROVO BRIANA ALEJANDRA",
  NombreCarrera:"ADMINISTRACION",CodigoCarrera:"ADMINISTRACION",estadoMatricula:"ACTIVO"},
 {cedula:"0303030303",Nombres:"OTRA ESTUDIANTE DE ONLINE",
  NombreCarrera:"ADMINISTRACION ONLINE",CodigoCarrera:"ADMINISTRACION ONLINE",estadoMatricula:"ACTIVO"}
];
const savedNuclei=[];
const statuses=["academico","documentacion","financiero","practicas","vinculacion",
 "seguimientograduados","ingles","actualizaciondatos","titulacion"];
const window={addEventListener(){},ConNcomplex:{
 async listPeriods(){return[{id:period,label:"Octubre 2025 a Marzo 2026"}];},
 async listStudents(){return roster;},async listEvaluations(){return [];},
 async checkRequirements(){return {requirements:statuses.map(k=>({key:k,label:k,
  status:k==="titulacion"?"NO APLICA":"CUMPLE"}))};},
 async saveImport(){return null;}
},NcomplexNucleosStore:{
 id(periodId,ced,n){return ced+"__"+periodId+"__N"+n;},
 async list(periodId){return savedNuclei.filter(row=>row.periodoId===periodId);},
 async saveMany(rows){rows.forEach(row=>savedNuclei.push(row));return rows;}
},
 NcomplexState:{get(){return {selectedPeriodId:""};}},
 InfNuclei:{careers(){return[{career:"Administración",nuclei:[
  {number:1,name:"Gestión Estratégica"},{number:2,name:"Procesos"},
  {number:3,name:"Finanzas"},{number:4,name:"Gestión Comercial"}]}];}}
};
const context=vm.createContext({window,document,console,Event:class{constructor(t){this.type=t;}},Promise});
["Ncomplex/ncomplex.nucleos.parser.js","Ncomplex/ncomplex.smart.js",
"Ncomplex/ncomplex.nucleos.policy.js","Ncomplex/ncomplex.center.js"]
.forEach(p=>new vm.Script(read(p),{filename:p}).runInContext(context));
const course="T-NUCLEO - GESTIÓN COMERCIAL [Mod 13, OCT-MAR26 Esp. M-A { l m v s } 19h00-22h00-Matriz]";
const pasted=[course,"Nombre / Apellido(s)","Dirección de correo",
 "CuestionarioEVALUACIÓN PARCIAL 1","CuestionarioEVALUACIÓN PARCIAL 2",
 "CuestionarioEVALUACIÓN PARCIAL 3","CuestionarioEVALUACIÓN PARCIAL 4",
 "TareaTALLER PRÁCTICO 1","CuestionarioPRUEBA","Media de calificacionesTotal del curso",
 "MAMALENA RACHELL ALVARADO PEREZ","alumno1@itsqmet.edu.ec",
 "9,00","10,00","10,00","10,00","10,00","10,00","9,83",
 "BRBRIANA ALEJANDRA RECALDE IDROVO","alumno2@itsqmet.edu.ec",
 "9,00","10,00","10,00","10,00","10,00","10,00","9,83",
 "BRBRIANA ALEJANDRA RECALDE IDROVO","alumno3@itsqmet.edu.ec",
 "-","-","-","-","10,00","-","10,00"].join("\n");
async function run(){
 await window.NcomplexCenter.init();
 assert.equal(dom["nc-period"].options.length,2);
 dom["nc-paste"].value=pasted;
 dom["nc-import"].hidden=false;
 await window.NcomplexCenter.parse();
 assert.equal(dom["nc-period"].value,period,"El lector debe seleccionar período inequívoco.");
 assert.equal(dom["nc-career"].value,"ADMINISTRACION","Seleccionar carrera vinculada a BDLocal.");
 assert.equal(window.NcomplexCenter.status().nucleus,4,"Cambiar automáticamente al núcleo reconocido.");
 assert.equal(dom["nc-save"].disabled,true,"No guardar si faltan grupo y resolución del duplicado.");
 assert.match(dom["nc-review"].children[0].textContent,/3 filas Moodle/);
 let duplicate=dom["nc-review"].children.find(x=>x.className==="nc-duplicate-group");
 assert.ok(duplicate,"Debe solicitar cuál de dos notas del mismo estudiante se conserva.");
 assert.equal(duplicate.textContent,"","No mostrar el texto literal null en duplicados.");
 const selector=duplicate.children.find(x=>x.tagName==="select");
 assert.equal(selector.options.length,3);
 selector.value="2";
 await selector.handlers.change();
 dom["nc-group"].value="PRESENCIAL";
 await dom["nc-group"].handlers.change();
 for(let i=0;i<30;i++)await Promise.resolve();
 assert.equal(dom["nc-save"].disabled,false,"Se habilita guardar tras conciliar y definir grupo.");
 assert.equal(dom["nc-students"].textContent,"2");
 const table=dom["nc-table"].querySelector("tbody");
 assert.equal(table.children.length,2);
 const header=dom["nc-table"].querySelector("thead").children[0];
 assert.ok(header.children.some(x=>x.textContent==="Requisitos"));
 assert.ok(table.children.every(row=>row.children.some(x=>x.children&&x.children.some(t=>t.textContent==="Por verificar"))));
 assert.ok(table.children.every(row=>row.children.some(x=>x.children&&x.children.some(t=>t.textContent==="Sin notas"))),
 "Sin notas no debe confundirse con requisito incumplido.");
 // Una fila Moodle de Administración Online no debe solicitar vínculo manual con presencial.
 dom["nc-paste"].value=pasted+"\nOTRA ESTUDIANTE DE ONLINE\nonline@itsqmet.edu.ec"+
  "\n8,00\n9,00\n10,00\n10,00\n10,00\n-\n9,40";
 await window.NcomplexCenter.parse();
 assert.match(dom["nc-review"].children[0].textContent,/1 de otras carreras apartadas/);
 assert.equal(dom["nc-review"].children.filter(x=>x.className==="nc-manual-row").length,0);
 assert.equal(dom["nc-review"].children.some(x=>x.className==="nc-duplicate-group"),false,
  "Un duplicado ya resuelto no debe volver a solicitar selección.");
 assert.equal(dom["nc-save"].disabled,false);
 await window.NcomplexCenter.save();
 assert.equal(savedNuclei.length,2,"Solo guardar estudiantes de la carrera seleccionada.");
 assert.ok(savedNuclei.every(x=>x.codigoCarrera==="ADMINISTRACION"&&x.grupoInforme==="PRESENCIAL"));
 assert.equal(dom["nc-group"].value,"PRESENCIAL","No borrar el grupo confirmado al refrescar.");
 assert.equal(dom["nc-loaded"].textContent,"2","Mostrar las notas guardadas sin recargar la app.");
 console.log("NCOMPLEX UI GUIADA: OK (núcleo 4, duplicados, modalidades, guardado y grupo persistente).");
}
run().catch(error=>{console.error(error);process.exitCode=1;});
