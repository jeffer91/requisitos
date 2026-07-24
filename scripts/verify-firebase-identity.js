"use strict";

/* =========================================================
Archivo: verify-firebase-identity.js
Ruta: /scripts/verify-firebase-identity.js
Función:
- Ejecutar el esquema y el adaptador de identidad Firebase.
- Validar conversiones local ↔ remota.
- Confirmar IDs por entidad sin depender de las pantallas.
========================================================= */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname,"..");
const files = [
  "BDLocal/firebase/bdl.firebase.schema.v2.js",
  "BDLocal/firebase/bdl.firebase.identity.js"
];
const errors = [];
const checks = [];

function check(condition,message){
  checks.push({ ok:Boolean(condition),message });
  if(!condition){ errors.push(message); }
}

function equal(actual,expected,message){
  check(actual === expected,`${message}. Esperado: ${expected}; recibido: ${actual}`);
}

files.forEach((relative) => {
  if(!fs.existsSync(path.join(ROOT,relative))){
    errors.push(`Falta el archivo: ${relative}`);
  }
});

if(!errors.length){
  const events = [];
  const window = {
    BL2Config:{
      utils:{
        normalizeCedula(value){ return String(value == null ? "" : value).replace(/[^0-9A-Za-z]/g,""); },
        canonicalPeriodId(value){
          value = String(value == null ? "" : value).trim();
          const match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
          return match ? `${match[1]}-${match[2]}__${match[3]}-${match[4]}` : value.replace(/_+/g,"__");
        }
      }
    },
    dispatchEvent(event){ events.push(event); }
  };

  function CustomEvent(name,options){
    this.type = name;
    this.detail = options && options.detail || {};
  }

  const context = vm.createContext({ window,CustomEvent,console,Date,JSON,Object,String,Array });

  try{
    files.forEach((relative) => {
      const source = fs.readFileSync(path.join(ROOT,relative),"utf8");
      new vm.Script(source,{ filename:relative }).runInContext(context);
    });
  }catch(error){
    errors.push(`No se pudo ejecutar el adaptador de identidad: ${error.message}`);
  }

  const identity = window.RequisitosFirebaseIdentity;

  if(identity){
    const cedula = "1723456789";
    const periodoId = "2026-04__2026-09";
    const localId = `${cedula}__${periodoId}`;
    const remoteId = `${periodoId}__${cedula}`;

    equal(identity.makeLocalStudentPeriodId(cedula,periodoId),localId,"ID local estudiante-período");
    equal(identity.makeRemoteStudentPeriodId(periodoId,cedula),remoteId,"ID remoto estudiante-período");
    equal(identity.convertLocalToRemote(localId),remoteId,"Conversión local a remota");
    equal(identity.convertRemoteToLocal(remoteId),localId,"Conversión remota a local");

    const parsedLocal = identity.parseLocalStudentPeriodId(localId);
    check(parsedLocal.ok === true,"El ID local debe analizarse correctamente");
    equal(parsedLocal.cedula,cedula,"Cédula extraída del ID local");
    equal(parsedLocal.periodoId,periodoId,"Período extraído del ID local");

    const parsedRemote = identity.parseRemoteStudentPeriodId(remoteId);
    check(parsedRemote.ok === true,"El ID remoto debe analizarse correctamente");
    equal(parsedRemote.cedula,cedula,"Cédula extraída del ID remoto");
    equal(parsedRemote.periodoId,periodoId,"Período extraído del ID remoto");

    const row = {
      numeroIdentificacion:cedula,
      periodoCanonicoId:periodoId,
      CodigoCarrera:"ENF"
    };

    const fromRow = identity.identityFromRow(row);
    equal(fromRow.localId,localId,"Identidad local formada desde una fila");
    equal(fromRow.remoteId,remoteId,"Identidad remota formada desde una fila");
    equal(identity.entityDocumentId("estudiantes",row),cedula,"Documento remoto de estudiantes");
    equal(identity.entityDocumentId("matriculas",row),remoteId,"Documento remoto de matrículas");
    equal(identity.entityDocumentId("requisitos",row),remoteId,"Documento remoto de requisitos");
    equal(identity.entityDocumentId("notas",row),remoteId,"Documento remoto de notas");
    equal(identity.entityLocalId("matriculas",row),localId,"Registro local de matrículas");

    check(
      events.some((event) => event.type === "requisitos:firebase-identity-ready"),
      "El adaptador debe emitir su evento de disponibilidad"
    );
  }else{
    errors.push("RequisitosFirebaseIdentity no quedó disponible.");
  }
}

if(errors.length){
  console.error("\nVERIFICACIÓN DE IDENTIDAD FIREBASE: ERROR\n");
  errors.forEach((error,index) => console.error(`${index + 1}. ${error}`));
  process.exit(1);
}

console.log(`VERIFICACIÓN DE IDENTIDAD FIREBASE: OK (${checks.length} comprobaciones)`);
