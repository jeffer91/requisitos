/* =========================================================
Nombre completo: bdl.sync.google-auto.js
Ruta: /BDLocal/sync/bdl.sync.google-auto.js
Función:
- Mantener compatibilidad con referencias antiguas a BDLGoogleAutoSync.
- Impedir sincronización periódica, por arranque, inactividad o cierre.
- Redirigir al usuario hacia las acciones manuales de ConexionesExternas.
- No leer ni escribir servicios externos.
========================================================= */
(function(window){
  "use strict";

  var VERSION="2.0.0-manual-only-compatibility";
  var state={
    enabled:false,
    started:false,
    running:false,
    automatic:false,
    manualOnly:true,
    circuitOpen:false,
    timerActive:false,
    externalReads:0,
    externalWrites:0,
    lastRunAt:"",
    lastSuccessAt:"",
    lastError:"",
    lastMessage:"Sincronización automática desactivada. Use Centro de datos → Conexiones Externas.",
    lastReason:"manual_only"
  };

  function now(){return new Date().toISOString();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function snapshot(){return Object.assign({version:VERSION,source:"BDLGoogleAutoSync.compat",at:now()},clone(state));}
  function emit(name){try{window.dispatchEvent(new CustomEvent(name,{detail:snapshot()}));}catch(error){}}

  function blocked(action){
    state.lastReason="blocked_"+String(action||"automatic");
    state.lastMessage="La sincronización automática está bloqueada. Use una acción manual del Centro de datos.";
    emit("bdlocal:google-auto-sync-blocked");
    return Promise.resolve(Object.assign(snapshot(),{
      ok:false,
      skipped:true,
      blocked:true,
      action:String(action||"automatic")
    }));
  }

  function start(){
    state.started=true;
    state.enabled=false;
    state.running=false;
    state.automatic=false;
    state.timerActive=false;
    state.lastReason="startup_manual_only";
    emit("bdlocal:google-auto-sync-status");
    return snapshot();
  }

  function disable(reason){
    state.enabled=false;
    state.running=false;
    state.automatic=false;
    state.timerActive=false;
    state.lastReason="disabled";
    state.lastMessage=String(reason||"Sincronización automática desactivada.");
    emit("bdlocal:google-auto-sync-disabled");
    return snapshot();
  }

  window.BDLGoogleAutoSync={
    version:VERSION,
    manualOnly:true,
    automatic:false,
    start:start,
    runNow:function(){return blocked("runNow");},
    enable:function(){return blocked("enable");},
    disable:disable,
    resume:function(){return blocked("resume");},
    schedule:function(){return false;},
    status:snapshot,
    isRunning:function(){return false;},
    isCircuitOpen:function(){return false;}
  };
})(window);
