"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const errors=[];
const stored=Object.create(null);
function check(value,message){if(!value){errors.push(message);}}
function clone(value){return JSON.parse(JSON.stringify(value));}
function idFor(row){return `outbox__${row.tabla||"registro"}__${row.registroId||row.cedula||"id"}`;}
function hash(row){return JSON.stringify(row.payload||{});}

const fakeRepo={
  normalize(row){
    const next={...clone(row),id:idFor(row),contentHash:hash(row)};
    next.estadoFirebase=next.estadoFirebase||next.statusFirebase||"PENDIENTE";
    next.statusFirebase=next.estadoFirebase;
    next.estadoSheets=next.estadoSheets||next.statusGoogle||"PENDIENTE";
    next.statusGoogle=next.estadoSheets;
    next.estadoSupabase=next.estadoSupabase||next.statusSupabase||"PENDIENTE";
    next.statusSupabase=next.estadoSupabase;
    return next;
  },
  mergeExisting(existing,incoming){
    if(!existing){return {...incoming};}
    const changed=existing.contentHash!==incoming.contentHash;
    const next={...existing,...incoming,id:existing.id};
    if(changed){
      next.estadoFirebase=next.statusFirebase="PENDIENTE";
      next.estadoSheets=next.statusGoogle="PENDIENTE";
      next.estadoSupabase=next.statusSupabase="PENDIENTE";
    }
    return next;
  },
  getByIds(ids){return Promise.resolve(ids.map((id)=>stored[id]&&clone(stored[id])).filter(Boolean));},
  save(row,options){
    const normalized=this.normalize(row);
    stored[normalized.id]=clone(normalized);
    return Promise.resolve(clone(normalized));
  },
  saveMany(rows,options){return Promise.all(rows.map((row)=>this.save(row,options)));}
};

const sandbox={
  console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Set,
  setTimeout,clearTimeout,
  CustomEvent:function(type,options){this.type=type;this.detail=options&&options.detail||{};},
  dispatchEvent(){},
  BDLRepoCambios:fakeRepo,
  BDLRepositories:{get(){return fakeRepo;}}
};
sandbox.window=sandbox;
const context=vm.createContext(sandbox);
const source=fs.readFileSync(path.join(ROOT,"BDLocal/patches/bdl.changes.firebase-policy.js"),"utf8");
new vm.Script(source,{filename:"bdl.changes.firebase-policy.js"}).runInContext(context);

(async()=>{
  await sandbox.BDLFirebaseOutboxPolicy.install();
  check(fakeRepo.firebaseTargetPolicy.defaultTarget==="firebase","La cola debe declarar Firebase como destino predeterminado");

  const first=await fakeRepo.save({
    tabla:"requisitos_estudiante",periodoId:"2026-04__2026-09",cedula:"1723456789",
    registroId:"1723456789__2026-04__2026-09",payload:{Financiero:"CUMPLE"}
  });
  check(first.estadoFirebase==="PENDIENTE","Un cambio normal debe quedar pendiente para Firebase");
  check(first.estadoSheets==="SINCRONIZADO","Un cambio normal no debe quedar pendiente para Sheets");
  check(first.estadoSupabase==="SINCRONIZADO","Un cambio normal no debe quedar pendiente para Supabase");

  first.estadoFirebase=first.statusFirebase="SINCRONIZADO";
  stored[first.id]=clone(first);
  const changed=await fakeRepo.save({
    tabla:"requisitos_estudiante",periodoId:"2026-04__2026-09",cedula:"1723456789",
    registroId:"1723456789__2026-04__2026-09",payload:{Financiero:"PENDIENTE"}
  });
  check(changed.estadoFirebase==="PENDIENTE","Cambiar el contenido debe reactivar Firebase");
  check(changed.estadoSheets==="SINCRONIZADO","Cambiar el contenido no debe reactivar Sheets");
  check(changed.estadoSupabase==="SINCRONIZADO","Cambiar el contenido no debe reactivar Supabase");

  const exportRow=await fakeRepo.save({
    tabla:"reporte_exportado",periodoId:"2026-04__2026-09",registroId:"reporte_1",
    target:"google",payload:{archivo:"reporte.xlsx"}
  });
  check(exportRow.estadoSheets==="PENDIENTE","Una acción explícita de Google sí debe quedar pendiente para Sheets");
  check(exportRow.estadoFirebase==="SINCRONIZADO","Una exportación exclusiva a Google no debe crear pendiente Firebase");
  check(exportRow.estadoSupabase==="SINCRONIZADO","Una exportación a Google no debe crear pendiente Supabase");

  const unchanged=await fakeRepo.save({
    tabla:"reporte_exportado",periodoId:"2026-04__2026-09",registroId:"reporte_1",
    target:"google",payload:{archivo:"reporte.xlsx"}
  });
  check(unchanged.contentHash===exportRow.contentHash,"El contenido idéntico debe conservar el mismo hash");

  if(errors.length){
    console.error("\nVERIFICACIÓN DE DESTINOS DE LA COLA: ERROR\n");
    errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
    process.exit(1);
  }
  console.log("VERIFICACIÓN DE DESTINOS DE LA COLA: OK");
})().catch((error)=>{
  console.error("VERIFICACIÓN DE DESTINOS DE LA COLA: ERROR",error);
  process.exit(1);
});
