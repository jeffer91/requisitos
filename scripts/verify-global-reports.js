"use strict";

/* =========================================================
Archivo: verify-global-reports.js
Ruta: /scripts/verify-global-reports.js
Función:
- Verificar que Global cargue el runtime PDF directo, sin gzip ni eval.
- Confirmar que el PDF exponga el modelo institucional requerido por Word.
- Validar que la implementación Word comprimida sea legible y compatible.
- Evitar que los botones PDF y Word vuelvan a quedar disponibles antes de sus APIs.
========================================================= */

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const zlib=require("node:zlib");

const ROOT=path.resolve(__dirname,"..");
const errors=[];
const checks=[];

function read(file){return fs.readFileSync(path.join(ROOT,file),"utf8");}
function check(value,message){
  checks.push({ok:!!value,message});
  if(!value){errors.push(message);console.error("[verify-global-reports] ERROR:",message);}
  else{console.log("[OK]",message);}
}
function syntax(source,file){
  try{new vm.Script(source,{filename:file});return true;}
  catch(error){errors.push(`${file}: ${error.message}`);console.error("[verify-global-reports] ERROR:",file,error.message);return false;}
}

const bootstrap=read("Global/global.bootstrap.js");
const pdfRuntime=read("Global/global.pdf.runtime.js");
const wordLoader=read("Global/global.word.js");
let wordImplementation="";

try{
  wordImplementation=zlib.gunzipSync(fs.readFileSync(path.join(ROOT,"Global/global.word.impl.gz"))).toString("utf8");
}catch(error){
  errors.push(`Global/global.word.impl.gz: ${error.message}`);
}

syntax(bootstrap,"Global/global.bootstrap.js");
syntax(pdfRuntime,"Global/global.pdf.runtime.js");
syntax(wordLoader,"Global/global.word.js");
if(wordImplementation){syntax(wordImplementation,"Global/global.word.impl.gz::global.word.js");}

check(bootstrap.includes('load("global.pdf.runtime.js",pdfReady)'),"Global carga el runtime PDF directo.");
check(!bootstrap.includes('load("global.pdf.js")'),"Global no usa el cargador PDF comprimido heredado.");
check(bootstrap.includes("window.__globalPdfReady"),"Global espera la API PDF antes de continuar.");
check(bootstrap.includes("window.__globalWordReady"),"Global espera la API Word antes de cargar la aplicación.");
check(bootstrap.indexOf("global.pdf.runtime.js")<bootstrap.indexOf("global.word.js"),"PDF queda disponible antes de inicializar Word.");
check(bootstrap.indexOf("global.word.js")<bootstrap.indexOf("global.app.js"),"Los reportes quedan listos antes de habilitar los botones de Global.");
check(!pdfRuntime.includes("DecompressionStream"),"El runtime PDF no depende de DecompressionStream.");
check(!pdfRuntime.includes("eval)(source"),"El runtime PDF no ejecuta código mediante eval.");

class FakeCustomEvent{
  constructor(type,options){this.type=type;this.detail=options&&options.detail||{};}
}

const selectValues={
  "#globalFiltroDesde":{text:"Febrero 2025 a Mayo 2025"},
  "#globalFiltroHasta":{text:"Noviembre 2025 a Mayo 2026"},
  "#globalFiltroCarrera":{text:"UNIVERSITARIA EN EDUCACIÓN INICIAL ONLINE"},
  "#globalFiltroDivision":{text:"Todas las divisiones"},
  "#globalFiltroRequisito":{text:"Todos los requisitos"},
  "#globalFiltroTipo":{text:"Universitaria"}
};

function fakeSelect(label){return {options:[{text:label}],selectedIndex:0};}
const documentObject={
  querySelector(selector){return selectValues[selector]?fakeSelect(selectValues[selector].text):null;},
  createElement(){return {style:{},click(){},setAttribute(){},appendChild(){},removeChild(){}};},
  body:{appendChild(){},removeChild(){}}
};

const sampleData={
  ok:true,
  resumen:{totalEstudiantes:8,totalCarreras:1,totalPeriodos:3,totalGraduados:8,porcentajeCumplimiento:92},
  students:[{cedula:"0100000001",nombreCompleto:"ESTUDIANTE PRUEBA"}],
  periods:[{id:"2025-02__2025-05"},{id:"2025-11__2026-05"}],
  careers:[{nombre:"UNIVERSITARIA EN EDUCACIÓN INICIAL ONLINE"}],
  graduados:{total:8,porPeriodo:[{periodo:"Febrero 2025 a Mayo 2025",graduados:3},{periodo:"Noviembre 2025 a Mayo 2026",graduados:5}]}
};

const windowObject={
  document:documentObject,
  location:{href:"file:///repo/Global/global.html"},
  CustomEvent:FakeCustomEvent,
  dispatchEvent(){return true;},
  addEventListener(){},
  setTimeout,
  clearTimeout,
  open(){return null;},
  GlobalConfig:{
    app:{unidad:"Unidad de Titulación y Eficiencia Terminal"},
    branding:{logoPath:"assets/branding/logo-instituto.png"},
    firmas:[
      {responsabilidad:"ELABORADO POR:",nombre:"Mgtr. Jefferson Villarreal",cargo:"Coordinador de Titulación y Eficiencia Terminal"},
      {responsabilidad:"REVISADO POR:",nombre:"Mpde. Martha Tomalá",cargo:"Secretaria General"},
      {responsabilidad:"APROBADO POR:",nombre:"Dr. Alex León T.",cargo:"Vicerrector"}
    ],
    secciones:[
      {id:"resumen",label:"Resumen",titulo:"Resumen general",pdfTitulo:"Reporte global - Resumen general"},
      {id:"graduados",label:"Graduados",titulo:"Graduados por período",pdfTitulo:"Reporte global - Graduados por período"}
    ]
  },
  GlobalApp:{
    rows:{
      resumen(){return [{indicador:"Total estudiantes",valor:8,detalle:"Estudiantes filtrados"}];},
      graduados(){return sampleData.graduados.porPeriodo.slice();},
      students(){return [{cedula:"0100000001",nombres:"ESTUDIANTE PRUEBA",carrera:"EDUCACIÓN",periodo:"2025",cumplimiento:100}];}
    }
  }
};
windowObject.window=windowObject;

const sandbox={
  window:windowObject,document:documentObject,CustomEvent:FakeCustomEvent,
  console,Date,Intl,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Set,Map,URL,
  Uint8Array,Uint16Array,Uint32Array,DataView,ArrayBuffer,TextEncoder,Blob,
  setTimeout,clearTimeout,encodeURIComponent,decodeURIComponent,escape,unescape
};

try{
  const context=vm.createContext(sandbox);
  new vm.Script(pdfRuntime,{filename:"Global/global.pdf.runtime.js"}).runInContext(context);
  const pdf=windowObject.GlobalPDF;
  ["generate","buildModel","tableForSection","summaryText","observations","filterRows","tableExplanation","label","graduateRows","getSignatures"].forEach((method)=>{
    check(pdf&&typeof pdf[method]==="function",`GlobalPDF expone ${method}().`);
  });
  check(pdf&&pdf.version!=="loading","GlobalPDF queda disponible sin proxy de carga.");

  const pdfModel=pdf.buildModel({
    section:"resumen",
    filters:{carrera:"EDUCACION",tipoCarrera:"UNIVERSITARIA"},
    data:sampleData
  });
  check(pdfModel&&pdfModel.table&&pdfModel.table.rows.length===1,"El PDF construye la tabla institucional de la sección activa.");
  check(pdfModel&&pdfModel.filterRows.length===2,"El PDF conserva los filtros visibles.");
  check(pdfModel&&pdfModel.summary.length>=3,"El PDF construye el resumen ejecutivo.");
  check(pdfModel&&pdfModel.signatures.length===3,"El PDF incorpora las firmas institucionales configuradas.");

  if(wordImplementation){
    new vm.Script(wordImplementation,{filename:"Global/global.word.impl.gz::global.word.js"}).runInContext(context);
    const word=windowObject.GlobalWord;
    check(word&&typeof word.generate==="function","GlobalWord expone generate().");
    check(word&&typeof word.buildReportModel==="function","GlobalWord expone buildReportModel().");
    const wordModel=word.buildReportModel({
      section:"graduados",
      filters:{periodoDesde:"2025-02__2025-05",periodoHasta:"2025-11__2026-05"},
      data:sampleData
    });
    check(wordModel&&wordModel.table&&wordModel.table.rows.length===2,"Word reutiliza correctamente la tabla construida por GlobalPDF.");
    check(wordModel&&wordModel.summary.length>=3,"Word reutiliza el resumen institucional de GlobalPDF.");
    check(wordModel&&wordModel.signatures.length===3,"Word conserva las firmas institucionales.");
  }
}catch(error){
  errors.push(`Ejecución del runtime Global: ${error.stack||error.message||error}`);
}

if(errors.length){
  console.error(`\nVERIFICACIÓN REPORTES GLOBAL: ERROR (${errors.length})`);
  errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
  process.exit(1);
}

console.log(`\nVERIFICACIÓN REPORTES GLOBAL: OK (${checks.length} comprobaciones)`);
