"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const errors=[];
function read(file){return fs.readFileSync(path.join(ROOT,file),"utf8");}
function check(value,message){if(!value){errors.push(message);}}
function syntax(file){try{new vm.Script(read(file),{filename:file});}catch(error){errors.push(`${file}: ${error.message}`);}}

const files=[
  "BDLocal/conexiones/cone.crdef.js",
  "BDLocal/conexiones/cone.inpvc.js",
  "Cr-def/cr-def.data.js"
];
files.forEach(syntax);

const cr=read(files[0]);
const pvc=read(files[1]);
check(cr.includes("canWrite:false"),"Cr-def debe registrarse como solo lectura");
check(pvc.includes("canWrite:false"),"InPVC debe registrarse como solo lectura");
check(cr.includes("readOnly:true"),"Cr-def debe declarar readOnly en su respuesta");
check(pvc.includes("readOnly:true"),"InPVC debe declarar readOnly en su estado o respuesta");

const forbidden=[
  "firebase.firestore","firestore.collection","RequisitosFirebaseRepository",
  "RequisitosFirebaseSyncEngine","BL2DB.put","BL2DB.bulkPut","indexedDB.open(",
  "save:","update:","delete:","remove:"
];
for(const [name,source] of [["Cr-def",cr],["InPVC",pvc]]){
  forbidden.forEach((token)=>check(!source.includes(token),`${name} no debe contener ruta de escritura: ${token}`));
}

check(cr.includes("operations:[\"ready\",\"read\",\"refresh\",\"status\",\"diagnose\"]"),"Cr-def debe publicar solo operaciones de lectura");
check(pvc.includes("operations:[\"ready\",\"read\",\"refresh\",\"status\",\"diagnose\"]"),"InPVC debe publicar solo operaciones de lectura");

if(errors.length){
  console.error("\nVERIFICACIÓN DE PANTALLAS SOLO LECTURA: ERROR\n");
  errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
  process.exit(1);
}
console.log("VERIFICACIÓN DE PANTALLAS SOLO LECTURA: OK");
