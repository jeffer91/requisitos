"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const errors=[];
function check(condition,message){if(!condition){errors.push(message);}}
function equal(actual,expected,message){check(actual===expected,`${message}. Esperado: ${expected}; recibido: ${actual}`);}
const files=[
  "BDLocal/firebase/bdl.firebase.schema.v2.js",
  "BDLocal/firebase/bdl.firebase.identity.js",
  "BDLocal/firebase/bdl.firebase.mapper.v2.js"
];
const window={
  BL2Config:{fields:{requirements:["Academico","Documentacion","Financiero","Titulacion","PracticasVinculacion","Vinculacion","SeguimientoGraduados","Ingles","ActualizacionDatos","AprobacionTitulacion","AprobacionComplexivoProyecto"]},
    utils:{
      normalizeCedula(value){return String(value==null?"":value).replace(/[^0-9A-Za-z]/g,"");},
      canonicalPeriodId(value){value=String(value==null?"":value).trim();const match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);return match?`${match[1]}-${match[2]}__${match[3]}-${match[4]}`:value.replace(/_+/g,"__");},
      normalizeKey(value){return String(value==null?"":value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"");}
    }},
  dispatchEvent(){}
};
const context=vm.createContext({window,CustomEvent:function(name,options){this.type=name;this.detail=options&&options.detail;},console,Date,JSON,Object,String,Array,Number,Math});
try{files.forEach(file=>new vm.Script(fs.readFileSync(path.join(ROOT,file),"utf8"),{filename:file}).runInContext(context));}catch(error){errors.push(error.message);}
const mapper=window.RequisitosFirebaseMapper;
if(mapper){
  const row={numeroIdentificacion:"1723456789",Nombres:"ESTUDIANTE DE PRUEBA",CorreoPersonal:"estudiante@example.com",CorreoInstitucional:"estudiante@institucion.edu",Celular:"0999999999",telegramUser:"@estudiante",telegramChatId:"123456",Sede:"MATRIZ",CodigoCarrera:"ENF",NombreCarrera:"ENFERMERÍA",periodoId:"2026-04__2026-09",periodoLabel:"Abril 2026 a Septiembre 2026",division:"A",estadoMatricula:"ACTIVO",modalidadTitulacion:"TRABAJO_TITULACION",Academico:"CUMPLE",Financiero:"NO CUMPLE",Notart:"8.5",Notdef:"9",Notafinal:"8.65",createdAt:"2026-07-23T12:00:00.000Z",updatedAt:"2026-07-23T13:00:00.000Z",version:1};
  const requirements=[{periodoId:row.periodoId,cedula:row.numeroIdentificacion,requisitoKey:"Ingles",estado:"PENDIENTE"}];
  const first=mapper.bundle(row,{requirements});
  const changedMeta=mapper.bundle({...row,createdAt:"2025-01-01T00:00:00.000Z",updatedAt:"2026-08-01T00:00:00.000Z",version:99},{requirements});
  const changedBusiness=mapper.bundle({...row,division:"B"},{requirements});
  check(first.ok,"El paquete completo debe ser válido");
  equal(first.documents.matriculas.id,"2026-04__2026-09__1723456789","ID remoto de matrícula");
  equal(first.documents.matriculas.localId,"1723456789__2026-04__2026-09","ID local de matrícula");
  equal(first.documents.requisitos.valores.Ingles,"PENDIENTE","Requisito separado");
  equal(first.documents.notas.notaFinal,8.65,"Nota final");
  ["estudiantes","matriculas","requisitos","notas"].forEach(entity=>{
    check(/^h[0-9a-f]{8}$/.test(first.documents[entity].dataHash),`Hash válido para ${entity}`);
    equal(first.documents[entity].dataHash,changedMeta.documents[entity].dataHash,`El hash de ${entity} debe ignorar fechas y versión`);
  });
  check(first.documents.matriculas.dataHash!==changedBusiness.documents.matriculas.dataHash,"El hash debe cambiar cuando cambia la división");
  check(!Object.prototype.hasOwnProperty.call(mapper.functionalContent(first.documents.matriculas),"updatedAt"),"functionalContent debe excluir updatedAt");
}else{errors.push("RequisitosFirebaseMapper no quedó disponible.");}
if(errors.length){console.error("\nVERIFICACIÓN DEL MAPEADOR FIREBASE: ERROR\n");errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));process.exit(1);}
console.log("VERIFICACIÓN DEL MAPEADOR FIREBASE: OK");
