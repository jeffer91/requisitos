"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const ROOT=path.resolve(__dirname,"..");
const errors=[];

function read(file){return fs.readFileSync(path.join(ROOT,file),"utf8");}
function check(value,message){if(!value){errors.push(message);}}
function syntax(file){try{new vm.Script(read(file),{filename:file});}catch(error){errors.push(`${file}: ${error.message}`);}}
function ascii(buffer,start,end){
  const bytes=new Uint8Array(buffer);
  let out="";
  for(let i=Math.max(0,start||0);i<Math.min(bytes.length,end==null?bytes.length:end);i+=1){out+=String.fromCharCode(bytes[i]);}
  return out;
}

const htmlFile="Stats/stats.html";
const pdfFile="Stats/stats.closure.pdf.vector.js";
syntax(pdfFile);

const html=read(htmlFile);
const pdf=read(pdfFile);
const jspdfIndex=html.indexOf("../node_modules/jspdf/dist/jspdf.umd.min.js");
const generatorIndex=html.indexOf("stats.closure.pdf.vector.js");

check(jspdfIndex>=0,"Stats debe cargar jsPDF local");
check(generatorIndex>=0,"Stats debe cargar el generador PDF vectorial");
check(jspdfIndex<generatorIndex,"jsPDF debe cargarse antes del generador de cierre");
check(!html.includes("html2pdf.bundle"),"Stats no debe cargar html2pdf para el cierre");
check(!pdf.includes("html2canvas"),"El generador PDF no debe depender de html2canvas");
check(pdf.includes('doc.output("arraybuffer")'),"El generador debe validar los bytes PDF antes de descargar");
check(pdf.includes("validatePdf(doc,buffer)"),"El generador debe ejecutar la validación del PDF");
check(pdf.includes("new Blob([buffer]"),"La descarga debe usar exactamente los bytes validados");

try{
  const mod=require("jspdf");
  const JsPDF=mod&&mod.jsPDF;
  check(typeof JsPDF==="function","El paquete jspdf debe exponer jsPDF");
  if(typeof JsPDF==="function"){
    const doc=new JsPDF({orientation:"portrait",unit:"mm",format:"a4",compress:false});
    doc.setFont("helvetica","bold");
    doc.setFontSize(16);
    doc.text("PDF STATS SMOKE",15,20);
    doc.setFont("helvetica","normal");
    doc.setFontSize(9);
    doc.text("Reporte de cierre",15,28);
    const buffer=doc.output("arraybuffer");
    check(buffer instanceof ArrayBuffer,"jsPDF debe devolver un ArrayBuffer");
    if(buffer instanceof ArrayBuffer){
      check(buffer.byteLength>1000,`El PDF smoke es demasiado pequeño: ${buffer.byteLength} bytes`);
      check(ascii(buffer,0,5)==="%PDF-","El PDF smoke no tiene cabecera %PDF-");
      check(ascii(buffer,Math.max(0,buffer.byteLength-1024),buffer.byteLength).includes("%%EOF"),"El PDF smoke no tiene marcador %%EOF");
      check(ascii(buffer,0,buffer.byteLength).includes("PDF STATS SMOKE"),"El PDF smoke no contiene texto vectorial esperado");
    }
  }
}catch(error){
  errors.push(`No se pudo ejecutar jsPDF en Node: ${error.message}`);
}

if(errors.length){
  console.error("\nVERIFICACIÓN STATS / PDF: ERROR\n");
  errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
  process.exit(1);
}

console.log("VERIFICACIÓN STATS / PDF: OK");
