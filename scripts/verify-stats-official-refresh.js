"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const errors=[];
function read(file){return fs.readFileSync(path.join(ROOT,file),"utf8");}
function check(value,message){if(!value){errors.push(message);}}
function syntax(file){try{new vm.Script(read(file),{filename:file});}catch(error){errors.push(`${file}: ${error.message}`);}}

const connectorFile="BDLocal/conexiones/cone.stats.firebase.js";
const screenFile="Stats/stats.telegram.firebase-sync.js";
const bootstrapFile="Stats/stats.bootstrap.js";
[connectorFile,screenFile,bootstrapFile].forEach(syntax);

const connector=read(connectorFile);
const screen=read(screenFile);
const bootstrap=read(bootstrapFile);

check(connector.includes('current.pullEntity("estudiantes"'),"ConStats debe solicitar estudiantes al motor central");
check(connector.includes("manual:true"),"La actualización oficial de Stats debe ser manual");
check(connector.includes("api.refreshTelegramFromOfficial"),"ConStats debe exponer refreshTelegramFromOfficial");
check(bootstrap.includes("cone.stats.firebase.js"),"Stats debe cargar la extensión oficial dentro del conector");
check(screen.includes("con.refreshTelegramFromOfficial"),"La pantalla debe usar únicamente ConStats");
check(screen.includes("directFirebase:false"),"La pantalla debe declarar que no usa Firebase directamente");
[
  "firebase.firestore","firestore.collection","BL2Sync","BDLRepo","BL2DB","indexedDB.open(",
  "RequisitosFirebaseSyncEngine","Estudiantes/{","COLLECTION="
].forEach((token)=>check(!screen.includes(token),`La pantalla Stats no debe contener acceso directo: ${token}`));
check(!connector.includes("setInterval("),"El conector de Stats no debe ejecutar sincronización automática");

if(errors.length){
  console.error("\nVERIFICACIÓN STATS OFICIAL: ERROR\n");
  errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
  process.exit(1);
}
console.log("VERIFICACIÓN STATS OFICIAL: OK");
