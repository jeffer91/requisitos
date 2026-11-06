/* Sesión Firebase institucional de Ncomplex.
 * Reutiliza Auth persistente del proyecto; nunca almacena contraseñas ni
 * concede permisos por disponer de la configuración pública del SDK. */
(function(w,d){"use strict";
var sdk="https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js";
var loading=null,auth=null,lastError="",listeners=[],stateListener=null;
function message(error){return error&&error.message?error.message:String(error||"");}
function current(){return auth&&auth.currentUser||null;}
function snapshot(){var user=current();return {
 ready:!!auth,authenticated:!!user,email:user&&user.email||"",
 uid:user&&user.uid||"",error:lastError
};}
function notify(){var info=snapshot();listeners.slice().forEach(function(fn){try{fn(info);}catch(error){}});}
function subscribe(fn){
 if(typeof fn!=="function")return function(){};
 listeners.push(fn);
 if(auth)Promise.resolve().then(function(){fn(snapshot());});
 return function(){var index=listeners.indexOf(fn);if(index>=0)listeners.splice(index,1);};
}
function load(){
 if(loading)return loading;
 loading=Promise.resolve().then(function(){
  // Ncomplex no depende del cargador pesado de cola/Personas.
  if(w.RequisitosFirebaseOperationCenter&&typeof w.RequisitosFirebaseOperationCenter.ensureNcomplex==="function")
   return w.RequisitosFirebaseOperationCenter.ensureNcomplex();
  if(w.BL2Sync&&typeof w.BL2Sync.ensureFirebase==="function")
   return w.BL2Sync.ensureFirebase();
  if(w.firebase&&typeof w.firebase.firestore==="function"&&w.firebase.apps&&w.firebase.apps.length)
   return w.firebase.firestore();
  if(w.RequisitosFirebaseOperationCenter&&typeof w.RequisitosFirebaseOperationCenter.ensure==="function")
   return w.RequisitosFirebaseOperationCenter.ensure();
  throw Error("Primero debe inicializarse Firebase en BDLocal.");
 }).then(function(){
  if(w.firebase&&typeof w.firebase.auth==="function")return;
  return new Promise(function(resolve,reject){
   var script=d.createElement("script");script.src=sdk;script.async=true;
   script.onload=resolve;
   script.onerror=function(){reject(Error("No se pudo cargar Firebase Authentication. Verifica la conexión."));};
   (d.head||d.documentElement).appendChild(script);
  });
 }).then(function(){
  if(!w.firebase||typeof w.firebase.auth!=="function")throw Error("El SDK de autenticación no está disponible.");
  auth=w.firebase.auth();
  return new Promise(function(resolve,reject){
   if(stateListener){resolve(current());return;}
   var settled=false;
   var unsubscribe=auth.onAuthStateChanged(function(user){
    lastError="";notify();
    if(!settled){settled=true;resolve(user||null);}
   },function(error){
    lastError=message(error);notify();
    if(!settled){settled=true;reject(error);}
   });
   stateListener=typeof unsubscribe==="function"?unsubscribe:function(){};
  });
 }).then(async function(user){
  // SESSION desaparecía al cerrar Ncomplex. LOCAL restaura una sesión que el
  // usuario ya abrió legítimamente. Firebase administra tokens y vencimientos.
  if(user&&w.firebase.auth.Auth&&w.firebase.auth.Auth.Persistence){
   try{await auth.setPersistence(w.firebase.auth.Auth.Persistence.LOCAL);}
   catch(error){
    lastError="La sesión está activa, pero no pudo recordarse: "+message(error);
   }
  }
  notify();return snapshot();
 }).catch(function(error){
  lastError=message(error);loading=null;notify();throw error;
 });
 return loading;
}
async function signIn(email,password){
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email||"").trim())||!password)
  throw Error("Introduce correo y contraseña.");
 await load();
 await auth.setPersistence(w.firebase.auth.Auth.Persistence.LOCAL);
 var result=await auth.signInWithEmailAndPassword(String(email).trim(),password);
 lastError="";notify();
 return {email:result&&result.user&&result.user.email||"",uid:result&&result.user&&result.user.uid||""};
}
async function signOut(){
 await load();
 await auth.signOut();
 lastError="";notify();
 return {ok:true};
}
async function requireUser(){
 await load();
 var user=current();
 if(!user)throw Error("Inicia sesión en Firebase una vez para publicar las notas. La sesión permanecerá iniciada en este equipo.");
 return {email:user.email||"",uid:user.uid||""};
}
async function requireWriter(){
 var identity=await requireUser();
 var user=current();
 var token=await user.getIdTokenResult();
 var claims=token&&token.claims||{};
 if(claims.ncomplex_write!==true&&claims.titulacion_admin!==true)
  throw Error("Tu cuenta Firebase no tiene permiso de escritura de calificaciones. Solicita el rol institucional ncomplex_write.");
 return identity;
}
w.NcomplexFirebaseAuth=Object.freeze({
 load:load,signIn:signIn,signOut:signOut,subscribe:subscribe,
 requireUser:requireUser,requireWriter:requireWriter,status:snapshot
});
})(window,document);
