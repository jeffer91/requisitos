"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const errors=[];
const calls={
  original:[],persons:[],contacts:[],enrollments:[],requirements:[],notes:[],changes:[],logs:[],events:[]
};

function check(value,message){if(!value){errors.push(message);}}
function CustomEvent(type,options){this.type=type;this.detail=options&&options.detail||{};}

let student={
  id:"1723456789__2026-04__2026-09",
  idEstudiantePeriodo:"1723456789__2026-04__2026-09",
  studentId:"1723456789__2026-04__2026-09",
  cedula:"1723456789",
  numeroIdentificacion:"1723456789",
  periodoId:"2026-04__2026-09",
  periodId:"2026-04__2026-09",
  Nombres:"ESTUDIANTE PRUEBA",
  CorreoPersonal:"old@example.com",
  estadoMatricula:"ACTIVO",
  Financiero:"PENDIENTE",
  Notart:8
};

const repos={
  personas:{save(row){calls.persons.push({...row});return Promise.resolve(row);}},
  contactos:{save(row,options){calls.contacts.push({row:{...row},options:{...options}});return Promise.resolve(row);}},
  matriculas:{save(row){calls.enrollments.push({...row});return Promise.resolve(row);}},
  requisitos:{saveMany(rows){calls.requirements.push(rows.map((row)=>({...row})));return Promise.resolve(rows);}},
  notas:{
    getByPeriodoCedula(){return Promise.resolve({
      idEstudiantePeriodo:"1723456789__2026-04__2026-09",
      cedula:"1723456789",periodoId:"2026-04__2026-09",Notart:8,Notdef:null
    });},
    save(row){calls.notes.push({...row});return Promise.resolve(row);}
  },
  cambios_pendientes:{
    save(row){
      const saved={...row,id:`outbox_${calls.changes.length+1}`};
      calls.changes.push(saved);
      return Promise.resolve(saved);
    }
  },
  logs:{save(row){calls.logs.push({...row});return Promise.resolve(row);}}
};

const conFicha={
  getStudentById(){return {...student};},
  updateStudent(id,changes,options){
    calls.original.push({id,changes:{...changes},options:{...options}});
    student={...student,...changes,updatedAt:"2026-07-24T10:00:00.000Z"};
    return Promise.resolve({...student});
  },
  updateEnrollmentStatus(id,value,options){
    const status=String(value).toUpperCase();
    student={...student,estadoMatricula:status,retirado:status==="RETIRADO",retiradoEn:status==="RETIRADO"?"2026-07-24T10:01:00.000Z":""};
    return Promise.resolve({ok:true,id,status,student:{...student}});
  },
  updateGraduationModality(id,value){
    student={...student,modalidadTitulacion:value,modalidadTitulacionActualizadaEn:"2026-07-24T10:02:00.000Z"};
    return Promise.resolve({ok:true,id,value,student:{...student}});
  }
};

const sandbox={
  console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Set,
  CustomEvent,
  dispatchEvent(event){calls.events.push(event);return true;},
  ConFicha:conFicha,
  BDLocalFicha:conFicha,
  BDLRepositories:{get(name){return repos[name]||null;}},
  BDLocalConUtils:{
    normalizeCedula(value){return String(value||"").replace(/\D/g,"");},
    canonicalPeriodId(value){return String(value||"").replace(/_+/g,"__");}
  },
  BL2ScreenAdapter:{}
};
sandbox.window=sandbox;
const context=vm.createContext(sandbox);
const source=fs.readFileSync(path.join(ROOT,"BDLocal/conexiones/cone.ficha.entities.js"),"utf8");
new vm.Script(source,{filename:"cone.ficha.entities.js"}).runInContext(context);

function entityChanges(table){return calls.changes.filter((row)=>row.tabla===table);}
function historyChanges(){return calls.changes.filter((row)=>row.tabla==="historial");}

(async()=>{
  check(sandbox.ConFichaEntities&&sandbox.ConFichaEntities.install(),"No se instaló ConFichaEntities");
  check(conFicha.entityWriteStatus().history===true,"ConFicha debe declarar historial activo");

  await conFicha.updateStudent(student.id,{CorreoPersonal:"new@example.com"},{periodoId:student.periodoId,action:"edit_contact"});
  check(calls.persons.length===1,"Editar contacto debe actualizar personas");
  check(calls.contacts.length===1,"Editar contacto debe actualizar contactos_estudiante");
  check(entityChanges("personas").length===1,"Editar contacto debe crear cambio Firebase de estudiantes/personas");
  check(historyChanges().some((row)=>row.payload&&row.payload.campo==="CorreoPersonal"),"Editar contacto debe crear historial por campo");

  await conFicha.updateStudent(student.id,{Financiero:"CUMPLE"},{periodoId:student.periodoId,action:"edit_requirement"});
  check(calls.requirements.length===1,"Editar requisito debe guardar requisitos_estudiante");
  check(calls.requirements[0][0].requisitoKey==="Financiero","El requisito debe conservar su nombre canónico");
  check(calls.requirements[0][0].valor==="CUMPLE","El requisito debe conservar el nuevo valor");
  check(entityChanges("requisitos_estudiante").length===1,"Editar requisito debe crear cambio Firebase de requisitos");
  check(historyChanges().some((row)=>row.payload&&row.payload.campo==="Financiero"),"Editar requisito debe crear historial");

  await conFicha.updateStudent(student.id,{Notdef:9},{periodoId:student.periodoId,action:"edit_note"});
  check(calls.notes.length===1,"Editar nota debe guardar notas_titulacion");
  check(calls.notes[0].Notart===8&&calls.notes[0].Notdef===9,"La edición de nota debe conservar las notas anteriores");
  check(entityChanges("notas_titulacion").length===1,"Editar nota debe crear cambio Firebase de notas");
  check(historyChanges().some((row)=>row.payload&&row.payload.campo==="Notdef"),"Editar nota debe crear historial");

  await conFicha.updateStudent(student.id,{division:"B"},{periodoId:student.periodoId,action:"edit_enrollment"});
  check(calls.enrollments.length===1,"Editar matrícula debe guardar matriculas_periodo");
  check(calls.enrollments[0].division==="B","La matrícula debe conservar la nueva división");
  check(entityChanges("matriculas_periodo").length===1,"Editar matrícula debe crear cambio Firebase de matrícula");

  const specific=calls.changes.filter((row)=>row.tabla!=="historial");
  check(specific.every((row)=>row.estadoFirebase==="PENDIENTE"&&row.statusFirebase==="PENDIENTE"),"Los cambios de Ficha deben quedar pendientes para Firebase");
  check(specific.every((row)=>row.estadoSheets==="SINCRONIZADO"&&row.estadoSupabase==="SINCRONIZADO"),"Ficha no debe crear pendientes para Sheets ni Supabase");
  check(calls.logs.length>=4,"Ficha debe guardar un log técnico por campo modificado");
  check(calls.events.some((event)=>event.type==="ficha:entity-writes-saved"),"Ficha debe emitir confirmación de escritura por entidades");

  if(errors.length){
    console.error("\nVERIFICACIÓN FICHA POR ENTIDADES: ERROR\n");
    errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
    process.exit(1);
  }
  console.log("VERIFICACIÓN FICHA POR ENTIDADES: OK");
})().catch((error)=>{
  console.error("VERIFICACIÓN FICHA POR ENTIDADES: ERROR",error);
  process.exit(1);
});
