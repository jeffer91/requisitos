"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname,"..");
const guardPath = path.join(root,"BDLocal","firebase","bdl.external-operation.guard.js");
const supplementPath = path.join(root,"BDLocal","firebase","bdl.external-operation.supplement.js");
const activeConnectorsPath = path.join(root,"BDLocal","conexiones","cone.active-connectors.ready.js");
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
const supplement = read(supplementPath);
const activeConnectors = read(activeConnectorsPath);
const redesign = read(redesignPath);

check(guard.includes("window.BDLExternalOperationGate"),"Existe puerta global de operaciones externas.");
check(guard.includes("function acquire(owner,meta)") && guard.includes("function release(token)"),"El bloqueo exige adquisición y liberación por token.");
check(guard.includes("withLock(\"migration:preview\"") && guard.includes("withLock(\"migration:apply\""),"Vista previa y aplicación usan el mismo bloqueo global.");
check(guard.includes("api.request=wrapped") && guard.includes("api.syncQueue=wrapped"),"La cola de Firebase, Google y Supabase pasa por el bloqueo global.");
check(guard.includes("readAllLegacy") && guard.includes("sourceSignature"),"La fuente legacy se firma y se relee antes de migrar.");
check(guard.includes("previewRefreshedBeforeApply:true"),"La migración crea una vista previa fresca antes de escribir.");
check(guard.includes("sourceChangedDuringApply=true"),"Se detectan cambios legacy ocurridos durante la aplicación.");
check(guard.includes("freshBackupId"),"La aplicación conserva el identificador del respaldo fresco.");
check(guard.includes("#bl2-period-select") && guard.includes("setUiLocked(true)"),"El selector de período principal queda congelado durante operaciones.");
check(guard.includes("automatic:false") && guard.includes("destructive:false"),"El guard permanece manual y no destructivo.");
check(!/\.delete\s*\(/.test(guard),"El guard no elimina documentos ni colecciones.");

check(supplement.includes("pullSheetsToLocal") && supplement.includes("pullAllSheetsToLocal"),"Las descargas de Google Sheets usan el bloqueo global.");
check(supplement.includes("bl2-btn-pull-sheets") && supplement.includes("bl2-btn-pull-sheets-all"),"Los botones legacy de Google Sheets son interceptados.");
check(supplement.includes("blockPeriodChange") && supplement.includes("[data-bl2-period]"),"No se puede cambiar de período durante una operación.");
check(supplement.includes("cone.active-connectors.ready.js") && supplement.includes("ensureActiveConnectors"),"El suplemento espera el inventario activo completo.");
check(supplement.includes("manualOnly:true") && supplement.includes("destructive:false"),"El suplemento es manual y no destructivo.");
check(!/\.delete\s*\(/.test(supplement),"El suplemento no elimina datos.");

[
  "carga","tabla","ficha","stats","coordi","reportes",
  "global","defart","ncomplex","cr_def","inpvc"
].forEach((name) => check(activeConnectors.includes(`\"${name}\"`),`El inventario activo incluye ${name}.`));
check(activeConnectors.includes("window.BDLActiveConnectorsReady"),"Existe una promesa única para esperar conectores activos.");
check(activeConnectors.includes("current.ready=function(options)"),"BDLocalConexiones.ready espera los conectores completos.");
check(activeConnectors.includes("test.run=function(options)"),"La certificación Electron espera los conectores completos.");
check(activeConnectors.includes("externalReads:0") && activeConnectors.includes("externalWrites:0"),"Completar conectores no consulta ni modifica fuentes externas.");
check(!/\.delete\s*\(/.test(activeConnectors),"El cargador de conectores no elimina datos.");

check(redesign.includes("bdl.external-operation.guard.js"),"El rediseño carga el guard operativo.");
check(redesign.includes("bdl.external-operation.supplement.js"),"El rediseño carga la protección de descargas y período.");
check(
  redesign.includes("if(!window.BDLExternalOperationGate||!window.BDLExternalOperationSupplement){return;}"),
  "Las acciones visibles esperan al guard y al suplemento."
);
check(redesign.includes("Operaciones bloqueadas"),"La interfaz bloquea escrituras si una protección no carga.");

if(process.exitCode){
  console.error("VERIFICACIÓN DEL BLOQUEO OPERATIVO: ERROR");
  process.exit(process.exitCode);
}

console.log("VERIFICACIÓN DEL BLOQUEO OPERATIVO: OK");
