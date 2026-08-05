"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const errors=[];
const savedBatches=[];
const savedPeople=[];
const remoteReads=[];

function check(value,message){if(!value){errors.push(message);}}
function CustomEvent(type,options){this.type=type;this.detail=options&&options.detail||{};}

const period="2026-04__2026-09";
const people=[
  {cedula:"1711111111",nombres:"PERSONA UNO",codigoCarreraActual:"MEC",nombreCarreraActual:"MECÁNICA",telegramUser:"",telegramChatId:""},
  {cedula:"PA1234567",nombres:"PERSONA EXTRANJERA",codigoCarreraActual:"ENF",nombreCarreraActual:"ENFERMERÍA",telegramUser:"existente",telegramChatId:"200"}
];
const enrollments=[
  {idEstudiantePeriodo:"1711111111__"+period,periodoId:period,cedula:"1711111111",CodigoCarrera:"MEC",NombreCarrera:"MECÁNICA"},
  {idEstudiantePeriodo:"PA1234567__"+period,periodoId:period,cedula:"PA1234567",CodigoCarrera:"ENF",NombreCarrera:"ENFERMERÍA"}
];
const requirements=[
  {idEstudiantePeriodo:"1711111111__"+period,periodoId:period,cedula:"1711111111",Academico:"SI"},
  {idEstudiantePeriodo:"PA1234567__"+period,periodoId:period,cedula:"PA1234567",Academico:"SI"}
];
const notes=[
  {idEstudiantePeriodo:"1711111111__"+period,periodoId:period,cedula:"1711111111",notaArticulo:8,notaDefensa:9,notaFinal:8.3},
  {idEstudiantePeriodo:"PA1234567__"+period,periodoId:period,cedula:"PA1234567",notaTeorica:8,notaPractica:9,notaComplexivo:8.6}
];
const evaluations=[
  {idEstudiantePeriodo:"PA1234567__"+period,periodoId:period,cedula:"PA1234567",notaTeorica:8,notaPractica:9,notaComplexivo:8.6,origen:"ncomplex"}
];
const periods=[{id:period,periodoId:period,label:"Abril - Septiembre 2026",activo:true}];
const imports=[
  {id:"carga_import",periodoId:period,source:"CARGA_ARCHIVO",archivoNombre:"estudiantes.xlsx"},
  {id:"ncomplex_import",periodoId:period,source:"NCOMPLEX_TEXTO_PEGADO",origen:"ncomplex"}
];
const logs=[
  {
    id:"hist_carga",scope:"Carga",createdAt:"2026-08-05T10:00:00.000Z",
    data:{id:"hist_carga",entidad:"matriculas",entidadId:"1711111111__"+period,periodoId:period,cedula:"1711111111",accion:"ACTUALIZAR",pantalla:"Carga",createdAt:"2026-08-05T10:00:00.000Z"}
  },
  {
    id:"hist_defensa",scope:"Defensas",createdAt:"2026-08-05T10:01:00.000Z",
    data:{id:"hist_defensa",entidad:"notas",entidadId:"1711111111__"+period,periodoId:period,cedula:"1711111111",accion:"ACTUALIZAR_NOTAS",pantalla:"Defensas",createdAt:"2026-08-05T10:01:00.000Z"}
  },
  {
    id:"hist_ncomplex",scope:"Ncomplex",createdAt:"2026-08-05T10:02:00.000Z",
    data:{id:"hist_ncomplex",entidad:"notas",entidadId:"PA1234567__"+period,periodoId:period,cedula:"PA1234567",accion:"ACTUALIZAR_EVALUACION",pantalla:"Ncomplex",createdAt:"2026-08-05T10:02:00.000Z"}
  },
  {id:"log_tecnico",scope:"BDLocal",message:"Inicio correcto",data:{detalle:"sin auditoría"},createdAt:"2026-08-05T10:03:00.000Z"}
];

function repository(rows){
  return {list(options){
    const wanted=String(options&&options.periodoId||"");
    return Promise.resolve(rows.filter((row)=>!wanted||!row.periodoId||row.periodoId===wanted));
  }};
}
const changesRepo={
  saveMany(rows,options){
    savedBatches.push({rows:JSON.parse(JSON.stringify(rows)),options:Object.assign({},options)});
    return Promise.resolve(rows);
  }
};
const personasRepo=Object.assign(repository(people),{
  save(row){
    savedPeople.push(JSON.parse(JSON.stringify(row)));
    const index=people.findIndex((item)=>item.cedula===row.cedula);
    if(index>=0){people[index]=Object.assign({},row);}
    return Promise.resolve(row);
  }
});
const repos={
  personas:personasRepo,
  matriculas:repository(enrollments),
  requisitos:repository(requirements),
  notas:repository(notes),
  evaluaciones_titulacion:repository(evaluations),
  periodos:repository(periods),
  importaciones:repository(imports),
  logs:repository(logs),
  cambios_pendientes:changesRepo,
  cambios:changesRepo
};
const center={
  telegramPatch(existing,remote){
    const row=Object.assign({},existing,{
      telegramUser:String(remote.telegramUser||"").replace(/^@/,""),
      telegramChatId:String(remote.telegramChatId||"")
    });
    return {changed:row.telegramUser!==existing.telegramUser||row.telegramChatId!==existing.telegramChatId,row};
  },
  requeue(){return Promise.resolve({legacy:true});},
  refreshTelegram(){return Promise.resolve({legacy:true});}
};
const firebaseRepo={
  getById(entity,id){
    remoteReads.push({entity,id});
    if(id==="1711111111"){
      return Promise.resolve({documentId:id,data:{cedula:id,telegramUser:"@nuevo",telegramChatId:"999"}});
    }
    return Promise.resolve(null);
  }
};
const sandbox={
  console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Set,Map,
  setTimeout,clearTimeout,CustomEvent,
  dispatchEvent(){},
  BDLRepositories:{get(name){return repos[name]||null;}},
  BDLRepoPersonas:personasRepo,
  BDLRepoMatriculas:repos.matriculas,
  BDLRepoRequisitos:repos.requisitos,
  BDLRepoNotas:repos.notas,
  BDLRepoEvaluacionesTitulacion:repos.evaluaciones_titulacion,
  BDLRepoPeriodos:repos.periodos,
  BDLRepoImportaciones:repos.importaciones,
  BDLRepoLogs:repos.logs,
  BDLRepoCambios:changesRepo,
  RequisitosFirebaseRepository:firebaseRepo,
  RequisitosFirebaseOperationCenter:center,
  BDLRulesPersona:{normalizeCedula(value){return String(value||"").replace(/[^0-9A-Za-z]/g,"").toUpperCase();}}
};
sandbox.window=sandbox;
const context=vm.createContext(sandbox);
const source=fs.readFileSync(path.join(ROOT,"BDLocal/firebase/bdl.firebase.rebuild.js"),"utf8");

try{
  new vm.Script(source,{filename:"BDLocal/firebase/bdl.firebase.rebuild.js"}).runInContext(context);
}catch(error){
  errors.push("Sintaxis o arranque: "+error.message);
}

(async()=>{
  const api=sandbox.RequisitosFirebaseRebuild;
  check(api&&typeof api.prepare==="function","Debe exponerse RequisitosFirebaseRebuild.prepare");
  check(center.__localSourceRebuildInstalled===true,"Debe reemplazar la reconstrucción antigua del Centro de Operaciones");

  const carga=await api.prepare("carga",{periodoId:period});
  check(carga.ok===true&&carga.fromLocalTables===true,"Carga debe reconstruirse desde tablas locales");
  const cargaBatch=savedBatches[0];
  check(cargaBatch.options.replace===true,"La reconstrucción debe reemplazar el estado anterior de la cola");
  check(cargaBatch.rows.every((row)=>row.estadoFirebase==="PENDIENTE"),"Todos los cambios reconstruidos deben quedar pendientes para Firebase");
  check(cargaBatch.rows.every((row)=>row.estadoSheets==="SINCRONIZADO"&&row.estadoSupabase==="SINCRONIZADO"),"No debe reabrir Google ni Supabase");
  check(cargaBatch.rows.some((row)=>row.tabla==="personas"),"Carga debe incluir personas");
  check(cargaBatch.rows.some((row)=>row.cedula==="PA1234567"),"Carga debe conservar identificaciones extranjeras normalizadas");
  check(cargaBatch.rows.some((row)=>row.tabla==="matriculas_periodo"),"Carga debe incluir matrículas");
  check(cargaBatch.rows.some((row)=>row.tabla==="requisitos_estudiante"),"Carga debe incluir requisitos");
  check(cargaBatch.rows.some((row)=>row.tabla==="periodos"),"Carga debe incluir el período");
  check(cargaBatch.rows.some((row)=>row.tabla==="carreras"),"Carga debe reconstruir carreras desde la información local");
  check(cargaBatch.rows.some((row)=>row.tabla==="historial"&&row.registroId==="hist_carga"),"Carga debe reconstruir su historial válido");
  check(!cargaBatch.rows.some((row)=>row.registroId==="log_tecnico"),"Los logs técnicos no deben convertirse en historial");
  check(!cargaBatch.rows.some((row)=>/nota|evaluacion/.test(row.tabla)),"Carga no debe incluir notas");
  check(!cargaBatch.rows.some((row)=>row.registroId==="ncomplex_import"),"Carga no debe incluir importaciones de Ncomplex");

  const defensas=await api.prepare("defensas",{periodoId:period});
  check(defensas.ok===true,"Defensas debe prepararse correctamente");
  const defenseBatch=savedBatches[1];
  check(defenseBatch.rows.filter((row)=>row.tabla==="notas_titulacion").length===1,"Defensas debe incluir solo registros con notas de artículo o defensa");
  check(defenseBatch.rows.some((row)=>row.source==="defart"&&row.tabla==="notas_titulacion"),"Defensas debe conservar su propietario funcional");
  check(defenseBatch.rows.some((row)=>row.tabla==="historial"&&row.registroId==="hist_defensa"),"Defensas debe reconstruir su historial");
  check(!defenseBatch.rows.some((row)=>row.registroId==="hist_ncomplex"),"Defensas no debe tomar historial de Ncomplex");

  const ncomplex=await api.prepare("ncomplex",{periodoId:period});
  check(ncomplex.ok===true,"Ncomplex debe prepararse correctamente");
  const complexBatch=savedBatches[2];
  check(complexBatch.rows.some((row)=>row.tabla==="evaluaciones_titulacion"),"Ncomplex debe incluir evaluaciones");
  check(complexBatch.rows.some((row)=>row.registroId==="ncomplex_import"),"Ncomplex debe incluir su importación");
  check(complexBatch.rows.some((row)=>row.tabla==="historial"&&row.registroId==="hist_ncomplex"),"Ncomplex debe reconstruir su historial");
  check(!complexBatch.rows.some((row)=>row.source==="defart"),"Ncomplex no debe incluir Defensas");

  const patched=await center.requeue("defensas",{periodoId:period});
  check(patched.ok===true&&patched.fromLocalTables===true,"El botón Preparar carga completa debe usar la reconstrucción local real");

  const telegram=await center.refreshTelegram({periodoId:period,limit:500});
  check(telegram.ok===true&&telegram.limit===25,"Telegram debe limitarse siempre a 25 candidatos");
  check(telegram.requested===1,"Telegram debe consultar solo estudiantes matriculados con datos faltantes");
  check(remoteReads.length===1&&remoteReads[0].id==="1711111111","Telegram no debe leer estudiantes que ya están completos");
  check(savedPeople.length===1&&savedPeople[0].telegramUser==="nuevo"&&savedPeople[0].telegramChatId==="999","Telegram debe guardar exclusivamente los datos recuperados");
  check(savedPeople[0].nombres==="PERSONA UNO","Telegram debe conservar los demás campos locales");

  if(errors.length){
    console.error("\nVERIFICACIÓN RECONSTRUCCIÓN FIREBASE: ERROR\n");
    errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
    process.exit(1);
  }
  console.log("VERIFICACIÓN RECONSTRUCCIÓN FIREBASE DESDE TABLAS LOCALES: OK");
})().catch((error)=>{
  console.error("VERIFICACIÓN RECONSTRUCCIÓN FIREBASE: ERROR",error);
  process.exit(1);
});
