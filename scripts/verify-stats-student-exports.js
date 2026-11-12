"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");

function read(file){return fs.readFileSync(path.join(root,file),"utf8");}
function check(condition,message){if(!condition){console.error("1. "+message);process.exit(1);}}

const html=read("Stats/stats.html");
const bootstrap=read("Stats/stats.bootstrap.js");
const exporter=read("Stats/stats.students.export.js");
const css=read("Stats/stats.overrides.css");

check(html.includes('id="stats-students-xlsx"'),"Falta el botón XLSX de estudiantes.");
check(html.includes('id="stats-students-pdf"'),"Falta el botón PDF de estudiantes.");
check(!html.includes('xlsx.full.min.js'),"Stats no debe cargar SheetJS hasta que el usuario exporte.");
check(!html.includes('html2pdf.bundle.min.js'),"Stats no debe cargar html2pdf hasta que el usuario exporte.");
check(bootstrap.includes('load("stats.students.export.js"'),"El bootstrap no carga el exportador de estudiantes.");
check(bootstrap.indexOf('load("stats.students.export.js"')>bootstrap.indexOf('load("stats.students.js"'),"El exportador debe cargarse después de StatsStudents.");
check(exporter.includes('XLSX_PATH="../node_modules/xlsx/dist/xlsx.full.min.js"'),"El exportador no declara SheetJS local.");
check(exporter.includes('HTML2PDF_PATH="../node_modules/html2pdf.js/dist/html2pdf.bundle.min.js"'),"El exportador no declara html2pdf local.");
check(exporter.includes("ensureXlsx()")&&exporter.includes("ensureHtml2Pdf()"),"Las dependencias deben cargarse bajo demanda.");
check(exporter.includes("window.XLSX.writeFile"),"La descarga Excel no genera un XLSX real.");
check(exporter.includes("window.html2pdf().set"),"La descarga PDF no utiliza el generador PDF local.");
check(exporter.includes('selectedLabel("stats-sede"'),"El exportador no conserva el filtro de sede.");
check(exporter.includes('selectedLabel("stats-requisito"'),"El exportador no conserva el requisito seleccionado.");
check(exporter.includes("currentMode()"),"El exportador no conserva Todos/Completos/Con faltantes.");
check(exporter.includes("currentOrder()"),"El exportador no conserva el orden de la tabla.");
check(exporter.includes("appState().studentSearch"),"El exportador no conserva la búsqueda del estudiante.");
check(exporter.includes("Información")&&exporter.includes("Estudiantes"),"El XLSX debe contener información de filtros y estudiantes.");
check(exporter.includes("ROWS_PER_PAGE=22")&&exporter.includes("Página "),"El PDF debe paginar y numerar páginas.");
check(css.includes(".stats-mini-export-xlsx")&&css.includes(".stats-mini-export-pdf"),"Falta el estilo compacto de los botones de exportación.");

const currentRowsBlock=exporter.slice(exporter.indexOf("function currentRows()"),exporter.indexOf("function selectedLabel"));
check(currentRowsBlock&&!currentRowsBlock.includes("slice(0,"),"La exportación no debe limitarse al máximo visual de filas.");

try{new vm.Script(exporter,{filename:"Stats/stats.students.export.js"});}
catch(error){console.error("1. stats.students.export.js tiene error de sintaxis: "+error.message);process.exit(1);}


const workbookSource=read("Stats/stats.students.workbook.js");
check(exporter.includes('loadDependency("stats.students.workbook.js"'),"XLSX debe cargar el consolidado de requisitos bajo demanda.");
try{new vm.Script(workbookSource,{filename:"Stats/stats.students.workbook.js"});}
catch(error){console.error("1. stats.students.workbook.js tiene error de sintaxis: "+error.message);process.exit(1);}
const sandbox={module:{exports:{}}};
vm.runInNewContext(workbookSource,sandbox,{filename:"Stats/stats.students.workbook.js"});
const Workbook=sandbox.module.exports;
check(Workbook&&typeof Workbook.createBook==="function","No se expone el generador del consolidado XLSX.");

const reqs=["academico","documentacion","financiero","practicasvinculacion","vinculacion","seguimientograduados","ingles","actualizaciondatos"].map(key=>({key,label:key}));
const tit={key:"titulacion",label:"Titulación"};
const rules={
  BASE_REQUIREMENTS:reqs,
  requirementsForStudent:row=>row.pvc?reqs:reqs.concat(tit),
  requirementStatus:(row,key)=>({applies:!(row.pvc&&key==="titulacion"),cumple:row.ok.includes(key),status:row.ok.includes(key)?"cumple":"no_cumple"})
};
const helpers={studentId:row=>row.cedula,studentName:row=>row.nombre,studentCareer:row=>row.carrera};
const regular=[
  {cedula:"0100000001",nombre:"Estudiante A",carrera:"Carrera A",ok:reqs.slice(1).map(item=>item.key)},
  {cedula:"0100000002",nombre:"Estudiante B",carrera:"Carrera B",ok:reqs.map(item=>item.key).concat("titulacion")},
  {cedula:"0100000001",nombre:"Duplicado A",carrera:"Carrera A",ok:[]}
];
const fakeXLSX={utils:{
  book_new:()=>({SheetNames:[],Sheets:{}}),
  aoa_to_sheet:rows=>({_rows:rows}),
  book_append_sheet:(book,sheet,name)=>{book.SheetNames.push(name);book.Sheets[name]=sheet;}
}};
const report=Workbook.createBook(fakeXLSX,regular,{rules,helpers,meta:{periodo:"Abril 2026 a Septiembre 2026",vista:"Con faltantes"}});
check(report.summary.total===2,"Global debe contener estudiantes únicos, sin duplicados por cédula.");
check(report.summary.conFaltantes===1,"El consolidado debe distinguir los estudiantes con faltantes.");
check(report.summary.incidencias===2,"Las incidencias deben contar los requisitos, no los estudiantes.");
check(report.summary.duplicadosOmitidos===1,"El consolidado debe informar registros duplicados omitidos.");
check(report.book.SheetNames.length===11,"Período regular: Consolidado, Global y nueve requisitos.");
check(report.book.Sheets.Global._rows[6][2]==="0100000001","El Excel debe conservar la cédula como texto y sus ceros iniciales.");
check(report.book.Sheets.Global._rows[6][4]===2,"El Global debe informar el total de requisitos faltantes.");
check(report.book.Sheets.academico._rows.length===7,"Académico debe listar solamente a sus estudiantes pendientes.");
check(report.book.Sheets.Titulación._rows.length===7,"Titulación debe listar solamente a sus estudiantes pendientes.");

const pvc=Workbook.createBook(fakeXLSX,[{cedula:"0200000001",nombre:"Estudiante PVC",carrera:"Carrera C",pvc:true,ok:reqs.slice(1).map(item=>item.key)}],{rules,helpers,meta:{periodo:"PVC"}});
check(pvc.book.SheetNames.length===10,"En PVC no debe generarse la hoja Titulación cuando no aplica.");
check(pvc.summary.incidencias===1,"Requisitos no aplicables no deben contarse como pendientes.");
check(!pvc.book.SheetNames.includes("Titulación"),"Titulación no debe aparecer en el consolidado PVC.");

console.log("OK: exportaciones XLSX/PDF de la vista filtrada de estudiantes verificadas.");
