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
check(/function\s+validIdentification\s*\(/.test(rules),"Debe validarse la identificación normalizada");
check(/value\.matches\('\^\[0-9A-Za-z\]\{6,20\}\$'\)/.test(rules),"Las reglas deben aceptar cédulas y documentos extranjeros alfanuméricos");
check(!/\^\[0-9\]\{10\}\$/.test(rules),"Las reglas no deben limitar toda identificación a diez dígitos");
check(/function\s+validStudentPeriodDocument\s*\(/.test(rules),"Debe validarse la identidad período-identificación");
check(/allow\s+delete\s*:\s*if\s+false/.test(rules),"Las colecciones oficiales deben impedir eliminaciones físicas");
check(/match\s+\/\{document=\*\*\}\s*\{[\s\S]*allow\s+read\s*,\s*write\s*:\s*if\s+false/.test(rules),"Las colecciones no declaradas deben quedar bloqueadas");

[
  "Estudiante","matriculas","requisitos","notas",
  "periodos","carreras","importaciones","historial"
].forEach((collection)=>{
  check(new RegExp("match\\s+\\/"+collection+"\\/").test(rules),"Falta la regla para "+collection);
});

check(!/match\s+\/estudiantes\//.test(rules),"Las reglas no deben crear una colección paralela estudiantes");
check(!/match\s+\/Estudiantes\//.test(rules),"Las reglas no deben reactivar Estudiantes legacy");
check(!/match\s+\/EstudiantesPeriodo\//.test(rules),"Las reglas no deben reactivar EstudiantesPeriodo legacy");

if(errors.length){
  console.error("\nVERIFICACIÓN REGLAS FIRESTORE V2: ERROR\n");
  errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
  process.exit(1);
}

if(/allow\s+read\s*:\s*if\s+true/.test(rules)){
  console.warn("[AVISO] firestore.rules conserva acceso público porque la aplicación todavía no implementa Firebase Auth. No despliegue estas reglas en producción sin configurar autenticación.");
}

console.log("VERIFICACIÓN REGLAS FIRESTORE V2: OK");
