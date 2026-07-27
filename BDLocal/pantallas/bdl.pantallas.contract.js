/* =========================================================
Nombre completo: bdl.pantallas.contract.js
Ruta: /BDLocal/pantallas/bdl.pantallas.contract.js
Función:
- Exponer el contrato oficial de comunicación interna con pantallas.
- Mantener compatibilidad temporal con BDLocalConeContract.
- No acceder a IndexedDB ni a servicios externos.
========================================================= */
(function(window){
  "use strict";

  var legacy=window.BDLocalConeContract||null;
  if(!legacy){return;}

  var VERSION="1.0.0-base-local-pantallas";
  var EVENTS=Object.freeze({
    READY:"bdlocal:pantallas:ready",
    UPDATED:"bdlocal:pantallas:updated",
    ERROR:"bdlocal:pantallas:error",
    SCREEN_READY:"bdlocal:pantallas:screen-ready",
    MONITOR_UPDATED:"bdlocal:pantallas:monitor-updated"
  });

  function dispatch(name,detail){
    if(typeof legacy.dispatch==="function"){
      return legacy.dispatch(name,detail||{});
    }
    try{
      window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));
      return true;
    }catch(error){
      return false;
    }
  }

  window.BDLocalPantallasContract={
    version:VERSION,
    source:"BDLocal/pantallas/bdl.pantallas.contract.js",
    namespace:"BaseLocal.Pantallas",
    compatibilityGlobal:"BDLocalConeContract",
    legacy:legacy,
    EVENTS:EVENTS,
    LEGACY_EVENTS:legacy.EVENTS||{},
    OPERATIONS:legacy.OPERATIONS||{},
    STATES:legacy.STATES||{},
    TABLES:legacy.TABLES||{},
    text:legacy.text,
    nowISO:legacy.nowISO,
    array:legacy.array,
    object:legacy.object,
    clone:legacy.clone,
    makeId:legacy.makeId,
    normalizeScreen:legacy.normalizeScreen,
    normalizeError:legacy.normalizeError,
    countData:legacy.countData,
    success:legacy.success,
    failure:legacy.failure,
    normalize:legacy.normalize,
    dispatch:dispatch
  };

  dispatch(EVENTS.READY,{
    ok:true,
    module:"contract",
    namespace:"BaseLocal.Pantallas",
    compatibility:true,
    version:VERSION,
    at:new Date().toISOString()
  });
})(window);
