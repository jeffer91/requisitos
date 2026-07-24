"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const errors=[];
function read(file){return fs.readFileSync(path.join(ROOT,file),"utf8");}
function check(value,message){if(!value){errors.push(message);}}
function syntax(file){try{new vm.Script(read(file),{filename:file});}catch(error){errors.push(`${file}: ${error.message}`);}}

const connectorFile="BDLocal/conexiones/cone.defart.js";
const bridgeFile="defart/defart.save-service-bridge.js";
const bootstrapFile="defart/defart.bootstrap.js";
[connectorFile,bridgeFile,bootstrapFile].forEach(syntax);

const connector=read(connectorFile);
const bootstrap=read(bootstrapFile);
check(connector.includes('return {periodoId:periodoId,cedula:cedula,localId:cedula&&periodoId?cedula+"__"+periodoId'),"ConDefart debe construir la clave local cédula__período");
check(connector.includes('tabla:"notas_titulacion"'),"ConDefart debe crear cambios específicos de notas");
check(connector.includes('tabla:"historial"'),"ConDefart debe crear cambios de historial");
check(connector.includes('estadoSheets:"SINCRONIZADO"'),"Defart no debe crear pendientes para Sheets");
check(connector.includes('estadoSupabase:"SINCRONIZADO"'),"Defart no debe crear pendientes para Supabase");
check(connector.includes('estadoFirebase:"PENDIENTE"'),"Defart debe crear pendientes para Firebase");
check(!bootstrap.includes("defart.persistence.js"),"Defart no debe cargar el mirror antiguo duplicado");

const calls=[];
const sandbox={
  console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Set,
  CustomEvent:function(type,options){this.type=type;this.detail=options&&options.detail||{};},
  dispatchEvent(){},
  DefartCore:{saveNotes(){return Promise.resolve(true);}},
  DefartApp:{getState(){return {data:{rows:[{
    idEstudiantePeriodo:"2026-04__2026-09__1723456789",
    periodoId:"2026-04__2026-09",cedula:"1723456789",Notart:8.5,Notdef:8
  }]}};}},
  ConDefart:{save(note,options){calls.push({note:{...note},options:{...options}});return Promise.resolve(note);}}
};
sandbox.window=sandbox;
const context=vm.createContext(sandbox);
new vm.Script(read(bridgeFile),{filename:bridgeFile}).runInContext(context);

(async()=>{
  const note=sandbox.DefartSaveServiceBridge.notaFromChange({id:"2026-04__2026-09__1723456789",ndef:9});
  check(note.idEstudiantePeriodo==="1723456789__2026-04__2026-09","El puente debe convertir un ID remoto/legacy a la clave local");
  check(note.Notart===8.5&&note.Notdef===9&&note.Notafinal===8.65,"El puente debe calcular correctamente la nota final 70/30");
  const result=await sandbox.DefartSaveServiceBridge.saveDirect([{id:"2026-04__2026-09__1723456789",ndef:9}]);
  check(result.ok===true&&calls.length===1,"Defart debe esperar y confirmar el guardado mediante ConDefart");
  check(calls[0].options.enqueue===true,"Defart debe solicitar la creación del cambio Firebase");

  if(errors.length){
    console.error("\nVERIFICACIÓN DEFART V2: ERROR\n");
    errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
    process.exit(1);
  }
  console.log("VERIFICACIÓN DEFART V2: OK");
})().catch((error)=>{
  console.error("VERIFICACIÓN DEFART V2: ERROR",error);
  process.exit(1);
});
