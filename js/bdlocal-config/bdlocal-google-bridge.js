/* =========================================================
Nombre completo: bdlocal-google-bridge.js
Ruta o ubicación: /js/bdlocal-config/bdlocal-google-bridge.js
Función o funciones:
- Mantener compatibilidad con llamadas antiguas de BL2Sync.
- Permitir Google Sheets únicamente con una orden manual explícita.
- Desactivar sincronización automática por inactividad.
- Desactivar toda sincronización externa al cerrar la aplicación.
- Evitar que una ruta legacy active Firebase automáticamente.
========================================================= */
(function(window,document){
  "use strict";

  var installed = false;
  var attempts = 0;
  var MAX_ATTEMPTS = 40;

  function text(value){ return String(value == null ? "" : value).trim(); }
  function manager(){ return window.BDLocalSyncManager || null; }
  function sync(){ return window.BL2Sync || null; }

  function log(message,level,data){
    try{
      if(window.BDLocalConfigStore && typeof window.BDLocalConfigStore.addLog === "function"){
        window.BDLocalConfigStore.addLog("external_sync_bridge",message,level === "error" ? "error" : level === "warn" ? "warning" : "success",data || {});
      }
    }catch(error){}
  }

  function skipped(message,source){
    var result = {
      ok:true,
      skipped:true,
      manualOnly:true,
      source:text(source || "legacy"),
      message:message
    };
    log(message,"warn",result);
    return Promise.resolve(result);
  }

  function install(){
    var currentSync = sync();
    var currentManager = manager();
    attempts += 1;

    if(!currentSync || !currentManager || typeof currentManager.pushLocalToSheets !== "function"){
      return false;
    }
    if(installed || currentSync.__bdlocalManualBridgeInstalled){ return true; }

    currentSync.syncGoogle = function(options){
      options = options || {};
      if(options.manual !== true){
        return skipped("La sincronización automática de Google Sheets está desactivada.",options.source);
      }
      return currentManager.pushLocalToSheets(Object.assign({},options,{
        manual:true,
        source:text(options.source || "BL2Sync.bridge.manual")
      }));
    };

    currentSync.maybeSyncGoogleIdle = function(options){
      return skipped("La sincronización por inactividad está desactivada. Use el botón Subir.",options && options.source);
    };

    currentSync.syncBeforeClose = function(){
      return Promise.resolve({
        ok:true,
        skipped:true,
        manualOnly:true,
        google:{ ok:true,skipped:true },
        firebase:{ ok:true,skipped:true },
        message:"No se sincronizó al cerrar. Los cambios permanecen guardados en la cola local."
      });
    };

    currentSync.__bdlocalManualBridgeInstalled = true;
    installed = true;
    log("Puente legacy configurado en modo exclusivamente manual.","info",{
      googleAutomatic:false,
      firebaseAutomatic:false,
      syncBeforeClose:false
    });
    return true;
  }

  function start(){
    if(install()){ return; }
    var timer = window.setInterval(function(){
      if(install() || attempts >= MAX_ATTEMPTS){ window.clearInterval(timer); }
    },250);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded",start);
  }else{
    start();
  }

  window.addEventListener("bl2:ready",start);
})(window,document);
