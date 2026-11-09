"use strict";
/* Publicación directa (igual que Carga) en /complexivos: idempotencia, actualización con
 * control de versión y detección de cambios concurrentes. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../Ncomplex/ncomplex.firebase-complexivo.js"),"utf8");
const period="2025-10__2026-03",id="0101234567";
const elements={
 "ncomplex-filter-periodo":{value:period},
 "ncomplex-complexivo-grupo":{value:"PRESENCIAL"},
 "ncomplex-btn-complexivo-sync":{disabled:false},
 "ncomplex-firebase-status":{textContent:"",className:""}
};
let saved=[],remote=new Map(),confirms=0,disconnected=false,eligible=true,concurrent=false;
const school={cedula:id,Nombres:"EJEMPLO ESTUDIANTE",periodoId:period,modalidad:"presencial",
 CodigoCarrera:"550413A02-P-1701",NombreCarrera:"ADMINISTRACION"};
const note={periodoId:period,cedula:id,modalidadTitulacion:"EXAMEN_COMPLEXIVO",
 estadoEvaluacion:"APROBADO",notaTeorica:8,notaPractica:9,notaOficial:8.6,
 notaComplexivo:8.6,notaMinimaAprobacion:7,oportunidadAplicada:"ORDINARIA"};
const schoolRows=[school],noteRows=[note];
const window={
 confirm(message){confirms++;return true;},
 NcomplexState:{get(){return {dirty:{}};}},
 NcomplexFirebaseAuth:{async requireWriter(){return {uid:"test-user"};}},
 ConNcomplex:{
  async listEvaluations(){return noteRows;},
  async listStudents(){return schoolRows;},
  async checkRequirements(){return eligible?{eligible:true,complete:9,total:9,missing:[]}: {eligible:false,complete:8,total:9,reason:"Financiero (PENDIENTE)"};}
 },
 RequisitosFirebaseOperationCenter:{async ensure(){if(disconnected)throw Error("offline");}},
 RequisitosFirebaseRepository:{
  async getById(entity,documentId){assert.equal(entity,"complexivos");return remote.get(documentId)||null;},
  async writeChecked(entity,doc,options){
   assert.equal(entity,"complexivos");
   const key=doc.periodoId+"__"+doc.cedula,current=remote.get(key);
   const expected=options.expected||{};
   // Semántica del repositorio: la escritura solo procede si el remoto sigue
   // siendo el que se leyó (inexistente o con el mismo dataHash).
   const matches=expected.exists===false?!current:!!current&&current.data.dataHash===expected.hash;
   if(!matches||concurrent){const e=Error("conflict");e.code="FIREBASE_CONFLICT";throw e;}
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
 assert.equal(confirms,0,"La publicación automática no debe mostrar confirmaciones manuales");
 // BDLocal es la autoridad: si Firebase tiene otra versión, se actualiza con su hash como base.
 remote.set(period+"__"+id,{data:{...saved[0],dataHash:"diferente",version:1}});
 const updated=await api.publish();
 assert.equal(saved.length,2,"Actualiza la versión distinta de Firebase con BDLocal");
 assert.equal(updated.published,1);
 assert.equal(remote.get(period+"__"+id).data.dataHash,saved[0].dataHash);
 // Si otro equipo cambia el documento entre la lectura y la escritura, no se pisa.
 remote.set(period+"__"+id,{data:{...saved[0],dataHash:"otro-equipo",version:2}});
 concurrent=true;
 await api.publish();
 concurrent=false;
 assert.equal(saved.length,2,"Un cambio concurrente queda como conflicto");
 assert.match(elements["ncomplex-firebase-status"].textContent,/conflictos: 1/);
 saved.length=1;
 remote.clear();
 elements["ncomplex-complexivo-grupo"].value="ONLINE";
 await api.publish({anyGroup:false});
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
 const presencial=await api.publish({anyGroup:false});
 assert.equal(presencial.published,1);
 assert.equal(presencial.invalid.length,0,"Online no se marca como conflicto al sincronizar presencial.");
 assert.equal(remote.size,1);
 elements["ncomplex-complexivo-grupo"].value="ONLINE";
 const online=await api.publish({anyGroup:false});
 assert.equal(online.published,1,"Online se publica sin reutilizar la modalidad presencial.");
 assert.equal(online.invalid.length,0);
 assert.equal(remote.size,2);
 assert.equal(remote.get(period+"__"+onlineId).data.grupoInforme,"ONLINE");
 remote.clear();
 elements["ncomplex-complexivo-grupo"].value="";
 const unified=await api.publish({periodoId:period,anyGroup:true,confirmedByCenter:true});
 assert.equal(unified.published,2,"No exigir un grupo global para publicar ambos registros.");
 assert.equal(remote.get(period+"__"+id).data.grupoInforme,"PRESENCIAL");
 assert.equal(remote.get(period+"__"+onlineId).data.grupoInforme,"ONLINE");
 const unknownId="0301234567";
 schoolRows.push({cedula:unknownId,Nombres:"SIN MODALIDAD",periodoId:period});
 noteRows.push({...note,cedula:unknownId,grupoInforme:""});
 const unknown=await api.publish({periodoId:period,anyGroup:true,
  onlyCedulas:[unknownId],confirmedByCenter:true});
 assert.equal(unknown.published,0,"No inventar modalidad cuando BDLocal no la conoce.");
 assert.match(unknown.invalid.join(","),/no identifica la modalidad/);
 // Sin campo de modalidad: el código oficial -P-/-L- de la carrera la determina.
 const codeId="0401234567",codeOnlineId="0501234567";
 schoolRows.push({cedula:codeId,Nombres:"POR CODIGO",periodoId:period,CodigoCarrera:"550411C02-P-1701",NombreCarrera:"CONTABILIDAD"});
 schoolRows.push({cedula:codeOnlineId,Nombres:"POR CODIGO L",periodoId:period,CodigoCarrera:"560612A01-L-1701",NombreCarrera:"REDES"});
 noteRows.push({...note,cedula:codeId,grupoInforme:""},{...note,cedula:codeOnlineId,grupoInforme:""});
 const byCode=await api.publish({periodoId:period,anyGroup:true,onlyCedulas:[codeId,codeOnlineId],confirmedByCenter:true});
 assert.equal(byCode.published,2,"La modalidad se deduce del código de carrera.");
 assert.equal(remote.get(period+"__"+codeId).data.grupoInforme,"PRESENCIAL");
 assert.equal(remote.get(period+"__"+codeOnlineId).data.grupoInforme,"ONLINE");
 console.log("VERIFICACIÓN PUBLICADOR COMPLEXIVO: OK (identificación por período y cédula, sin grupo global).");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
