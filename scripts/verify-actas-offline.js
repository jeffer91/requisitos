"use strict";
/* Verifica que Firestore sin servidor no convierta la caché en folios oficiales.
 * No accede al proyecto real ni registra números.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../Actas/actas.numbering.js"),"utf8");
let serverFails=true,permissionFails=false;
const saved={id:"2026-04__2026-09__0100000001",periodoId:"2026-04__2026-09",
 cedula:"0100000001",numeroActa:"2026-0100-11-0001"};
const serverDocs=[saved],cacheDocs=[saved];
const db={
 runTransaction(){throw Error("Las pruebas de lectura no deben asignar números.");},
 collection(name){
  assert.equal(name,"actas_registro");
  return {where(field,op,value){
   assert.equal(field,"periodoId");assert.equal(op,"==");assert.equal(value,"2026-04__2026-09");
   return {async get(options){
    if(options.source==="server"&&permissionFails){
      const err=Error("Missing or insufficient permissions.");err.code="permission-denied";throw err;
    }
    if(options.source==="server"&&serverFails){
      const err=Error("Failed to get documents from server.");err.code="unavailable";throw err;
    }
    const docs=(options.source==="cache"?cacheDocs:serverDocs).map(row=>({
      exists:true,id:row.id,data:()=>row
    }));
    return {docs,metadata:{fromCache:options.source==="cache"}};
   }};
  }};
 }
};
const ctx={window:{db},document:{baseURI:"https://example.test/Actas/actas.html"},Date,URL,Promise,Map,Set,console};
vm.createContext(ctx);vm.runInContext(source,ctx,{filename:"actas.numbering.js"});
const api=ctx.window.ActasNumbering;
(async()=>{
 let status=await api.listDetailed("2026-04__2026-09");
 assert.equal(status.verified,false,"Una caída de red debe bloquear la verificación");
 assert.equal(status.source,"cache");
 assert.equal(status.entries.length,1,"La caché puede existir como información provisional");
 assert.match(status.warning,/servidor de Firestore/);
 await assert.rejects(()=>api.list("2026-04__2026-09"),/Failed to get documents from server/);
 permissionFails=true;
 status=await api.listDetailed("2026-04__2026-09");
 assert.equal(status.verified,false);
 assert.match(status.warning,/permiso|reglas|rechazó/i);
 permissionFails=false;
 serverFails=false;
 status=await api.listDetailed("2026-04__2026-09");
 assert.equal(status.verified,true);
 assert.equal(status.source,"server");
 assert.equal(status.entries.length,1);
 assert.equal((await api.list("2026-04__2026-09")).length,1);
 console.log("VERIFICACIÓN ACTAS SIN CONEXIÓN: OK (servidor, caché provisional, permisos y recuperación)");
})().catch(error=>{console.error(error);process.exitCode=1;});
