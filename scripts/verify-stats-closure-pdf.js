"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const ROOT=path.resolve(__dirname,"..");
const errors=[];

function read(file){return fs.readFileSync(path.join(ROOT,file),"utf8");}
function check(value,message){if(!value){errors.push(message);}}
function syntax(file){try{new vm.Script(read(file),{filename:file});}catch(error){errors.push(`${file}: ${error.message}`);}}
function ascii(bytes,start,end){
  let out="";
  const from=Math.max(0,Number(start||0));
  const to=Math.min(bytes.length,end==null?bytes.length:Number(end));
  for(let i=from;i<to;i+=1){out+=String.fromCharCode(bytes[i]);}
  return out;
}

const htmlFile="Stats/stats.html";
const pdfFile="Stats/stats.closure.pdf.vector.js";
syntax(pdfFile);

const html=read(htmlFile);
const pdf=read(pdfFile);

check(html.includes("stats.closure.pdf.vector.js"),"Stats debe cargar el generador PDF de cierre");
check(!html.includes("node_modules/jspdf"),"Stats no debe depender de jsPDF instalado en node_modules");
check(!html.includes("html2pdf.bundle"),"Stats no debe cargar html2pdf para el cierre");
check(!pdf.includes("window.jspdf")&&!pdf.includes("new JsPDF")&&!pdf.includes("node_modules/jspdf"),"El generador PDF no debe depender de jsPDF");
check(!pdf.includes("window.html2canvas")&&!pdf.includes("html2canvas("),"El generador PDF no debe ejecutar html2canvas");
check(!pdf.includes("window.html2pdf")&&!pdf.includes("html2pdf()"),"El generador PDF no debe ejecutar html2pdf");
check(pdf.includes("%PDF-1.4"),"El generador debe construir una cabecera PDF propia");
check(pdf.includes("xref")&&pdf.includes("%%EOF"),"El generador debe construir tabla xref y cierre PDF");
check(pdf.includes("buildPdfBytes")&&pdf.includes("validatePdf"),"El generador debe exponer construcción y validación de bytes");

try{
  const document={
    readyState:"loading",
    addEventListener(){},
    getElementById(){return null;},
    createElement(){return {style:{},click(){},remove(){}};},
    body:{appendChild(){}}
  };
  const sandbox={
    console,Date,Math,JSON,Object,Array,String,Boolean,Number,Uint8Array,Blob,
    document,
    setTimeout,clearTimeout,
    URL:{createObjectURL(){return "blob:test";},revokeObjectURL(){}},
    alert(){}
  };
  sandbox.window=sandbox;
  sandbox.StatsApp={getState(){return {periodId:"2025_11_2026_05",sede:"",division:"",career:""};}};
  sandbox.StatsRules={
    BASE_REQUIREMENTS:[{key:"academico",label:"Académico"},{key:"ingles",label:"Inglés"}],
    REGULAR_EXTRA_REQUIREMENTS:[{key:"titulacion",label:"Titulación"}],
    requirementStatus(row){return {applies:true,cumple:row.ok!==false};},
    studentApproval(row){return {approved:row.ok!==false};}
  };

  vm.runInNewContext(pdf,sandbox,{filename:pdfFile});
  const api=sandbox.StatsClosurePDFVector;
  check(api&&api.version==="2.0.0-native-pdf","Debe exponerse el generador PDF nativo");

  if(api){
    const report={
      periodId:"2025_11_2026_05",
      total:3,active:2,retired:1,reached:1,notReached:2,arrivalRate:33.33,
      causes:[{label:"Inglés",total:1,percent:50},{label:"Retiro",total:1,percent:50}],
      final:[{label:"Aprobación titulación",total:1,cumple:1,no_cumple:0,avance:100}],
      detail:[
        {type:"retirado",causes:["Retiro"],row:{nombres:"Ana Pérez",cedula:"1",carrera:"Administración"}},
        {type:"requisito",causes:["Inglés"],row:{nombres:"José Núñez",cedula:"2",carrera:"Software",ok:false}}
      ]
    };
    const rows=[
      {nombres:"A",carrera:"Administración",ok:true},
      {nombres:"B",carrera:"Software",ok:false},
      {nombres:"C",carrera:"Software",estadoMatricula:"RETIRADO"}
    ];
    const meta={period:"Noviembre 2025 - Mayo 2026",sede:"Todas",division:"Todas",career:"Todas",generated:"20/08/2026 16:00"};
    const bytes=api.buildPdfBytes(report,rows,meta);
    const validation=api.validatePdf(bytes);

    check(bytes instanceof Uint8Array,"El generador debe devolver Uint8Array");
    check(bytes.byteLength>5000,`El PDF de prueba es demasiado pequeño: ${bytes.byteLength} bytes`);
    check(ascii(bytes,0,5)==="%PDF-","El PDF de prueba no tiene cabecera %PDF-");
    check(ascii(bytes,Math.max(0,bytes.length-1024),bytes.length).includes("%%EOF"),"El PDF de prueba no tiene marcador %%EOF");
    check(ascii(bytes,0,bytes.length).includes("Reporte de cierre"),"El PDF de prueba no contiene texto vectorial del informe");
    check(ascii(bytes,0,bytes.length).includes("xref"),"El PDF de prueba no contiene tabla xref");
    check(validation&&validation.ok===true&&validation.pages>=1,"La validación interna del PDF debe aprobar el documento");
  }
}catch(error){
  errors.push(`No se pudo ejecutar el generador PDF nativo: ${error.message}`);
}

if(errors.length){
  console.error("\nVERIFICACIÓN STATS / PDF: ERROR\n");
  errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
  process.exit(1);
}

console.log("VERIFICACIÓN STATS / PDF NATIVO: OK");
