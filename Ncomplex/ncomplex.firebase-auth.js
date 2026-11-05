/* Autenticación Firebase institucional para la carga de núcleos.
 * No registra contraseñas ni crea usuarios y no guarda credenciales en BDLocal. */
(function(w,d){"use strict";
var sdk="https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js",loading=null,auth=null;
function load(){
 if(loading)return loading;
 loading=Promise.resolve().then(function(){
  if(!w.BL2Sync||typeof w.BL2Sync.ensureFirebase!=="function")
    throw Error("Primero debe inicializarse Firebase en BDLocal.");
  return w.BL2Sync.ensureFirebase();
 }).then(function(){
  if(w.firebase&&typeof w.firebase.auth==="function")return;
  return new Promise(function(resolve,reject){
   var script=d.createElement("script");
   script.src=sdk;script.async=true;
   script.onload=resolve;
   script.onerror=function(){reject(Error("No se pudo cargar Firebase Authentication. Verifica la conexión."));};
   (d.head||d.documentElement).appendChild(script);
  });
 }).then(function(){
  if(!w.firebase||typeof w.firebase.auth!=="function")throw Error("El SDK de autenticación no está disponible.");
  auth=w.firebase.auth();
  return new Promise(function(resolve,reject){
   var finished=false,unsubscribe;
   unsubscribe=auth.onAuthStateChanged(function(user){
    if(finished)return;
    finished=true;if(unsubscribe)unsubscribe();resolve(user||null);
   },function(error){if(finished)return;finished=true;if(unsubscribe)unsubscribe();reject(error);});
  });
 }).catch(function(error){loading=null;throw error;});
 return loading;
}
async function signIn(email,password){
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email||"").trim())||!password)throw Error("Introduce correo y contraseña.");
 await load();
 var persistence=w.firebase.auth.Auth.Persistence.SESSION;
 await auth.setPersistence(persistence);
 var result=await auth.signInWithEmailAndPassword(String(email).trim(),password);
 return {email:result&&result.user&&result.user.email||"",uid:result&&result.user&&result.user.uid||""};
}
async function requireUser(){
 await load();
 var user=auth&&auth.currentUser;
 if(!user)throw Error("Inicia sesión en Firebase para publicar las evaluaciones de núcleos.");
 return {email:user.email||"",uid:user.uid||""};
}
async function requireWriter(){
 var identity=await requireUser();
 var user=auth.currentUser;
 var token=await user.getIdTokenResult();
 var claims=token&&token.claims||{};
 if(claims.ncomplex_write!==true && claims.titulacion_admin!==true)
  throw Error("Tu cuenta Firebase no tiene permiso de escritura de calificaciones. Solicita el rol institucional ncomplex_write.");
 return identity;
}
function status(){return {ready:!!auth,authenticated:!!(auth&&auth.currentUser),email:auth&&auth.currentUser&&auth.currentUser.email||""};}
w.NcomplexFirebaseAuth=Object.freeze({load:load,signIn:signIn,requireUser:requireUser,requireWriter:requireWriter,status:status});
})(window,document);
