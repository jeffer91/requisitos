/* =========================================================
Nombre completo: fb.upload.js
Ruta: /BDLocal/connections/firebase/fb.upload.js
Función:
- Adaptar escritura hacia Firebase desde el módulo nuevo.
- Mantener compatibilidad con BDLSyncFirebase.
========================================================= */
(function(window){
  "use strict";

  function sendItem(item){
    if(!window.BDLFirebaseClient){ return Promise.reject(new Error("BDLFirebaseClient no está disponible.")); }
    return window.BDLFirebaseClient.saveItem(item);
  }

  function writeDoc(collectionName, docId, data){
    if(!window.BDLFirebaseClient){ return Promise.reject(new Error("BDLFirebaseClient no está disponible.")); }
    return window.BDLFirebaseClient.setDoc(collectionName, docId, data || {});
  }

  window.BDLFirebaseUpload = {
    sendItem: sendItem,
    writeDoc: writeDoc
  };
})(window);
