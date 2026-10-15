// Regresión Art: notas oficiales, período, notas en cero y mensajes personalizados.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname,"..");
const read = relative => fs.readFileSync(path.join(root,relative),"utf8");
const html = read("Gestion/Tabla/tabla.html");
const checks = [
  ["data-req-filter=\"art\"", "Filtro Art"],
  ['<option value="art">Art — nota inferior a 7</option>', "Selector Art"],
  ['src="data/tabla.art.js"', "Consulta de notas incluida"]
];
checks.forEach(([target,label])=>assert(html.includes(target),label));
assert.strictEqual((html.match(/<option value="art">/g)||[]).length,3,"Art en selector global, Telegram individual y masivo");

const source = "Gestion/Tabla/";
const samples = [
  {cedula:"1720000001",periodoId:"2026-02__2026-08",Notart:0,Notdef:null},
  {cedula:"1720000002",periodoId:"2026-02__2026-08",Notart:8,Notdef:6},
  {cedula:"1720000003",periodoId:"2026-02__2026-08",Notart:8,Notdef:9},
  {cedula:"1720000004",periodoId:"2026-02__2026-08",Notart:null,Notdef:null},
  {cedula:"1720000005",periodoId:"2026-02__2026-08",Notart:4,Notdef:5},
  {cedula:"1720000001",periodoId:"2025-02__2025-08",Notart:10,Notdef:10}
];
const win = {
  addEventListener(){},
  BDLRepoNotas: {
    list: opts=>Promise.resolve(samples.filter(row=>row.periodoId===opts.periodoId)),
    noteValues: row=>({article:row.Notart,defense:row.Notdef})
  }
};
win.top = win;
const doc = {addEventListener(){}};
const context = vm.createContext({window:win,document:doc,console,Promise});
["data/tabla.art.js","ui/tabla.filters.js","communication/tabla.message.js"].forEach(file=>{
  new vm.Script(read(source+file),{filename:file}).runInContext(context);
});
const p = "2026-02__2026-08";
const row = (cedula)=>({
  _cedula:cedula,_periodoId:p,_periodo:"Febrero 2026 a Agosto 2026",
  _nombres:"Estudiante de prueba",_carrera:"Marketing"
});
(async()=>{
  assert(!win.TablaArtNotes.hasFailure(row("1720000001")),"No asumir notas no cargadas");
  await win.TablaArtNotes.load(p);
  const cases = [
    ["1720000001",true,"Artículo académico: 0/10"],
    ["1720000002",true,"Defensa: 6/10"],
    ["1720000003",false,""],
    ["1720000004",false,""],
    ["1720000005",true,"Artículo académico: 4/10"]
  ];
  cases.forEach(([id,expected,detail])=>{
    const student = row(id);
    assert.strictEqual(win.TablaFilters.hasRequirementMissing(student,"art"),expected,id);
    const message=win.TablaMessage.generarMensaje(student,"art",{});
    assert.strictEqual(!!message,expected,id+" mensaje");
    if(detail){assert(message.includes(detail),id+" calificación");}
    if(expected){assert(message.includes("requisitos completos"),"Regla de defensa");}
  });
  assert(win.TablaMessage.generarMensaje(row("1720000005"),"art",{}).includes("Defensa: 5/10"),"Artículo y defensa reprobados");
  assert.strictEqual(win.TablaArtNotes.get(Object.assign({},row("1720000001"),{_periodoId:"2025-02__2025-08"})),null,"No mezclar períodos sin consultar");
  assert(read(source+"core/tabla.app.js").includes('current.requirements.indexOf("art") >= 0'),"Cargar notas al filtrar");
  assert(read(source+"communication/tabla.actions.js").includes('if(type === "art")'),"Bloqueo de mensajes individuales");
  assert(read(source+"communication/tabla.bulk.js").includes('key(globalType) === "art"'),"Destinatarios Art masivos");
  console.log("VERIFICACIÓN TABLA ART: OK");
})().catch(error=>{console.error("VERIFICACIÓN TABLA ART: ERROR",error);process.exitCode=1;});
