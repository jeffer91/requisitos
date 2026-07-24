/* =========================================================
Nombre completo: maq-baselocal-background-sync.js
Ruta o ubicación: /Maqueta/maq-baselocal-background-sync.js
Función:
- Mantener compatibilidad con el puente de cierre de Electron.
- Garantizar que Firebase, Google Sheets y Supabase funcionen solo manualmente.
- No abrir Base Local en segundo plano.
- No consultar, escribir ni sincronizar por inactividad o al cerrar.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="5.0.0-manual-only-no-background-io";
  var STATUS_KEY="REQ_MAQ_BL_BACKGROUND_SYNC_STATUS_V2";
  var AUTO_KEY="REQ_BL_AUTO_SYNC_ENABLED_V1";
  var GOOGLE_AUTO_KEY="REQ_BL_AUTO_SYNC_GOOGLE_ENABLED_V1";

  var state={
    started:false,
    running:false,
    closing:false,
    lastActivityAt:Date.now(),
    lastChangeAt:Date.now(),
    lastResult:null
  };

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function parse(value,fallback){try{return value?JSON.parse(value):fallback;}catch(error){return fallback;}}
  function statusText(message){var node=document.getElementById("maq-status-text");if(node){node.textContent=message;}}
  function memoryText(message){var node=document.getElementById("maq-memory-text");if(node){node.textContent=message;}}

  function forceManualFlags(){
    try{window.localStorage.setItem(AUTO_KEY,"false");}catch(error){}
    try{window.localStorage.setItem(GOOGLE_AUTO_KEY,"false");}catch(error){}
  }

  function saveStatus(patch){
    var current=parse(window.localStorage.getItem(STATUS_KEY),{})||{};
    var next=Object.assign({},current,patch||{}, {
      version:VERSION,
      manualOnly:true,
      automatic:false,
      googleAutomatic:false,
      externalReads:0,
      externalWrites:0,
      updatedAt:now(),
      source:"MaquetaManualSyncPolicy"
    });
    try{window.localStorage.setItem(STATUS_KEY,JSON.stringify(next));}catch(error){}
    state.lastResult=next;
    return next;
  }

  function autoEnabled(){forceManualFlags();return false;}
  function googleAutoEnabled(){forceManualFlags();return false;}

  function markActivity(){
    state.lastActivityAt=Date.now();
    saveStatus({mode:"manual",message:"Sincronización manual. No se ejecutan tareas por inactividad."});
  }

  function markChange(){
    state.lastChangeAt=Date.now();
    saveStatus({mode:"pending-manual",message:"Cambio local detectado. El envío requiere una acción manual."});
  }

  function runIdleCycle(){
    forceManualFlags();
    return Promise.resolve(saveStatus({
      ok:true,
      skipped:true,
      mode:"manual",
      message:"AutoSync desactivada permanentemente; no se consultó ni modificó ninguna fuente externa."
    }));
  }

  function handleCloseRequest(){
    forceManualFlags();
    state.closing=false;
    state.running=false;
    return Promise.resolve(saveStatus({
      ok:true,
      canClose:true,
      skipped:true,
      mode:"close-manual",
      message:"Cierre autorizado sin sincronización automática.",
      pendingUnchanged:true
    }));
  }

  function enable(){
    forceManualFlags();
    return saveStatus({
      ok:false,
      blocked:true,
      mode:"manual",
      message:"La sincronización automática está deshabilitada por política de seguridad."
    });
  }

  function disable(){
    forceManualFlags();
    return saveStatus({ok:true,mode:"manual",message:"Sincronización automática desactivada."});
  }

  function enableGoogle(){return enable();}
  function disableGoogle(){return disable();}

  function status(){
    forceManualFlags();
    return Object.assign({},parse(window.localStorage.getItem(STATUS_KEY),{})||{}, {
      version:VERSION,
      manualOnly:true,
      automatic:false,
      googleAutomatic:false,
      running:false,
      closing:false,
      externalReads:0,
      externalWrites:0,
      lastActivityAt:new Date(state.lastActivityAt).toISOString(),
      lastChangeAt:new Date(state.lastChangeAt).toISOString(),
      limits:{backgroundOperations:0,closeOperations:0}
    });
  }

  function removeCloseOverlay(){
    var overlay=document.getElementById("maq-sync-close-overlay");
    if(overlay&&overlay.parentNode){overlay.parentNode.removeChild(overlay);}
  }

  function boot(){
    if(state.started){return;}
    state.started=true;
    forceManualFlags();
    statusText("Sincronización manual");
    memoryText("AutoSync desactivada");
    saveStatus({
      ok:true,
      mode:"manual",
      message:"Solo se sincroniza mediante acciones explícitas del usuario."
    });
  }

  window.MAQ_BASELOCAL_BACKGROUND_SYNC={
    version:VERSION,
    manualOnly:true,
    automatic:false,
    externalReads:0,
    externalWrites:0,
    boot:boot,
    run:runIdleCycle,
    handleCloseRequest:handleCloseRequest,
    enable:enable,
    disable:disable,
    enableGoogle:enableGoogle,
    disableGoogle:disableGoogle,
    markActivity:markActivity,
    markChange:markChange,
    status:status,
    removeCloseOverlay:removeCloseOverlay,
    constants:{backgroundOperations:0,closeOperations:0}
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",boot,{once:true});
  }else{
    boot();
  }
})(window,document);
