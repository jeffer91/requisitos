"use strict";

/* =========================================================
Archivo: verify-defart-bulk-import.js
Ruta: /scripts/verify-defart-bulk-import.js
Función:
- Verificar el parser de texto bruto de Moodle para N-ART.
- Confirmar conversión X/100 a escala 0-10.
- Probar cruce por correo, nombre exacto y nombre aproximado.
- Asegurar que notas existentes no se sobrescriban automáticamente.
- Detectar duplicados y conflictos antes de guardar.
========================================================= */

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const ROOT=path.resolve(__dirname,"..");
const errors=[];
function check(value,message){
  if(!value){errors.push(message);console.error("[verify-defart-bulk-import] ERROR:",message);}
  else{console.log("[OK]",message);}
}
const sandbox={console,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,Promise,Set};
sandbox.window=sandbox;
const context=vm.createContext(sandbox);
const source=fs.readFileSync(path.join(ROOT,"defart/defart.bulk-import.js"),"utf8");
new vm.Script(source,{filename:"defart/defart.bulk-import.js"}).runInContext(context);
const api=sandbox.DefartBulkImport;

const pasted=`
| Seleccione GABRIEL FERNANDO GUERRA ZAVALA | [image] | GABRIEL FERNANDO GUERRA ZAVALA | gguerra\\@itsqmet.edu.ec | Enviado para calificar | Calificado | Calificar 100,00 / 100,00 | Editar |
| Seleccione LISBETH ALEXANDRA MERA ZAMBRANO | [LM] | LISBETH ALEXANDRA MERA ZAMBRANO | lmeraz\\@itsqmet.edu.ec | Enviado para calificar | Calificado | Calificar 90,00 / 100,00 | Editar |
| Seleccione CRUZ ELSA SANCHEZ MACIAS | [image] | CRUZ ELSA SANCHEZ MACIAS | csanchezm\\@itsqmet.edu.ec | Enviado para calificar | Calificado | Calificar 85,00 / 100,00 | Editar |
`;

const parsed=api.parse(pasted);
check(parsed.ok===true,"El texto pegado de Moodle se reconoce.");
check(parsed.rows.length===3,"Se detectan tres estudiantes.");
check(parsed.rows[0].correo==="gguerra@itsqmet.edu.ec","Se limpia el correo escapado de Markdown.");
check(parsed.rows[0].notaArticulo===10,"100/100 se convierte a N-ART 10.");
check(parsed.rows[1].notaArticulo===9,"90/100 se convierte a N-ART 9.");
check(parsed.rows[2].notaArticulo===8.5,"85/100 se convierte a N-ART 8.5.");

const students=[
  {_defId:"0100000001__2026-02__2026-08",_cedula:"0100000001",_nombre:"GABRIEL FERNANDO GUERRA ZAVALA",correoInstitucional:"gguerra@itsqmet.edu.ec",_nart:null,_ndef:8.5,_carrera:"ADMINISTRACIÓN"},
  {_defId:"0100000002__2026-02__2026-08",_cedula:"0100000002",_nombre:"LISBETH ALEXANDRA MERA ZAMBRANO",correoInstitucional:"lmeraz@itsqmet.edu.ec",_nart:8.5,_ndef:9,_carrera:"REDES"},
  {_defId:"0100000003__2026-02__2026-08",_cedula:"0100000003",_nombre:"CRUZ ELSA MARIA SÁNCHEZ MACIAS",correoInstitucional:"otro@itsqmet.edu.ec",_nart:null,_ndef:7.5,_carrera:"CONTABILIDAD"}
];

const items=api.buildItems(parsed.rows,students);
check(items[0].kind==="exact"&&items[0].confidence===100,"El correo exacto tiene prioridad y 100% de confianza.");
check(items[0].action==="load"&&items[0].selected===true,"Una N-ART vacía con coincidencia exacta queda lista para cargar.");
check(items[1].kind==="exact"&&items[1].action==="keep"&&items[1].selected===false,"Una N-ART existente diferente no se sobrescribe automáticamente.");
check(items[2].kind==="probable"&&items[2].confidence>=90,"Un nombre con segundo nombre adicional se propone como coincidencia probable.");
check(items[2].selected===false,"Una coincidencia probable requiere revisión.");

items[1].action="replace";
items[1].selected=true;
const changes=api.changesForSave(items);
check(changes.length===2,"Solo las notas confirmadas se preparan para guardar.");
check(changes.some(change=>change.id==="0100000002__2026-02__2026-08"&&change.nart===9),"El reemplazo explícito de N-ART existente se respeta.");
check(changes.every(change=>change._row&&change._bulkImport===true),"Cada cambio lleva la fila validada para la ruta oficial de Defensas.");
check(changes.every(change=>Object.prototype.hasOwnProperty.call(change,"nart")&&!Object.prototype.hasOwnProperty.call(change,"ndef")),"La carga masiva genera exclusivamente cambios N-ART y nunca N-DEF.");

const duplicateParsed=api.parse(`
Seleccione GABRIEL FERNANDO GUERRA ZAVALA
gguerra@itsqmet.edu.ec
100,00 / 100,00
Seleccione GABRIEL FERNANDO GUERRA ZAVALA
gguerra@itsqmet.edu.ec
90,00 / 100,00
`);
const duplicateItems=api.buildItems(duplicateParsed.rows,students);
check(duplicateItems.every(item=>item.kind==="conflict"&&item.selected===false),"Dos notas distintas para el mismo estudiante se bloquean como conflicto.");

const sameDuplicate=api.parse(`
Seleccione GABRIEL FERNANDO GUERRA ZAVALA
gguerra@itsqmet.edu.ec
100,00 / 100,00
Seleccione GABRIEL FERNANDO GUERRA ZAVALA
gguerra@itsqmet.edu.ec
100,00 / 100,00
`);
const sameItems=api.buildItems(sameDuplicate.rows,students);
check(sameItems.filter(item=>item.kind==="duplicate").length===1,"Un duplicado idéntico se consolida y solo una fila queda operativa.");


const flattened=api.parse(`
Seleccione LISBETH ALEXANDRA MERA ZAMBRANO LM LISBETH ALEXANDRA MERA ZAMBRANO lmeraz\\@itsqmet.edu.ec Enviado para calificar Calificado Calificar 90,00 / 100,00 Editar
Seleccione JOSE ROLANDO CABAL CEDEÑO JC JOSE ROLANDO CABAL CEDEÑO jcabal\\@itsqmet.edu.ec Enviado para calificar Calificado Calificar 90,00 / 100,00 Editar
`);
check(flattened.rows[0].nombreCompleto==="LISBETH ALEXANDRA MERA ZAMBRANO","El parser elimina iniciales de avatar y nombre duplicado de Moodle.");
check(flattened.rows[1].nombreCompleto==="JOSE ROLANDO CABAL CEDEÑO","El parser limpia nombres duplicados en texto plano.");

const reorderedStudents=[
  {_defId:"1",_nombre:"MERA ZAMBRANO LISBETH ALEXANDRA",_correo:"lmeraz@itsqmet.edu.ec",_nart:null},
  {_defId:"2",_nombre:"CABAL CEDEÑO JOSE ROLANDO",CorreoInstitucional:"jcabal@itsqmet.edu.ec",_nart:null}
];
const reorderedItems=api.buildItems(flattened.rows,reorderedStudents);
check(reorderedItems[0].kind==="exact"&&reorderedItems[0].confidence===100,"El correo hidratado en _correo produce coincidencia exacta.");
check(reorderedItems[1].kind==="exact"&&reorderedItems[1].confidence===100,"El correo institucional produce coincidencia exacta.");
check(api.cleanMoodleName("LISBETH ALEXANDRA MERA ZAMBRANO LM LISBETH ALEXANDRA MERA ZAMBRANO")==="LISBETH ALEXANDRA MERA ZAMBRANO","La limpieza de nombre elimina repetición e iniciales.");

const reorderedNoEmail=api.buildItems(
  [{rowNumber:1,nombreCompleto:"JOSE ROLANDO CABAL CEDEÑO",correo:"",notaArticulo:9}],
  [{_defId:"3",_nombre:"CABAL CEDEÑO JOSE ROLANDO",_nart:null}]
);
check(reorderedNoEmail[0].kind==="exact"&&reorderedNoEmail[0].confidence===99,"Mismos nombres y apellidos en distinto orden cuentan como coincidencia exacta.");

const zeroAndMissing=api.parse(`
Seleccione ESTUDIANTE CERO EC ESTUDIANTE CERO cero@itsqmet.edu.ec Calificar 0,00 / 100,00
Seleccione ESTUDIANTE SIN NOTA ES ESTUDIANTE SIN NOTA sinnota@itsqmet.edu.ec Enviado para calificar
`);
check(zeroAndMissing.rows[0].notaArticulo===0,"0/100 se conserva como N-ART 0.00.");
check(zeroAndMissing.rows[1].notaArticulo===null,"Una fila sin X/Y queda realmente sin calificación.");
const missingItems=api.buildItems(zeroAndMissing.rows,[
  {_defId:"4",_nombre:"ESTUDIANTE CERO",correoInstitucional:"cero@itsqmet.edu.ec",_nart:null},
  {_defId:"5",_nombre:"ESTUDIANTE SIN NOTA",correoInstitucional:"sinnota@itsqmet.edu.ec",_nart:null}
]);
check(missingItems[0].action==="load"&&missingItems[0].selected===true,"N-ART 0.00 sí queda disponible para cargar.");
check(missingItems[1].kind==="no-grade"&&missingItems[1].action==="skip"&&missingItems[1].selected===false,"Sin calificación nunca se ofrece para cargar.");
check(api.changesForSave(missingItems).length===1&&api.changesForSave(missingItems)[0].nart===0,"Los cambios guardables incluyen cero, pero excluyen filas sin nota.");

if(errors.length){
  console.error("\nVERIFICACIÓN CARGA MASIVA DEFENSAS: ERROR ("+errors.length+")");
  errors.forEach((error,index)=>console.error((index+1)+". "+error));
  process.exit(1);
}
console.log("\nVERIFICACIÓN CARGA MASIVA DEFENSAS: OK");
