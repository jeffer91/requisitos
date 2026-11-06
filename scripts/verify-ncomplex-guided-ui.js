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
  NombreCarrera:"ADMINISTRACION",CodigoCarrera:"ADMINISTRACION",estadoMatricula:"ACTIVO",modalidadEstudio:"PRESENCIAL"},
 {cedula:"0202020202",Nombres:"RECALDE IDROVO BRIANA ALEJANDRA",
  NombreCarrera:"ADMINISTRACION",CodigoCarrera:"ADMINISTRACION",estadoMatricula:"ACTIVO",modalidadEstudio:"PRESENCIAL"},
 {cedula:"0303030303",Nombres:"OTRA ESTUDIANTE DE ONLINE",
  NombreCarrera:"ADMINISTRACION ONLINE",CodigoCarrera:"ADMINISTRACION ONLINE",estadoMatricula:"ACTIVO"}
];
const allRequirements=["academico","documentacion","financiero","practicas","vinculacion",
 "seguimientograduados","ingles","actualizaciondatos","titulacion"];
const reqs=bad=>({requirements:allRequirements.map(k=>({key:k,status:k===bad?"PENDIENTE":"CUMPLE"}))});
roster.push(
 {cedula:"0404040404",Nombres:"EJEMPLO SIN REQUISITOS",
  NombreCarrera:"ADMINISTRACION",CodigoCarrera:"ADMINISTRACION",estadoMatricula:"ACTIVO"},
 {cedula:"0505050505",Nombres:"RETIRADO EJEMPLO UNO",
  NombreCarrera:"ADMINISTRACION",CodigoCarrera:"ADMINISTRACION",estadoMatricula:"RETIRADO",retirado:true},
 {cedula:"0606060606",Nombres:"RETIRADO EJEMPLO DOS",
  NombreCarrera:"ADMINISTRACION",CodigoCarrera:"ADMINISTRACION",estadoMatricula:"RETIRADO",retirado:true},
 {cedula:"0707070707",Nombres:"RETIRADO EJEMPLO TRES",
  NombreCarrera:"ADMINISTRACION",CodigoCarrera:"ADMINISTRACION",estadoMatricula:"RETIRADO",retirado:true}
);
roster.forEach(st=>{st._ncomplexRequirements=reqs(st.cedula==="0404040404"?"financiero":"");});
const savedNuclei=[];
const firebasePushCalls=[];
const statuses=["academico","documentacion","financiero","practicas","vinculacion",
 "seguimientograduados","ingles","actualizaciondatos","titulacion"];
const window={addEventListener(){},ConNcomplex:{
 async listPeriods(){return[{id:period,label:"Octubre 2025 a Marzo 2026"}];},
 async listStudents(){return roster;},async listEvaluations(){return [];},
 async checkRequirements(periodId,ced){
  const st=roster.find(s=>s.cedula===ced&&s.estadoMatricula==="ACTIVO");
  return st?st._ncomplexRequirements:{eligible:false,total:9,missing:[],reason:"Sin matrícula activa."};
 },
 async saveImport(){return null;}
},NcomplexFirebaseAuth:{async requireWriter(){return {uid:"test"};}},
 NcomplexNucleosFirebase:{async push(options){
  firebasePushCalls.push(options);
  return {ok:true,published:options.onlyIds.length,processed:options.onlyIds.length,
   attemptedIds:options.onlyIds,remaining:0,conflicts:0,errors:0};
 }},NcomplexNucleosStore:{
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
 assert.equal(dom["nc-career"].value,"ADMINISTRACION","Seleccionar la carrera base para ambas modalidades.");
 assert.equal(dom["nc-career"].options.length,2,"Una sola opción de carrera para presencial y online.");
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
 for(let i=0;i<30;i++)await Promise.resolve();
 assert.equal(dom["nc-group"].value,"","No exigir un grupo global para dos modalidades.");
 assert.equal(dom["nc-save"].disabled,false,"Se habilita guardar tras resolver el duplicado, sin grupo global.");
 assert.equal(dom["nc-students"].textContent,"3","Ambas modalidades aparecen en el mismo núcleo.");
 const table=dom["nc-table"].querySelector("tbody");
 assert.equal(table.children.length,3,"La lista incluye ambas modalidades sin duplicar carreras.");
 const header=dom["nc-table"].querySelector("thead").children[0];
 assert.ok(header.children.some(x=>x.textContent==="Requisitos"));
 assert.ok(header.children.some(x=>x.textContent==="Grupo"),
  "La modalidad sigue visible y se conserva después de la importación.");
 assert.ok(table.children.every(row=>row.children.some(x=>x.children&&x.children.some(t=>t.textContent==="Habilitado"))),
 "La lista contiene únicamente matrículas con 9/9 requisitos CUMPLE.");
 assert.ok(table.children.every(row=>row.children.some(x=>x.children&&x.children.some(t=>t.textContent==="Sin notas"))),
 "Sin notas no debe confundirse con requisito incumplido.");
 // Una fila Moodle de Administración Online no debe solicitar vínculo manual con presencial.
 const additional=[
  ["OTRA ESTUDIANTE DE ONLINE","online@itsqmet.edu.ec"],
  ["RETIRADO EJEMPLO UNO","retirado1@itsqmet.edu.ec"],
  ["RETIRADO EJEMPLO DOS","retirado2@itsqmet.edu.ec"],
  ["RETIRADO EJEMPLO TRES","retirado3@itsqmet.edu.ec"],
  ["EJEMPLO SIN REQUISITOS","sinrequisitos@itsqmet.edu.ec"],
  ["ALUMNO EXTERNO SIN MATRICULA","externo@itsqmet.edu.ec"]
 ];
 dom["nc-paste"].value=pasted+"\n"+additional.map((entry,index)=>
  [entry[0],entry[1],"9,00","10,00","10,00","10,00","10,00","10,00","9,83"].join("\n")).join("\n");
 await window.NcomplexCenter.parse();
 assert.match(dom["nc-review"].children[0].textContent,/3 vinculadas/);
 assert.match(dom["nc-review"].children[0].textContent,/0 de otras carreras apartadas/);
 assert.match(dom["nc-review"].children[0].textContent,/5 excluidas/);
 assert.equal(dom["nc-review"].children.filter(x=>x.className==="nc-manual-row").length,0);
 const excluded=dom["nc-review"].children.find(x=>x.className==="nc-excluded");
 assert.ok(excluded,"Registrar las filas excluidas sin ofrecer matrículas ajenas.");
 const exclusions=excluded.children.find(x=>x.tagName==="ul").children;
 assert.equal(exclusions.length,5);
 assert.equal(exclusions.filter(x=>/retirada\/inactiva en BDLocal/.test(x.textContent)).length,3);
 assert.equal(exclusions.filter(x=>/nueve requisitos CUMPLE/.test(x.textContent)).length,1);
 assert.equal(exclusions.filter(x=>/Verifica el retiro en BDLocal/.test(x.textContent)).length,1);
 assert.equal(dom["nc-review"].children.some(x=>x.className==="nc-duplicate-group"),false);
 assert.equal(dom["nc-save"].disabled,false);
 await window.NcomplexCenter.save();
 assert.equal(savedNuclei.length,3,"Guardar presencial y online en la misma importación.");
 assert.equal(savedNuclei.filter(x=>x.codigoCarrera==="ADMINISTRACION"&&x.grupoInforme==="PRESENCIAL").length,2);
 assert.equal(savedNuclei.filter(x=>x.codigoCarrera==="ADMINISTRACION ONLINE"&&x.grupoInforme==="ONLINE").length,1,
  "La nota online debe conservar su código real y grupo propio.");
 assert.equal(dom["nc-group"].value,"","No establecer un grupo global al guardar ambas modalidades.");
 assert.equal(dom["nc-loaded"].textContent,"3","Mostrar ambas modalidades guardadas sin recargar.");
 assert.equal(dom["nc-students"].textContent,"3","Los retirados y requisitos pendientes no reaparecen.");
 assert.equal(firebasePushCalls.length,0,"Guardar BDLocal no debe publicar sin pulsar Guardar Firebase.");
 await dom["nc-publish"].handlers.click();
 assert.equal(firebasePushCalls.length,2,"Guardar Firebase publica sin selección de grupo global.");
 assert.equal(firebasePushCalls.reduce((sum,call)=>sum+call.onlyIds.length,0),3,
  "Se publican solamente las tres matrículas guardadas.");
 assert.ok(firebasePushCalls.some(call=>call.grupoInforme==="ONLINE"&&call.onlyIds.length===1));
 assert.ok(firebasePushCalls.some(call=>call.grupoInforme==="PRESENCIAL"&&call.onlyIds.length===2));
 console.log("NCOMPLEX UI GUIADA: OK (dos botones separados, grupo automático y publicación por cédula).");
}
run().catch(error=>{console.error(error);process.exitCode=1;});
