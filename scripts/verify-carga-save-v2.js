"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const errors=[];
const captured={students:[],imports:[],events:[]};

function check(value,message){if(!value){errors.push(message);}}
function CustomEvent(type,options){this.type=type;this.detail=options&&options.detail||{};}

const existing={
  cedula:"1723456789",
  numeroIdentificacion:"1723456789",
  Nombres:"ESTUDIANTE ANTERIOR",
  periodoId:"2026-04__2026-09",
  estadoMatricula:"RETIRADO",
  retirado:true,
  estadoMatriculaManual:true,
  estadoMatriculaManualOrigen:"Ficha",
  Financiero:"CUMPLE",
  CorreoPersonal:"anterior@example.com",
  Notart:8.5
};

const connector={
  ready(){return Promise.resolve({ok:true});},
  listStudents(){return Promise.resolve([existing]);},
  saveStudents(rows){
    captured.students=rows;
    return Promise.resolve({
      ok:true,totalEntrada:rows.length,guardados:0,actualizados:1,
      sinCambios:0,retirados:0,duplicados:0,advertencias:[],errores:[],
      changes:[{id:"cambio_estudiante"}],finishedAt:"2026-07-24T10:00:00.000Z"
    });
  },
  saveImport(row){
    captured.imports.push(row);
    return Promise.resolve({...row,id:`importacion__${row.archivoHash}__${row.periodoId}`});
  }
};

const sandbox={
  console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Set,
  CustomEvent,
  dispatchEvent(event){captured.events.push(event);},
  ConCarga:connector,
  CargaConfig:{maxPeriodDifferencePercent:10,defaultBatchSize:250},
  localStorage:{getItem(){return "";},setItem(){},removeItem(){}}
};
sandbox.window=sandbox;
const context=vm.createContext(sandbox);
const source=fs.readFileSync(path.join(ROOT,"Carga/process/carga.save.js"),"utf8");
new vm.Script(source,{filename:"Carga/process/carga.save.js"}).runInContext(context);

(async()=>{
  const normalized={
    fileName:"estudiantes.xlsx",
    rows:[{
      numeroIdentificacion:"1723456789",
      Nombres:"ESTUDIANTE ACTUALIZADO",
      NombreCarrera:"ENFERMERÍA"
    }]
  };
  const result=await sandbox.CargaSave.save(normalized,{ok:true},{
    periodoId:"2026-04__2026-09",
    periodoLabel:"Abril a septiembre 2026",
    analysis:{ok:true,periodoId:"2026-04__2026-09",firstLoad:true,percent:0},
    markRetired:false
  });

  const row=captured.students[0]||{};
  check(row.estadoMatricula==="RETIRADO","La carga parcial debe conservar el estado manual RETIRADO");
  check(row.estadoMatriculaManual===true,"La carga parcial debe conservar la marca manual");
  check(row.Financiero==="CUMPLE","La carga sin columna Financiero debe conservar el requisito existente");
  check(row.CorreoPersonal==="anterior@example.com","La carga sin correo debe conservar el contacto existente");
  check(row.Notart===8.5,"La carga sin nota debe conservar la nota existente");
  check(row._camposAusentesPreservados===true,"La fila debe registrar que preservó campos ausentes");
  check(captured.imports.length===1,"La carga debe registrar exactamente una importación");
  check(Boolean(captured.imports[0].archivoHash),"La importación debe incluir un hash estable");
  check(captured.imports[0].periodoId==="2026-04__2026-09","La importación debe quedar ligada al período");
  check(Boolean(result.importacionId),"El resultado debe devolver importacionId");
  check(captured.events.some((event)=>event.type==="bdlocal:carga-save-finish"&&event.detail.importacionId),"El evento final debe incluir la importación");

  const explicit=await sandbox.CargaSave.helpers.preserveExistingFields(connector,[{
    numeroIdentificacion:"1723456789",
    periodoId:"2026-04__2026-09",
    Financiero:"",
    Notart:"",
    CorreoPersonal:""
  }],{periodoId:"2026-04__2026-09"},{});
  check(explicit[0].Financiero==="","Un campo presente y vacío no debe ser reemplazado por el valor anterior");
  check(explicit[0].Notart==="","Una nota explícitamente vacía no debe restaurarse automáticamente");
  check(explicit[0].CorreoPersonal==="","Un contacto explícitamente vacío no debe restaurarse automáticamente");

  if(errors.length){
    console.error("\nVERIFICACIÓN CARGA V2: ERROR\n");
    errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
    process.exit(1);
  }
  console.log("VERIFICACIÓN CARGA V2: OK");
})().catch((error)=>{
  console.error("VERIFICACIÓN CARGA V2: ERROR",error);
  process.exit(1);
});
