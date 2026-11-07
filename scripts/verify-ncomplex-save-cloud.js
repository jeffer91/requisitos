"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const code=fs.readFileSync(path.join(__dirname,"../Ncomplex/ncomplex.save.js"),"utf8");
const period="2026-04__2026-09",cedula="0101234567";
let group="PRESENCIAL",cloudCalls=0,localSaves=0,dirty=true;
const status={textContent:"",className:""},button={textContent:"",disabled:false};
const state={selectedPeriodId:period,dirty:{x:true},saving:false,parsedImport:null,importApplied:false};
const doc={getElementById(id){
 if(id==="ncomplex-status")return status;
 if(id==="ncomplex-btn-save")return button;
 if(id==="ncomplex-complexivo-grupo")return {value:group};
 return null;
}};
const row={id:cedula+"__"+period,idEstudiantePeriodo:cedula+"__"+period,periodoId:period,
 cedula,modalidadTitulacion:"EXAMEN_COMPLEXIVO",notaTeorica:9.7,notaPractica:9,notaOficial:9.28};
const window={
 NcomplexState:{
  get(){return state;},
  dirtyRows(){return dirty?[row]:[];},
  patch(values){Object.assign(state,values);},
  clearDirty(){dirty=false;state.dirty={};},
  recordId(x){return x.id;}
 },
 NcomplexCalculator:{recalculate(x){return x;}},
 ConNcomplex:{saveMany(rows){localSaves++;return Promise.resolve(rows);}},
 NcomplexFirebaseComplexivo:{async publish(args){
  cloudCalls++;assert.equal(args.onlyCedulas[0],cedula);
  assert.equal(args.periodoId,period);
  assert.equal(args.anyGroup,true,"Cada matrícula determina su grupo; no requiere selector global");
  return {ok:true,published:1};
 }}
};
const ctx=vm.createContext({window,document:doc,console,Promise,Date});
vm.runInContext(code,ctx);
async function run(){
 let result=await window.NcomplexSave.save();
 assert.equal(result.saved,1);
 assert.equal(result.firebase.published,1);
 assert.equal(cloudCalls,1);
 assert.match(status.textContent,/Firebase complexivos: 1/);
 assert.equal(localSaves,1);
 group="";dirty=true;state.dirty={x:true};
 result=await window.NcomplexSave.save();
 assert.equal(result.saved,1);
 assert.equal(cloudCalls,2,"La sincronización automática no depende del selector global de grupo");
 assert.match(status.textContent,/Firebase complexivos: 1/);
 console.log("VERIFICACIÓN GUARDADO BDLOCAL/FIREBASE: OK (sin grupo global y publicación automática)");
}
run().catch(err=>{console.error(err);process.exitCode=1;});
