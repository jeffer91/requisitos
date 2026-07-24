"use strict";

/* =========================================================
Archivo: verify-firebase-contract.js
Ruta: /scripts/verify-firebase-contract.js
Función:
- Ejecutar el contrato Firebase V2 en un entorno aislado.
- Validar colecciones, responsabilidades e identificadores.
- Impedir que se mezclen las claves locales y remotas.
- Confirmar que la migración siga siendo no destructiva.
========================================================= */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname,"..");
const SCHEMA_FILE = path.join(ROOT,"BDLocal/firebase/bdl.firebase.schema.v2.js");
const errors = [];
const checks = [];

function check(condition,message){
  checks.push({ ok:Boolean(condition),message });
  if(!condition){ errors.push(message); }
}

function equal(actual,expected,message){
  check(actual === expected,`${message}. Esperado: ${expected}; recibido: ${actual}`);
}

function executeSchema(){
  const source = fs.readFileSync(SCHEMA_FILE,"utf8");
  const events = [];
  const window = {
    BL2Config:{},
    dispatchEvent(event){ events.push(event); }
  };

  function CustomEvent(name,options){
    this.type = name;
    this.detail = options && options.detail || {};
  }

  const context = vm.createContext({ window,CustomEvent,console,Date,JSON,Object,String });
  new vm.Script(source,{ filename:"BDLocal/firebase/bdl.firebase.schema.v2.js" }).runInContext(context);
  return { schema:window.RequisitosFirebaseSchema,config:window.BL2Config,events };
}

if(!fs.existsSync(SCHEMA_FILE)){
  errors.push("No existe BDLocal/firebase/bdl.firebase.schema.v2.js");
}else{
  let result;
  try{
    result = executeSchema();
  }catch(error){
    errors.push(`El contrato Firebase no se puede ejecutar: ${error.message}`);
  }

  if(result){
    const schema = result.schema || {};
    const collections = schema.collections || {};
    const remoteIds = schema.documentIds || {};
    const localIds = schema.localIds || {};
    const ownership = schema.ownership || {};
    const sync = schema.synchronization || {};
    const migration = schema.migration || {};

    equal(schema.sourceOfTruth,"firebase","Firebase debe ser la fuente oficial");
    equal(schema.localRole,"cache","BDLocal debe ser la caché operativa");
    equal(schema.googleRole,"export","Google Sheets debe quedar para exportación");

    [
      "estudiantes","matriculas","requisitos","notas",
      "periodos","carreras","historial","importaciones"
    ].forEach((name) => {
      equal(collections[name],name,`Nombre oficial de la colección ${name}`);
      check(Boolean(ownership[name]),`Debe existir la responsabilidad de ${name}`);
      check(Array.isArray(ownership[name] && ownership[name].fields),`Debe existir la lista de campos de ${name}`);
    });

    equal(remoteIds.estudiantes,"cedula","ID remoto de estudiantes");
    equal(remoteIds.matriculas,"periodoId__cedula","ID remoto de matrículas");
    equal(remoteIds.requisitos,"periodoId__cedula","ID remoto de requisitos");
    equal(remoteIds.notas,"periodoId__cedula","ID remoto de notas");

    equal(localIds.estudiantes,"cedula","ID local de estudiantes");
    equal(localIds.matriculas,"cedula__periodoId","ID local de matrículas");
    equal(localIds.requisitos,"cedula__periodoId","ID local de requisitos");
    equal(localIds.notas,"cedula__periodoId","ID local de notas");

    equal(
      schema.makeLocalStudentPeriodId("1723456789","2026-04__2026-09"),
      "1723456789__2026-04__2026-09",
      "Constructor de identidad local"
    );
    equal(
      schema.makeRemoteStudentPeriodId("2026-04__2026-09","1723456789"),
      "2026-04__2026-09__1723456789",
      "Constructor de identidad remota"
    );

    check(sync.initialDownload === "global","La primera descarga debe ser global");
    check(sync.incrementalDownload === true,"Las descargas posteriores deben ser incrementales");
    check(sync.uploadOnlyChanges === true,"Solo deben subirse cambios reales");
    check(sync.compareByHash === true,"La sincronización debe poder comparar hashes");
    check(sync.softDelete === true,"Los borrados deben ser lógicos durante la sincronización");
    check(sync.directScreenAccess === false,"Las pantallas no deben consultar Firebase directamente");
    equal(sync.screenReadsFrom,"indexeddb","Origen de lectura de las pantallas");
    equal(sync.screenWritesTo,"indexeddb_then_outbox","Destino inicial de las escrituras de pantalla");

    check(migration.destructive === false,"La migración no puede ser destructiva");
    check(migration.deleteLegacyCollections === false,"Todavía no se pueden borrar colecciones antiguas");
    check(migration.requireBackupBeforeDataMove === true,"Debe exigirse respaldo antes de mover datos");
    check(migration.requireCountComparison === true,"Debe compararse el número de documentos antes y después");
    check(migration.requireScreenValidation === true,"Deben validarse las pantallas antes de limpiar Firebase");

    check(
      result.config && result.config.firebase && result.config.firebase.schemaV2,
      "El contrato debe incorporarse a BL2Config.firebase"
    );
    check(
      result.events.some((event) => event.type === "requisitos:firebase-schema-v2-ready"),
      "El contrato debe emitir su evento de disponibilidad"
    );
  }
}

if(errors.length){
  console.error("\nVERIFICACIÓN DEL CONTRATO FIREBASE: ERROR\n");
  errors.forEach((error,index) => console.error(`${index + 1}. ${error}`));
  process.exit(1);
}

console.log(`VERIFICACIÓN DEL CONTRATO FIREBASE: OK (${checks.length} comprobaciones)`);
