"use strict";
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const XLSX=require("xlsx");
const JSZip=require("jszip");

const root=path.resolve(__dirname,"..");
const sandbox={window:{XLSX,JSZip},document:{},Blob,URL,console,setTimeout,clearTimeout};
sandbox.window.window=sandbox.window;
vm.createContext(sandbox);
function load(relative){vm.runInContext(fs.readFileSync(path.join(root,relative),"utf8"),sandbox,{filename:relative});}

[
  "InPVC/core/inpvc.utils.js",
  "InPVC/sections/01-aspectos-generales/section.js",
  "InPVC/sections/02-marco-normativo/section.js",
  "InPVC/sections/03-lineamientos/section.js",
  "InPVC/sections/04-metodologia/section.js",
  "InPVC/sections/05-resultados/section.js",
  "InPVC/sections/06-ishikawa/section.js",
  "InPVC/sections/07-conclusiones/section.js",
  "InPVC/sections/08-calificaciones/section.js",
  "InPVC/core/inpvc.model.js",
  "InPVC/export/inpvc.word.js",
  "InPVC/export/inpvc.excel.js",
  "InPVC/export/inpvc.zip.js"
].forEach(load);

async function main(){
  const html=fs.readFileSync(path.join(root,"InPVC/inpvc.html"),"utf8");
  assert.ok(!html.includes("<h1>InPVC</h1>"),"El encabezado no debe mostrar el título InPVC.");
  assert.match(html,/id="inpvc-code"[^>]*readonly/,"El código debe ser automático y no editable.");
  assert.equal(sandbox.window.InPVCUtils.reportCode("2026-07-17"),"UTET-INF-01-PRO-95-2026-07","El código debe derivarse del año y mes de la fecha.");
  assert.equal(sandbox.window.InPVCUtils.reportCode(""),"","Sin fecha no debe generarse un código.");
  const ctx=sandbox.window.InPVCModel.create({periodoId:"2025-04__2026-01",periodoLabel:"PVC Abril 2025 - Enero 2026",codigoInforme:"UTET-INF-01-PRO-95-2026-03",fechaElaboracion:"2026-03-02"},[
    {cedula:"1",nombres:"Ana Uno",carrera:"Administración",nart:8,ndef:9},
    {cedula:"2",nombres:"Beto Dos",carrera:"Administración",nart:6,ndef:8},
    {cedula:"3",nombres:"Carla Tres",carrera:"Redes",estadoPVC:"NO_CUMPLE_REQUISITOS"}
  ]);
  assert.equal(ctx.sections.length,8,"Deben existir ocho secciones.");
  assert.equal(ctx.students[0].nfin,8.3,"La nota final debe usar 70/30.");
  assert.equal(ctx.summary.total,3);
  assert.equal(ctx.summary.aprobados,1);
  assert.ok(ctx.sections.some((section)=>section.id==="ishikawa"&&section.html.includes("Ishikawa")));
  const word=sandbox.window.InPVCWord.build(ctx,ctx.sections);
  assert.ok(word.includes("Informe final del proceso de titulación PVC"));
  const excel=sandbox.window.InPVCExcel.array(ctx,ctx.sections);
  const wb=XLSX.read(excel,{type:"array"});
  assert.ok(wb.SheetNames.length>=8,"El Excel global debe contener hojas por sección.");
  const zipBlob=await sandbox.window.InPVCZip.create(ctx,ctx.sections);
  const zip=await JSZip.loadAsync(await zipBlob.arrayBuffer());
  assert.ok(Object.keys(zip.files).some((name)=>name.startsWith("01_Aspectos_Generales/")));
  assert.ok(Object.keys(zip.files).some((name)=>name.endsWith("_Completo.doc")));
  assert.ok(Object.keys(zip.files).some((name)=>name.endsWith("_Completo.xlsx")));
  console.log("VERIFICACIÓN InPVC: OK (cálculos, 8 secciones, Word, Excel y ZIP)");
}
main().catch((error)=>{console.error("VERIFICACIÓN InPVC: ERROR",error);process.exit(1);});
