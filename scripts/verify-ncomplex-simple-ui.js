"use strict";

/* =========================================================
Archivo: verify-ncomplex-simple-ui.js
Ruta: /scripts/verify-ncomplex-simple-ui.js
Función:
- Verificar que Ncomplex priorice filtros esenciales, resumen y tabla.
- Confirmar que filtros avanzados e importación permanezcan bajo demanda.
- Validar que el resumen principal tenga únicamente cuatro indicadores.
========================================================= */

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const errors=[];

function read(file){return fs.readFileSync(path.join(ROOT,file),"utf8");}
function check(value,message){
  if(value){console.log("[OK]",message);return;}
  errors.push(message);
  console.error("[verify-ncomplex-simple-ui] ERROR:",message);
}
function syntax(source,file){
  try{new vm.Script(source,{filename:file});return true;}
  catch(error){errors.push(`${file}: ${error.message}`);console.error("[verify-ncomplex-simple-ui] ERROR:",file,error.message);return false;}
}

const html=read("Ncomplex/ncomplex.html");
const css=read("Ncomplex/ncomplex.css");
const ui=read("Ncomplex/ncomplex.simple-ui.js");
const summary=read("Ncomplex/ncomplex.summary.js");
const bootstrap=read("Ncomplex/ncomplex.bootstrap.js");

syntax(ui,"Ncomplex/ncomplex.simple-ui.js");
syntax(summary,"Ncomplex/ncomplex.summary.js");
syntax(bootstrap,"Ncomplex/ncomplex.bootstrap.js");

check(html.includes('id="ncomplex-btn-advanced"'),"Ncomplex incluye un control para filtros secundarios.");
check(html.includes('id="ncomplex-advanced-filters"')&&html.includes('class="ncomplex-advanced-filters" hidden'),"Los filtros secundarios están ocultos al iniciar.");
check(html.includes('id="ncomplex-btn-import"'),"Ncomplex conserva una acción visible para importar notas.");
check(html.includes('id="ncomplex-import-modal"')&&html.includes('class="ncomplex-modal ncomplex-import-modal"'),"La importación se muestra dentro de una ventana modal.");
check(html.indexOf('id="ncomplex-table-wrap"')<html.indexOf('id="ncomplex-import-modal"'),"La tabla aparece antes que la herramienta de importación.");
check(html.includes('id="ncomplex-career-summary" hidden'),"El resumen redundante de carreras permanece oculto por compatibilidad.");
check(!html.includes("Carreras y modalidades"),"La pantalla principal ya no muestra la sección redundante de carreras y modalidades.");
check(bootstrap.includes('ncomplex.simple-ui.js'),"El bootstrap carga la interfaz simple.");
check(bootstrap.indexOf('ncomplex.simple-ui.js')<bootstrap.indexOf('ncomplex.app.js'),"La interfaz simple se prepara antes de iniciar NcomplexApp.");
check(css.includes(".ncomplex-summary{display:grid;grid-template-columns:repeat(4"),"El resumen usa cuatro columnas principales.");
check(css.includes(".ncomplex-import-dialog"),"La importación tiene un diseño modal independiente.");

const containers={
  "ncomplex-summary":{innerHTML:""},
  "ncomplex-career-summary":{innerHTML:""}
};
const sandbox={
  console,Number,Object,Array,String,Boolean,Math,
  document:{getElementById(id){return containers[id]||null;}},
  NcomplexConfig:{modalidades:{TRABAJO:"TRABAJO_TITULACION"}},
  NcomplexFilters:{careerOf(row){return row.carrera||"SIN CARRERA";}}
};
sandbox.window=sandbox;

try{
  new vm.Script(summary,{filename:"Ncomplex/ncomplex.summary.js"}).runInContext(vm.createContext(sandbox));
  sandbox.NcomplexSummary.render([
    {carrera:"A",modalidadTitulacion:"EXAMEN_COMPLEXIVO",estadoEvaluacion:"SIN_NOTAS"},
    {carrera:"A",modalidadTitulacion:"TRABAJO_TITULACION",estadoEvaluacion:"APROBADO"},
    {carrera:"A",modalidadTitulacion:"EXAMEN_COMPLEXIVO",estadoEvaluacion:"NO_APROBADO"}
  ]);
  const cards=(containers["ncomplex-summary"].innerHTML.match(/class="ncomplex-kpi/g)||[]).length;
  check(cards===4,"El resumen renderiza exactamente cuatro indicadores principales.");
  check(containers["ncomplex-summary"].innerHTML.includes("Pendientes"),"El resumen consolida sin notas e incompletos como pendientes.");
  check(containers["ncomplex-summary"].innerHTML.includes("No aprobados"),"Los no aprobados se conservan como detalle de alerta.");
}catch(error){
  errors.push(`No se pudo ejecutar el resumen: ${error.message}`);
}

if(errors.length){
  console.error(`\nVERIFICACIÓN NCOMPLEX SIMPLE UI: ERROR (${errors.length})`);
  errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
  process.exit(1);
}

console.log("\nVERIFICACIÓN NCOMPLEX SIMPLE UI: OK");
