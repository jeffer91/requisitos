/* =========================================================
Nombre completo: verify-bdlocal.js
Ruta o ubicación: /scripts/verify-bdlocal.js
Función o funciones:
- Verificar archivos críticos y sintaxis JavaScript.
- Certificar separación Firebase y claves locales.
- Comprobar seguridad Electron e IPC.
- Confirmar sincronización externa exclusivamente manual.
- Validar importación segura y dependencia SheetJS corregida.
- No abrir Electron, IndexedDB ni conexiones externas.
========================================================= */
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const childProcess=require("node:child_process");

const root=path.resolve(__dirname,"..");
const checks=[];

function absolute(file){return path.resolve(root,file);}
function relative(file){return path.relative(root,file).replace(/\\/g,"/");}
function exists(file){return fs.existsSync(absolute(file))&&fs.statSync(absolute(file)).isFile();}
function read(file){return fs.readFileSync(absolute(file),"utf8");}
function add(name,ok,detail){checks.push({name:name,ok:!!ok,detail:String(detail||"")});}
function requireFile(file){var ok=exists(file);add("Existe "+file,ok,ok?"OK":"No encontrado");if(ok){var size=fs.statSync(absolute(file)).size;add("No vacío "+file,size>0,size+" bytes");}}
function contains(file,fragment,label){if(!exists(file)){add(label,false,"Archivo no encontrado: "+file);return;}var ok=read(file).includes(fragment);add(label,ok,ok?"Encontrado":"Falta: "+fragment);}
function notContains(file,fragment,label){if(!exists(file)){add(label,false,"Archivo no encontrado: "+file);return;}var ok=!read(file).includes(fragment);add(label,ok,ok?"Ausente, correcto":"Referencia no permitida: "+fragment);}

function walk(directory,output=[]){
  var full=absolute(directory);
  if(!fs.existsSync(full)){return output;}
  fs.readdirSync(full,{withFileTypes:true}).forEach(function(entry){
    if(entry.name==="node_modules"||entry.name===".git"){return;}
    var current=path.join(full,entry.name);
    if(entry.isDirectory()){walk(relative(current),output);}
    else if(entry.isFile()){output.push(current);}
  });
  return output;
}

function syntax(file){
  var result=childProcess.spawnSync(process.execPath,["--check",file],{cwd:root,encoding:"utf8"});
  add("Sintaxis "+relative(file),result.status===0,result.status===0?"OK":String(result.stderr||result.stdout||"Error").trim());
}

console.log("\n=== Certificación estática BDLocal ===");
console.log("Ruta: "+root);
console.log("No abre Electron, IndexedDB, Firebase ni Google Sheets.\n");

[
  "package.json",
  "electron/main.js",
  "electron/preload.js",
  "electron/smoke-main.js",
  "Maqueta/maq-index.html",
  "BDLocal/bl2.html",
  "BDLocal/bl2.config.js",
  "BDLocal/bl2.config.v2.js",
  "BDLocal/bl2.db.js",
  "BDLocal/bl2.core.js",
  "BDLocal/bl2.app.js",
  "BDLocal/bl2.test.js",
  "BDLocal/bl2.import.js",
  "BDLocal/bl2.sync.js",
  "BDLocal/rules/bdl.rules.persona.js",
  "BDLocal/rules/bdl.rules.matricula.js",
  "BDLocal/sync/bdl.firebase.telegram-pull.js",
  "BDLocal/sync/targets/bdl.sync.target.firebase.js",
  "BDLocal/maintenance/bdl.firebase.identity-repair.js",
  "BDLocal/maintenance/bdl.local.identity-repair.js",
  "BDLocal/diagnostics/bdl.diagnostics.ui-bridge.js",
  "BDLocal/conexiones/cone.index.js",
  "js/bdlocal-config/bdlocal-sync-fixups.js",
  "Carga/readers/carga.reader.xlsx.js",
  "scripts/audit-repository.js",
  ".github/workflows/bdlocal-integrity.yml"
].forEach(requireFile);

contains("BDLocal/bl2.config.js",'collection:"EstudiantesPeriodo"',"Firebase académico = EstudiantesPeriodo");
contains("BDLocal/bl2.config.js",'personCollection:"Estudiantes"',"Firebase persona = Estudiantes");
contains("BDLocal/bl2.config.js",'personDocumentIdStrategy:"cedula"',"Estudiantes usa solo cédula");
contains("BDLocal/bl2.config.js",'academicDocumentIdStrategy:"periodoId__cedula"',"EstudiantesPeriodo usa período y cédula");
contains("BDLocal/bl2.config.js",'manualOnly:true',"Sincronización externa manual");
contains("BDLocal/bl2.config.js",'syncOnIdle:false',"Sin sincronización por inactividad");
contains("BDLocal/bl2.config.js",'syncOnClose:false',"Sin sincronización al cerrar");
contains("BDLocal/bl2.config.js",'maxBatchSize:25',"Lote externo máximo 25");

contains("BDLocal/rules/bdl.rules.matricula.js",'cedula + "__" + periodoId',"Matrícula usa cedula__periodoId");
contains("BDLocal/rules/bdl.rules.requisitos.js",'cedula + "__" + periodoId',"Requisitos usan cedula__periodoId");
contains("BDLocal/rules/bdl.rules.notas.js",'cedula + "__" + periodoId',"Notas usan cedula__periodoId");
contains("BDLocal/rules/bdl.rules.persona.js","isValidEcuadorianCedula","Identidad valida dígito verificador");

contains("BDLocal/bl2.sync.js","compatibilityOnly:true","BL2Sync es fachada de compatibilidad");
contains("BDLocal/bl2.sync.js","BDLSyncV2.request","BL2Sync delega a la puerta V2");
contains("BDLocal/bl2.sync.js","directFirebaseWrites:false","BL2Sync declara cero escrituras directas Firebase");
notContains("BDLocal/bl2.sync.js","fetch(","BL2Sync sin POST directo");
notContains("BDLocal/bl2.sync.js",".commit(","BL2Sync sin commit directo Firestore");
notContains("BDLocal/bl2.sync.js","setInterval(","BL2Sync sin intervalos automáticos");

contains("electron/main.js","sandbox:true","Electron usa sandbox");
contains("electron/main.js","webSecurity:true","Electron usa seguridad web");
contains("electron/main.js","nodeIntegration:false","Electron bloquea Node en renderer");
contains("electron/main.js","contextIsolation:true","Electron aísla contextos");
contains("electron/main.js","navigateOnDragDrop:false","Electron bloquea navegación por arrastre");
contains("electron/main.js","trustedSender(event)","IPC valida remitente");
contains("electron/main.js","secureHandle(channel,handler)","IPC usa registro seguro");
notContains("electron/main.js","webSecurity:false","Electron no desactiva seguridad web");
notContains("electron/main.js","sandbox:false","Electron no desactiva sandbox");

contains("BDLocal/bl2.import.js","xlsx-0.20.3","Importador usa SheetJS corregido");
contains("BDLocal/bl2.import.js","MAX_FILE_BYTES=15*1024*1024","Importador limita archivos");
contains("BDLocal/bl2.import.js","safeKey(key)","Importador bloquea claves peligrosas");
contains("BDLocal/bl2.import.js","missingLeadingZero&&identity.safeAutoCorrection","Cero inicial solo con validación");
notContains("BDLocal/bl2.import.js","cdn.jsdelivr.net","Importador sin CDN antiguo");
contains("Carga/readers/carga.reader.xlsx.js","node_modules/xlsx/dist/xlsx.full.min.js","Carga usa dependencia local");
contains("Carga/readers/carga.reader.xlsx.js","sheetjs@0.20.3","Carga declara SheetJS corregido");
contains("defart/defart.html","node_modules/xlsx/dist/xlsx.full.min.js","Defensas usa dependencia local");
contains("defart/defart.html","sheetjs@0.20.3","Defensas declara SheetJS corregido");

contains("package.json",'"node": ">=22.12.0"',"Motor Node mínimo fijado");
contains("package.json",'"electron": "43.1.0"',"Electron fijado");
contains("package.json","xlsx-0.20.3.tgz","SheetJS corregido y fijado");
notContains("package.json",'"latest"',"Sin dependencias latest");
notContains("package.json","npx --yes","Inicio sin descarga dinámica");
contains("package.json",'"test": "node scripts/verify-bdlocal.js && node scripts/audit-repository.js"',"npm test ejecuta certificación y auditoría");
contains("package.json",'"test:electron": "electron electron/smoke-main.js"',"Existe prueba real de Electron");

notContains("BDLocal/bl2.html","bdlocal-modal.js","No se carga modal legacy");
notContains("BDLocal/bl2.html","bdl.migration.legacy-v2.ui.js","No se carga interfaz de migración duplicada");
add("Modal legacy eliminado",!exists("js/bdlocal-config/bdlocal-modal.js"),exists("js/bdlocal-config/bdlocal-modal.js")?"Todavía existe":"Eliminado");
add("UI legacy eliminada",!exists("BDLocal/migrations/bdl.migration.legacy-v2.ui.js"),exists("BDLocal/migrations/bdl.migration.legacy-v2.ui.js")?"Todavía existe":"Eliminada");

["BDLocal","js/bdlocal-config","Carga","defart","electron","scripts"].flatMap(function(directory){return walk(directory);}).filter(function(file){return /\.js$/i.test(file);}).filter(function(file,index,list){return list.indexOf(file)===index;}).sort().forEach(syntax);

var empty=walk("BDLocal").filter(function(file){return fs.statSync(file).size===0;});
add("Sin archivos vacíos en BDLocal",empty.length===0,empty.length?empty.map(relative).join(", "):"OK");

var passed=checks.filter(function(check){return check.ok;}).length;
var failed=checks.filter(function(check){return !check.ok;});
checks.forEach(function(check){console.log((check.ok?"[OK]    ":"[FALLO] ")+check.name+" - "+check.detail);});
console.log("\nResumen: "+passed+" / "+checks.length+" controles correctos.");
if(failed.length){console.error("Hay "+failed.length+" fallo(s). No realice una sincronización real.");process.exit(1);}
console.log("Certificación estática aprobada. Ejecute también Diagnóstico y salud dentro de Electron.");
