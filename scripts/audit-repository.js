/* =========================================================
Nombre completo: audit-repository.js
Ruta o ubicación: /scripts/audit-repository.js
Función o funciones:
- Auditar dependencias, rutas, HTML, duplicados y archivos heredados.
- Detectar XML, colisiones de nombres y referencias locales rotas.
- Revisar seguridad de Electron, IPC y sincronización externa.
- Verificar conexiones BDLocal, Firebase, Telegram y módulos de pantalla.
- No abrir Electron, IndexedDB ni conexiones externas.
========================================================= */
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname,"..");
const self = path.resolve(__filename);
const ignoredDirectories = new Set([".git","node_modules","dist","build","coverage","out"]);
const textExtensions = new Set([".js",".cjs",".mjs",".json",".html",".htm",".css",".md",".txt",".ps1",".yml",".yaml",".xml"]);
const results = [];

function relative(file){return path.relative(root,file).replace(/\\/g,"/");}
function exists(file){return fs.existsSync(path.resolve(root,file));}
function read(file){return fs.readFileSync(path.resolve(root,file),"utf8");}
function add(level,name,detail,data){results.push({level,name,detail:String(detail||""),data:data||null});}
function pass(name,detail,data){add("PASS",name,detail,data);}
function warn(name,detail,data){add("WARN",name,detail,data);}
function fail(name,detail,data){add("FAIL",name,detail,data);}

function walk(directory,output=[]){
  if(!fs.existsSync(directory)){return output;}
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    if(entry.isDirectory()&&ignoredDirectories.has(entry.name)){continue;}
    const current=path.join(directory,entry.name);
    if(entry.isDirectory()){walk(current,output);}
    else if(entry.isFile()){output.push(current);}
  }
  return output;
}

function isText(file){return textExtensions.has(path.extname(file).toLowerCase());}
function safeRead(file){try{return fs.readFileSync(file,"utf8");}catch(error){return "";}}
function hash(buffer){return crypto.createHash("sha256").update(buffer).digest("hex");}

function auditPackage(){
  const packagePath=path.join(root,"package.json");
  if(!fs.existsSync(packagePath)){fail("Dependencias","Falta package.json.");return;}
  let pkg;
  try{pkg=JSON.parse(fs.readFileSync(packagePath,"utf8"));pass("package.json","JSON válido.");}
  catch(error){fail("package.json","JSON inválido: "+error.message);return;}

  const all=Object.assign({},pkg.dependencies||{},pkg.devDependencies||{},pkg.optionalDependencies||{});
  const floating=Object.keys(all).filter((name)=>/^(latest|next|\*|workspace:)|^[~^><=]/i.test(String(all[name]||"")));
  if(floating.length){fail("Versiones de dependencias","Existen versiones flotantes: "+floating.map((name)=>name+"="+all[name]).join(", "));}
  else{pass("Versiones de dependencias","Todas las dependencias directas están fijadas.",{dependencies:all});}

  const start=String(pkg.scripts&&pkg.scripts.start||"");
  if(/\bnpx\b|--yes/.test(start)){fail("Arranque npm","El arranque descarga ejecutables dinámicamente: "+start);}
  else if(start!=="electron ."){warn("Arranque npm","Revise el comando de inicio: "+start);}
  else{pass("Arranque npm","Usa Electron instalado localmente.");}

  const lockPath=path.join(root,"package-lock.json");
  if(!fs.existsSync(lockPath)){warn("Bloqueo de dependencias","No existe package-lock.json; use npm install para generarlo antes de distribuir.");return;}
  try{
    const lock=JSON.parse(fs.readFileSync(lockPath,"utf8"));
    const rootPackage=lock.packages&&lock.packages[""]||{};
    const locked=Object.assign({},rootPackage.dependencies||{},rootPackage.devDependencies||{});
    const mismatch=Object.keys(all).filter((name)=>String(locked[name]||"")!==String(all[name]||""));
    if(mismatch.length){fail("package-lock.json","No coincide con package.json: "+mismatch.join(", "));}
    else{pass("package-lock.json","Dependencias directas coinciden con el archivo de bloqueo.");}
  }catch(error){fail("package-lock.json","Archivo inválido: "+error.message);}
}

function auditElectron(){
  const file="electron/main.js";
  if(!exists(file)){fail("Electron","Falta electron/main.js.");return;}
  const source=read(file);
  const forbidden=["webSecurity:false","webSecurity: false","sandbox:false","sandbox: false","nodeIntegration:true","nodeIntegration: true","allowRunningInsecureContent:true","enableRemoteModule:true"];
  const found=forbidden.filter((fragment)=>source.includes(fragment));
  if(found.length){fail("Seguridad Electron","Configuraciones inseguras: "+found.join(", "));}
  else{pass("Seguridad Electron","Sandbox, aislamiento y seguridad web no están desactivados.");}

  ["contextIsolation:true","nodeIntegration:false","sandbox:true","webSecurity:true","navigateOnDragDrop:false","trustedSender(event)","secureHandle(channel,handler)"].forEach((fragment)=>{
    if(!source.includes(fragment)){fail("Electron requerido","Falta control: "+fragment);}
  });
  if(results.filter((item)=>item.name==="Electron requerido"&&item.level==="FAIL").length===0){pass("IPC Electron","Canales IPC y navegación declaran validación de origen.");}

  if(/appRoot\s*:|entry\s*:.*findEntryFile/.test(source)){warn("Exposición de rutas","get-app-info podría exponer rutas del sistema.");}
  else{pass("Privacidad Electron","La API pública no expone rutas físicas de la aplicación.");}
}

function auditSync(){
  const file="BDLocal/bl2.sync.js";
  if(!exists(file)){fail("Sincronización legacy","Falta la fachada BL2Sync.");return;}
  const source=read(file);
  const directPatterns=[/\bfetch\s*\(/,/firestore\.batch\s*\(/,/\.batch\s*\(\s*\)/,/\.commit\s*\(/,/setInterval\s*\(/];
  const direct=directPatterns.filter((pattern)=>pattern.test(source)).map((pattern)=>String(pattern));
  if(direct.length){fail("Puerta única de sincronización","BL2Sync conserva rutas directas: "+direct.join(", "));}
  else{pass("Puerta única de sincronización","BL2Sync no escribe directamente en servicios externos.");}

  ["compatibilityOnly:true","manualOnly:true","automatic:false","singleGate:true","maxBatchSize:MAX_BATCH_SIZE","BDLSyncV2.request"].forEach((fragment)=>{
    if(!source.includes(fragment)){fail("Contrato BL2Sync","Falta: "+fragment);}
  });
  if(!source.includes("maybeSyncGoogleIdle")||!source.includes("maybeSyncFirebaseDaily")||!source.includes("syncBeforeClose")){fail("Bloqueos automáticos","Faltan fachadas de bloqueo automático.");}
  else{pass("Bloqueos automáticos","Inactividad, sincronización diaria y cierre están controlados.");}
}

function auditFirebaseAndIdentity(){
  const configFile="BDLocal/bl2.config.js";
  if(!exists(configFile)){fail("Firebase","Falta configuración de Base Local.");return;}
  const source=read(configFile);
  const expected=[
    'collection:"EstudiantesPeriodo"',
    'academicCollection:"EstudiantesPeriodo"',
    'personCollection:"Estudiantes"',
    'personDocumentIdStrategy:"cedula"',
    'academicDocumentIdStrategy:"periodoId__cedula"',
    'maxBatchSize:25'
  ];
  const missing=expected.filter((fragment)=>!source.includes(fragment));
  if(missing.length){fail("Separación Firebase","Faltan declaraciones: "+missing.join(", "));}
  else{pass("Separación Firebase","Persona, Telegram y datos académicos usan destinos e IDs separados.");}

  const localFiles=["BDLocal/rules/bdl.rules.matricula.js","BDLocal/rules/bdl.rules.requisitos.js","BDLocal/rules/bdl.rules.notas.js"];
  const incorrect=[];
  localFiles.forEach((file)=>{if(!exists(file)||!read(file).includes('cedula + "__" + periodoId')){incorrect.push(file);}});
  if(incorrect.length){fail("Clave local","Archivos sin cedula__periodoId: "+incorrect.join(", "));}
  else{pass("Clave local","Matrículas, requisitos y notas usan cedula__periodoId.");}

  const telegram="BDLocal/sync/bdl.firebase.telegram-pull.js";
  if(!exists(telegram)){fail("Telegram","Falta el módulo de lectura.");}
  else{
    const content=read(telegram);
    const problems=[];
    if(!content.includes('var COLLECTION="Estudiantes"')){problems.push("colección");}
    if(!content.includes("var MAX_READS=25")){problems.push("límite");}
    if(!content.includes("writesFirebase:false")){problems.push("writesFirebase");}
    if(!content.includes("createsOutbox:false")){problems.push("createsOutbox");}
    if(/batch\.commit|runTransaction|\.set\s*\(/.test(content)){problems.push("escritura remota");}
    problems.length?fail("Telegram seguro","Problemas: "+problems.join(", ")):pass("Telegram seguro","Lee Estudiantes con límite 25 y sin escritura remota ni cola.");
  }
}

function auditConnections(files){
  const index="BDLocal/conexiones/cone.index.js";
  const expected=["cone.carga.js","cone.tabla.js","cone.ficha.js","cone.stats.js","cone.coordi.js","cone.reportes.js","cone.defensas.js","cone.global.js"];
  if(!exists(index)){fail("Conectores","Falta cone.index.js.");return;}
  const source=read(index);
  const missing=expected.filter((name)=>!source.includes('"'+name+'"')||!files.has("BDLocal/conexiones/"+name));
  if(missing.length){fail("Conectores de pantallas","Faltan referencias o archivos: "+missing.join(", "));}
  else{pass("Conectores de pantallas",expected.length+" conectores declarados y presentes.");}

  if(source.includes('files.push("../bl2.sync.js")')){warn("Carga de compatibilidad","cone.index puede cargar BL2Sync; la fachada debe permanecer bloqueada y manual.");}
  if(!source.includes("state.errors")){warn("Errores de conectores","El registro de errores no es visible en cone.index.");}
  else{pass("Errores de conectores","Los fallos de carga se conservan en el estado de conexiones.");}
}

function auditHtml(files){
  const htmlFiles=[...files].filter((name)=>/\.html?$/i.test(name));
  let duplicateIdFiles=0;
  let duplicateRefFiles=0;
  let missingRefs=0;

  for(const name of htmlFiles){
    const full=path.join(root,name);
    const source=safeRead(full);
    const ids=[...source.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map((match)=>match[1]);
    const idCounts={};
    ids.forEach((value)=>{idCounts[value]=(idCounts[value]||0)+1;});
    const duplicates=Object.keys(idCounts).filter((value)=>idCounts[value]>1);
    if(duplicates.length){duplicateIdFiles+=1;warn("IDs HTML duplicados",name+": "+duplicates.slice(0,20).join(", "));}

    const scripts=[...source.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map((match)=>match[1]);
    const counts={};
    scripts.forEach((value)=>{counts[value]=(counts[value]||0)+1;});
    const repeated=Object.keys(counts).filter((value)=>counts[value]>1);
    if(repeated.length){duplicateRefFiles+=1;warn("Scripts repetidos",name+": "+repeated.join(", "));}

    const refs=[...source.matchAll(/<(?:script|link|iframe)\b[^>]*(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((match)=>match[1]);
    for(const ref of refs){
      if(!ref||/^(?:https?:|data:|mailto:|#|javascript:)/i.test(ref)||ref.includes("${")||ref.includes("node_modules/")){continue;}
      const withoutQuery=ref.split(/[?#]/)[0];
      if(!withoutQuery){continue;}
      const target=path.resolve(path.dirname(full),withoutQuery);
      if(!target.startsWith(root+path.sep)&&target!==root){warn("Ruta fuera de aplicación",name+" → "+ref);continue;}
      if(!fs.existsSync(target)){missingRefs+=1;warn("Referencia local ausente",name+" → "+ref);}
    }
  }

  if(!duplicateIdFiles){pass("IDs HTML","No se detectaron IDs estáticos repetidos.");}
  if(!duplicateRefFiles){pass("Scripts HTML","No se detectaron cargas duplicadas dentro del mismo HTML.");}
  if(!missingRefs){pass("Referencias HTML","No se detectaron recursos locales ausentes.");}
}

function auditXml(files){
  const xmlFiles=[...files].filter((name)=>/\.xml$/i.test(name));
  if(xmlFiles.length){warn("Archivos XML","Se encontraron: "+xmlFiles.join(", "));}
  else{pass("Archivos XML","No existen archivos XML en el repositorio.");}

  const offenders=[];
  for(const name of files){
    if(!isText(name)||path.resolve(root,name)===self){continue;}
    const source=safeRead(path.join(root,name));
    if(/responseXML|application\/xml|text\/xml|parseFromString\s*\([^)]*["'](?:application|text)\/xml/i.test(source)){offenders.push(name);}
  }
  if(offenders.length){warn("Procesamiento XML","Uso detectado en: "+offenders.join(", "));}
  else{pass("Procesamiento XML","No se detectaron parsers o respuestas XML.");}
}

function auditPathsAndDuplicates(allFiles,files){
  const caseMap={};
  for(const name of files){
    const key=name.toLowerCase();
    if(!caseMap[key]){caseMap[key]=[];}
    caseMap[key].push(name);
  }
  const collisions=Object.values(caseMap).filter((group)=>group.length>1);
  collisions.length?fail("Colisiones de rutas",collisions.map((group)=>group.join(" ↔ ")).join("; ")):pass("Colisiones de rutas","No existen rutas que solo difieran por mayúsculas/minúsculas.");

  const hashes={};
  for(const full of allFiles){
    const stat=fs.statSync(full);
    if(stat.size<256||stat.size>2*1024*1024){continue;}
    const digest=hash(fs.readFileSync(full));
    if(!hashes[digest]){hashes[digest]=[];}
    hashes[digest].push(relative(full));
  }
  const duplicates=Object.values(hashes).filter((group)=>group.length>1);
  if(duplicates.length){warn("Contenido exactamente duplicado",duplicates.slice(0,30).map((group)=>group.join(" = ")).join("; "),{groups:duplicates.length});}
  else{pass("Contenido duplicado","No se encontraron archivos idénticos de tamaño significativo.");}
}

function auditLegacyAndSecrets(files){
  const forbiddenFiles=["js/bdlocal-config/bdlocal-modal.js","BDLocal/migrations/bdl.migration.legacy-v2.ui.js"];
  const present=forbiddenFiles.filter((file)=>files.has(file));
  present.length?fail("Interfaces legacy activas","Deben retirarse: "+present.join(", ")):pass("Interfaces legacy","Las interfaces visuales antiguas duplicadas no están presentes.");

  const risky=[];
  const secretFiles=[];
  for(const name of files){
    if(!isText(name)||path.resolve(root,name)===self){continue;}
    const source=safeRead(path.join(root,name));
    if(/\beval\s*\(|\bnew\s+Function\s*\(/.test(source)){risky.push(name);}
    if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bservice_role\b\s*[:=]\s*["'][^"']+|\bclient_secret\b\s*[:=]\s*["'][^"']{8,}|\bsk_live_[A-Za-z0-9]+/.test(source)){secretFiles.push(name);}
  }
  risky.length?fail("Ejecución dinámica","eval/new Function en: "+risky.join(", ")):pass("Ejecución dinámica","No se detectaron eval ni new Function.");
  secretFiles.length?fail("Secretos incrustados","Posibles secretos en: "+secretFiles.join(", ")):pass("Secretos críticos","No se detectaron claves privadas, service-role o client_secret incrustados.");

  const store="js/bdlocal-config/bdlocal-config.store.js";
  if(exists(store)&&/\bbtoa\s*\(|\batob\s*\(/.test(read(store))){warn("Protección de secretos locales","Los valores se ofuscan con Base64; no equivale a cifrado del sistema operativo.");}
}

function auditExternalDependencies(files){
  const references=[];
  for(const name of files){
    if(!isText(name)){continue;}
    const source=safeRead(path.join(root,name));
    for(const match of source.matchAll(/https:\/\/[^\s"'<>`)]+/g)){
      const url=match[0];
      if(/firebaseio\.com|googleapis\.com|firebasestorage\.app|firebaseapp\.com|sisacad\.itsqmet\.edu\.ec/.test(url)){continue;}
      if(!references.some((item)=>item.file===name&&item.url===url)){references.push({file:name,url:url});}
    }
  }
  const executable=references.filter((item)=>/\.js(?:\?|$)|cdn\.|gstatic\.com\/firebasejs/.test(item.url));
  if(executable.length){warn("Código remoto fijado",executable.slice(0,30).map((item)=>item.file+" → "+item.url).join("; "));}
  else{pass("Código remoto","No se detectaron dependencias JavaScript remotas.");}
}

function main(){
  console.log("\n=== Auditoría integral del repositorio Requisitos ===");
  console.log("No abre Electron, IndexedDB, Firebase ni Google Sheets.\n");

  const allFiles=walk(root);
  const fileSet=new Set(allFiles.map(relative));

  auditPackage();
  auditElectron();
  auditSync();
  auditFirebaseAndIdentity();
  auditConnections(fileSet);
  auditHtml(fileSet);
  auditXml(fileSet);
  auditPathsAndDuplicates(allFiles,fileSet);
  auditLegacyAndSecrets(fileSet);
  auditExternalDependencies(fileSet);

  const icons={PASS:"[OK]   ",WARN:"[AVISO]",FAIL:"[FALLO]"};
  results.forEach((item)=>console.log(`${icons[item.level]} ${item.name} - ${item.detail}`));

  const summary={
    generatedAt:new Date().toISOString(),
    files:allFiles.length,
    passed:results.filter((item)=>item.level==="PASS").length,
    warnings:results.filter((item)=>item.level==="WARN").length,
    failed:results.filter((item)=>item.level==="FAIL").length
  };
  console.log(`\nResumen: ${summary.passed} correctos, ${summary.warnings} avisos, ${summary.failed} fallos.`);
  if(summary.failed){console.error("La auditoría encontró fallos críticos.");process.exit(1);}
  console.log(summary.warnings?"Auditoría aprobada con avisos que deben revisarse antes de distribuir.":"Auditoría aprobada sin avisos.");
}

main();
