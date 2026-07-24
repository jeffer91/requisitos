"use strict";

/* Verifica que Firebase V2 use outbox, sync_estado y ejecución manual. */
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const errors=[];

function read(file){
  const full=path.join(ROOT,file);
  if(!fs.existsSync(full)){errors.push(`Falta ${file}`);return "";}
  return fs.readFileSync(full,"utf8");
}
function ok(value,message){if(!value){errors.push(message);}}
function contains(file,fragment,message){ok(read(file).includes(fragment),message||`${file} debe contener ${fragment}`);}
function notContains(file,fragment,message){ok(!read(file).includes(fragment),message||`${file} no debe contener ${fragment}`);}
function syntax(file){
  const source=read(file);if(!source){return;}
  try{new vm.Script(source,{filename:file});}catch(error){errors.push(`${file}: ${error.message}`);}
}

const stateFile="BDLocal/repositories/bdl.repo.sync-estado.js";
const engineFile="BDLocal/firebase/bdl.firebase.sync-engine.v2.js";
const targetFile="BDLocal/sync/targets/bdl.sync.target.firebase.js";
const bridgeFile="BDLocal/patches/bdl.changes.outbox-bridge.js";
[stateFile,engineFile,targetFile,bridgeFile].forEach(syntax);

contains(stateFile,'Repos.storeName("syncEstado","sync_estado")',"sync_estado debe ser la memoria persistente del cursor");
contains(stateFile,"lastCursor", "sync_estado debe guardar el cursor incremental");
contains(stateFile,"pullSuccess", "sync_estado debe confirmar descargas");
contains(stateFile,"pushSuccess", "sync_estado debe confirmar subidas");
contains(stateFile,'Repos.register("sync_estado",api)',"El repositorio sync_estado debe registrarse");

contains(engineFile,"options.manual!==true", "El motor debe rechazar solicitudes no manuales");
contains(engineFile,'automatic:false', "El motor debe declarar sincronización automática desactivada");
contains(engineFile,"updatedAfter:cursor", "La descarga debe usar el cursor updatedAt");
contains(engineFile,"writeStores(local.stores", "La descarga debe guardar el mapeo en IndexedDB");
contains(engineFile,"pushPending", "El motor debe reutilizar la cola para subir");
notContains(engineFile,"setInterval(", "El motor no debe ejecutar intervalos automáticos");
notContains(engineFile,"DOMContentLoaded", "El motor no debe sincronizar al abrir la pantalla");

contains(targetFile,"RequisitosFirebaseRepository", "El destino debe usar el repositorio Firebase V2");
contains(targetFile,"RequisitosFirebaseMapper", "El destino debe separar las entidades");
contains(targetFile,"compareEntries", "El destino debe comparar documentos antes de escribir");
contains(targetFile,"dataHash", "El destino debe evitar escrituras idénticas mediante dataHash");
contains(targetFile,"MAX_BATCH_SIZE=25", "El destino debe conservar el máximo de 25 cambios locales");
contains(targetFile,'return ["estudiantes","matriculas","requisitos","notas"]', "Los cambios completos deben dividirse en cuatro colecciones");
notContains(targetFile,"EstudiantesPeriodo", "El destino nuevo no debe escribir en EstudiantesPeriodo");
notContains(targetFile,'collection("Estudiantes")', "El destino nuevo no debe escribir directamente en Estudiantes");

contains(bridgeFile,"bdl.repo.sync-estado.js", "El cargador común debe preparar sync_estado");
contains(bridgeFile,"bdl.firebase.sync-engine.v2.js", "El cargador común debe preparar el motor diferencial");
contains(bridgeFile,"automatic:false", "El cargador debe declarar que no inicia sincronización automática");

if(errors.length){
  console.error("\nVERIFICACIÓN FIREBASE SYNC V2: ERROR\n");
  errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
  process.exit(1);
}
console.log("VERIFICACIÓN FIREBASE SYNC V2: OK");