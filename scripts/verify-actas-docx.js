"use strict";
/* Comprobación del DOCX real generado en navegador, sin librerías externas. */
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict"),zlib=require("node:zlib");
const code=fs.readFileSync(path.join(__dirname,"../Actas/actas.docx.js"),"utf8");
const image=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==","base64");
const context={URL,Blob,TextEncoder,DataView,Uint32Array,Uint8Array,Date,console,Promise,fetch:async()=>({ok:true,arrayBuffer:async()=>Uint8Array.from(image).buffer})};
context.window={location:{href:"https://example.test/requisitos/Actas/actas.html"}};
context.document={createElement(){return {}},body:{appendChild(){}}};
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,"../Actas/actas.evidence.js"),"utf8"),context);vm.runInContext(code,context);
function readZip(blobBytes){const items=new Map(),buf=Buffer.from(blobBytes);let pos=0;while(pos+4<=buf.length&&buf.readUInt32LE(pos)===0x04034b50){const method=buf.readUInt16LE(pos+8),len=buf.readUInt32LE(pos+18),n=buf.readUInt16LE(pos+26),e=buf.readUInt16LE(pos+28),filename=buf.subarray(pos+30,pos+30+n).toString("utf8"),start=pos+30+n+e,raw=buf.subarray(start,start+len);assert.equal(method,0,"Método ZIP sin compresión");items.set(filename,raw);pos=start+len;}assert.equal(buf.readUInt32LE(pos),0x02014b50,"Índice central ZIP presente");return items;}
async function main(){const item={student:{Nombres:"ESTUDIANTE EJEMPLO",cedula:"0000000001",NombreCarrera:"EDUCACIÓN INICIAL",CodigoCarrera:"EI"},mode:"EXAMEN_COMPLEXIVO",record:{codigo:"AT-ITSQMET-UTET-2026-10-01",consecutivo:"01",numeroActa:"2026-0000-10-0001"},periodLabel:"Octubre 2025 a Marzo 2026",issue:"2026-05-29",schedule:[{fase:"Complexivo",actividades:[{id:"examen",nombre:"Examen complexivo",inicio:"2026-04-20",fin:"2026-04-24"}]}]};
const reqKeys=["academico","documentacion","practicasvinculacion","vinculacion","seguimientograduados","ingles","actualizaciondatos","financiero","titulacion","aprobaciontitulacion","aprobacioncomplexivoproyecto"];
const requirementValues=Object.fromEntries(reqKeys.map(k=>[k,"CUMPLE"]));
item.student._ncomplexHasSavedEvaluation=true;
item.student._ncomplexEvaluation={modalidadTitulacion:item.mode,estadoEvaluacion:"APROBADO",notaTeorica:8,notaPractica:9,notaOficial:8.6};
item.evidence=context.window.ActasEvidence.assess({student:item.student,mode:item.mode,requirementValues,remoteEvaluation:item.student._ncomplexEvaluation,nuclei:[1,2,3,4].map(n=>({nucleo:n,notaFinal:8,estado:"APROBADO"}))});
assert.ok(item.evidence.eligible);
const blob=await context.window.ActasDocx.build(item);assert.equal(blob.type,"application/vnd.openxmlformats-officedocument.wordprocessingml.document");const parts=readZip(await blob.arrayBuffer());for(const filename of ["[Content_Types].xml","_rels/.rels","word/document.xml","word/_rels/document.xml.rels","word/media/logo.png"])assert.ok(parts.has(filename),"Existe "+filename);
assert.ok(parts.get("word/media/logo.png").length>1000,"Logo institucional incrustado en DOCX");assert.equal(parts.get("word/media/logo.png").subarray(0,8).toString("hex"),"89504e470d0a1a0a","Logotipo es PNG auténtico");
const institutionLogo=fs.readFileSync(path.join(__dirname,"../Global/assets/branding/logo-instituto.png"));
 assert.ok(parts.get("word/media/logo.png").equals(institutionLogo),"DOCX incluye el logo institucional reparado, no una copia obsoleta");
 function crc32(data){
   let crc=0xffffffff;
   for(const byte of data){
     crc^=byte;
     for(let i=0;i<8;i++)crc=(crc&1)?((crc>>>1)^0xedb88320):(crc>>>1);
   }
   return (crc^0xffffffff)>>>0;
 }
 function inspectPng(png){
   assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
   let offset=8,complete=false,count=0;
   while(offset+12<=png.length){
     const size=png.readUInt32BE(offset),end=offset+12+size;
     assert.ok(end<=png.length,"El bloque PNG debe caber en la imagen");
     const type=png.subarray(offset+4,offset+8).toString("ascii");
     const crcStored=png.readUInt32BE(end-4),actual=crc32(png.subarray(offset+4,end-4));
     assert.equal(crcStored,actual,"Bloque PNG "+type+" tiene CRC válido");
     offset=end;count++;
     if(type==="IEND"){complete=true;break;}
   }
   assert.ok(complete&&count>=3&&offset===png.length,"El archivo PNG termina correctamente");
 }
 inspectPng(parts.get("word/media/logo.png"));
 const xml=parts.get("word/document.xml").toString("utf8");
assert.match(xml,/<w:document/);assert.match(xml,/Acta de Titulación por Examen Complexivo/);assert.match(xml,/Unidad de Titulación y/);assert.match(xml,/Fecha de emisión: 29\/05\/2026/);assert.match(xml,/ESTADO DOCUMENTAL: REQUISITOS Y APROBACIONES INSTITUCIONALES CUMPLIDOS/);assert.match(xml,/Aprobación de titulación/);
assert.match(xml,/N.º DE ACTA: 2026-0000-10-0001/,"Número al inicio del cuerpo del Word");assert.match(xml,/Aprobación complexivo\/proyecto/);
assert.match(xml,/Prácticas preprofesionales/);assert.match(xml,/Verificación de los nueve requisitos institucionales/);assert.doesNotMatch(xml,new RegExp("8,60/10|Nota final oficial|Evaluación teórica"),"DOCX no contiene calificaciones");
assert.doesNotMatch(xml,/Calificación numérica:\s*\d/i);
for(const signer of ["MSc, Jefferson Villarreal","Ing. Martha Tomalá","Dr. Alex León T.","Coordinador de Titulación y Eficiencia Terminal","Coordinadora General de Carreras","Vicerrector"])assert.ok(xml.includes(signer),"DOCX conserva firmante: "+signer);
assert.match(xml,/<w:tblW w:w="10200" w:type="dxa"\/>/,"Encabezado y firmas de 18 cm");
assert.match(xml,/<w:tblLayout w:type="fixed"\/>/,"Tablas de ancho fijo");
assert.match(xml,/<w:vMerge w:val="restart"\/>/,"Celdas A1+A2 y B1+B2 combinadas");
assert.match(xml,/<w:vMerge w:val="continue"\/>/,"Combinación vertical continúa en segunda fila");
assert.match(xml,/<w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850"/,"Márgenes de 1,5 cm");
for(const height of ["1361","425","595"])assert.ok(xml.includes('<w:trHeight w:val="'+height+'"'),"Fila de firma ACT: "+height);
assert.match(xml,/Versión: 1.0/);
assert.match(xml,/<w:sz w:val="46"\/><w:b\/><\/w:rPr><w:t xml:space="preserve">Período académico:/,"El período académico debe estar en 23 pt en Word");
assert.doesNotMatch(xml,/NOMBRE: _{4}|CARGO: _{4}/);
assert.match(xml,/rIdLogo/);assert.match(xml,/w:type="page"/);assert.match(xml,/w:br\/>/,"Firmas y códigos con saltos de línea");
assert.match(parts.get("[Content_Types].xml").toString("utf8"),/wordprocessingml.document.main\+xml/);
const workStudent={...item.student,cedula:"0000000002",_ncomplexEvaluation:{modalidadTitulacion:"TRABAJO_TITULACION",estadoEvaluacion:"APROBADO",notaEscrito:8,notaDefensaTrabajo:9,notaOficial:8.4}};
const workItem={...item,student:workStudent,mode:"TRABAJO_TITULACION",record:{...item.record,numeroActa:"2026-0000-10-0002"},evidence:context.window.ActasEvidence.assess({student:workStudent,mode:"TRABAJO_TITULACION",requirementValues})};
const work=await context.window.ActasDocx.build(workItem),workParts=readZip(await work.arrayBuffer());
 const incompleteItem={...item,student:{Nombres:"ESTUDIANTE SIN REQUISITOS",cedula:"0000000099",NombreCarrera:"EDUCACIÓN INICIAL"},
  record:{...item.record,numeroActa:""},evidence:context.window.ActasEvidence.assess({
   mode:"EXAMEN_COMPLEXIVO",student:{Nombres:"ESTUDIANTE SIN REQUISITOS"},requirementValues:{}
  })};
 await assert.rejects(()=>context.window.ActasDocx.build(incompleteItem),/acta final exige/,"DOCX no se genera sin folio y requisitos completos");
 assert.doesNotMatch(xml,/borrador/i,"El Word final no tiene etiquetas de borrador");
assert.match(workParts.get("word/document.xml").toString("utf8"),/Acta de Titulación por Trabajo de Titulación/);
console.log("VERIFICACIÓN DOCX ACTAS: OK (ZIP OOXML, logotipo incrustado, formato por modalidad, sin notas)");}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
