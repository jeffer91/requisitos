"use strict";

/* =========================================================
Archivo: verify-specialized-screen-runtime.js
Ruta: /scripts/verify-specialized-screen-runtime.js
Función:
- Verificar el orden de configuración, base, repositorios y servicios.
- Confirmar que Defensas, Ncomplex, Cr-def e InPVC usan el cargador común.
- Confirmar que el período global se inyecta al crear y reabrir pantallas.
========================================================= */

const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const errors=[];
let checks=0;

function read(file){return fs.readFileSync(path.join(root,file),"utf8");}
function check(value,message){
  checks+=1;
  if(value){console.log("[OK]",message);return;}
  errors.push(message);
  console.error("[verify-specialized-screen-runtime] ERROR:",message);
}
function before(source,left,right){return source.indexOf(left)>=0&&source.indexOf(right)>=0&&source.indexOf(left)<source.indexOf(right);}

const runtime=read("BDLocal/conexiones/cone.runtime-deps.js");
const defart=read("BDLocal/conexiones/cone.defart.js");
const ncomplex=read("BDLocal/conexiones/cone.ncomplex.js");
const crdef=read("BDLocal/conexiones/cone.crdef.js");
const inpvc=read("BDLocal/conexiones/cone.inpvc.js");
const core=read("Maqueta/maq-core.js");

check(runtime.includes('window.BDLocalRuntimeDeps='),"Existe el cargador común de dependencias.");
check(before(runtime,'../bl2.db.js','../repositories/bdl.repo.index.js'),"IndexedDB se prepara antes del registro de repositorios.");
check(before(runtime,'../repositories/bdl.repo.index.js','../repositories/bdl.repo.notas.js'),"El registro de repositorios se crea antes del repositorio de notas.");
check(before(runtime,'../repositories/bdl.repo.index.js','../repositories/bdl.repo.evaluaciones-titulacion.js'),"El registro de repositorios se crea antes de evaluaciones de titulación.");
check(before(runtime,'../services/bdl.service.index.js','../services/bdl.service.defensas.js'),"El registro de servicios se crea antes de Defensas.");
check(before(runtime,'../services/bdl.service.index.js','../services/bdl.service.ncomplex.js'),"El registro de servicios se crea antes de Ncomplex.");
check(runtime.includes('profiles.defensas=')&&runtime.includes('profiles.inpvc=')&&runtime.includes('profiles.ncomplex='),"El cargador define los tres perfiles especializados.");

check(defart.includes('runtime.ensure("defensas")'),"Defensas usa el perfil ordenado de dependencias.");
check(defart.includes('load("cone.defensas.js",legacy)'),"Defensas carga su compatibilidad después del perfil.");
check(defart.includes('if(!notesRepo())')&&defart.includes('if(!changesRepo())'),"Defensas valida notas y cambios antes de declararse lista.");

check(ncomplex.includes('runtime.ensure("ncomplex")'),"Ncomplex usa el perfil ordenado de dependencias.");
check(ncomplex.includes('load("cone.ncomplex.api.js",actual)'),"Ncomplex carga su API real después de repositorios y servicios.");
check(!ncomplex.includes('../repositories/bdl.repo.evaluaciones-titulacion.js",test'),"Ncomplex ya no carga evaluaciones por fuera del perfil común.");

check(inpvc.includes('runtime.ensure("inpvc")'),"InPVC usa el perfil ordenado de dependencias.");
check(inpvc.includes('if(!studentService()||!periodService()||!notesRepo())'),"InPVC valida sus servicios y notas antes de quedar lista.");

check(crdef.includes('var base=document.currentScript&&document.currentScript.src||document.baseURI;'),"Cr-def conserva la ruta base al ejecutar el archivo.");
check(crdef.includes('runtime.ensure("defensas")'),"Cr-def prepara servicios de Defensas antes de cargar la compatibilidad.");
check(crdef.includes('load("cone.defensas.js",legacy)'),"Cr-def calcula cone.defensas.js desde la carpeta de conexiones.");

check(core.includes('PERIOD_GLOBAL_SCRIPT_URL'),"El núcleo conoce el script del período global.");
check(core.includes('seedGlobalPeriod()'),"El núcleo puede iniciar el período desde la caché compartida.");
check(core.includes('syncPeriodGlobal(frame)'),"El núcleo reaplica el período al mostrar una pantalla.");
check(core.includes('data-maq-periodo-global'),"El período global se inyecta una sola vez por iframe.");
check(core.includes('frame.addEventListener("load"')&&core.includes('syncPeriodGlobal(frame);'),"Cada iframe sincroniza el período después de cargar.");

[
  [defart,"Defensas"],
  [ncomplex,"Ncomplex"],
  [crdef,"Cr-def"],
  [inpvc,"InPVC"]
].forEach(([source,label])=>{
  check(!source.includes('fetch('),`${label} no depende de red para preparar BDLocal.`);
});

if(errors.length){
  console.error(`\nVERIFICACIÓN PANTALLAS ESPECIALIZADAS: ERROR (${errors.length})`);
  errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
  process.exit(1);
}
console.log(`\nVERIFICACIÓN PANTALLAS ESPECIALIZADAS: OK (${checks} comprobaciones)`);
