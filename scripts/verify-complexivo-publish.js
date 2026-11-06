"use strict";
/* Publicación manual de exámenes complexivos: idempotencia y no sobrescritura. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../Ncomplex/ncomplex.firebase-complexivo.js"),"utf8");
const period="2025-10__2026-03",id="0101234567";
const elements={
 "ncomplex-filter-periodo":{value:period},
 "ncomplex-complexivo-grupo":{value:"PRESENCIAL"},
 "ncomplex-btn-complexivo-sync":{disabled:false},
 "ncomplex-firebase-status":{textContent:"",className:""}
};
let saved=[],remote=new Map(),confirms=0,disconnected=false,eligible=true;
const school={cedula:id,Nombres:"EJEMPLO ESTUDIANTE",periodoId:period,modalidad:"presencial"};
const note={periodoId:period,cedula:id,modalidadTitulacion:"EXAMEN_COMPLEXIVO",
 estadoEvaluacion:"APROBADO",notaTeorica:8,notaPractica:9,notaOficial:8.6,
 notaComplexivo:8.6,notaMinimaAprobacion:7,oportunidadAplicada:"ORDINARIA"};
const schoolRows=[school],noteRows=[note];
const window={
 confirm(message){confirms++;return true;},
 NcomplexState:{get(){return {dirty:{}};}},
 ConNcomplex:{
  async listEvaluations(){return noteRows;},
  async listStudents(){return schoolRows;},
  async checkRequirements(){return eligible?{eligible:true,complete:9,total:9,missing:[]}: {eligible:false,complete:8,total:9,reason:"Financiero (PENDIENTE)"};}
 },
 RequisitosFirebaseOperationCenter:{async ensure(){if(disconnected)throw Error("offline");}},
 RequisitosFirebaseRepository:{
  async getById(entity,documentId){assert.equal(entity,"complexivo");return remote.get(documentId)||null;},
  async writeChecked(entity,doc,options){
   assert.equal(entity,"complexivo");assert.equal(options.expected.exists,false);
   const key=doc.periodoId+"__"+doc.cedula;
   if(remote.has(key))throw Error("duplicate");
   saved.push(doc);
   remote.set(key,{data:doc});
   return {ok:true};
  }
 }
};
const document={readyState:"loading",getElementById:id=>elements[id]||null,addEventListener(){}};
const context={window,document,console,Map,Math,Object};
vm.createContext(context);vm.runInContext(source,context,{filename:"ncomplex.firebase-complexivo.js"});
const api=window.NcomplexFirebaseComplexivo;
async function main(){
 assert.equal(api.normalize(note,period,"PRESENCIAL").notaOficial,8.6);
 assert.equal(api.normalize({...note,notaTeorica:20},period,"PRESENCIAL"),null,"Desglose discordante se rechaza");
 await api.publish();
 assert.equal(saved.length,1,"Se registra el primer examen");
 assert.equal(remote.size,1);
 await api.publish();
 assert.equal(saved.length,1,"Reimportación idéntica no duplica");
 assert.equal(confirms,1,"Sin cambios no se pide una nueva publicación");
 remote.set(period+"__"+id,{data:{...saved[0],dataHash:"diferente"}});
 await api.publish();
 assert.equal(saved.length,1,"No sobrescribe examen ajeno");
 assert.match(elements["ncomplex-firebase-status"].textContent,/conflictos: 1/);
 remote.clear();
 elements["ncomplex-complexivo-grupo"].value="ONLINE";
 await api.publish();
 assert.equal(saved.length,1,"No publica matrícula presencial en grupo online");
 elements["ncomplex-complexivo-grupo"].value="PRESENCIAL";
 eligible=false;
 await api.publish();
 assert.equal(saved.length,1,"No publica cuando Financiero está pendiente");
 assert.match(elements["ncomplex-firebase-status"].textContent,/bloqueados por requisitos: 1/);
 eligible=true;
 disconnected=true;
 await api.publish();
 assert.equal(saved.length,1,"Una desconexión no produce cambios");
 // Una única importación contiene ahora dos modalidades; se publican por separado.
 disconnected=false;remote.clear();
 note.grupoInforme="PRESENCIAL";
 const onlineId="0201234567";
 schoolRows.push({cedula:onlineId,Nombres:"EJEMPLO ONLINE",periodoId:period,
  NombreCarrera:"ADMINISTRACION ONLINE",modalidadEstudio:"ONLINE"});
 noteRows.push({...note,cedula:onlineId,grupoInforme:"ONLINE",NombreCarrera:"ADMINISTRACION ONLINE"});
 elements["ncomplex-complexivo-grupo"].value="PRESENCIAL";
 const presencial=await api.publish();
 assert.equal(presencial.published,1);
 assert.equal(presencial.invalid.length,0,"Online no se marca como conflicto al sincronizar presencial.");
 assert.equal(remote.size,1);
 elements["ncomplex-complexivo-grupo"].value="ONLINE";
 const online=await api.publish();
 assert.equal(online.published,1,"Online se publica sin reutilizar la modalidad presencial.");
 assert.equal(online.invalid.length,0);
 assert.equal(remote.size,2);
 assert.equal(remote.get(period+"__"+onlineId).data.grupoInforme,"ONLINE");
 console.log("VERIFICACIÓN PUBLICADOR COMPLEXIVO: OK (modalidades mixtas conservadas, idempotencia y seguridad).");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
