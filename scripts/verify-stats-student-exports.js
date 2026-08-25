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

console.log("OK: exportaciones XLSX/PDF de la vista filtrada de estudiantes verificadas.");
