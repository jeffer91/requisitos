/* =========================================================
Nombre completo: bl2.cloud-pull.js
Ruta o ubicación: /BDLocal/bl2.cloud-pull.js
Función o funciones:
- Mantener compatibilidad con llamadas antiguas de descarga externa.
- Delegar Google Sheets exclusivamente a BL2CloudPullSafe.
- Delegar Firebase exclusivamente a BL2FirebaseGuard.
- Permitir traer un período o todos los períodos.
- No registrar botones, intervalos ni importaciones propias.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "3.1.0-all-periods-facade";

  function unavailable(name){
    return Promise.reject(new Error(
      name + " todavía no está disponible. Espere a que BDLocal termine de cargar."
    ));
  }

  function sheets(){
    return window.BL2CloudPullSafe || null;
  }

  function firebase(){
    return window.BL2FirebaseGuard || null;
  }

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

  function pullAllSheetsToLocal(options){
    var api = sheets();

    return api && typeof api.pullAllSheetsToLocal === "function"
      ? api.pullAllSheetsToLocal(options || {})
      : unavailable("La descarga completa de Google Sheets");
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

  function pullAllFirebaseToLocal(options){
    var api = firebase();

    if(api && typeof api.pullAllFirebaseToLocal === "function"){
      return api.pullAllFirebaseToLocal(options || {});
    }

    if(api && typeof api.pullFirebaseToLocal === "function"){
      return api.pullFirebaseToLocal(
        null,
        Object.assign({},options || {},{
          scope:"all",
          all:true
        })
      );
    }

    return unavailable("La descarga completa de Firebase");
  }

  window.BL2CloudPull = {
    version:VERSION,
    compatibilityOnly:true,
    supportsAllPeriods:true,
    forceFetchFirebaseConfig:forceFetchFirebaseConfig,
    pullSheetsToLocal:pullSheetsToLocal,
    pullAllSheetsToLocal:pullAllSheetsToLocal,
    selectAndPull:selectAndPullSheets,
    cleanSheetsDuplicates:cleanSheetsDuplicates,
    pullFirebaseToLocal:pullFirebaseToLocal,
    pullAllFirebaseToLocal:pullAllFirebaseToLocal
  };
})(window);