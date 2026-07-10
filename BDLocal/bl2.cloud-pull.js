/* =========================================================
Nombre completo: bl2.cloud-pull.js
Ruta o ubicación: /BDLocal/bl2.cloud-pull.js
Función o funciones:
- Mantener compatibilidad con llamadas antiguas de descarga externa.
- Delegar Google Sheets exclusivamente a BL2CloudPullSafe.
- Delegar Firebase exclusivamente a BL2FirebaseGuard.
- No registrar botones, intervalos ni procesos de importación propios.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "3.0.0-safe-facade";

  function unavailable(name){
    return Promise.reject(new Error(name + " todavía no está disponible. Espere a que BDLocal termine de cargar."));
  }

  function sheets(){ return window.BL2CloudPullSafe || null; }
  function firebase(){ return window.BL2FirebaseGuard || null; }

  function forceFetchFirebaseConfig(){
    var api = sheets();
    return api && typeof api.forceFetchFirebaseConfig === "function"
      ? api.forceFetchFirebaseConfig()
      : unavailable("La descarga segura de configuración Firebase");
  }

  function pullSheetsToLocal(period){
    var api = sheets();
    return api && typeof api.pullSheetsToLocal === "function"
      ? api.pullSheetsToLocal(period)
      : unavailable("La descarga segura de Google Sheets");
  }

  function selectAndPullSheets(){
    var api = sheets();
    return api && typeof api.selectAndPull === "function"
      ? api.selectAndPull()
      : unavailable("El selector seguro de Google Sheets");
  }

  function cleanSheetsDuplicates(){
    var api = sheets();
    return api && typeof api.cleanSheetsDuplicates === "function"
      ? api.cleanSheetsDuplicates()
      : unavailable("La limpieza segura de Google Sheets");
  }

  function pullFirebaseToLocal(period,options){
    var api = firebase();
    return api && typeof api.pullFirebaseToLocal === "function"
      ? api.pullFirebaseToLocal(period || null,options || {})
      : unavailable("La descarga segura de Firebase");
  }

  window.BL2CloudPull = {
    version:VERSION,
    compatibilityOnly:true,
    forceFetchFirebaseConfig:forceFetchFirebaseConfig,
    pullSheetsToLocal:pullSheetsToLocal,
    selectAndPull:selectAndPullSheets,
    cleanSheetsDuplicates:cleanSheetsDuplicates,
    pullFirebaseToLocal:pullFirebaseToLocal
  };
})(window);
