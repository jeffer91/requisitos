"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const errors=[];
const backups=[];
const conflictRows=[];
const writes=[];

function check(value,message){if(!value){errors.push(message);}}
function clone(value){return JSON.parse(JSON.stringify(value));}
function CustomEvent(type,options){this.type=type;this.detail=options&&options.detail||{};}

const legacy={
  Estudiantes:[{
    id:"1723456789",
    data:{cedula:"1723456789",Nombres:"ESTUDIANTE PRUEBA",telegramUser:"@estudiante",telegramChatId:"12345",updatedAt:"2026-07-20T10:00:00.000Z"}
  }],
  EstudiantesPeriodo:[{
    id:"2026-04__2026-09__1723456789",
    data:{
      periodoId:"2026-04__2026-09",periodoLabel:"Abril a septiembre 2026",
      cedula:"1723456789",numeroIdentificacion:"1723456789",Nombres:"ESTUDIANTE PRUEBA",
      CodigoCarrera:"ENF",NombreCarrera:"ENFERMERÍA",Sede:"MATRIZ",division:"A",
      estadoMatricula:"ACTIVO",Academico:"CUMPLE",Financiero:"CUMPLE",
      Notart:8.5,Notdef:9,Notafinal:8.65,updatedAt:"2026-07-21T10:00:00.000Z"
    }
  }],
  historial:[{
    id:"hist_1",
    data:{entidad:"requisitos",entidadId:"1723456789__2026-04__2026-09",periodoId:"2026-04__2026-09",cedula:"1723456789",campo:"Financiero",anterior:"PENDIENTE",nuevo:"CUMPLE",accion:"ACTUALIZAR",createdAt:"2026-07-21T11:00:00.000Z"}
  }],
  historial_periodos:[{
    id:"hist_period_1",
    data:{entidad:"periodos",entidadId:"2026-04__2026-09",accion:"CREAR",createdAt:"2026-07-01T10:00:00.000Z"}
  }]
};

const target={
  carreras:{
    ENF:{id:"ENF",codigoCarrera:"ENF",nombreCarrera:"NOMBRE DIFERENTE",createdAt:"2026-07-01T00:00:00.000Z",updatedAt:"2026-07-01T00:00:00.000Z",version:1,dataHash:"hdiferente",eliminado:false,eliminadoEn:""}
  }
};

function fakeFirestore(){
  function collection(name){
    let after="";
    let limitValue=400;
    const api={
      orderBy(){return api;},
      startAfter(value){after=String(value||"");return api;},
      limit(value){limitValue=Number(value||400);return api;},
      get(){
        const rows=(legacy[name]||[]).filter((item)=>item.id>after).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,limitValue);
        return Promise.resolve({docs:rows.map((item)=>({id:item.id,data:()=>clone(item.data)}))});
      }
    };
    return api;
  }
  return {collection};
}

const firestore=fakeFirestore();
const repository={
  ensureFirestore(){return Promise.resolve(firestore);},
  getById(entity,id){
    const data=target[entity]&&target[entity][id];
    return Promise.resolve(data?{documentId:id,data:clone(data)}:null);
  },
  writeChecked(entity,document,options){
    target[entity]=target[entity]||{};
    target[entity][options.documentId]=clone(document);
    writes.push({entity,documentId:options.documentId,document:clone(document),options:clone(options)});
    return Promise.resolve({ok:true,unchanged:false,entity,documentId:options.documentId,document:clone(document)});
  }
};

const sandbox={
  console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Set,
  CustomEvent,dispatchEvent(){},setTimeout,clearTimeout,
  BL2Config:{
    fields:{requirements:["Academico","Documentacion","Financiero","Titulacion","PracticasVinculacion","Vinculacion","SeguimientoGraduados","Ingles","ActualizacionDatos","AprobacionTitulacion","AprobacionComplexivoProyecto"]},
    utils:{
      normalizeCedula(value){return String(value==null?"":value).replace(/[^0-9A-Za-z]/g,"");},
      canonicalPeriodId(value){const raw=String(value||"");const match=raw.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);return match?`${match[1]}-${match[2]}__${match[3]}-${match[4]}`:raw.replace(/_+/g,"__");},
      normalizeKey(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"");}
    }
  },
  RequisitosFirebaseRepository:repository,
  BL2DB:{bulkPut(store,rows){check(store==="backups","La migración debe respaldar en backups");rows.forEach((row)=>backups.push(clone(row)));return Promise.resolve(rows.map(clone));}},
  BDLRepoConflictos:{save(row){conflictRows.push(clone(row));return Promise.resolve(row);}}
};
sandbox.window=sandbox;
const context=vm.createContext(sandbox);
function load(file){new vm.Script(fs.readFileSync(path.join(ROOT,file),"utf8"),{filename:file}).runInContext(context);}

load("BDLocal/firebase/bdl.firebase.schema.v2.js");
load("BDLocal/firebase/bdl.firebase.identity.js");
load("BDLocal/firebase/bdl.firebase.mapper.v2.js");
load("BDLocal/firebase/bdl.firebase.migration.v2.js");
load("BDLocal/firebase/bdl.firebase.migration.contract.js");

(async()=>{
  const migration=sandbox.RequisitosFirebaseMigration;
  check(migration&&typeof migration.preview==="function","No se expuso RequisitosFirebaseMigration");
  check(migration.confirmation==="MIGRAR A FIREBASE V2","La migración debe exigir una frase exacta");

  const preview=await migration.preview({limit:2,maxPages:20});
  check(preview.backup&&preview.backup.backupId,"La vista previa debe crear respaldo antes de escribir");
  check(backups.length>=2,"El respaldo debe incluir manifiesto y documentos legacy");
  check(preview.sourceCounts.Estudiantes===1,"Debe contar Estudiantes legacy");
  check(preview.sourceCounts.EstudiantesPeriodo===1,"Debe contar EstudiantesPeriodo legacy");
  check(preview.sourceCountContractVersion==="1.0.0-canonical-source-counts","La vista previa debe exponer el contrato canónico de conteos");
  check(preview.counts.estudiantes===1,"Debe producir un estudiante único");
  check(preview.counts.matriculas===1,"Debe producir una matrícula");
  check(preview.counts.requisitos===1,"Debe producir un documento de requisitos");
  check(preview.counts.notas===1,"Debe producir un documento de notas");
  check(preview.counts.periodos===1,"Debe derivar un período");
  check(preview.counts.carreras===1,"Debe derivar una carrera");
  check(preview.counts.historial===2,"Debe unir historial e historial_periodos");
  check(preview.errors.length===0,"La vista previa válida no debe contener errores");

  let rejected=false;
  try{await migration.apply(preview.token,"frase incorrecta",{});}catch(error){rejected=true;}
  check(rejected,"La migración debe rechazar una frase incorrecta");
  check(writes.length===0,"Una confirmación incorrecta no debe escribir documentos");

  const result=await migration.apply(preview.token,"MIGRAR A FIREBASE V2",{overwriteExisting:false,continueOnError:true});
  check(result.legacyDeleted===false,"La migración nunca debe eliminar colecciones legacy");
  check(result.conflicts===1,"La carrera diferente existente debe registrarse como conflicto");
  check(conflictRows.length===1&&conflictRows[0].entidad==="carreras","El conflicto debe persistirse con su entidad");
  check(result.written===7,"Debe escribir las siete entidades no conflictivas");
  check(target.estudiantes&&target.estudiantes["1723456789"],"Debe escribir estudiantes/{cedula}");
  check(target.matriculas&&target.matriculas["2026-04__2026-09__1723456789"],"Debe escribir matrícula con ID remoto");
  check(target.requisitos&&target.requisitos["2026-04__2026-09__1723456789"].valores.Financiero==="CUMPLE","Debe migrar requisitos");
  check(target.notas&&target.notas["2026-04__2026-09__1723456789"].notaFinal===8.65,"Debe migrar notas");
  check(target.estudiantes["1723456789"].telegramUser==="estudiante","Debe combinar Telegram desde Estudiantes");

  const second=await migration.apply(preview.token,"MIGRAR A FIREBASE V2",{overwriteExisting:false,continueOnError:true});
  check(second.written===0,"Repetir la misma migración debe ser idempotente");
  check(second.unchanged===7,"Los documentos ya migrados deben quedar sin cambios");
  check(second.conflicts===1,"El conflicto diferente debe seguir protegido");
  check(!String(fs.readFileSync(path.join(ROOT,"BDLocal/firebase/bdl.firebase.migration.v2.js"),"utf8")).includes(".delete("),"El módulo no debe contener borrado Firestore");

  if(errors.length){
    console.error("\nVERIFICACIÓN DE MIGRACIÓN FIREBASE V2: ERROR\n");
    errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
    process.exit(1);
  }
  console.log("VERIFICACIÓN DE MIGRACIÓN FIREBASE V2: OK");
})().catch((error)=>{
  console.error("VERIFICACIÓN DE MIGRACIÓN FIREBASE V2: ERROR",error);
  process.exit(1);
});
