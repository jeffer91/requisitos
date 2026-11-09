"use strict";
/* Actas SENESCYT de trabajo de titulación con la MISMA estructura y notas que
 * tres actas reales, pero con nombres, cédulas y vocales FICTICIOS. */
function block(o){
 const crit=(rows)=>rows.map(([name,max,a,b,c])=>[name+"\t"+max+"\t",a,b,c].join("\n")).join("\n");
 return [
  "Nombres:\tCedula:\tCódigo de Carrera:\tCarrera:",
  o.nombre+"\t"+o.cedula+"\t"+o.codigo+"\t"+o.carrera,
  "",
  "Informacion ProyectoMiembros ProyectoNotas Proyecto",
  "VocalEvaluación Final Proyecto",
  "",
  "TRABAJO ESCRITO PROYECTO DE TITULACIÓN",
  "NÚMERO DE ACTA DE GRADO:\t"+o.acta,
  "FECHA ACTA DE GRADO:\t",
  o.fecha,
  "CALIFICACIÓN TUTOR:\t"+o.tutor,
  "CALIFICACIÓN LECTOR:\t"+o.lector,
  "PROMEDIO TRABAJO ESCRITO:\t"+o.escrito,
  "","","","","",
  "DEFENSA DE PROYECTO",
  "PARÁMETROS DE EVALUACIÓN\tPUNTAJE MÁXIMO\tPRIMER VOCAL",
  o.vocales[0]+"\tSEGUNDO VOCAL",
  o.vocales[1]+"\tTERCER VOCAL",
  o.vocales[2],
  "",
  "EVALUACIÓN PRACTICA",
  "",
  crit(o.practica),
  o.totalPractica.join("\n"),
  "",
  "EVALUACIÓN DE LA DEFENSA",
  "",
  crit(o.defensa),
  o.totalDefensa.join("\n"),
  "",
  "1. PROMEDIO TRABAJO ESCRITO (Calf. Tutor + Calif. Lector):\t",o.escrito,
  "2. PROMEDIO EVALUACION PRACTICA:\t",o.p2,
  "3. PROMEDIO EVALUACION DEFENSA:\t",o.p3,
  "4. PROMEDIO DEFENSA ORAL DEL PROYECTO DE TITULACION (2. + 3.):\t",o.p4,
  "5. CALIFICACION FINAL DEL PROYECTO DE TITULACION (1. + 4.):\t",o.p5,
  "","","",""
 ].join("\n");
}
const P=(a,b,c,d)=>[["Diseño","2,5",...a],["Construcción","2,5",...b],["Funcionamiento","2,5",...c],["Aplicación","2,5",...d]];
const D=(a,b,c,d)=>[["Sustento del marco teórico","2",...a],["Sustento de la propuesta","2",...b],["Uso de recursos","2",...c],["Solventar preguntas","4",...d]];
const actas=[
 {nombre:"PRUEBA UNO ESTUDIANTE ANA",cedula:"1700000001",codigo:"550417A01-P-1701",carrera:"TECNOLOGÍA SUPERIOR EN GESTIÓN DEL TALENTO HUMANO",
  acta:"4136",fecha:"14/04/2026",tutor:"8,00",lector:"8,00",escrito:"8,00",vocales:["VOCAL UNO A","VOCAL DOS A","VOCAL TRES A"],
  practica:P(["2,00","2,00","2,00"],["2,00","2,00","2,00"],["2,00","2,00","2,00"],["1,00","1,00","1,00"]),totalPractica:["7,00","7,00","7,00"],
  defensa:D(["2,00","2,00","2,00"],["2,00","2,00","2,00"],["2,00","2,00","2,00"],["1,00","1,00","1,00"]),totalDefensa:["7,00","7,00","7,00"],
  p2:"7,00",p3:"7,00",p4:"7,00",p5:"7,6"},
 {nombre:"PRUEBA DOS ESTUDIANTE BEA",cedula:"1700000002",codigo:"550414G01-P-1701",carrera:"TECNOLOGÍA SUPERIOR EN MARKETING DIGITAL Y COMERCIO ELECTRÓNICO",
  acta:"4138",fecha:"14/04/2026",tutor:"8,00",lector:"8,00",escrito:"8,00",vocales:["VOCAL UNO B","VOCAL DOS B","VOCAL TRES B"],
  practica:P(["2,00","2,00","2,00"],["2,00","2,00","2,00"],["2,50","2,00","2,00"],["2,50","2,50","2,00"]),totalPractica:["9,00","8,50","8,00"],
  defensa:D(["2,00","2,00","2,00"],["2,00","2,00","2,00"],["2,00","2,00","2,00"],["3,00","2,50","2,00"]),totalDefensa:["9,00","8,50","8,00"],
  p2:"8,50",p3:"8,50",p4:"8,50",p5:"8,2"},
 {nombre:"PRUEBA TRES ESTUDIANTE CAI",cedula:"1700000003",codigo:"550613A01-P-1701",carrera:"TECNOLOGÍA SUPERIOR EN DESARROLLO DE SOFTWARE",
  acta:"4135",fecha:"14/04/2026",tutor:"9,00",lector:"9,00",escrito:"9,00",vocales:["VOCAL UNO C","VOCAL DOS C","VOCAL TRES C"],
  practica:P(["2,00","1,00","1,00"],["2,50","2,50","2,50"],["1,50","2,50","2,50"],["1,50","1,50","1,50"]),totalPractica:["7,50","7,50","7,50"],
  defensa:D(["2,00","2,00","2,00"],["2,00","2,00","2,00"],["2,00","2,00","2,00"],["2,00","2,00","2,00"]),totalDefensa:["8,00","8,00","8,00"],
  p2:"7,50",p3:"8,00",p4:"7,75",p5:"8,5"}
];
module.exports={block,actas,text:()=>actas.map(block).join("\n\n\n\n\n\n")};
