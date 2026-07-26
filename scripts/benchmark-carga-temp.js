"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {performance}=require("node:perf_hooks");

const root=path.resolve(__dirname,"..");
const progress=[];
function CustomEvent(type,options){this.type=type;this.detail=options&&options.detail||{};}
const sandbox={
  console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Set,Map,
  performance,CustomEvent,setTimeout,clearTimeout,TextDecoder,
  dispatchEvent(event){if(event&&event.type==="carga:progress"){progress.push(event.detail||{});}},
  localStorage:{getItem(){return null;},setItem(){},removeItem(){}}
};
sandbox.window=sandbox;sandbox.parent=sandbox;sandbox.top=sandbox;
const context=vm.createContext(sandbox);
function load(file){
  const source=fs.readFileSync(path.join(root,file),"utf8");
  new vm.Script(source,{filename:file}).runInContext(context);
}

load("Carga/carga.norm-compat.js");
load("Carga/mapping/carga.field-map.js");
load("Carga/mapping/carga.detect-periodo.js");
load("Carga/mapping/carga.detect-carrera.js");
load("Carga/readers/carga.reader.csv.js");
load("Carga/process/carga.normalizer.js");

const total=100000;
const lines=new Array(total+1);
lines[0]="NumeroIdentificacion;Nombres;CodigoCarrera;NombreCarrera;CorreoPersonal;Academico";
for(let i=0;i<total;i+=1){
  const id=String(100000000+(i%900000000));
  lines[i+1]=`${id};ESTUDIANTE ${i};ENF;ENFERMERÍA;;CUMPLE`;
}
const source=lines.join("\r\n");

(async()=>{
  const csvStart=performance.now();
  const rows=await sandbox.CargaReaderCSV.parseAsync(source);
  const csvMs=performance.now()-csvStart;
  if(rows.length!==total){throw new Error(`CSV incompleto: ${rows.length} de ${total}`);}
  if(rows[0].NumeroIdentificacion!=="100000000"||rows[total-1].Nombres!==`ESTUDIANTE ${total-1}`){throw new Error("CSV alteró la primera o la última fila");}

  const normStart=performance.now();
  const normalized=await sandbox.CargaNormalizer.normalizeRowsAsync(rows,{periodoId:"2026-04__2026-09",periodoLabel:"Abril 2026 a septiembre 2026",fileName:"benchmark.csv",origen:"archivo"});
  const normMs=performance.now()-normStart;
  if(!normalized||normalized.rowsMapeadas.length!==total){throw new Error("La normalización no conservó todas las filas");}
  if(!normalized.rowsMapeadas[0].numeroIdentificacion){throw new Error("No se normalizó numeroIdentificacion");}

  const totalMs=csvMs+normMs;
  const heapMb=Math.round(process.memoryUsage().heapUsed/1048576);
  if(csvMs>10000){throw new Error(`Lectura CSV demasiado lenta: ${Math.round(csvMs)} ms`);}
  if(normMs>10000){throw new Error(`Normalización demasiado lenta: ${Math.round(normMs)} ms`);}
  if(totalMs>15000){throw new Error(`Proceso combinado demasiado lento: ${Math.round(totalMs)} ms`);}
  if(progress.length<4){throw new Error("No se emitió progreso suficiente durante la carga grande");}

  console.log(JSON.stringify({ok:true,filas:total,tamanoMb:Number((Buffer.byteLength(source)/1048576).toFixed(2)),csvMs:Math.round(csvMs),normalizacionMs:Math.round(normMs),totalMs:Math.round(totalMs),heapMb,eventosProgreso:progress.length},null,2));
})().catch((error)=>{
  console.error(error);
  process.exit(1);
});
