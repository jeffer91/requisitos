"use strict";

/* =========================================================
Archivo: verify-defart-excel-import.js
Ruta: /scripts/verify-defart-excel-import.js
Función:
- Verificar el parser de la plantilla Excel de Defensas.
- Confirmar decimales con coma y "Sin notas".
- Confirmar carga conjunta de N-ART y N-DEF.
- Asegurar que Nota final sea solo un control y no un campo guardado.
========================================================= */

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const errors=[];

function check(value,message){
  if(!value){errors.push(message);console.error("[verify-defart-excel-import] ERROR:",message);}
  else{console.log("[OK]",message);}
}

const sandbox={console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Set};
sandbox.window=sandbox;
sandbox.DefartCore={
  calculateFinal:(nart,ndef)=>Math.round(((Number(nart)*.7)+(Number(ndef)*.3))*100)/100
};
const context=vm.createContext(sandbox);
const source=fs.readFileSync(path.join(ROOT,"defart/defart.excel-import.js"),"utf8");
new vm.Script(source,{filename:"defart/defart.excel-import.js"}).runInContext(context);
const api=sandbox.DefartExcelImport;

const matrix=[
  ["Febrero Agosto"],
  [],
  ["Nombre","Nota Articulo","Nota Defensa","Nota final"],
  ["MEZA QUIROZ RUTH MARIUXI","7","9,12","7,64"],
  ["VIZCAINO MENDEZ ROBINSON ADRIAN","Sin notas","",""],
  ["MERA ZAMBRANO LISBETH ALEXANDRA","9","6,42","REPROBADO"],
  ["PILLAJO MELENDEZ JEFFERSON ALEJANDRO","8,5","8","8,25"]
];

const parsed=api.parseMatrix(matrix);
check(parsed.ok===true,"La tabla Excel se reconoce.");
check(parsed.rows.length===4,"Se detectan cuatro estudiantes.");
check(parsed.rows[0].notaArticulo===7&&parsed.rows[0].notaDefensa===9.12,"Se interpretan notas y coma decimal.");
check(parsed.rows[1].notaArticulo===null&&parsed.rows[1].notaDefensa===null,"Sin notas se interpreta como ausencia de calificación.");
check(parsed.rows[2].notaFinalFuente==="REPROBADO","REPROBADO se conserva como control de Nota final.");
check(parsed.rows[3].notaArticulo===8.5,"La N-ART 8,5 se convierte a 8.5.");

const students=[
  {_defId:"1",_nombre:"MEZA QUIROZ RUTH MARIUXI",_nart:null,_ndef:null,_requirementsOk:true},
  {_defId:"2",_nombre:"VIZCAINO MENDEZ ROBINSON ADRIAN",_nart:null,_ndef:null,_requirementsOk:true},
  {_defId:"3",_nombre:"MERA ZAMBRANO LISBETH ALEXANDRA",_nart:9,_ndef:null,_requirementsOk:true},
  {_defId:"4",_nombre:"PILLAJO MELENDEZ JEFFERSON ALEJANDRO",_nart:8.5,_ndef:8,_requirementsOk:true}
];

const items=api.buildItems(parsed.rows,students);
check(items[0].selected===true&&items[0].changeNart===true&&items[0].changeNdef===true,"Una fila exacta con N-ART y N-DEF nuevas queda lista.");
check(items[1].kind==="no-grade"&&items[1].selected===false,"Una fila Sin notas no crea cambios.");
check(items[2].selected===true&&items[2].changeNart===false&&items[2].changeNdef===true,"Puede actualizar solo N-DEF sin reescribir N-ART.");
check(items[3].hasChanges===false&&items[3].selected===false,"Notas ya iguales no se vuelven a guardar.");

const changes=api.changesForSave(items);
check(changes.length===2,"Solo las filas con cambios confirmados se preparan para guardar.");
check(changes.some(change=>change.id==="1"&&change.nart===7&&change.ndef===9.12),"Se prepara carga conjunta de N-ART y N-DEF.");
check(changes.some(change=>change.id==="3"&&!Object.prototype.hasOwnProperty.call(change,"nart")&&change.ndef===6.42),"Se prepara actualización exclusiva de N-DEF cuando N-ART ya coincide.");
check(changes.every(change=>!Object.prototype.hasOwnProperty.call(change,"nfin")&&!Object.prototype.hasOwnProperty.call(change,"notaFinal")),"Nota final nunca se importa como dato oficial.");

const blockedParsed=api.parseMatrix([
  ["Periodo"],[],
  ["Nombre","Nota Articulo","Nota Defensa","Nota final"],
  ["ESTUDIANTE BLOQUEADO","8","9","8,3"]
]);
const blockedItems=api.buildItems(blockedParsed.rows,[
  {_defId:"5",_nombre:"ESTUDIANTE BLOQUEADO",_nart:null,_ndef:null,_requirementsOk:false}
]);
check(blockedItems[0].errors.length>0&&blockedItems[0].selected===false,"N-DEF se bloquea cuando los requisitos no están completos.");

if(errors.length){
  console.error("\nVERIFICACIÓN EXCEL DEFENSAS: ERROR ("+errors.length+")");
  errors.forEach((error,index)=>console.error((index+1)+". "+error));
  process.exit(1);
}

console.log("\nVERIFICACIÓN EXCEL DEFENSAS: OK");
