"use strict";
/* Encabezados académicos en Ncomplex y preservación de valores 40/60 y 60/40. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const container={innerHTML:"",addEventListener(){}};
const window={};
const document={getElementById(id){return id==="ncomplex-table-wrap"?container:null;}};
const context=vm.createContext({window,document,console,Date});
for(const file of ["ncomplex.config.js","ncomplex.calculator.js","ncomplex.table.js"]){
 const source=fs.readFileSync(path.join(root,"Ncomplex",file),"utf8");
 vm.runInContext(source,context,{filename:file});
}
const cx={id:"cx",cedula:"0100000001",Nombres:"ALVARADO PEREZ MALENA RACHELL",
 modalidadTitulacion:"EXAMEN_COMPLEXIVO",notaTeorica:9.3,notaPractica:10};
const work={id:"work",cedula:"0100000002",Nombres:"PRUEBA TRABAJO",
 modalidadTitulacion:"TRABAJO_TITULACION",notaEscrito:9,notaDefensaTrabajo:8};
const calc=window.NcomplexCalculator;
const table=window.NcomplexTable;
const complexRow=calc.recalculate(cx);
const workRow=calc.recalculate(work);
assert.equal(complexRow.notaComplexivo,9.72,"Complexivo: teórico 40 % y práctico 60 %");
assert.equal(workRow.notaTrabajoTitulacion,8.6,"Trabajo: escrito 60 % y defensa 40 %");
const check=(yes,no)=>{
 assert.ok(container.innerHTML.includes("<th scope=\"col\">"+yes+"</th>"),"Debe mostrar "+yes);
 if(no)assert.ok(!container.innerHTML.includes("<th scope=\"col\">"+no+"</th>"),"No debe mostrar "+no);
};
table.render([complexRow],{modalidad:""});
check("Teórico (40 %)","Nota A");
check("Práctico (60 %)","Nota B");
assert.ok(container.innerHTML.includes('data-ncomplex-field="notaTeorica"'));
assert.ok(container.innerHTML.includes('data-ncomplex-field="notaPractica"'));
assert.ok(container.innerHTML.includes('value="9,3"'));
assert.ok(container.innerHTML.includes('value="10"'));
table.render([workRow],{modalidad:""});
check("Escrito (60 %)","Nota A");
check("Defensa (40 %)","Nota B");
assert.ok(container.innerHTML.includes('data-ncomplex-field="notaEscrito"'));
assert.ok(container.innerHTML.includes('data-ncomplex-field="notaDefensaTrabajo"'));
table.render([complexRow,workRow],{modalidad:""});
check("Teórico (40 %) / Escrito (60 %)","Nota A");
check("Práctico (60 %) / Defensa (40 %)","Nota B");
check("Final según modalidad");
assert.ok(container.innerHTML.includes('data-ncomplex-field="notaTeorica"'));
assert.ok(container.innerHTML.includes('data-ncomplex-field="notaEscrito"'));
table.render([complexRow],{modalidad:"",modalidadesVisibles:["EXAMEN_COMPLEXIVO","TRABAJO_TITULACION"]});
check("Teórico (40 %) / Escrito (60 %)","Nota A");
table.render([complexRow],{modalidad:"EXAMEN_COMPLEXIVO"});
check("Teórico (40 %)","Nota A");
console.log("VERIFICACIÓN ENCABEZADOS NCOMPLEX: OK (complexivo, trabajo, mixto y paginación)");
