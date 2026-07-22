/* =========================================================
Nombre completo: verify-autosync.js
Ruta o ubicación: /scripts/verify-autosync.js
Función o funciones:
- Verificar la entrada protegida de Electron.
- Comprobar el puente limitado hacia Base Local.
- Comprobar el cierre condicionado a sincronización confirmada.
- Comprobar límites, bloqueo persistente e inactividad del AutoSync.
- Evitar que una edición futura retire las seguridades principales.
Con qué se conecta:
- package.json
- electron/main-safe.js
- electron/preload.js
- Maqueta/maq-baselocal-background-sync.js
========================================================= */
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");

function read(file){return fs.readFileSync(path.join(root,file),"utf8");}
function fail(message){console.error("[verify-autosync] ERROR:",message);process.exitCode=1;}
function requireFragments(file,fragments){
  const source=read(file);
  fragments.forEach((fragment)=>{if(!source.includes(fragment)){fail(file+" no contiene: "+fragment);}});
}

const pkg=JSON.parse(read("package.json"));
if(pkg.main!=="electron/main-safe.js"){fail("package.json debe iniciar con electron/main-safe.js");}

requireFragments("electron/main-safe.js",[
  "app.requestSingleInstanceLock()",
  'browserWindow.on("close"',
  "event.preventDefault()",
  "handleCloseRequest",
  "result.canClose===true",
  "Reintentar sincronización",
  "findBaseLocalFrame",
  "installGuard",
  "sameRevision",
  "contentHash",
  "payloadRevision",
  "powerMonitor.getSystemIdleTime()"
]);

requireFragments("electron/preload.js",[
  "baseLocalSync",
  "requisitos:sync-status",
  "requisitos:sync-snapshot",
  "requisitos:sync-request",
  "requisitos:sync-idle-state"
]);

requireFragments("Maqueta/maq-baselocal-background-sync.js",[
  "IDLE_MS=3*60*1000",
  "QUIET_AFTER_CHANGE_MS=60*1000",
  "AUTO_BATCH_SIZE=5",
  "CLOSE_BATCH_SIZE=25",
  "MAX_CONSECUTIVE_ERRORS=2",
  "LOCK_TTL_MS=2*60*1000",
  "handleCloseRequest",
  "MAX_CLOSE_REQUESTS=200",
  "googleAutoEnabled",
  "getIdleState",
  "installConfirmationGuard"
]);

if(!process.exitCode){console.log("[verify-autosync] OK: inactividad, puente, revisión y cierre protegido verificados.");}
