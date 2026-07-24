"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const errors=[];
function check(value,message){if(!value){errors.push(message);}}
function makeSandbox(mode){
  const conflicts=[];
  const registered={};
  const sandbox={
    console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Set,
    CustomEvent:function(name,options){this.type=name;this.detail=options&&options.detail;},
    dispatchEvent(){},
    RequisitosFirebaseIdentity:{
      identityFromRow(row){
        const cedula=String(row.cedula||row.numeroIdentificacion||"");
        const periodoId=String(row.periodoId||"");
        return {ok:!!(cedula&&periodoId),cedula,periodoId,localId:`${cedula}__${periodoId}`,remoteId:`${periodoId}__${cedula}`};
      }
    },
    RequisitosFirebaseMapper:{
      requirementsDocument(base){
        const cedula=String(base.cedula||base.numeroIdentificacion||"");
        const periodoId=String(base.periodoId||"");
        return {id:`${periodoId}__${cedula}`,periodoId,cedula,valores:{Financiero:base.valor||"CUMPLE"},createdAt:"2026-07-23T10:00:00.000Z",updatedAt:"2026-07-23T11:00:00.000Z",version:1,dataHash:`h${cedula.slice(-8)}`};
      },
      dataHash(){return "habcdef12";},
      functionalContent(value){return value;}
    },
    RequisitosFirebaseRepository:{
      documentId(entity,document){return document.id;},
      writeManyChecked(entity,entries){
        if(mode==="all"){
          return Promise.resolve({ok:false,written:0,results:[],conflicts:entries.map((entry)=>({documentId:entry.documentId,remote:{dataHash:"hremota0"}}))});
        }
        return Promise.resolve({
          ok:false,
          written:1,
          results:[{documentId:entries[0].documentId,unchanged:false}],
          conflicts:entries.slice(1).map((entry)=>({documentId:entry.documentId,remote:{dataHash:"hremota1"}}))
        });
      }
    },
    BDLRepositories:{
      get(name){
        if(name==="personas"){return {getByCedula:()=>Promise.resolve(null)};}
        if(name==="matriculas"){return {getByPeriodoCedula:()=>Promise.resolve(null)};}
        if(name==="requisitos"){return {list:()=>Promise.resolve([{_firebaseDataHash:"hbase000",_firebaseVersion:1,_firebaseUpdatedAt:"2026-07-23T09:00:00.000Z"}])};}
        if(name==="notas"){return {getByPeriodoCedula:()=>Promise.resolve(null)};}
        return null;
      }
    },
    BDLRepoSyncEstado:{
      begin:()=>Promise.resolve(true),
      pushSuccess:()=>Promise.resolve(true),
      fail:()=>Promise.resolve(true)
    },
    BDLRepoConflictos:{
      save(row){conflicts.push(row);return Promise.resolve(row);}
    },
    BDLocalConfigStore:{
      getFirebaseQuotaStatus(){return {allowed:true};},
      registerFirebaseUsage(){}
    },
    BDLSyncTargets:{
      register(name,adapter){registered[name]=adapter;return true;}
    }
  };
  sandbox.window=sandbox;
  sandbox.__conflicts=conflicts;
  sandbox.__registered=registered;
  return sandbox;
}
function change(cedula){
  return {id:`cambio_${cedula}`,tabla:"requisitos_estudiante",periodoId:"2026-04__2026-09",cedula,payload:{periodoId:"2026-04__2026-09",cedula,valor:"CUMPLE"}};
}
async function run(mode,rows){
  const sandbox=makeSandbox(mode);
  const context=vm.createContext(sandbox);
  const source=fs.readFileSync(path.join(ROOT,"BDLocal/sync/targets/bdl.sync.target.firebase.js"),"utf8");
  new vm.Script(source,{filename:"bdl.sync.target.firebase.js"}).runInContext(context);
  const target=sandbox.__registered.firebase||sandbox.BDLSyncTargetFirebase;
  check(target&&typeof target.push==="function",`No se registró el destino Firebase en modo ${mode}`);
  const result=await target.push(rows,{manual:true,periodoId:"2026-04__2026-09"});
  return {result,sandbox};
}
(async()=>{
  const partial=await run("partial",[change("1000000001"),change("1000000002")]);
  check(partial.result.ok===true,"Un lote parcialmente exitoso debe permitir confirmar sus éxitos");
  check(partial.result.partial===true,"Un lote mixto debe declararse parcial");
  check(partial.result.processedIds.length===1&&partial.result.processedIds[0]==="cambio_1000000001","Solo el cambio exitoso debe aparecer en processedIds");
  check(partial.sandbox.__conflicts.length===1,"El conflicto parcial debe registrarse");

  const total=await run("all",[change("1000000003")]);
  check(total.result.ok===false,"Un lote totalmente conflictuado no debe declararse exitoso");
  check(total.result.deferWithoutAttempt===true,"Un lote totalmente conflictuado debe conservarse sin sumar intentos");
  check(total.result.processedIds.length===0,"Un lote totalmente conflictuado no debe confirmar cambios");
  check(total.sandbox.__conflicts.length===1,"El conflicto total debe registrarse");

  if(errors.length){
    console.error("\nVERIFICACIÓN DEL DESTINO FIREBASE: ERROR\n");
    errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
    process.exit(1);
  }
  console.log("VERIFICACIÓN DEL DESTINO FIREBASE: OK");
})().catch((error)=>{
  console.error("VERIFICACIÓN DEL DESTINO FIREBASE: ERROR",error);
  process.exit(1);
});
