"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname,"..");
const guardPath = path.join(root,"BDLocal","firebase","bdl.external-operation.guard.js");
const redesignPath = path.join(root,"BDLocal","firebase","bdl.firebase.redesign.js");

function read(file){
  if(!fs.existsSync(file)){
    throw new Error("No existe: "+path.relative(root,file));
  }
  return fs.readFileSync(file,"utf8");
}

function check(condition,message){
  if(!condition){
    console.error("[ERROR] "+message);
    process.exitCode = 1;
    return;
  }
  console.log("[OK] "+message);
}

const guard = read(guardPath);
const redesign = read(redesignPath);

check(guard.includes("window.BDLExternalOperationGate"),"Existe puerta global de operaciones externas.");
check(guard.includes("function acquire(owner,meta)") && guard.includes("function release(token)"),"El bloqueo exige adquisición y liberación por token.");
check(guard.includes("withLock(\"migration:preview\"") && guard.includes("withLock(\"migration:apply\""),"Vista previa y aplicación usan el mismo bloqueo global.");
check(guard.includes("api.request=wrapped") && guard.includes("api.syncQueue=wrapped"),"La cola de Firebase, Google y Supabase pasa por el bloqueo global.");
check(guard.includes("readAllLegacy") && guard.includes("sourceSignature"),"La fuente legacy se firma y se relee antes de migrar.");
check(guard.includes("previewRefreshedBeforeApply:true"),"La migración crea una vista previa fresca antes de escribir.");
check(guard.includes("sourceChangedDuringApply=true"),"Se detectan cambios legacy ocurridos durante la aplicación.");
check(guard.includes("freshBackupId"),"La aplicación conserva el identificador del respaldo fresco.");
check(guard.includes("#bl2-period-select") && guard.includes("setUiLocked(true)"),"El período y los controles quedan congelados durante operaciones.");
check(guard.includes("automatic:false") && guard.includes("destructive:false"),"El guard permanece manual y no destructivo.");
check(!/\.delete\s*\(/.test(guard),"El guard no elimina documentos ni colecciones.");
check(redesign.includes("bdl.external-operation.guard.js"),"El rediseño carga el guard operativo.");
check(redesign.indexOf("ensureGuard();") >= 0 && redesign.includes("if(!window.BDLExternalOperationGate){return;}"),"Las acciones visibles esperan a que el guard esté cargado.");
check(redesign.includes("Operaciones bloqueadas"),"La interfaz bloquea escrituras si el guard no carga.");

if(process.exitCode){
  console.error("VERIFICACIÓN DEL BLOQUEO OPERATIVO: ERROR");
  process.exit(process.exitCode);
}

console.log("VERIFICACIÓN DEL BLOQUEO OPERATIVO: OK");
