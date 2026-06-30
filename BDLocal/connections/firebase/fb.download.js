/* =========================================================
Nombre completo: fb.download.js
Ruta: /BDLocal/connections/firebase/fb.download.js
Función:
- Adaptar lectura desde Firebase hacia el módulo nuevo.
- Mantener compatibilidad con BDLSyncFirebase.
========================================================= */
(function(window){
  "use strict";

  function listUpdated(collectionName, since, limit){
    if(!window.BDLFirebaseClient){ return Promise.reject(new Error("BDLFirebaseClient no está disponible.")); }
    return window.BDLFirebaseClient.listUpdated(collectionName, since || "", limit || 0);
  }

  window.BDLFirebaseDownload = {
    listUpdated: listUpdated
  };
})(window);
