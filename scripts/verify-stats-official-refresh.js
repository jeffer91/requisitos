"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const childProcess=require("node:child_process");
const ROOT=path.resolve(__dirname,"..");
const errors=[];
function read(file){return fs.readFileSync(path.join(ROOT,file),"utf8");}
function check(value,message){if(!value){errors.push(message);}}
function syntax(file){try{new vm.Script(read(file),{filename:file});}catch(error){errors.push(`${file}: ${error.message}`);}}

const connectorFile="BDLocal/conexiones/cone.stats.firebase.js";
const centerFile="BDLocal/firebase/bdl.firebase.operation-center.js";
const screenFile="Stats/stats.telegram.firebase-sync.js";
const htmlFile="Stats/stats.html";
const bootstrapFile="Stats/stats.bootstrap.js";
[connectorFile,centerFile,screenFile,bootstrapFile].forEach(syntax);

const connector=read(connectorFile);
const center=read(centerFile);
const screen=read(screenFile);
const html=read(htmlFile);
const bootstrap=read(bootstrapFile);

check(connector.includes("current.refreshTelegram"),"ConStats debe solicitar únicamente Telegram al Centro de Operaciones Firebase");
check(connector.includes("telegramOnly:true"),"ConStats debe declarar que la operación está limitada a Telegram");
check(connector.includes("api.refreshTelegramFromOfficial"),"ConStats debe exponer refreshTelegramFromOfficial");
check(!connector.includes('pullEntity("estudiantes"'),"ConStats no debe aplicar documentos completos de estudiantes");
check(center.includes("function telegramPatch"),"El Centro de Operaciones debe aplicar un parche específico de Telegram");
check(center.includes("personasRepo().getByCedula"),"Telegram debe combinarse con la persona local existente");
check(center.includes("personasRepo().save(patch.row)"),"Telegram debe guardarse mediante el repositorio de personas");
check(bootstrap.includes("cone.stats.firebase.js"),"Stats debe cargar la extensión oficial dentro del conector");
check(html.includes("bdl.firebase.operation-center.js"),"Stats debe cargar el Centro de Operaciones Firebase");
check(screen.includes("con.refreshTelegramFromOfficial"),"La pantalla debe usar únicamente ConStats");
check(screen.includes("directFirebase:false"),"La pantalla debe declarar que no usa Firebase directamente");
check(screen.includes("telegramOnly:true"),"La pantalla debe declarar que solo actualiza Telegram");
[
  "firebase.firestore","firestore.collection","BL2Sync","BDLRepo","BL2DB","indexedDB.open(",
  "RequisitosFirebaseSyncEngine","Estudiantes/{","COLLECTION="
].forEach((token)=>check(!screen.includes(token),`La pantalla Stats no debe contener acceso directo: ${token}`));
check(!connector.includes("setInterval("),"El conector de Stats no debe ejecutar sincronización automática");
check(!screen.includes("setInterval("),"La pantalla Stats no debe actualizar Firebase automáticamente");

if(errors.length){
  console.error("\nVERIFICACIÓN STATS / TELEGRAM: ERROR\n");
  errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
  process.exit(1);
}

childProcess.execFileSync(process.execPath,[path.join(__dirname,"verify-firebase-operation-center.js")],{stdio:"inherit"});
console.log("VERIFICACIÓN STATS / TELEGRAM: OK");
