"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const ROOT=path.resolve(__dirname,"..");
const errors=[];
const stores={
  notas_titulacion:Object.create(null),
  notas:Object.create(null)
};
const registry=Object.create(null);

function check(value,message){
  if(!value){errors.push(message);}
}
function clone(value){
  return value==null?value:JSON.parse(JSON.stringify(value));
}
function rowsOf(store){
  return Object.values(stores[store]||{}).map(clone);
}
function matchesIndex(row,index,value){
  if(index==="periodoId"){return String(row.periodoId||"")===String(value||"");}
  if(index==="cedula"){return String(row.cedula||"")===String(value||"");}
  if(index==="periodo_cedula"){
    return String(row.periodoId||"")===String(value&&value[0]||"")&&
      String(row.cedula||"")===String(value&&value[1]||"");
  }
  return false;
}

const Repositories={
  storeName(name,fallback){
    return name==="notasTitulacion"?"notas_titulacion":name==="notas"?"notas":fallback;
  },
  register(name,api){registry[name]=api;},
  get(name){return registry[name]||null;},
  db(){
    return {
      get(store,key){return Promise.resolve(clone(stores[store]&&stores[store][key]||null));}
    };
  },
  safeGetAll(store){return Promise.resolve(rowsOf(store));},
  safeQueryByIndex(store,index,value){
    return Promise.resolve(rowsOf(store).filter((row)=>matchesIndex(row,index,value)));
  },
  safePut(store,row){
    stores[store][row.idEstudiantePeriodo||row.id]=clone(row);
    return Promise.resolve(clone(row));
  },
  bulkPut(store,rows){
    rows.forEach((row)=>{stores[store][row.idEstudiantePeriodo||row.id]=clone(row);});
    return Promise.resolve(rows.map(clone));
  }
};

const sandbox={
  console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Set,Map,
  BDLRepositories:Repositories,
  BL2Config:{utils:{normalizeCedula(value){return String(value||"").replace(/\D/g,"");}}}
};
sandbox.window=sandbox;
const context=vm.createContext(sandbox);
const source=fs.readFileSync(path.join(ROOT,"BDLocal/repositories/bdl.repo.notas.js"),"utf8");

try{
  new vm.Script(source,{filename:"BDLocal/repositories/bdl.repo.notas.js"}).runInContext(context);
}catch(error){
  errors.push(`Sintaxis o arranque del repositorio: ${error.message}`);
}

(async()=>{
  const repo=sandbox.BDLRepoNotas;
  const periodoId="2026-04__2026-09";
  const cedula="1723456789";

  check(repo&&typeof repo.save==="function","Debe exponerse BDLRepoNotas");
  check(repo&&repo.version==="1.4.0-domain-preserving-save","Debe cargarse la versión con preservación por dominio");

  await repo.save({
    periodoId,cedula,
    Notart:8,Notdef:9,Notafinal:8.3,
    observacionDefensa:"DEFENSA REGISTRADA",
    origen:"defensas",
    updatedAt:"2026-08-05T10:00:00.000Z"
  });

  await repo.save({
    periodoId,cedula,
    modalidadTitulacion:"EXAMEN_COMPLEXIVO",
    notaTeorica:7.5,notaPractica:8,notaComplexivo:7.8,
    estadoEvaluacion:"APROBADO",
    origen:"ncomplex",
    updatedAt:"2026-08-05T10:05:00.000Z"
  });

  let merged=await repo.getByPeriodoCedula(periodoId,cedula);
  check(merged.Notart===8&&merged.Notdef===9&&merged.Notafinal===8.3,"Guardar Ncomplex no debe borrar N-ART, N-DEF ni N-FIN");
  check(merged.observacionDefensa==="DEFENSA REGISTRADA","Guardar Ncomplex no debe borrar la observación de Defensas");
  check(merged.notaTeorica===7.5&&merged.notaPractica===8&&merged.notaComplexivo===7.8,"Deben conservarse las notas de Ncomplex");

  await repo.saveMany([{
    periodoId,cedula,
    Notdef:9.5,Notafinal:8.45,
    origen:"defensas",
    updatedAt:"2026-08-05T10:10:00.000Z"
  }]);

  merged=await repo.getByPeriodoCedula(periodoId,cedula);
  check(merged.Notart===8&&merged.Notdef===9.5&&merged.Notafinal===8.45,"Defensas debe poder actualizar solo sus campos");
  check(merged.notaComplexivo===7.8&&merged.notaTeorica===7.5,"Actualizar Defensas no debe borrar Ncomplex");

  await repo.saveMany([{
    periodoId,cedula,
    notaPractica:8.5,notaComplexivo:8.1,
    origen:"ncomplex",
    updatedAt:"2026-08-05T10:15:00.000Z"
  }]);

  merged=await repo.getByPeriodoCedula(periodoId,cedula);
  check(merged.notaTeorica===7.5&&merged.notaPractica===8.5&&merged.notaComplexivo===8.1,"Ncomplex debe actualizar solo sus campos");
  check(merged.Notart===8&&merged.Notdef===9.5&&merged.Notafinal===8.45,"Actualizar Ncomplex no debe borrar Defensas");

  if(errors.length){
    console.error("\nVERIFICACIÓN PRESERVACIÓN DE NOTAS: ERROR\n");
    errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
    process.exit(1);
  }

  console.log("VERIFICACIÓN PRESERVACIÓN DE NOTAS: OK");
})().catch((error)=>{
  console.error("VERIFICACIÓN PRESERVACIÓN DE NOTAS: ERROR",error);
  process.exit(1);
});