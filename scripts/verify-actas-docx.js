"use strict";
/* Comprobación del DOCX real generado en navegador, sin librerías externas. */
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict"),zlib=require("node:zlib");
const code=fs.readFileSync(path.join(__dirname,"../Actas/actas.docx.js"),"utf8");
const image=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==","base64");
const context={URL,Blob,TextEncoder,DataView,Uint32Array,Uint8Array,Date,console,Promise,fetch:async()=>({ok:true,arrayBuffer:async()=>Uint8Array.from(image).buffer})};
context.window={location:{href:"https://example.test/requisitos/Actas/actas.html"}};
context.document={createElement(){return {}},body:{appendChild(){}}};
vm.createContext(context);vm.runInContext(code,context);
function readZip(blobBytes){const items=new Map(),buf=Buffer.from(blobBytes);let pos=0;while(pos+4<=buf.length&&buf.readUInt32LE(pos)===0x04034b50){const method=buf.readUInt16LE(pos+8),len=buf.readUInt32LE(pos+18),n=buf.readUInt16LE(pos+26),e=buf.readUInt16LE(pos+28),filename=buf.subarray(pos+30,pos+30+n).toString("utf8"),start=pos+30+n+e,raw=buf.subarray(start,start+len);assert.equal(method,0,"Método ZIP sin compresión");items.set(filename,raw);pos=start+len;}assert.equal(buf.readUInt32LE(pos),0x02014b50,"Índice central ZIP presente");return items;}
async function main(){const item={student:{Nombres:"ESTUDIANTE EJEMPLO",cedula:"0000000001",NombreCarrera:"EDUCACIÓN INICIAL",CodigoCarrera:"EI"},mode:"EXAMEN_COMPLEXIVO",record:{codigo:"AT-ITSQMET-UTET-2026-10-01",consecutivo:"01"},periodLabel:"Octubre 2025 a Marzo 2026",issue:"2026-10-28",schedule:[{fase:"Complexivo",actividades:[{id:"examen",nombre:"Examen complexivo",inicio:"2026-04-20",fin:"2026-04-24"}]}]};
const blob=await context.window.ActasDocx.build(item);assert.equal(blob.type,"application/vnd.openxmlformats-officedocument.wordprocessingml.document");const parts=readZip(await blob.arrayBuffer());for(const filename of ["[Content_Types].xml","_rels/.rels","word/document.xml","word/_rels/document.xml.rels","word/media/logo.png"])assert.ok(parts.has(filename),"Existe "+filename);
assert.ok(parts.get("word/media/logo.png").length>1000,"Logo institucional incrustado en DOCX");assert.equal(parts.get("word/media/logo.png").subarray(0,8).toString("hex"),"89504e470d0a1a0a","Logotipo es PNG auténtico");
const xml=parts.get("word/document.xml").toString("utf8");
assert.match(xml,/<w:document/);assert.match(xml,/ACTA DE TITULACIÓN POR EXAMEN COMPLEXIVO/);assert.match(xml,/RESULTADO FINAL: APROBADO/);assert.match(xml,/Aprobación titulación/);assert.match(xml,/Aprobación complexivo\/proyecto/);
assert.doesNotMatch(xml,/Nota teórica|Nota práctica|Calificación numérica:\s*\d/i);
for(const signer of ["MSc, Jefferson Villarreal","Ing. Martha Tomalá","Dr. Alex León T.","Coordinador de Titulación y Eficiencia Terminal","Coordinadora General de Carreras","Vicerrector"])assert.ok(xml.includes(signer),"DOCX conserva firmante: "+signer);
assert.match(xml,/<w:tblW w:w="10200" w:type="dxa"\/>/,"Encabezado y firmas de 18 cm");
assert.match(xml,/<w:tblLayout w:type="fixed"\/>/,"Tablas de ancho fijo");
assert.match(xml,/<w:vMerge w:val="restart"\/>/,"Celdas A1+A2 y B1+B2 combinadas");
assert.match(xml,/<w:vMerge w:val="continue"\/>/,"Combinación vertical continúa en segunda fila");
assert.match(xml,/<w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850"/,"Márgenes de 1,5 cm");
for(const height of ["1361","425","595"])assert.ok(xml.includes('<w:trHeight w:val="'+height+'"'),"Fila de firma ACT: "+height);
assert.match(xml,/Versión: 1.0/);
assert.match(xml,/<w:sz w:val="46"\/>[^<]*<\/w:rPr><w:t xml:space="preserve">Período académico:/,"El período académico debe estar en 23 pt en Word");
assert.doesNotMatch(xml,/NOMBRE: _{4}|CARGO: _{4}/);
assert.match(xml,/rIdLogo/);assert.match(xml,/w:type="page"/);assert.match(xml,/w:br\/>/,"Firmas y códigos con saltos de línea");
assert.match(parts.get("[Content_Types].xml").toString("utf8"),/wordprocessingml.document.main\+xml/);
const work=await context.window.ActasDocx.build({...item,mode:"TRABAJO_TITULACION"}),workParts=readZip(await work.arrayBuffer());
assert.match(workParts.get("word/document.xml").toString("utf8"),/ACTA DE TITULACIÓN POR TRABAJO DE TITULACIÓN/);
console.log("VERIFICACIÓN DOCX ACTAS: OK (ZIP OOXML, logotipo incrustado, formato por modalidad, sin notas)");}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
