/* =========================================================
Nombre completo: bl2.cloud-pull.js
Ruta o ubicación: /BDLocal/bl2.cloud-pull.js
Función o funciones:
- Mantener compatibilidad con llamadas antiguas de descarga externa.
- Delegar Google Sheets exclusivamente a BL2CloudPullSafe.
- Delegar Firebase exclusivamente a BL2FirebaseGuard.
- Permitir traer un período o todos los períodos.
- Normalizar la API de diagnóstico segura para la certificación runtime.
- No registrar botones, intervalos ni importaciones propias.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "3.1.1-safe-diagnostics";

  function unavailable(name){
    return Promise.reject(new Error(
      name + " todavía no está disponible. Espere a que BDLocal termine de cargar."
    ));
  }

  function normalizeSafeDiagnostics(){
    var api = window.BL2CloudPullSafe || null;
    if(!api){return null;}
    if(typeof api.diagnostics === "function"){return api;}

    var details = api.diagnostics && typeof api.diagnostics === "object"
      ? api.diagnostics
      : {};
    var diagnostics = function(){
      return {
        ok:true,
        version:api.version || "",
        singleImplementation:api.singleImplementation === true,
        supportsAllPeriods:api.supportsAllPeriods === true,
        methods:Object.keys(details)
      };
    };

    Object.keys(details).forEach(function(name){
      diagnostics[name] = details[name];
    });

    api.diagnostics = diagnostics;
    return api;
  }

  function sheets(){
    return normalizeSafeDiagnostics() || window.BL2CloudPullSafe || null;
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
    normalizeSafeDiagnostics:normalizeSafeDiagnostics,
    forceFetchFirebaseConfig:forceFetchFirebaseConfig,
    pullSheetsToLocal:pullSheetsToLocal,
    pullAllSheetsToLocal:pullAllSheetsToLocal,
    selectAndPull:selectAndPullSheets,
    cleanSheetsDuplicates:cleanSheetsDuplicates,
    pullFirebaseToLocal:pullFirebaseToLocal,
    pullAllFirebaseToLocal:pullAllFirebaseToLocal
  };

  window.addEventListener("bdlocal:bl2-html-scripts-loaded",normalizeSafeDiagnostics,{once:true});
  window.addEventListener("load",normalizeSafeDiagnostics,{once:true});
  window.setTimeout(normalizeSafeDiagnostics,0);
  window.setTimeout(normalizeSafeDiagnostics,250);
})(window);
