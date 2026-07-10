// Configuración Firebase web para la app Requisitos.
// La API key de Firebase web no es una contraseña; la seguridad real depende de las reglas de Firestore.
(function(window){
  "use strict";

  var config = {
    apiKey: "AIzaSyCaHf1C0BB0X_H3BDZ1o-UDAsPmLTjsZLA",
    authDomain: "utet-4387a.firebaseapp.com",
    projectId: "utet-4387a",
    storageBucket: "utet-4387a.firebasestorage.app",
    messagingSenderId: "902848131454",
    appId: "1:902848131454:web:47f515eb6480834724c32f"
  };

  window.firebaseConfig = window.firebaseConfig || config;
  window.FIREBASE_CONFIG = window.FIREBASE_CONFIG || config;

  try{
    if(window.firebase && window.firebase.initializeApp && (!window.firebase.apps || !window.firebase.apps.length)){
      window.firebase.initializeApp(config);
    }
    if(window.firebase && window.firebase.firestore){
      window.db = window.db || window.firebase.firestore();
    }
  }catch(error){
    console.warn("[firebase-config] No se pudo inicializar Firebase", error);
  }
})(window);
