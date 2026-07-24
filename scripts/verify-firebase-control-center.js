"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const errors=[];
const calls={pull:[],push:[],alerts:[],events:[]};

function check(value,message){if(!value){errors.push(message);}}

class FakeClassList{
  constructor(){this.values=new Set();}
  add(...values){values.forEach((value)=>this.values.add(value));}
  remove(...values){values.forEach((value)=>this.values.delete(value));}
  contains(value){return this.values.has(value);}
}

class FakeElement{
  constructor(id){
    this.id=id||"";
    this.textContent="";
    this.innerHTML="";
    this.disabled=false;
    this.className="";
    this.classList=new FakeClassList();
    this.attributes={};
    this.listeners={};
    this.children=[];
    this.parentNode=null;
    this.selectedOptions=[];
    this.value="";
  }
  setAttribute(name,value){this.attributes[name]=String(value);}
  getAttribute(name){return this.attributes[name]||"";}
  addEventListener(name,handler){(this.listeners[name]=this.listeners[name]||[]).push(handler);}
  dispatchEvent(event){(this.listeners[event.type]||[]).forEach((handler)=>handler(event));return true;}
  cloneNode(){
    const copy=new FakeElement(this.id);
    copy.textContent=this.textContent;
    copy.innerHTML=this.innerHTML;
    copy.className=this.className;
    copy.value=this.value;
    copy.selectedOptions=this.selectedOptions.slice();
    copy.parentNode=this.parentNode;
    return copy;
  }
  appendChild(child){child.parentNode=this;this.children.push(child);return child;}
  insertBefore(child,before){child.parentNode=this;const index=this.children.indexOf(before);if(index<0){this.children.push(child);}else{this.children.splice(index,0,child);}return child;}
  closest(selector){return selector===".bdlc-connection-card"?this._card||null:null;}
  querySelector(selector){return this._queries&&this._queries[selector]||null;}
}

const elements=Object.create(null);
function element(id){return elements[id]||(elements[id]=new FakeElement(id));}

const card=new FakeElement("firebase-card");
const title=new FakeElement("firebase-title");
const copy=new FakeElement("firebase-copy");
const actions=new FakeElement("firebase-actions");
card._queries={"h3":title,".bdlc-connection-head p":copy,".bdlc-actions":actions};
card.appendChild(actions);
element("bl2-firebase-status")._card=card;
[
  "bl2-btn-pull-firebase","bl2-btn-pull-firebase-all","bl2-btn-fetch-firebase-config",
  "bl2-btn-push-firebase","bl2-dot-firebase","bl2-firebase-v2-detail",
  "bl2-firebase-conflicts-list","bl2-firebase-last-sync","bl2-firebase-last-mode",
  "bl2-firebase-conflict-count","bl2-firebase-read-count","bl2-firebase-query-count",
  "bl2-firebase-write-count","bl2-firebase-engine-version","bl2-log"
].forEach((id)=>element(id));
["bl2-btn-pull-firebase","bl2-btn-pull-firebase-all","bl2-btn-fetch-firebase-config","bl2-btn-push-firebase"].forEach((id)=>{
  const parent=new FakeElement(`${id}-parent`);
  parent.appendChild(element(id));
  parent.replaceChild=function(next,current){
    const index=this.children.indexOf(current);
    if(index>=0){this.children[index]=next;}
    next.parentNode=this;
    elements[id]=next;
  };
});

const document={
  getElementById(id){return elements[id]||null;},
  createElement(){return new FakeElement("");},
  querySelector(selector){
    if(selector===".bl2-eyebrow"){return element("eyebrow");}
    if(selector===".bdlc-sidebar-footer"){return element("footer");}
    return null;
  }
};

function CustomEvent(type,options){this.type=type;this.detail=options&&options.detail||{};}
function clickEvent(){return {type:"click",preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}};}

const engine={
  pullAll(options){calls.pull.push({...options});return Promise.resolve({ok:true,operation:"pull:all",periodoId:options.periodoId||"",downloaded:3,written:3,removed:0,conflicts:0,rejected:0,results:[]});},
  pushPending(options){calls.push.push({...options});return Promise.resolve({ok:true,message:"Firebase V2 actualizado sin conflictos.",processedIds:["cambio_1"]});},
  status(){return Promise.resolve({ok:true,version:"test",running:false,syncStates:[],lastError:""});}
};

const sandbox={
  console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Set,
  setTimeout,clearTimeout,CustomEvent,document,
  confirm(){return true;},
  alert(message){calls.alerts.push(String(message));},
  dispatchEvent(event){calls.events.push(event);return true;},
  addEventListener(){},
  RequisitosPeriodoGlobal:{get(){return {id:"2026-04__2026-09",label:"Abril a septiembre 2026"};}},
  RequisitosFirebaseSyncEngine:engine,
  RequisitosFirebaseRepository:{status(){return {readDocuments:6,queries:2,writes:1};}},
  BDLRepoConflictos:{list(){return Promise.resolve([]);}},
  BL2Core:{
    getPeriods(){return Promise.resolve([{id:"2026-04__2026-09",label:"Abril a septiembre 2026"},{id:"2025-10__2026-03",label:"Octubre 2025 a marzo 2026"}]);},
    log(){return Promise.resolve(true);}
  },
  BL2App:{getSelectedPeriod(){return {id:"2026-04__2026-09",label:"Abril a septiembre 2026"};},refresh(){return Promise.resolve(true);}},
  BDLSyncOutbox:{counts(){return Promise.resolve({detail:{firebase:{pending:1,error:0,blocked:0,waitingRetry:0}}});}},
  BDLSyncUIBridge:{refreshCounts(){return Promise.resolve(true);}}
};
sandbox.window=sandbox;

function load(file){
  const source=fs.readFileSync(path.join(ROOT,file),"utf8");
  new vm.Script(source,{filename:file}).runInContext(context);
}
const context=vm.createContext(sandbox);

(async()=>{
  load("BDLocal/firebase/bdl.firebase.control-center.js");
  load("BDLocal/firebase/bdl.firebase.push-control.js");

  check(sandbox.RequisitosFirebaseControlCenter,"No se expuso RequisitosFirebaseControlCenter");
  check(sandbox.RequisitosFirebasePushControl,"No se expuso RequisitosFirebasePushControl");
  check(elements["bl2-btn-pull-firebase"].__firebaseV2ControlBound===true,"Traer período no fue sustituido por el controlador V2");
  check(elements["bl2-btn-push-firebase"].__firebaseV2PushBound===true,"Subir Firebase no fue sustituido por el controlador V2");

  await sandbox.RequisitosFirebaseControlCenter.pullPeriod({full:false});
  check(calls.pull.length===1,"Traer período debe ejecutar una descarga");
  check(calls.pull[0].manual===true,"Traer período debe ser manual");
  check(calls.pull[0].periodoId==="2026-04__2026-09","Traer período debe usar el período global");
  check(calls.pull[0].full===false,"Traer período normal debe ser incremental");

  calls.pull.length=0;
  await sandbox.RequisitosFirebaseControlCenter.pullAllPeriods();
  check(calls.pull.length===3,"Traer todo debe ejecutar una descarga global y una por cada período");
  check(JSON.stringify(calls.pull[0].entities)===JSON.stringify(["periodos","carreras","estudiantes"]),"Traer todo debe iniciar por datos globales");
  check(calls.pull.slice(1).every((item)=>JSON.stringify(item.entities)===JSON.stringify(["matriculas","requisitos","notas"])),"Traer todo debe descargar las entidades académicas por período");

  await sandbox.RequisitosFirebasePushControl.run();
  check(calls.push.length===1,"Subir debe ejecutar pushPending una vez");
  check(calls.push[0].manual===true,"Subir Firebase debe ser manual");
  check(calls.push[0].periodoId==="2026-04__2026-09","Subir debe usar el período global");
  check(calls.push[0].limit===25,"Subir debe limitarse a 25 cambios");

  if(errors.length){
    console.error("\nVERIFICACIÓN DEL CENTRO FIREBASE: ERROR\n");
    errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
    process.exit(1);
  }
  console.log("VERIFICACIÓN DEL CENTRO FIREBASE: OK");
})().catch((error)=>{
  console.error("VERIFICACIÓN DEL CENTRO FIREBASE: ERROR",error);
  process.exit(1);
});
