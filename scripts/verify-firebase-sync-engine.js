"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const errors=[];
function read(file){const full=path.join(ROOT,file);if(!fs.existsSync(full)){errors.push(`Falta ${file}`);return "";}return fs.readFileSync(full,"utf8");}
function check(value,message){if(!value){errors.push(message);}}
function contains(file,fragment,message){check(read(file).includes(fragment),message||`${file} debe contener ${fragment}`);}
function notContains(file,fragment,message){check(!read(file).includes(fragment),message||`${file} no debe contener ${fragment}`);}
function syntax(file){try{new vm.Script(read(file),{filename:file});}catch(error){errors.push(`${file}: ${error.message}`);}}

const stateFile="BDLocal/repositories/bdl.repo.sync-estado.js";
const conflictFile="BDLocal/repositories/bdl.repo.conflictos.js";
const engineFile="BDLocal/firebase/bdl.firebase.sync-engine.v2.js";
const targetFile="BDLocal/sync/targets/bdl.sync.target.firebase.js";
const bridgeFile="BDLocal/patches/bdl.changes.outbox-bridge.js";
const repositoryFile="BDLocal/firebase/bdl.firebase.repository.v2.js";
const centerFile="BDLocal/firebase/bdl.firebase.control-center.js";
const pushFile="BDLocal/firebase/bdl.firebase.push-control.js";
[stateFile,conflictFile,engineFile,targetFile,bridgeFile,repositoryFile,centerFile,pushFile].forEach(syntax);

contains(stateFile,"lastCursorUpdatedAt","sync_estado debe guardar updatedAt del cursor");
contains(stateFile,"lastCursorDocumentId","sync_estado debe guardar documentId del cursor");
contains(stateFile,"Repos.put(store(),merged)","sync_estado debe usar escritura estricta");
notContains(stateFile,"Repos.safePut(store(),merged)","sync_estado no debe ocultar errores críticos");
contains(conflictFile,'tipo:"CONFLICTO_SYNC"',"Debe existir registro persistente de conflictos");
contains(conflictFile,'Repos.register("conflictos_sync",api)',"El repositorio de conflictos debe registrarse");

contains(repositoryFile,'query=query.orderBy("updatedAt","asc")',"La descarga debe ordenar por updatedAt");
contains(repositoryFile,"documentIdField()","La descarga debe ordenar también por documentId");
contains(repositoryFile,"query.startAfter(cursor.updatedAt,cursor.documentId)","La paginación debe usar cursor compuesto");
contains(repositoryFile,'query=query.where("periodoId","==",periodoId)',"Las colecciones académicas deben filtrar por período");
contains(repositoryFile,"writeManyChecked","El repositorio debe exponer escritura segura");
contains(repositoryFile,"FIREBASE_CONFLICT","El repositorio debe detectar conflictos");
contains(repositoryFile,"state.readDocuments+=all.length","La cuota debe contar documentos leídos");

contains(engineFile,"pendingRows(entity,data)","La descarga debe revisar cambios pendientes");
contains(engineFile,'Promise.reject(new Error("Repositorio cambios_pendientes no disponible."))',"La descarga debe detenerse si no puede revisar la cola");
contains(engineFile,"REMOTE_CHANGED_WITH_LOCAL_PENDING","La descarga debe registrar conflicto si Firebase cambió");
contains(engineFile,"removeRequirements","La descarga debe reconciliar requisitos retirados");
contains(engineFile,"isEmptyRequirementsDocument","Un mapa de requisitos vacío debe eliminar requisitos locales anteriores");
contains(engineFile,"applyDeleted","La descarga debe aplicar borrado lógico al caché");
contains(engineFile,"DEFAULT_ENTITIES_GLOBAL","La descarga global debe separar catálogos y personas");
contains(engineFile,"DEFAULT_ENTITIES_PERIOD","La descarga por período debe separar datos académicos");
contains(engineFile,"La paginación no avanzó","El motor debe bloquear ciclos de paginación");
notContains(engineFile,"setInterval(","El motor no debe ejecutar intervalos automáticos");

contains(targetFile,"requiresStudentIdentity","La identidad debe validarse según la entidad");
contains(targetFile,'return ["carreras"]',"Carreras debe procesarse sin identidad de estudiante");
contains(targetFile,"writeManyChecked","La subida debe usar control atómico");
contains(targetFile,"processedChangeIds","Solo deben confirmarse cambios completamente procesados");
contains(targetFile,"ATOMIC_REMOTE_CONFLICT","La subida debe registrar conflictos atómicos");
contains(targetFile,"partial:written.conflicts>0","Los conflictos parciales no deben marcar todo el lote como error");
contains(targetFile,"allConflicted=written.conflicts>0&&processed.length===0","Debe detectarse un lote totalmente conflictuado");
contains(targetFile,"ok:!allConflicted","Un lote totalmente conflictuado no debe declararse exitoso");
contains(targetFile,"deferWithoutAttempt:allConflicted","Un lote totalmente conflictuado debe conservarse pendiente sin sumar intentos");
contains(targetFile,"Repositorio de conflictos no disponible","La subida debe bloquearse si no puede registrar el conflicto");
notContains(targetFile,"EstudiantesPeriodo","El destino nuevo no debe escribir en EstudiantesPeriodo");

contains(bridgeFile,"bdl.repo.conflictos.js","El cargador compartido debe incluir conflictos");
contains(bridgeFile,"bdl.firebase.control-center.js","El cargador compartido debe incluir controles de descarga Firebase V2");
contains(bridgeFile,"bdl.firebase.push-control.js","El cargador compartido debe incluir la subida Firebase V2");
contains(bridgeFile,"automatic:false","El cargador no debe iniciar sincronización automática");

contains(centerFile,'replaceControl("bl2-btn-pull-firebase"',"Base Local debe sustituir la descarga Firebase heredada");
contains(centerFile,'replaceControl("bl2-btn-pull-firebase-all"',"Base Local debe permitir descargar todos los períodos");
contains(centerFile,'engine().pullAll({manual:true,periodoId:period.id',"La descarga del período debe usar el motor V2 manual");
contains(centerFile,'entities:["periodos","carreras","estudiantes"]',"Traer todo debe descargar primero la base global");
contains(centerFile,'entities:["matriculas","requisitos","notas"]',"Traer todo debe descargar los datos académicos por período");
contains(centerFile,"bl2-firebase-conflicts-list","El Centro debe mostrar conflictos abiertos");
contains(centerFile,"Firebase oficial · BDLocal caché","La interfaz debe declarar la arquitectura real");
notContains(centerFile,"setInterval(","Los controles Firebase no deben ejecutar intervalos automáticos");

contains(pushFile,'engine().pushPending({',"El botón de subida debe usar pushPending V2");
contains(pushFile,"limit:25","La subida manual debe conservar el máximo de 25");
contains(pushFile,"Los conflictos permanecerán pendientes","La confirmación debe explicar la protección de conflictos");
notContains(pushFile,"EstudiantesPeriodo","El control de subida no debe mencionar la colección antigua");
notContains(pushFile,"setInterval(","La subida no debe ejecutarse automáticamente");

if(errors.length){console.error("\nVERIFICACIÓN FIREBASE SYNC V2: ERROR\n");errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));process.exit(1);}
console.log("VERIFICACIÓN FIREBASE SYNC V2: OK");
