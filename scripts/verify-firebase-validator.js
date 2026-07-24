"use strict";

/* Verifica el validador del contrato Firebase V2 sin usar datos reales. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname,"..");
const errors = [];

function load(relative,context){
  const target = path.join(ROOT,relative);
  if(!fs.existsSync(target)){ throw new Error(`Falta ${relative}`); }
  const source = fs.readFileSync(target,"utf8");
  new vm.Script(source,{ filename:relative }).runInContext(context);
}

function check(condition,message){
  if(!condition){ errors.push(message); }
}

const sandbox = {
  console,
  Date,
  Math,
  JSON,
  Number,
  Object,
  Array,
  String,
  Boolean,
  RegExp,
  setTimeout,
  clearTimeout,
  CustomEvent:function(name,options){ this.type=name;this.detail=options&&options.detail; }
};
sandbox.window = sandbox;
sandbox.dispatchEvent = function(){};
const context = vm.createContext(sandbox);

load("BDLocal/firebase/bdl.firebase.schema.v2.js",context);
load("BDLocal/firebase/bdl.firebase.identity.js",context);
load("BDLocal/firebase/bdl.firebase.validator.v2.js",context);

const validator = sandbox.RequisitosFirebaseValidator;
check(validator && typeof validator.validate === "function","No se expuso RequisitosFirebaseValidator.validate");

const base = {
  id:"2026-04__2026-09__1723456789",
  periodoId:"2026-04__2026-09",
  cedula:"1723456789",
  createdAt:"2026-07-23T12:00:00.000Z",
  updatedAt:"2026-07-23T12:00:00.000Z",
  version:1,
  dataHash:"h12345678",
  eliminado:false,
  eliminadoEn:""
};

const validRequirement = validator.validate("requisitos",{
  ...base,
  valores:{ Academico:"CUMPLE",Financiero:"PENDIENTE" },
  observaciones:""
},{ documentId:base.id });
check(validRequirement.ok,"Un documento requisitos correcto fue rechazado");

const wrongId = validator.validate("matriculas",{
  ...base,
  estadoMatricula:"ACTIVO",
  retirado:false
},{ documentId:"1723456789__2026-04__2026-09" });
check(!wrongId.ok,"El validador aceptó un ID remoto con orden local");

const invalidNote = validator.validate("notas",{
  ...base,
  notaFinal:12
},{ documentId:base.id });
check(!invalidNote.ok,"El validador aceptó una nota superior a 10");

const invalidDelete = validator.validate("estudiantes",{
  id:"1723456789",
  cedula:"1723456789",
  createdAt:"2026-07-23T12:00:00.000Z",
  updatedAt:"2026-07-23T12:00:00.000Z",
  version:1,
  dataHash:"h12345678",
  eliminado:true,
  eliminadoEn:""
},{ documentId:"1723456789" });
check(!invalidDelete.ok,"El validador aceptó borrado lógico sin eliminadoEn");

const unknown = validator.validate("estudiantes",{
  id:"1723456789",
  cedula:"1723456789",
  nombres:"Prueba",
  createdAt:"2026-07-23T12:00:00.000Z",
  updatedAt:"2026-07-23T12:00:00.000Z",
  version:1,
  dataHash:"h12345678",
  eliminado:false,
  campoInventado:"x"
},{ documentId:"1723456789" });
check(unknown.ok,"Un campo desconocido debe advertir, no invalidar automáticamente");
check(unknown.unknownFields.includes("campoInventado"),"No se detectó el campo desconocido");

const batch = validator.validateMany("requisitos",[
  { documentId:base.id,data:{ ...base,valores:{ Academico:"CUMPLE" } } },
  { documentId:base.id,data:{ ...base,valores:"incorrecto" } }
]);
check(batch.total===2 && batch.valid===1 && batch.invalid===1,"validateMany no contó válidos e inválidos correctamente");

if(errors.length){
  console.error("\nVERIFICACIÓN FIREBASE VALIDATOR: ERROR\n");
  errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
  process.exit(1);
}

console.log("VERIFICACIÓN FIREBASE VALIDATOR: OK");
