"use strict";

/* =========================================================
Archivo: verify-firebase-mapper.js
Ruta: /scripts/verify-firebase-mapper.js
Función:
- Ejecutar esquema, identidad y mapeador en un entorno aislado.
- Confirmar la separación de estudiante, matrícula, requisitos y notas.
- Confirmar que los hashes sean repetibles con la misma información.
========================================================= */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname,"..");
const files = [
  "BDLocal/firebase/bdl.firebase.schema.v2.js",
  "BDLocal/firebase/bdl.firebase.identity.js",
  "BDLocal/firebase/bdl.firebase.mapper.v2.js"
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
      fields:{
        requirements:[
          "Academico","Documentacion","Financiero","Titulacion",
          "PracticasVinculacion","Vinculacion","SeguimientoGraduados","Ingles",
          "ActualizacionDatos","AprobacionTitulacion","AprobacionComplexivoProyecto"
        ]
      },
      utils:{
        normalizeCedula(value){ return String(value == null ? "" : value).replace(/[^0-9A-Za-z]/g,""); },
        canonicalPeriodId(value){
          value = String(value == null ? "" : value).trim();
          const match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
          return match ? `${match[1]}-${match[2]}__${match[3]}-${match[4]}` : value.replace(/_+/g,"__");
        },
        normalizeKey(value){
          return String(value == null ? "" : value)
            .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
            .toLowerCase().replace(/[^a-z0-9]+/g,"");
        }
      }
    },
    dispatchEvent(event){ events.push(event); }
  };

  function CustomEvent(name,options){
    this.type = name;
    this.detail = options && options.detail || {};
  }

  const context = vm.createContext({
    window,CustomEvent,console,Date,JSON,Object,String,Array,Number,Math
  });

  try{
    files.forEach((relative) => {
      const source = fs.readFileSync(path.join(ROOT,relative),"utf8");
      new vm.Script(source,{ filename:relative }).runInContext(context);
    });
  }catch(error){
    errors.push(`No se pudo ejecutar el mapeador Firebase: ${error.message}`);
  }

  const mapper = window.RequisitosFirebaseMapper;

  if(mapper){
    const row = {
      numeroIdentificacion:"1723456789",
      Nombres:"ESTUDIANTE DE PRUEBA",
      CorreoPersonal:"estudiante@example.com",
      CorreoInstitucional:"estudiante@institucion.edu",
      Celular:"0999999999",
      telegramUser:"@estudiante",
      telegramChatId:"123456",
      Sede:"MATRIZ",
      CodigoCarrera:"ENF",
      NombreCarrera:"ENFERMERÍA",
      periodoId:"2026-04__2026-09",
      periodoLabel:"Abril 2026 a Septiembre 2026",
      division:"A",
      estadoMatricula:"ACTIVO",
      modalidadTitulacion:"TRABAJO_TITULACION",
      Academico:"CUMPLE",
      Financiero:"NO CUMPLE",
      Notart:"8.5",
      Notdef:"9",
      Notafinal:"8.65",
      createdAt:"2026-07-23T12:00:00.000Z",
      updatedAt:"2026-07-23T13:00:00.000Z",
      version:1
    };

    const requirementRows = [
      {
        periodoId:row.periodoId,
        cedula:row.numeroIdentificacion,
        requisitoKey:"Ingles",
        estado:"PENDIENTE"
      }
    ];

    const firstBundle = mapper.bundle(row,{ requirements:requirementRows });
    const secondBundle = mapper.bundle(row,{ requirements:requirementRows });
    const documents = firstBundle.documents || {};

    check(firstBundle.ok === true,"El paquete completo debe ser válido");
    equal(firstBundle.errors.length,0,"El paquete no debe contener errores");

    equal(documents.estudiantes.id,"1723456789","ID del estudiante");
    equal(documents.estudiantes.codigoCarreraActual,"ENF","Carrera actual del estudiante");
    equal(documents.estudiantes.nombreCarreraActual,"ENFERMERÍA","Nombre de carrera actual");
    equal(documents.estudiantes.telegramUser,"estudiante","Telegram sin arroba inicial");

    equal(documents.matriculas.id,"2026-04__2026-09__1723456789","ID remoto de matrícula");
    equal(documents.matriculas.localId,"1723456789__2026-04__2026-09","ID local de matrícula");
    equal(documents.matriculas.codigoCarrera,"ENF","Carrera de la matrícula");
    equal(documents.matriculas.division,"A","División de la matrícula");
    equal(documents.matriculas.estadoMatricula,"ACTIVO","Estado de matrícula");

    equal(documents.requisitos.valores.Academico,"CUMPLE","Requisito académico");
    equal(documents.requisitos.valores.Financiero,"NO CUMPLE","Requisito financiero");
    equal(documents.requisitos.valores.Ingles,"PENDIENTE","Requisito obtenido desde filas separadas");

    equal(documents.notas.notaArticulo,8.5,"Nota de artículo");
    equal(documents.notas.notaDefensa,9,"Nota de defensa");
    equal(documents.notas.notaFinal,8.65,"Nota final");

    ["estudiantes","matriculas","requisitos","notas"].forEach((entity) => {
      check(/^h[0-9a-f]{8}$/.test(documents[entity].dataHash),`Hash válido para ${entity}`);
      equal(
        documents[entity].dataHash,
        secondBundle.documents[entity].dataHash,
        `Hash estable para ${entity}`
      );
    });

    check(
      events.some((event) => event.type === "requisitos:firebase-mapper-ready"),
      "El mapeador debe emitir su evento de disponibilidad"
    );
  }else{
    errors.push("RequisitosFirebaseMapper no quedó disponible.");
  }
}

if(errors.length){
  console.error("\nVERIFICACIÓN DEL MAPEADOR FIREBASE: ERROR\n");
  errors.forEach((error,index) => console.error(`${index + 1}. ${error}`));
  process.exit(1);
}

console.log(`VERIFICACIÓN DEL MAPEADOR FIREBASE: OK (${checks.length} comprobaciones)`);
