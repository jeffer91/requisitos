"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const files=[
  "Carga/carga.app.connector.js",
  "Carga/carga.divisiones.popup.js",
  "Carga/carga.index.js",
  "Carga/carga.ui.connector.js",
  "Carga/mapping/carga.field-map.js",
  "Carga/process/carga.normalizer.js",
  "Carga/process/carga.save.js",
  "Carga/readers/carga.reader.csv.js",
  "Carga/readers/carga.reader.file.js",
  "Carga/readers/carga.reader.txt.js",
  "Carga/readers/carga.reader.xlsx.js"
];

for(const file of files){
  const source=fs.readFileSync(path.join(root,file),"utf8");
  new vm.Script(source,{filename:file});
}

const html=fs.readFileSync(path.join(root,"Carga/carga.html"),"utf8");
for(const removed of [
  "carga.app.js",
  "carga.ui.js",
  "carga.connection-bridge.js",
  "carga.detect-division.js",
  "carga.detect-notas.js",
  "carga.distributor.js"
]){
  if(html.includes(removed)){throw new Error(`Carga todavía referencia ${removed}`);}
}
for(const id of ["cargaProgressBox","cargaProgressBar","cargaGuardOnlyFile","cargaGuardOnlyExisting"]){
  if(!html.includes(`id=\"${id}\"`)){throw new Error(`Falta ${id} en carga.html`);}
}

console.log("VERIFICACIÓN TEMPORAL DE CARGA: OK");
