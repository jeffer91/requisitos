/* =========================================================
Nombre completo: bdlocal-google-bridge.js
Ruta o ubicación: /js/bdlocal-config/bdlocal-google-bridge.js
Función o funciones:
- Mantener compatibilidad con llamadas antiguas de BL2Sync.
- Bloquear Google Sheets automático, por inactividad o al cerrar.
- Delegar las órdenes manuales al administrador, que luego usa BDLSyncV2.
- Instalarse una sola vez al finalizar la carga ordenada.
- No usar intervalos ni iniciar conexiones externas.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION = "2.0.0-manual-no-interval";
  var installed = false;

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
      blocked:true,
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
    if(!currentSync || !currentManager || typeof currentManager.pushLocalToSheets !== "function"){ return false; }
    if(installed || currentSync.__bdlocalManualBridgeInstalled){ return true; }

    currentSync.syncGoogle = function(options){
      options = options || {};
      if(options.manual !== true){
        return skipped("La sincronización automática de Google Sheets está desactivada.",options.source);
      }
      return currentManager.pushLocalToSheets(Object.assign({},options,{
        manual:true,
        automatic:false,
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
    log("Puente legacy configurado una sola vez en modo manual.","info",{
      version:VERSION,
      googleAutomatic:false,
      syncOnIdle:false,
      syncBeforeClose:false,
      intervals:false
    });
    return true;
  }

  window.BDLocalGoogleBridge = Object.assign({},window.BDLocalGoogleBridge || {},{
    version:VERSION,
    manualOnly:true,
    intervals:false,
    install:install,
    status:function(){ return { version:VERSION,installed:installed,manualOnly:true,intervals:false }; }
  });

  window.addEventListener("bdlocal:bl2-html-scripts-loaded",install,{ once:true });
  if(!document.querySelector("script[data-bl2-loader-src]")){
    if(document.readyState === "loading"){
      document.addEventListener("DOMContentLoaded",install,{ once:true });
    }else{
      install();
    }
  }
})(window,document);
