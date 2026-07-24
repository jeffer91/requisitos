"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const errors=[];
function check(value,message){if(!value){errors.push(message);}}
function CustomEvent(type,options){this.type=type;this.detail=options&&options.detail||{};}

const rawCache={
  meta:{revision:1},
  periods:[
    {id:"2026-04__2026-09",periodoId:"2026-04__2026-09",label:"Abril a septiembre"},
    {id:"old",periodoId:"old",label:"Eliminado",eliminado:true}
  ],
  students:[
    {
      id:"1723456789__2026-04__2026-09",idEstudiantePeriodo:"1723456789__2026-04__2026-09",
      cedula:"1723456789",numeroIdentificacion:"1723456789",periodoId:"2026-04__2026-09",
      Nombres:"ACTIVO",NombreCarrera:"ENFERMERÍA",estadoMatricula:"ACTIVO",division:"A",
      Notart:8.5,Notdef:9,Notafinal:8.65
    },
    {
      id:"1711111111__2026-04__2026-09",cedula:"1711111111",periodoId:"2026-04__2026-09",
      Nombres:"ELIMINADO",eliminado:true
    }
  ],
  requirements:[
    {id:"req1",cedula:"1723456789",periodoId:"2026-04__2026-09",requisitoKey:"Financiero",valor:"CUMPLE"},
    {id:"req2",cedula:"1723456789",periodoId:"2026-04__2026-09",requisitoKey:"Ingles",valor:"CUMPLE",_firebaseDeleted:true}
  ],
  summaries:{},diagnostics:[]
};

const registered={};
const U={
  readCache(){return rawCache;},
  writeCache(cache){return cache;},
  normalizeCache(cache){return cache;},
  filterStudents(rows,options){
    options=options||{};
    return (rows||[]).filter((row)=>!options.periodoId||row.periodoId===options.periodoId);
  },
  normalizeCedula(value){return String(value||"").replace(/\D/g,"");},
  canonicalPeriodId(value){return String(value||"").replace(/_+/g,"__");},
  samePeriod(a,b){return !b||String(a)===String(b);},
  normalizePeriod(row){return row;},
  text(value){return String(value==null?"":value).trim();},
  clone(value){return JSON.parse(JSON.stringify(value));},
  nowISO(){return "2026-07-24T12:00:00.000Z";}
};
const HUB={
  register(name,api){registered[name]=api;return true;},
  ready(){return Promise.resolve(true);},
  refreshCache(){return Promise.resolve(rawCache);}
};
const sandbox={
  console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Set,
  CustomEvent,dispatchEvent(){},BDLocalConUtils:U,BDLocalConexiones:HUB
};
sandbox.window=sandbox;
const context=vm.createContext(sandbox);
function load(file){new vm.Script(fs.readFileSync(path.join(ROOT,file),"utf8"),{filename:file}).runInContext(context);}

load("BDLocal/conexiones/cone.active-filter.js");
load("BDLocal/conexiones/cone.reportes.js");

const sanitized=sandbox.BDLocalConUtils.readCache();
check(sanitized.periods.length===1,"La caché activa debe excluir períodos eliminados");
check(sanitized.students.length===1,"La caché activa debe excluir estudiantes eliminados");
check(sanitized.requirements.length===1,"La caché activa debe excluir requisitos eliminados");
check(sandbox.BDLocalConUtils.filterStudents(rawCache.students,{periodoId:"2026-04__2026-09"}).length===1,"filterStudents debe excluir tombstones aunque reciba filas sin sanear");

const report=registered.reportes.buildReportData({periodoId:"2026-04__2026-09"});
check(report.estudiantes.length===1,"Reportes debe incluir solo estudiantes activos");
check(report.requisitos.length===1,"Reportes debe incluir solo requisitos activos");
check(report.matriculas.length===1&&report.matriculas[0].division==="A","Reportes debe incluir el contexto de matrícula");
check(report.notas.length===1&&report.notas[0].Notafinal===8.65,"Reportes debe incluir las notas disponibles");
check(report.resumen.totalEstudiantes===1&&report.resumen.totalRegistrosNotas===1,"El resumen de Reportes debe coincidir con sus datos");

if(errors.length){
  console.error("\nVERIFICACIÓN CACHÉ ACTIVA Y REPORTES: ERROR\n");
  errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
  process.exit(1);
}
console.log("VERIFICACIÓN CACHÉ ACTIVA Y REPORTES: OK");
