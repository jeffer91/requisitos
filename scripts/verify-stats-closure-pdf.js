"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const ROOT=path.resolve(__dirname,"..");
const errors=[];
function read(file){return fs.readFileSync(path.join(ROOT,file),"utf8");}
function check(value,message){if(!value){errors.push(message);}}
function syntax(file){try{new vm.Script(read(file),{filename:file});}catch(error){errors.push(`${file}: ${error.message}`);}}
function ascii(bytes,start,end){let out="";const from=Math.max(0,Number(start||0)),to=Math.min(bytes.length,end==null?bytes.length:Number(end));for(let i=from;i<to;i+=1){out+=String.fromCharCode(bytes[i]);}return out;}

const htmlFile="Stats/stats.html";
const pdfFile="Stats/stats.closure.pdf.vector.js";
const closureFile="Stats/stats.closure.js";
const logoFile="Global/assets/branding/logo-instituto.png";
[closureFile,pdfFile].forEach(syntax);

const html=read(htmlFile),pdf=read(pdfFile),closure=read(closureFile);
check(fs.existsSync(path.join(ROOT,logoFile)),"Debe existir el logo institucional usado por el PDF");
check(html.includes("stats.closure.pdf.vector.js"),"Stats debe cargar el generador PDF de cierre");
check(!html.includes("node_modules/jspdf"),"Stats no debe depender de jsPDF instalado en node_modules");
check(!html.includes("html2pdf.bundle"),"Stats no debe cargar html2pdf para el cierre");
check(!pdf.includes("window.jspdf")&&!pdf.includes("new JsPDF")&&!pdf.includes("node_modules/jspdf"),"El generador PDF no debe depender de jsPDF");
check(!pdf.includes("window.html2canvas")&&!pdf.includes("html2canvas("),"El generador PDF no debe ejecutar html2canvas");
check(pdf.includes('LOGO_PATH="../Global/assets/branding/logo-instituto.png"'),"El PDF debe utilizar el logo institucional");
check(pdf.includes("INFORME DE CIERRE DEL PERÍODO"),"El PDF debe contener una portada formal");
check(pdf.includes("Análisis del resumen")&&pdf.includes("Análisis de causas")&&pdf.includes("Análisis de requisitos")&&pdf.includes("Análisis por carrera")&&pdf.includes("Análisis de aprobación final"),"Cada bloque del PDF debe incluir análisis");
check(!pdf.includes('builder.section("7. Detalle')&&!pdf.includes('builder.sectionPage("7. Detalle'),"El PDF no debe incluir el detalle nominal de quienes no llegaron");
check(pdf.includes("No aprobaron artículo o defensa"),"El PDF debe informar la categoría de artículo o defensa no aprobados");
check(pdf.includes("%PDF-1.4")&&pdf.includes("xref")&&pdf.includes("%%EOF"),"El generador debe construir un PDF nativo completo");
check(closure.includes("failedArticleDefense")&&closure.includes('!isCumpleKey(row,"titulacion")')&&closure.includes('!isCumpleKey(row,"aprobaciontitulacion")')&&closure.includes('!isCumpleKey(row,"aprobacioncomplexivoproyecto")'),"La lógica de cierre debe aplicar la regla de artículo o defensa");

function requirementValue(row,key){return row&&row[key];}
function cumple(value){return [true,1,"1","SI","Sí","si","sí","APROBADO","Aprobado"].includes(value);}

try{
  const document={readyState:"loading",addEventListener(){},getElementById(){return null;}};
  const sandbox={console,Date,Math,JSON,Object,Array,String,Boolean,Number,setTimeout,clearTimeout,document};
  sandbox.window=sandbox;
  sandbox.StatsApp={getState(){return {periodId:"2025_11_2026_05",division:"",career:""};}};
  sandbox.StatsRules={
    BASE_REQUIREMENTS:[{key:"academico",label:"Académico"},{key:"documentacion",label:"Documentación"},{key:"ingles",label:"Inglés"}],
    FINAL_REQUIREMENTS:[{key:"aprobaciontitulacion",label:"Aprobación titulación"},{key:"aprobacioncomplexivoproyecto",label:"Aprobación complexivo/proyecto"}],
    valueOf:requirementValue,isCumple:cumple,
    requirementStatus(row,key){return {key,label:key,applies:true,cumple:cumple(requirementValue(row,key))};}
  };
  const allBase={academico:"SI",documentacion:"SI",ingles:"SI",titulacion:"NO",aprobaciontitulacion:"NO",aprobacioncomplexivoproyecto:"NO",carrera:"Administración"};
  const missingBase={academico:"SI",documentacion:"NO",ingles:"SI",titulacion:"NO",aprobaciontitulacion:"NO",aprobacioncomplexivoproyecto:"NO",carrera:"Software"};
  const finalApproved={academico:"SI",documentacion:"SI",ingles:"SI",titulacion:"SI",aprobaciontitulacion:"SI",aprobacioncomplexivoproyecto:"NO",carrera:"Administración"};
  sandbox.StatsCore={resumen(){return {rows:[allBase,missingBase,finalApproved]};}};
  vm.runInNewContext(closure,sandbox,{filename:closureFile});
  const report=sandbox.StatsClosure.build();
  check(report.reached===2,"Quien cumple todos los requisitos BASE debe contar como llegado a fase final");
  check(report.notReached===1,"Quien mantiene un requisito BASE pendiente no debe llegar a fase final");
  check(report.failedFinal===1,"Quien cumple BASE pero no tiene las tres evidencias finales debe clasificarse como no aprobado en artículo o defensa");
  check(report.causes.some((item)=>item.label==="Documentación"&&item.total===1),"Las causas de no llegada deben limitarse a requisitos previos");
}catch(error){errors.push(`No se pudo verificar la clasificación de cierre: ${error.message}`);}

try{
  const document={readyState:"loading",baseURI:"file:///app/Stats/stats.html",addEventListener(){},getElementById(){return null;},createElement(){return {style:{},click(){},remove(){}};},body:{appendChild(){}}};
  const sandbox={console,Date,Math,JSON,Object,Array,String,Boolean,Number,Uint8Array,Blob,document,setTimeout,clearTimeout,URL:{createObjectURL(){return "blob:test";},revokeObjectURL(){}},alert(){},atob(value){return Buffer.from(value,"base64").toString("binary");}};
  sandbox.window=sandbox;
  sandbox.StatsApp={getState(){return {periodId:"2025_11_2026_05",sede:"",division:"",career:""};}};
  sandbox.StatsRules={
    BASE_REQUIREMENTS:[{key:"academico",label:"Académico"},{key:"ingles",label:"Inglés"}],
    valueOf:requirementValue,isCumple:cumple,
    requirementStatus(row,key){return {applies:true,cumple:cumple(requirementValue(row,key))};}
  };
  sandbox.StatsClosure={baseAssessment(row){return {complete:cumple(row.academico)&&cumple(row.ingles),missing:[]};},failedArticleDefense(row){return cumple(row.academico)&&cumple(row.ingles)&&!cumple(row.titulacion)&&!cumple(row.aprobaciontitulacion)&&!cumple(row.aprobacioncomplexivoproyecto);}};

  vm.runInNewContext(pdf,sandbox,{filename:pdfFile});
  const api=sandbox.StatsClosurePDFVector;
  check(api&&api.version==="3.0.0-institutional-analysis","Debe exponerse el generador PDF institucional actualizado");
  if(api){
    const report={periodId:"2025_11_2026_05",total:3,active:3,retired:0,reached:2,notReached:1,failedFinal:1,arrivalRate:66.67,incidents:1,causes:[{label:"Inglés",total:1,percent:100}],final:[{label:"Titulación",total:2,cumple:1,no_cumple:1,avance:50},{label:"Aprobación titulación",total:2,cumple:1,no_cumple:1,avance:50}]};
    const rows=[{carrera:"Administración",academico:"SI",ingles:"SI",titulacion:"NO",aprobaciontitulacion:"NO",aprobacioncomplexivoproyecto:"NO"},{carrera:"Administración",academico:"SI",ingles:"SI",titulacion:"SI",aprobaciontitulacion:"SI"},{carrera:"Software",academico:"SI",ingles:"NO"}];
    const meta={period:"Noviembre 2025 - Mayo 2026",sede:"Todas",division:"Todas",career:"Todas",generated:"20 de agosto de 2026, 16:00"};
    const bytes=api.buildPdfBytes(report,rows,meta,null),validation=api.validatePdf(bytes),raw=ascii(bytes,0,bytes.length);
    check(bytes instanceof Uint8Array,"El generador debe devolver Uint8Array");
    check(bytes.byteLength>5000,`El PDF de prueba es demasiado pequeño: ${bytes.byteLength} bytes`);
    check(ascii(bytes,0,5)==="%PDF-","El PDF de prueba no tiene cabecera %PDF-");
    check(ascii(bytes,Math.max(0,bytes.length-1024),bytes.length).includes("%%EOF"),"El PDF de prueba no tiene marcador %%EOF");
    check(raw.includes("INFORME DE CIERRE DEL PER"),"El PDF debe contener texto de portada");
    check(raw.includes("No aprobaron art"),"El PDF debe contener la categoría de artículo o defensa");
    check(!raw.includes("Detalle de quienes no llegaron"),"El PDF generado no debe contener el detalle nominal excluido");
    check(validation&&validation.ok===true&&validation.pages>=7,"La validación interna debe aprobar portada y seis secciones");
  }
}catch(error){errors.push(`No se pudo ejecutar el generador PDF nativo: ${error.message}`);}

if(errors.length){console.error("\nVERIFICACIÓN STATS / PDF: ERROR\n");errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));process.exit(1);}
console.log("VERIFICACIÓN STATS / PDF INSTITUCIONAL: OK");
