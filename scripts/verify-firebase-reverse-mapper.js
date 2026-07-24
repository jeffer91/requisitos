"use strict";

/* Verifica la conversión Firebase V2 → IndexedDB sin escribir datos reales. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname,"..");
const errors = [];

function load(relative,context){
  const target = path.join(ROOT,relative);
  if(!fs.existsSync(target)){ throw new Error(`Falta ${relative}`); }
  new vm.Script(fs.readFileSync(target,"utf8"),{ filename:relative }).runInContext(context);
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
load("BDLocal/firebase/bdl.firebase.reverse-mapper.v2.js",context);

const mapper = sandbox.RequisitosFirebaseReverseMapper;
check(mapper && typeof mapper.toLocal === "function","No se expuso RequisitosFirebaseReverseMapper.toLocal");

const remoteId = "2026-04__2026-09__1723456789";
const common = {
  id:remoteId,
  periodoId:"2026-04__2026-09",
  cedula:"1723456789",
  createdAt:"2026-07-23T12:00:00.000Z",
  updatedAt:"2026-07-23T12:00:00.000Z",
  version:1,
  dataHash:"h12345678",
  eliminado:false,
  eliminadoEn:""
};

const person = mapper.toLocal("estudiantes",{
  id:"1723456789",
  cedula:"1723456789",
  nombres:"ESTUDIANTE PRUEBA",
  correoPersonal:"prueba@example.com",
  createdAt:common.createdAt,
  updatedAt:common.updatedAt,
  version:1,
  dataHash:"h12345678",
  eliminado:false,
  eliminadoEn:""
},{ documentId:"1723456789" });
check(person.ok,"No convirtió estudiantes");
check(person.records[0].store==="personas","estudiantes debe convertirse a personas");
check(person.records[0].row.id==="1723456789","La persona debe usar la cédula como ID local");

const enrollment = mapper.toLocal("matriculas",{
  ...common,
  nombreCarrera:"ENFERMERÍA",
  codigoCarrera:"ENF",
  division:"A",
  estadoMatricula:"ACTIVO",
  retirado:false
},{ documentId:remoteId });
check(enrollment.ok,"No convirtió matriculas");
check(enrollment.records[0].store==="matriculas_periodo","matriculas debe ir a matriculas_periodo");
check(enrollment.records[0].row.id==="1723456789__2026-04__2026-09","La matrícula no usó el ID local cedula__periodo");

const requirements = mapper.toLocal("requisitos",{
  ...common,
  valores:{ Academico:"CUMPLE",Financiero:"PENDIENTE" },
  observaciones:"Revisión"
},{ documentId:remoteId });
check(requirements.ok,"No convirtió requisitos");
check(requirements.records.length===2,"El documento de requisitos debe expandirse en dos filas locales");
check(requirements.records.every(item=>item.store==="requisitos_estudiante"),"Los requisitos no apuntan a requisitos_estudiante");
check(requirements.records.some(item=>item.row.id==="1723456789__2026-04__2026-09__academico"),"No creó el ID local del requisito Académico");

const notes = mapper.toLocal("notas",{
  ...common,
  modalidadTitulacion:"TRABAJO_TITULACION",
  notaEscrito:8.5,
  notaDefensaTrabajo:9,
  notaTrabajoTitulacion:8.7
},{ documentId:remoteId });
check(notes.ok,"No convirtió notas");
check(notes.records[0].store==="notas_titulacion","notas debe ir a notas_titulacion");
check(notes.records[0].row.idEstudiantePeriodo==="1723456789__2026-04__2026-09","Las notas no conservaron la identidad local");
check(notes.records[0].row._skipOutbox===true,"Una descarga Firebase no debe crear un nuevo cambio pendiente");

const invalid = mapper.toLocal("requisitos",{
  ...common,
  valores:"incorrecto"
},{ documentId:remoteId });
check(!invalid.ok && invalid.records.length===0,"Un documento remoto inválido no debe producir filas locales");

const many = mapper.toLocalMany("requisitos",[
  { documentId:remoteId,data:{ ...common,valores:{ Academico:"CUMPLE" } } },
  { documentId:remoteId,data:{ ...common,valores:{ Financiero:"CUMPLE" } } }
]);
check(many.ok && many.converted===2,"toLocalMany no convirtió el lote válido");
check(many.stores.requisitos_estudiante.length===2,"toLocalMany no agrupó las filas por store");

if(errors.length){
  console.error("\nVERIFICACIÓN FIREBASE REVERSE MAPPER: ERROR\n");
  errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
  process.exit(1);
}

console.log("VERIFICACIÓN FIREBASE REVERSE MAPPER: OK");
