"use strict";

/* Verifica el repositorio Firebase V2 con un Firestore simulado. */
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

function fakeFirestore(){
  const writes = [];
  const queries = [];
  const stored = {
    matriculas:[{
      id:"2026-04__2026-09__1723456789",
      data:{
        id:"2026-04__2026-09__1723456789",
        periodoId:"2026-04__2026-09",
        cedula:"1723456789",
        nombreCarrera:"ENFERMERÍA",
        estadoMatricula:"ACTIVO",
        retirado:false,
        createdAt:"2026-07-23T12:00:00.000Z",
        updatedAt:"2026-07-23T12:00:00.000Z",
        version:1,
        dataHash:"h12345678",
        eliminado:false,
        eliminadoEn:""
      }
    }]
  };

  function collection(name){
    const queryState = { name,where:[],orderBy:[],limit:null };
    const api = {
      where(field,operator,value){ queryState.where.push([field,operator,value]);return api; },
      orderBy(field,direction){ queryState.orderBy.push([field,direction]);return api; },
      limit(value){ queryState.limit=value;return api; },
      get(){
        queries.push(queryState);
        const rows = (stored[name] || []).slice(0,queryState.limit || 999).map(item=>({
          id:item.id,
          data:()=>item.data
        }));
        return Promise.resolve({ docs:rows });
      },
      doc(id){
        const finalId = id || `auto_${writes.length+1}`;
        return {
          id:finalId,
          get(){
            const found=(stored[name]||[]).find(item=>item.id===finalId);
            return Promise.resolve(found?{ id:finalId,exists:true,data:()=>found.data }:{ id:finalId,exists:false,data:()=>null });
          },
          set(payload,options){ writes.push({ name,id:finalId,payload,options });return Promise.resolve(); }
        };
      }
    };
    return api;
  }

  return {
    writes,
    queries,
    collection,
    batch(){
      const pending=[];
      return {
        set(reference,payload,options){ pending.push({ reference,payload,options }); },
        commit(){
          pending.forEach(item=>writes.push({ name:"batch",id:item.reference.id,payload:item.payload,options:item.options }));
          return Promise.resolve();
        }
      };
    }
  };
}

(async()=>{
  const firestore = fakeFirestore();
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
    Promise,
    setTimeout,
    clearTimeout,
    CustomEvent:function(name,options){ this.type=name;this.detail=options&&options.detail; },
    BL2Sync:{ ensureFirebase:()=>Promise.resolve(firestore) }
  };
  sandbox.window=sandbox;
  sandbox.dispatchEvent=function(){};
  const context=vm.createContext(sandbox);

  load("BDLocal/firebase/bdl.firebase.schema.v2.js",context);
  load("BDLocal/firebase/bdl.firebase.identity.js",context);
  load("BDLocal/firebase/bdl.firebase.validator.v2.js",context);
  load("BDLocal/firebase/bdl.firebase.mapper.v2.js",context);
  load("BDLocal/firebase/bdl.firebase.reverse-mapper.v2.js",context);
  load("BDLocal/firebase/bdl.firebase.repository.v2.js",context);

  const repo=sandbox.RequisitosFirebaseRepository;
  check(repo&&typeof repo.write==="function","No se expuso RequisitosFirebaseRepository.write");
  check(repo.collectionName("notas")==="notas","No resolvió la colección notas");

  const row={
    periodoId:"2026-04__2026-09",
    cedula:"1723456789",
    Nombres:"ESTUDIANTE PRUEBA",
    NombreCarrera:"ENFERMERÍA",
    estadoMatricula:"ACTIVO",
    Academico:"CUMPLE",
    notaFinal:8.7,
    createdAt:"2026-07-23T12:00:00.000Z",
    updatedAt:"2026-07-23T12:00:00.000Z",
    version:1
  };
  const bundle=repo.prepareLocalBundle(row);
  check(bundle.ok,"El repositorio no pudo preparar el paquete local");

  const writeResult=await repo.write("matriculas",bundle.documents.matriculas);
  check(writeResult.ok,"No escribió una matrícula válida en el Firestore simulado");
  check(firestore.writes[0].name==="matriculas","La escritura fue a una colección incorrecta");
  check(firestore.writes[0].id==="2026-04__2026-09__1723456789","La escritura no usó el ID remoto oficial");

  const listResult=await repo.list("matriculas",{ since:"2026-07-01T00:00:00.000Z",limit:25 });
  check(listResult.ok&&listResult.incremental,"No preparó una lectura incremental");
  check(firestore.queries[0].where.some(item=>item[0]==="updatedAt"&&item[1]===">"),"La lectura incremental no filtró por updatedAt");

  const pullResult=await repo.pull("matriculas",{ limit:25 });
  check(pullResult.local&&pullResult.local.stores.matriculas_periodo,"pull no convirtió la respuesta a matriculas_periodo");
  check(pullResult.local.stores.matriculas_periodo[0]._skipOutbox===true,"pull podría crear un ciclo de sincronización");

  let rejected=false;
  try{
    await repo.write("notas",{
      id:"2026-04__2026-09__1723456789",
      periodoId:"2026-04__2026-09",
      cedula:"1723456789",
      notaFinal:15,
      createdAt:"2026-07-23T12:00:00.000Z",
      updatedAt:"2026-07-23T12:00:00.000Z",
      version:1,
      dataHash:"h12345678",
      eliminado:false,
      eliminadoEn:""
    });
  }catch(error){ rejected=true; }
  check(rejected,"El repositorio permitió escribir una nota inválida");

  const status=repo.status();
  check(status.reads>=2&&status.writes>=1,"El estado del repositorio no registró operaciones");

  if(errors.length){
    console.error("\nVERIFICACIÓN FIREBASE REPOSITORY: ERROR\n");
    errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
    process.exit(1);
  }

  console.log("VERIFICACIÓN FIREBASE REPOSITORY: OK");
})().catch(error=>{
  console.error("VERIFICACIÓN FIREBASE REPOSITORY: ERROR",error);
  process.exit(1);
});
