"use strict";

/* =========================================================
Archivo: verify-periodo-global.js
Ruta: /scripts/verify-periodo-global.js
Función:
- Verificar sintaxis del período global y del esquema Firebase V2.
- Confirmar que Global quede fuera del período operativo compartido.
- Confirmar nombres e identificadores de las colecciones oficiales.
- Confirmar que la arquitectura se cargue desde el puente común.
========================================================= */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname,"..");
const errors = [];
const checks = [];

function read(relative){
  const target = path.join(ROOT,relative);
  if(!fs.existsSync(target)){
    errors.push(`Falta el archivo: ${relative}`);
    return "";
  }
  return fs.readFileSync(target,"utf8");
}

function ok(condition,message){
  checks.push({ ok:Boolean(condition),message });
  if(!condition){ errors.push(message); }
}

function contains(relative,token,message){
  ok(read(relative).includes(token),message || `${relative} debe contener ${token}`);
}

function syntax(relative){
  const source = read(relative);
  if(!source){ return; }
  try{
    new vm.Script(source,{ filename:relative });
    checks.push({ ok:true,message:`${relative}: sintaxis válida` });
  }catch(error){
    errors.push(`${relative}: ${error.message}`);
  }
}

const periodFile = "BDLocal/shared/bdl.periodo-global.js";
const schemaFile = "BDLocal/firebase/bdl.firebase.schema.v2.js";
const bridgeFile = "BDLocal/patches/bdl.changes.outbox-bridge.js";

[periodFile,schemaFile,bridgeFile].forEach(syntax);

contains(periodFile,"REQ_PERIODO_GLOBAL_V1","Debe existir una sola clave persistente de período general");
contains(periodFile,"requisitos-periodo-global","Debe existir comunicación entre ventanas mediante BroadcastChannel");
contains(periodFile,"isGlobalScreen","Debe existir exclusión expresa para Global");
contains(periodFile,"data-periodo-global","Los selectores deben poder incluirse o excluirse de forma explícita");
contains(periodFile,"BL2Core","El período general debe sincronizarse con el núcleo local");
contains(periodFile,"requisitos:periodo-global-cambiado","Debe emitirse un evento común al cambiar de período");

[
  "estudiantes",
  "matriculas",
  "requisitos",
  "notas",
  "periodos",
  "carreras",
  "historial",
  "importaciones"
].forEach((collection) => {
  contains(schemaFile,`${collection}:\"${collection}\"`,`Falta la colección oficial ${collection}`);
});

contains(schemaFile,"sourceOfTruth:\"firebase\"","Firebase debe quedar definido como fuente oficial");
contains(schemaFile,"localRole:\"cache\"","BDLocal debe quedar definido como caché");
contains(schemaFile,"periodoId__cedula","Las entidades por período deben usar período y cédula");
contains(schemaFile,"incrementalDownload:true","La descarga posterior debe ser incremental");
contains(schemaFile,"uploadOnlyChanges:true","La subida debe limitarse a cambios reales");
contains(schemaFile,"softDelete:true","Las eliminaciones deben ser lógicas durante sincronización");

contains(bridgeFile,"bdl.firebase.schema.v2.js","El puente común debe cargar el esquema Firebase V2");
contains(bridgeFile,"bdl.periodo-global.js","El puente común debe cargar el período general");
contains(bridgeFile,"loadSharedArchitecture","La carga compartida debe estar centralizada");

if(errors.length){
  console.error("\nVERIFICACIÓN DE PERÍODO GLOBAL: ERROR\n");
  errors.forEach((error,index) => console.error(`${index + 1}. ${error}`));
  process.exit(1);
}

console.log(`VERIFICACIÓN DE PERÍODO GLOBAL: OK (${checks.length} comprobaciones)`);
