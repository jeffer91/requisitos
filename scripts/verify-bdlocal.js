/* =========================================================
Nombre completo: verify-bdlocal.js
Ruta o ubicación: /scripts/verify-bdlocal.js
Función o funciones:
- Verificar archivos críticos y sintaxis JavaScript.
- Certificar separación Firebase y claves locales.
- Comprobar seguridad Electron e IPC.
- Confirmar sincronización externa exclusivamente manual.
- Validar importación segura y dependencia SheetJS corregida.
- Verificar la estructura V3, reglas, repositorios, servicio, migración, conexión y pantalla Ncomplex.
- Verificar que el diagnóstico PowerShell esté instalado.
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

console.log("\n=== Certificación estática BDLocal y Ncomplex ===");
console.log("Ruta: "+root);
console.log("No abre Electron, IndexedDB, Firebase ni Google Sheets.\n");

[
  "package.json",
  "electron/main.js",
  "electron/preload.js",
  "electron/smoke-main.js",
  "Maqueta/maq-index.html",
  "Maqueta/maq-modulos-registry.js",
  "Maqueta/maq-menu.js",
  "Maqueta/maq-config-service.js",
  "BDLocal/bl2.html",
  "BDLocal/bl2.config.js",
  "BDLocal/bl2.config.v2.js",
  "BDLocal/bl2.config.v3.js",
  "BDLocal/bl2.db.js",
  "BDLocal/bl2.core.js",
  "BDLocal/bl2.app.js",
  "BDLocal/bl2.test.js",
  "BDLocal/bl2.import.js",
  "BDLocal/bl2.sync.js",
  "BDLocal/rules/bdl.rules.persona.js",
  "BDLocal/rules/bdl.rules.matricula.js",
  "BDLocal/rules/bdl.rules.evaluaciones-titulacion.js",
  "BDLocal/repositories/bdl.repo.evaluaciones-titulacion.js",
  "BDLocal/repositories/bdl.repo.importaciones.js",
  "BDLocal/services/bdl.service.ncomplex.js",
  "BDLocal/migrations/bdl.migration.v3.ncomplex.js",
  "BDLocal/conexiones/cone.index.js",
  "BDLocal/conexiones/cone.ncomplex.js",
  "BDLocal/conexiones/cone.ncomplex.api.js",
  "BDLocal/diagnostics/bdl.diagnostics.index.js",
  "BDLocal/diagnostics/bdl.diagnostics.general.js",
  "BDLocal/sync/bdl.firebase.telegram-pull.js",
  "BDLocal/sync/targets/bdl.sync.target.firebase.js",
  "BDLocal/maintenance/bdl.firebase.identity-repair.js",
  "BDLocal/maintenance/bdl.local.identity-repair.js",
  "BDLocal/diagnostics/bdl.diagnostics.ui-bridge.js",
  "js/bdlocal-config/bdlocal-sync-fixups.js",
  "Carga/readers/carga.reader.xlsx.js",
  "Ncomplex/ncomplex.html",
  "Ncomplex/ncomplex.css",
  "Ncomplex/ncomplex.config.js",
  "Ncomplex/ncomplex.state.js",
  "Ncomplex/ncomplex.calculator.js",
  "Ncomplex/ncomplex.parser.js",
  "Ncomplex/ncomplex.matcher.js",
  "Ncomplex/ncomplex.filters.js",
  "Ncomplex/ncomplex.pagination.js",
  "Ncomplex/ncomplex.summary.js",
  "Ncomplex/ncomplex.table.js",
  "Ncomplex/ncomplex.modal.js",
  "Ncomplex/ncomplex.save.js",
  "Ncomplex/ncomplex.app.js",
  "scripts/audit-repository.js",
  "scripts/diagnostico-bdlocal.ps1",
  "scripts/diagnostico-runtime.js",
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

contains("BDLocal/bl2.config.v3.js",'stores.evaluacionesTitulacion',"V3 declara evaluaciones_titulacion");
contains("BDLocal/bl2.config.v3.js",'config.dbVersion = Math.max',"V3 eleva DB_VERSION de forma segura");
contains("BDLocal/bl2.config.v3.js",'defaultModality:"EXAMEN_COMPLEXIVO"',"Ncomplex inicia en examen complexivo");
contains("BDLocal/bl2.config.v3.js",'teorico:0.40,practico:0.60',"Configuración complexivo 40/60");
contains("BDLocal/bl2.config.v3.js",'escrito:0.60,defensa:0.40',"Configuración trabajo 60/40");
contains("BDLocal/rules/bdl.rules.evaluaciones-titulacion.js",'function complexivo(a,b){return weighted(a,b,0.40,0.60);}',"Regla complexivo 40/60");
contains("BDLocal/rules/bdl.rules.evaluaciones-titulacion.js",'function trabajo(a,b){return weighted(a,b,0.60,0.40);}',"Regla trabajo de titulación 60/40");
contains("BDLocal/rules/bdl.rules.evaluaciones-titulacion.js",'return periodoId&&id?id+"__"+periodoId:"";',"Evaluación usa cedula__periodoId");
contains("BDLocal/repositories/bdl.repo.evaluaciones-titulacion.js",'Repos.register("evaluaciones_titulacion",api);',"Repositorio evaluaciones registrado");
contains("BDLocal/repositories/bdl.repo.importaciones.js",'Repos.register("importaciones",api);',"Repositorio importaciones registrado");
contains("BDLocal/services/bdl.service.ncomplex.js",'Services.register("ncomplex",api);',"Servicio Ncomplex registrado");
contains("BDLocal/services/bdl.service.ncomplex.js",'tabla:"evaluaciones_titulacion"',"Ncomplex registra cambios pendientes por tabla");
contains("BDLocal/migrations/bdl.migration.v3.ncomplex.js",'db.createObjectStore(STORE,{keyPath:"idEstudiantePeriodo"})',"Migración crea tabla V3 sin reemplazar tablas");
contains("BDLocal/migrations/bdl.migration.v3.ncomplex.js",'destructive:false',"Migración Ncomplex no destructiva");
contains("BDLocal/conexiones/cone.ncomplex.js",'window.ConNcomplex=proxy;',"Conector Ncomplex expone proxy inmediato");
contains("BDLocal/conexiones/cone.ncomplex.api.js",'function ensureSchema()',"Conector verifica esquema antes de operar");
contains("BDLocal/conexiones/cone.ncomplex.api.js",'window.ConNcomplex=api;',"Conector Ncomplex expone API oficial");
contains("BDLocal/diagnostics/bdl.diagnostics.index.js",'startNcomplexIntegration',"Centro BDLocal carga integración Ncomplex");
contains("BDLocal/diagnostics/bdl.diagnostics.index.js",'registry.register("ncomplex"',"Ncomplex se registra en conexiones");
contains("BDLocal/diagnostics/bdl.diagnostics.general.js",'safeCount("evaluaciones_titulacion")',"Diagnóstico cuenta evaluaciones_titulacion");
contains("BDLocal/diagnostics/bdl.diagnostics.general.js",'ConNcomplex:exists(window.ConNcomplex)',"Diagnóstico verifica ConNcomplex");

contains("Maqueta/maq-modulos-registry.js",'ruta:base+"/Ncomplex/ncomplex.html"',"Maqueta registra ruta Ncomplex");
contains("Maqueta/maq-menu.js",'moduloId:"ncomplex",etiqueta:"Ncomplex"',"Menú principal incluye Ncomplex");
contains("Maqueta/maq-config-service.js",'moduloId:"ncomplex",etiqueta:"Ncomplex"',"Configuración efectiva conserva Ncomplex");

contains("Ncomplex/ncomplex.html",'id="ncomplex-filter-periodo"',"Pantalla Ncomplex tiene selector de período");
contains("Ncomplex/ncomplex.html",'id="ncomplex-filter-carrera"',"Pantalla Ncomplex tiene selector de carrera");
contains("Ncomplex/ncomplex.html",'id="ncomplex-filter-modalidad"',"Pantalla Ncomplex tiene selector de modalidad");
contains("Ncomplex/ncomplex.html",'id="ncomplex-paste-data"',"Pantalla Ncomplex tiene área de pegado");
contains("Ncomplex/ncomplex.html",'id="ncomplex-modality-modal"',"Pantalla Ncomplex tiene popup de modalidad");
contains("Ncomplex/ncomplex.parser.js",'findHeader',"Parser detecta encabezado de tabla");
contains("Ncomplex/ncomplex.matcher.js",'studentsByCedula',"Cruce Ncomplex utiliza cédula");
contains("Ncomplex/ncomplex.matcher.js",'No existe en el período seleccionado',"Cruce reporta estudiantes no encontrados");
contains("Ncomplex/ncomplex.calculator.js",'return weighted(teorico, practico, 0.40, 0.60);',"Calculadora complexivo 40/60");
contains("Ncomplex/ncomplex.calculator.js",'return weighted(escrito, defensa, 0.60, 0.40);',"Calculadora trabajo 60/40");
contains("Ncomplex/ncomplex.save.js",'con.saveMany(rows',"Pantalla guarda lotes mediante ConNcomplex");
contains("Ncomplex/ncomplex.app.js",'con.listStudents({',"Pantalla carga estudiantes del período desde el conector");
contains("Ncomplex/ncomplex.app.js",'includeConflicts: false',"Importación no sobrescribe conflictos");

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

contains("BDLocal/bl2.import.js","sheetjs@0.20.3","Importador usa SheetJS corregido");
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
contains("package.json",'"diagnostico:bdlocal"',"Comando de diagnóstico BDLocal disponible");
notContains("package.json",'"latest"',"Sin dependencias latest");
notContains("package.json","npx --yes","Inicio sin descarga dinámica");
contains("package.json","node scripts/verify-bdlocal.js","npm test ejecuta certificación BDLocal");
contains("package.json","node scripts/audit-repository.js","npm test ejecuta auditoría integral");
contains("package.json",'"test:electron": "electron electron/smoke-main.js"',"Existe prueba real de Electron");

notContains("BDLocal/bl2.html","bdlocal-modal.js","No se carga modal legacy");
notContains("BDLocal/bl2.html","bdl.migration.legacy-v2.ui.js","No se carga interfaz de migración duplicada");
add("Modal legacy eliminado",!exists("js/bdlocal-config/bdlocal-modal.js"),exists("js/bdlocal-config/bdlocal-modal.js")?"Todavía existe":"Eliminado");
add("UI legacy eliminada",!exists("BDLocal/migrations/bdl.migration.legacy-v2.ui.js"),exists("BDLocal/migrations/bdl.migration.legacy-v2.ui.js")?"Todavía existe":"Eliminada");

[
  "BDLocal",
  "js/bdlocal-config",
  "Carga",
  "defart",
  "Ncomplex",
  "Maqueta",
  "electron",
  "scripts"
].flatMap(function(directory){return walk(directory);})
  .filter(function(file){return /\.js$/i.test(file);})
  .filter(function(file,index,list){return list.indexOf(file)===index;})
  .sort()
  .forEach(syntax);

var empty=walk("BDLocal").concat(walk("Ncomplex")).filter(function(file){return fs.statSync(file).size===0;});
add("Sin archivos vacíos en BDLocal y Ncomplex",empty.length===0,empty.length?empty.map(relative).join(", "):"OK");

var passed=checks.filter(function(check){return check.ok;}).length;
var failed=checks.filter(function(check){return !check.ok;});
checks.forEach(function(check){console.log((check.ok?"[OK]    ":"[FALLO] ")+check.name+" - "+check.detail);});
console.log("\nResumen: "+passed+" / "+checks.length+" controles correctos.");
if(failed.length){console.error("Hay "+failed.length+" fallo(s). No realice una sincronización real.");process.exit(1);}
console.log("Certificación estática aprobada. Ejecute también Diagnóstico y salud dentro de Electron.");
