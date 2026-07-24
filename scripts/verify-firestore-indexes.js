"use strict";

const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const file=path.join(root,"firestore.indexes.json");
const errors=[];

if(!fs.existsSync(file)){
  errors.push("Falta firestore.indexes.json.");
}else{
  let config;
  try{ config=JSON.parse(fs.readFileSync(file,"utf8")); }
  catch(error){ errors.push("firestore.indexes.json no contiene JSON válido: "+error.message); }

  if(config){
    const expected=["matriculas","requisitos","notas"];
    expected.forEach((collection)=>{
      const index=(config.indexes||[]).find((item)=>item.collectionGroup===collection&&item.queryScope==="COLLECTION");
      if(!index){
        errors.push(`Falta el índice de ${collection}.`);
        return;
      }
      const fields=index.fields||[];
      const period=fields.find((field)=>field.fieldPath==="periodoId"&&field.order==="ASCENDING");
      const updated=fields.find((field)=>field.fieldPath==="updatedAt"&&field.order==="ASCENDING");
      const documentId=fields.find((field)=>field.fieldPath==="__name__"&&field.order==="ASCENDING");
      if(!period){ errors.push(`${collection}: falta periodoId ASCENDING.`); }
      if(!updated){ errors.push(`${collection}: falta updatedAt ASCENDING.`); }
      if(!documentId){ errors.push(`${collection}: falta __name__ ASCENDING.`); }
    });
  }
}

if(errors.length){
  console.error("\nVERIFICACIÓN DE ÍNDICES FIRESTORE: ERROR\n");
  errors.forEach((error,index)=>console.error(`${index+1}. ${error}`));
  process.exit(1);
}
console.log("VERIFICACIÓN DE ÍNDICES FIRESTORE: OK");
