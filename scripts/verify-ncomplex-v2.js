"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const errors=[];
const calls={evaluations:[],notes:[],changes:[],logs:[],imports:[],events:[]};
function check(value,message){if(!value){errors.push(message);}}
function CustomEvent(type,options){this.type=type;this.detail=options&&options.detail||{};}

let existing=null;
const evaluationRepo={
  getByPeriodoCedula(){return Promise.resolve(existing?{...existing}:null);},
  save(row){
    const id=`${row.cedula}__${row.periodoId}`;
    existing={...existing,...row,id,idEstudiantePeriodo:id,studentId:id,updatedAt:"2026-07-24T12:00:00.000Z"};
    calls.evaluations.push({...existing});
    return Promise.resolve({...existing});
  },
  list(){return Promise.resolve(existing?[{...existing}]:[]);}
};
const notesRepo={save(row){calls.notes.push({...row});return Promise.resolve(row);}};
const changesRepo={
  save(row){calls.changes.push({...row});return Promise.resolve({...row,id:`change_${calls.changes.length}`});},
  saveMany(rows){rows.forEach((row)=>calls.changes.push({...row}));return Promise.resolve(rows);}
};
const logsRepo={saveMany(rows){rows.forEach((row)=>calls.logs.push({...row}));return Promise.resolve(rows);}};
const importsRepo={save(row){const saved={...row,id:row.id||"importacion_test",createdAt:row.createdAt||"2026-07-24T12:00:00.000Z"};calls.imports.push(saved);return Promise.resolve(saved);},list(){return Promise.resolve(calls.imports);}};

const servicesMap={
  estudiantes:{list(){return Promise.resolve([]);}},
  periodos:{list(){return Promise.resolve([]);}}
};
const Services={
  repo(name){return {
    evaluaciones_titulacion:evaluationRepo,ncomplex:evaluationRepo,notas:notesRepo,notas_titulacion:notesRepo,
    cambios_pendientes:changesRepo,cambios:changesRepo,logs:logsRepo,importaciones:importsRepo
  }[name]||null;},
  get(name){return servicesMap[name]||null;},
  getStudents(){return Promise.resolve([]);},
  getPeriods(){return Promise.resolve([]);},
  paginate(rows){return {rows,total:rows.length,page:1,limit:25,totalPages:1};},
  register(name,api){servicesMap[name]=api;}
};
const rules={
  normalizeCedula(value){return String(value||"").replace(/\D/g,"");},
  canonicalPeriodId(value){return String(value||"").replace(/_+/g,"__");},
  makeId(periodoId,cedula){return `${cedula}__${periodoId}`;},
  modality(value){return String(value||"").toUpperCase();},
  build(row){
    const periodoId=String(row.periodoId||"").replace(/_+/g,"__");
    const cedula=String(row.cedula||"").replace(/\D/g,"");
    return {...row,periodoId,cedula,id:`${cedula}__${periodoId}`,idEstudiantePeriodo:`${cedula}__${periodoId}`,studentId:`${cedula}__${periodoId}`};
  }
};
const sandbox={
  console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Set,
  CustomEvent,dispatchEvent(event){calls.events.push(event);},
  BDLServices:Services,BDLRulesEvaluacionesTitulacion:rules,
  BDLRepoEvaluacionesTitulacion:evaluationRepo,BDLRepoNotas:notesRepo,
  BDLRepoCambios:changesRepo,BDLRepoLogs:logsRepo,BDLRepoImportaciones:importsRepo
};
sandbox.window=sandbox;
const context=vm.createContext(sandbox);
const source=fs.readFileSync(path.join(ROOT,"BDLocal/services/bdl.service.ncomplex.js"),"utf8");
new vm.Script(source,{filename:"bdl.service.ncomplex.js"}).runInContext(context);

(async()=>{
  const service=sandbox.BDLServiceNcomplex;
  check(service&&typeof service.saveEvaluation==="function","No se expuso BDLServiceNcomplex");

  const saved=await service.saveEvaluation({
    periodoId:"2026-04__2026-09",cedula:"1723456789",modalidadTitulacion:"EXAMEN_COMPLEXIVO",
    notaTeorica:8,notaPractica:9,notaComplexivo:8.6,estadoEvaluacion:"APROBADO"
  },{usuario:"tester"});
  check(saved.idEstudiantePeriodo==="1723456789__2026-04__2026-09","La evaluación debe usar cédula__período");
  check(calls.notes.length===1,"Ncomplex debe espejar la evaluación en notas_titulacion");
  check(calls.notes[0].notaComplexivo===8.6,"El espejo debe conservar las notas avanzadas");
  check(calls.changes.some((row)=>row.tabla==="evaluaciones_titulacion"),"Ncomplex debe crear un cambio unificado de notas");
  check(calls.changes.some((row)=>row.tabla==="historial"&&row.payload.campo==="notaComplexivo"),"Ncomplex debe crear historial por nota");
  const specific=calls.changes.filter((row)=>row.tabla!=="historial");
  check(specific.every((row)=>row.estadoFirebase==="PENDIENTE"&&row.estadoSheets==="SINCRONIZADO"&&row.estadoSupabase==="SINCRONIZADO"),"Ncomplex debe dejar pendiente solo Firebase");

  await service.changeModality("2026-04__2026-09","1723456789","TRABAJO_TITULACION");
  check(existing.modalidadTitulacion==="TRABAJO_TITULACION","Debe cambiar la modalidad");
  check(existing.notaTeorica===8&&existing.notaPractica===9&&existing.notaComplexivo===8.6,"Cambiar modalidad no debe borrar las notas anteriores");
  check(calls.changes.some((row)=>row.tabla==="historial"&&row.payload.campo==="modalidadTitulacion"),"Cambiar modalidad debe quedar en historial");

  const imported=await service.saveImport({
    id:"importacion_ncomplex",periodoId:"2026-04__2026-09",archivoNombre:"notas.xlsx",
    archivoHash:"abc123",createdAt:"2026-07-24T12:00:00.000Z"
  });
  check(imported.id==="importacion_ncomplex","Ncomplex debe guardar la importación");
  check(calls.changes.some((row)=>row.tabla==="importaciones"&&row.registroId==="importacion_ncomplex"),"La importación debe quedar pendiente para Firebase");

  if(errors.length){
    console.error("\nVERIFICACIÓN NCOMPLEX V2: ERROR\n");
    errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
    process.exit(1);
  }
  console.log("VERIFICACIÓN NCOMPLEX V2: OK");
})().catch((error)=>{
  console.error("VERIFICACIÓN NCOMPLEX V2: ERROR",error);
  process.exit(1);
});
