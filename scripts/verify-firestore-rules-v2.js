"use strict";

const fs=require("node:fs");
const path=require("node:path");
const ROOT=path.resolve(__dirname,"..");
const errors=[];

function check(value,message){if(!value){errors.push(message);}}

let firebase={};
let rules="";
try{firebase=JSON.parse(fs.readFileSync(path.join(ROOT,"firebase.json"),"utf8"));}
catch(error){errors.push("firebase.json no es válido: "+error.message);}
try{rules=fs.readFileSync(path.join(ROOT,"firestore.rules"),"utf8");}
catch(error){errors.push("No se pudo leer firestore.rules: "+error.message);}

check(firebase.firestore&&firebase.firestore.rules==="firestore.rules","firebase.json debe declarar firestore.rules");
check(firebase.firestore&&firebase.firestore.indexes==="firestore.indexes.json","firebase.json debe conservar firestore.indexes.json");
check(/rules_version\s*=\s*['"]2['"]/.test(rules),"Las reglas deben usar rules_version 2");
check(/function\s+validStudentPeriodDocument\s*\(/.test(rules),"Debe validarse la identidad período-cédula");
check(/allow\s+delete\s*:\s*if\s+false/.test(rules),"Las colecciones oficiales deben impedir eliminaciones físicas");
check(/match\s+\/\{document=\*\*\}\s*\{[\s\S]*allow\s+read\s*,\s*write\s*:\s*if\s+false/.test(rules),"Las colecciones no declaradas deben quedar bloqueadas");

[
  "estudiantes","matriculas","requisitos","notas",
  "periodos","carreras","importaciones","historial"
].forEach((collection)=>{
  check(new RegExp("match\\s+\\/"+collection+"\\/").test(rules),"Falta la regla para "+collection);
});

check(!/match\s+\/Estudiantes\//.test(rules),"Las reglas no deben reactivar Estudiantes legacy");
check(!/match\s+\/EstudiantesPeriodo\//.test(rules),"Las reglas no deben reactivar EstudiantesPeriodo legacy");

if(errors.length){
  console.error("\nVERIFICACIÓN REGLAS FIRESTORE V2: ERROR\n");
  errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
  process.exit(1);
}

console.log("VERIFICACIÓN REGLAS FIRESTORE V2: OK");
