"use strict";

const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const errors=[];

function read(file){return fs.readFileSync(path.join(root,file),"utf8");}
function check(value,message){
  if(value){console.log("[OK]",message);return;}
  errors.push(message);
  console.error("[ERROR]",message);
}

const background=read("Maqueta/maq-baselocal-background-sync.js");
const actions=read("BDLocal/firebase/bdl.firebase.user-actions.js");
const control=read("BDLocal/firebase/bdl.firebase.control-center.js");
const guard=read("BDLocal/firebase/bdl.external-operation.guard.js");
const migration=read("BDLocal/firebase/bdl.firebase.migration.v2.js");

check(background.includes("manualOnly:true")&&background.includes("automatic:false"),"La sincronización de fondo está declarada como manual.");
check(background.includes("externalReads:0")&&background.includes("externalWrites:0"),"Abrir, esperar y cerrar declaran cero E/S externa.");
check(!background.includes("setInterval("),"No existe un ciclo periódico de AutoSync.");
check(!background.includes("ensureBaseFrame("),"El arranque no abre Base Local ocultamente.");
check(!background.includes("api.request("),"El módulo de fondo no puede solicitar lotes externos.");

check(actions.includes("COMPARE_LIMIT=100"),"La comparación V2 limita cada colección a 100 documentos.");
check(actions.includes("COMPARE_READ_BUDGET=COMPARE_LIMIT*COMPARE_ENTITIES.length"),"La comparación tiene presupuesto total explícito.");
check(actions.includes('COMPARE_ENTITIES=["matriculas","requisitos","notas"]'),"La comparación usa únicamente colecciones académicas V2.");
check(actions.includes("repository().list")||actions.includes("current.list(entity"),"La comparación utiliza el repositorio V2.");
check(!actions.includes("previewFirebase(period)"),"La comparación visible no ejecuta la lectura legacy completa.");
check(!actions.includes("pullFirebaseToLocal(period"),"La descarga visible no usa el motor legacy.");

check(control.includes("PERIOD_READ_BUDGET=4500"),"La descarga de un período tiene un techo de 4 500 lecturas.");
check(control.includes("ALL_PERIODS_READ_BUDGET=9000"),"La descarga global tiene un techo de 9 000 lecturas.");
check(control.includes("ALL_PERIODS_MAX=3"),"La descarga global bloquea más de tres períodos.");
check(control.includes("limit:PERIOD_PAGE_SIZE")&&control.includes("maxPages:PERIOD_MAX_PAGES"),"Todas las descargas V2 aplican paginación limitada.");

check(guard.includes("MIGRATION_READ_BUDGET=20000"),"La vista previa de migración tiene un techo de 20 000 lecturas.");
check(guard.includes("MIGRATION_APPLY_READ_BUDGET=10000"),"La aplicación de migración tiene un techo de 10 000 verificaciones.");
check((guard.match(/originalPreview\s*\(/g)||[]).length===1,"La migración ejecuta una sola vista previa remota.");
check(!guard.includes("readAllLegacy("),"El guard no relee la fuente legacy.");
check(guard.includes("previewReadPasses:1"),"El resultado informa una sola pasada de lectura.");

check(migration.includes("state.lastPreview=plan"),"El plan completo queda en memoria después de la vista previa.");
check(migration.includes("var plan=planByToken(previewToken)"),"La aplicación consume el plan de la vista previa por token.");

if(errors.length){
  console.error("VERIFICACIÓN DEL PRESUPUESTO FIREBASE: ERROR");
  errors.forEach((message,index)=>console.error(`${index+1}. ${message}`));
  process.exit(1);
}

console.log("VERIFICACIÓN DEL PRESUPUESTO FIREBASE: OK");
