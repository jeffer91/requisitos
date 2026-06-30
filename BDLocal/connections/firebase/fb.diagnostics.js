/* =========================================================
Nombre completo: fb.diagnostics.js
Ruta: /BDLocal/connections/firebase/fb.diagnostics.js
Función:
- Entregar diagnóstico simple del conector Firebase.
========================================================= */
(function(window){
  "use strict";

  function diagnostics(){
    return Promise.resolve({
      id: "firebase",
      role: "nube_principal",
      legacyLoaded: !!window.BDLSyncFirebase,
      clientLoaded: !!window.BDLFirebaseClient,
      healthLoaded: !!window.BDLFirebaseHealth,
      writeLoaded: !!window.BDLFirebaseUpload,
      readLoaded: !!window.BDLFirebaseDownload,
      firebaseLoaded: !!window.firebase,
      dbLoaded: !!window.db,
      at: new Date().toISOString()
    });
  }

  window.BDLFirebaseDiagnostics = { diagnostics: diagnostics };
})(window);
