"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const errors=[];
function read(file){return fs.readFileSync(path.join(ROOT,file),"utf8");}
function check(value,message){if(!value){errors.push(message);}}
function syntax(file){try{new vm.Script(read(file),{filename:file});}catch(error){errors.push(`${file}: ${error.message}`);}}

const files=["BDLocal/conexiones/cone.crdef.js","BDLocal/conexiones/cone.inpvc.js","Cr-def/cr-def.data.js"];
files.forEach(syntax);
const cr=read(files[0]),pvc=read(files[1]);
check(cr.includes("canWrite:true"),"Cr-def debe poder persistir únicamente cronogramas de defensas.");
check(cr.includes("saveSchedules"),"Cr-def debe exponer guardado de cronogramas.");
check(cr.includes("cronograma_defensas"),"Cr-def debe limitar su escritura a cronograma_defensas.");
check(pvc.includes("canWrite:false"),"InPVC debe registrarse como solo lectura");
check(pvc.includes("readOnly:true"),"InPVC debe declarar readOnly en su estado o respuesta");
const forbiddenPvc=["firebase.firestore","firestore.collection","RequisitosFirebaseRepository","RequisitosFirebaseSyncEngine","BL2DB.put","BL2DB.bulkPut","indexedDB.open(","save:","update:","delete:","remove:"];
forbiddenPvc.forEach((token)=>check(!pvc.includes(token),`InPVC no debe contener ruta de escritura: ${token}`));
const forbiddenCr=["firebase.firestore","firestore.collection","RequisitosFirebaseRepository","RequisitosFirebaseSyncEngine","BL2DB.put","BL2DB.bulkPut","indexedDB.open("];
forbiddenCr.forEach((token)=>check(!cr.includes(token),`Cr-def no debe escribir directamente ni saltarse repositorios: ${token}`));
check(pvc.includes('operations:["ready","read","refresh","status","diagnose"]'),"InPVC debe publicar solo operaciones de lectura");
if(errors.length){console.error("\nVERIFICACIÓN DE ESCRITURA ACOTADA: ERROR\n");errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));process.exit(1);}
console.log("VERIFICACIÓN DE ESCRITURA ACOTADA: OK");
