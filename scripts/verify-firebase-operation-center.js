"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const errors=[];
const captured={prepared:[],pushed:[],synced:[],savedPersonas:[],events:[]};

function check(value,message){if(!value){errors.push(message);}}
function CustomEvent(type,options){this.type=type;this.detail=options&&options.detail||{};}

const rows=[
  {id:"c_persona",tabla:"personas",periodoId:"2026-04__2026-09",cedula:"1711111111",updatedAt:"2026-08-04T10:00:00.000Z"},
  {id:"c_requisito",tabla:"requisitos",periodoId:"2026-04__2026-09",cedula:"1722222222",updatedAt:"2026-08-04T10:01:00.000Z"},
  {id:"c_nota",tabla:"notas",periodoId:"2026-04__2026-09",cedula:"1733333333",updatedAt:"2026-08-04T10:02:00.000Z"}
];

const outbox={
  list(){return Promise.resolve(rows.slice());},
  isDone(){return false;},
  isBlocked(){return false;},
  retryDue(){return true;},
  rowId(row){return row&&row.id||"";},
  markSynced(selected){captured.synced.push(selected.map((row)=>row.id));return Promise.resolve({ok:true,updated:selected.length});},
  markError(){return Promise.resolve({ok:true,updated:0});}
};

function entryFor(row){
  const entity=row.tabla==="personas"?"estudiantes":row.tabla;
  const id=entity+"__"+row.id;
  const hash=entity==="requisitos"?"same_hash":"local_"+row.id;
  return {
    entity,
    documentId:id,
    document:{id,dataHash:hash},
    expected:entity==="requisitos"?{exists:true,hash:"same_hash",version:1,updatedAt:"2026-08-04T09:00:00.000Z"}:{exists:false},
    changeIds:[row.id]
  };
}

const target={
  prepareEntries(selected){
    captured.prepared.push(selected.map((row)=>({id:row.id,tabla:row.tabla})));
    return Promise.resolve({entries:selected.map(entryFor),skipped:[]});
  },
  push(selected){
    captured.pushed.push(selected.map((row)=>({id:row.id,tabla:row.tabla})));
    return Promise.resolve({ok:true,processedIds:selected.map((row)=>row.id),documentsWritten:selected.length,conflicts:0});
  }
};

const repository={
  getById(entity){
    if(entity==="requisitos"){
      return Promise.resolve({documentId:"remote_req",data:{dataHash:"same_hash",version:1,updatedAt:"2026-08-04T09:00:00.000Z"}});
    }
    return Promise.resolve(null);
  }
};

const people={
  "1711111111":{
    cedula:"1711111111",
    nombreCompleto:"NOMBRE CONSERVADO",
    correoPersonal:"correo@ejemplo.com",
    telegramUser:"anterior",
    telegramChatId:"100"
  }
};

const personasRepo={
  getByCedula(cedula){return Promise.resolve(people[cedula]||null);},
  save(row){captured.savedPersonas.push(row);people[row.cedula]=row;return Promise.resolve(row);}
};

const storage=Object.create(null);
const sandbox={
  console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Set,Map,URL,
  setTimeout,clearTimeout,CustomEvent,
  localStorage:{getItem(key){return storage[key]||"";},setItem(key,value){storage[key]=String(value);}},
  dispatchEvent(event){captured.events.push(event);},
  document:{currentScript:{src:"file:///repo/BDLocal/firebase/bdl.firebase.operation-center.js"},baseURI:"file:///repo/",scripts:[],head:{appendChild(){}},documentElement:{appendChild(){}}},
  BDLSyncOutbox:outbox,
  BDLSyncTargetFirebase:target,
  RequisitosFirebaseRepository:repository,
  BDLRepoPersonas:personasRepo,
  BDLRulesPersona:{
    normalizeTelegramUser(value){return String(value||"").replace(/^@+/,"").trim();},
    normalizeTelegramChatId(value){return String(value||"").trim();}
  }
};
sandbox.window=sandbox;
const context=vm.createContext(sandbox);
const source=fs.readFileSync(path.join(ROOT,"BDLocal/firebase/bdl.firebase.operation-center.js"),"utf8");
try{new vm.Script(source,{filename:"BDLocal/firebase/bdl.firebase.operation-center.js"}).runInContext(context);}catch(error){errors.push(`Sintaxis o arranque: ${error.message}`);}

(async()=>{
  const center=sandbox.RequisitosFirebaseOperationCenter;
  check(center&&typeof center.analyze==="function","Debe exponerse el Centro de Operaciones Firebase");
  check(center.entityOf({tabla:"personas"})==="estudiantes","Personas debe corresponder a estudiantes");
  check(center.entityOf({tabla:"notas"})==="notas","Notas debe conservar su dominio");

  const carga=await center.analyze("carga",{periodoId:"2026-04__2026-09"});
  check(carga.ok===true,"El análisis de Carga debe completarse");
  check(carga.pendingChanges===2,"Carga debe excluir cambios de notas");
  check(carga.nuevos===1,"Carga debe detectar un documento nuevo");
  check(carga.sinCambios===1,"Carga debe detectar un documento ya igual");
  check(!carga.entities.notas,"El resumen de Carga no debe contener notas");
  check(captured.prepared[0].every((row)=>row.tabla!=="notas"),"Carga no debe preparar notas");

  const pushed=await center.push("carga",{periodoId:"2026-04__2026-09",requireAnalysis:true});
  check(pushed.ok===true,"La subida de Carga debe completarse");
  check(captured.pushed[0].every((row)=>row.tabla!=="notas"),"Carga no debe enviar notas al destino Firebase");
  check(captured.pushed[0].some((row)=>row.tabla==="personas"),"Carga debe normalizar estudiantes como personas para el destino");
  check(captured.synced.length===1&&captured.synced[0].length===2,"Solo los cambios procesados de Carga deben marcarse sincronizados");

  const defensas=await center.analyze("defensas",{periodoId:"2026-04__2026-09"});
  check(defensas.ok===true,"El análisis de Defensas debe completarse");
  check(defensas.pendingChanges===1,"Defensas debe considerar únicamente notas");
  check(defensas.entities.notas&&defensas.entities.notas.total===1,"Defensas debe resumir la tabla notas");

  const patch=center.telegramPatch(people["1711111111"],{
    cedula:"1711111111",
    nombreCompleto:"NOMBRE REMOTO QUE NO DEBE APLICARSE",
    correoPersonal:"remoto@ejemplo.com",
    telegramUser:"@nuevo_usuario",
    telegramChatId:"999",
    updatedAt:"2026-08-04T12:00:00.000Z"
  });
  check(patch.changed===true,"El parche debe detectar cambios de Telegram");
  check(patch.row.telegramUser==="nuevo_usuario","Debe normalizar telegramUser");
  check(patch.row.telegramChatId==="999","Debe actualizar telegramChatId");
  check(patch.row.nombreCompleto==="NOMBRE CONSERVADO","Telegram no debe reemplazar el nombre local");
  check(patch.row.correoPersonal==="correo@ejemplo.com","Telegram no debe reemplazar el correo local");

  if(errors.length){
    console.error("\nVERIFICACIÓN CENTRO DE OPERACIONES FIREBASE: ERROR\n");
    errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
    process.exit(1);
  }
  console.log("VERIFICACIÓN CENTRO DE OPERACIONES FIREBASE: OK");
})().catch((error)=>{
  console.error("VERIFICACIÓN CENTRO DE OPERACIONES FIREBASE: ERROR",error);
  process.exit(1);
});
