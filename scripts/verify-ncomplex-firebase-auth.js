"use strict";
/* No accede a Firebase real ni almacena credenciales. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(root,"Ncomplex/ncomplex.firebase-auth.js"),"utf8");
function environment(store){
 let callbacks=[],authLoads=0,signIns=0,signOuts=0;
 const user=(email,claims)=>({email,uid:"example-uid",
  async getIdTokenResult(){return {claims:claims||{ncomplex_write:true}};}});
 const auth={
  get currentUser(){return store.user||null;},
  onAuthStateChanged(fn){
   callbacks.push(fn);
   Promise.resolve().then(()=>fn(store.user||null));
   return ()=>{callbacks=callbacks.filter(x=>x!==fn);};
  },
  async setPersistence(kind){store.persistence=kind;},
  async signInWithEmailAndPassword(email,password){
   signIns++;
   assert.equal(password,"prueba-local");
   store.user=user(email,store.claims);
   callbacks.forEach(fn=>fn(store.user));
   return {user:store.user};
  },
  async signOut(){signOuts++;store.user=null;callbacks.forEach(fn=>fn(null));}
 };
 const firebaseAuth=()=>auth;
 firebaseAuth.Auth={Persistence:{LOCAL:"LOCAL",SESSION:"SESSION"}};
 const firestore={collection(){return {};}};
 const sandbox={
  Promise,Date,Math,JSON,Number,Object,Array,String,Boolean,RegExp,
  firebase:{apps:[{}],firestore:()=>firestore,auth:firebaseAuth},
  RequisitosFirebaseOperationCenter:{async ensureNcomplex(){authLoads++;return firestore;}},
  document:{createElement(){throw Error("SDK de prueba ya se encuentra cargado.");}}
 };
 sandbox.window=sandbox;
 // Las pruebas de sesión cubren el modo con login (desactivable); el modo
 // directo por defecto se comprueba al final.
 sandbox.NCOMPLEX_FIREBASE_OPEN_WRITE=store.openWrite===true?undefined:false;
 new vm.Script(source,{filename:"ncomplex.firebase-auth.js"}).runInNewContext(sandbox);
 return {api:sandbox.NcomplexFirebaseAuth,store,metrics:()=>({authLoads,signIns,signOuts})};
}
async function main(){
 const store={user:null,persistence:null,claims:{ncomplex_write:true}};
 let first=environment(store),events=[];
 first.api.subscribe(info=>events.push(info.authenticated));
 let info=await first.api.load();
 assert.equal(info.authenticated,false,"No inventar una sesión inexistente.");
 await assert.rejects(first.api.requireUser(),/Inicia sesión/);
 await first.api.signIn("docente@itsqmet.edu.ec","prueba-local");
 assert.equal(store.persistence,"LOCAL","Una cuenta autenticada debe persistir entre reinicios.");
 assert.equal(first.api.status().authenticated,true);
 assert.equal((await first.api.requireWriter()).email,"docente@itsqmet.edu.ec");
 assert.ok(events.includes(false)&&events.includes(true),"Notificar estados de sesión.");
 // Segundo iframe/equipo lógico, con las credenciales de Firebase conservadas.
 const second=environment(store);
 info=await second.api.load();
 assert.equal(info.authenticated,true,"La sesión autorizada se restaura al abrir Ncomplex.");
 assert.equal(second.metrics().signIns,0,"No pedir otra vez correo y contraseña.");
 assert.equal((await second.api.requireWriter()).uid,"example-uid");
 // Migración de una sesión antigua SESSION que sigue abierta.
 const legacy={user:{email:"legacy@itsqmet.edu.ec",uid:"legacy",
  async getIdTokenResult(){return {claims:{ncomplex_write:true}};}},
  persistence:"SESSION"};
 const upgraded=environment(legacy);
 assert.equal((await upgraded.api.load()).authenticated,true);
 assert.equal(legacy.persistence,"LOCAL","Una sesión SESSION recuperada pasa a persistencia LOCAL.");
 // La configuración pública de Firebase NO concede derechos de publicación.
 const unauthorized={user:{email:"sinrol@itsqmet.edu.ec",uid:"reader",
  async getIdTokenResult(){return {claims:{}};}},persistence:null};
 const denied=environment(unauthorized);
 await denied.api.load();
 await assert.rejects(denied.api.requireWriter(),/permiso de escritura/);
 await second.api.signOut();
 assert.equal(store.user,null,"Cerrar sesión revoca la sesión local.");
 assert.equal(second.api.status().authenticated,false);
 await assert.rejects(second.api.requireWriter(),/Inicia sesión/);
 // Modo directo por defecto (igual que Carga): sin sesión ni rol se puede publicar.
 const direct=environment({user:null,persistence:null,openWrite:true});
 assert.equal(direct.api.openWrite,true);
 const openInfo=await direct.api.load();
 assert.equal(openInfo.openWrite,true);
 assert.equal(openInfo.authenticated,true,"La conexión directa no espera una sesión.");
 assert.equal((await direct.api.requireWriter()).openWrite,true);
 assert.equal((await direct.api.requireUser()).openWrite,true);
 assert.ok(direct.metrics().authLoads>=1,"Igual que Carga, prepara Firestore antes de escribir.");
 assert.equal(direct.metrics().signIns,0,"Nunca pide correo ni contraseña.");
 console.log("VERIFICACIÓN SESIÓN FIREBASE NCOMPLEX: OK (modo directo sin login; modo con sesión: persistencia, roles y cierre).");
}
main().catch(e=>{console.error("VERIFICACIÓN SESIÓN FIREBASE NCOMPLEX: ERROR",e);process.exitCode=1;});
