/* =========================================================
Nombre completo: coo.bridge.js
Ruta o ubicación: /Requisitos/Coordi/coo.bridge.js
Función o funciones:
- Unir Coordi con los adaptadores reales cargados por BDLocal.
- Exponer BDLScreenCompat cuando solo existe BDLLegacyAdapter.
- Evitar que coo.data.js busque un puente inexistente.
Con qué se conecta:
- ../BDLocal/adapters/bdl.screen-deps.js
- BDLLegacyAdapter
- coo.data.js
========================================================= */
(function(window){
  "use strict";

  function clone(value){
    try{return JSON.parse(JSON.stringify(value == null ? null : value));}
    catch(error){return value;}
  }

  function legacy(){return window.BDLLegacyAdapter || null;}

  function snapshot(){
    var l = legacy();
    if(!l){return {periods:[], students:[], diagnostics:[], meta:{source:"coo.bridge:sin_legacy"}};}
    if(typeof l.snapshot === "function"){
      return clone(l.snapshot() || {});
    }
    return {periods:[], students:[], diagnostics:[], meta:{source:"coo.bridge:legacy_sin_snapshot"}};
  }

  function getSnapshot(){
    var l = legacy();
    if(l && typeof l.refresh === "function"){
      return Promise.resolve(l.refresh()).then(function(result){return clone(result || snapshot());});
    }
    return Promise.resolve(snapshot());
  }

  if(!window.BDLScreenCompat){
    window.BDLScreenCompat = {
      source:"coo.bridge",
      getSnapshot:getSnapshot,
      snapshot:snapshot()
    };
  }else{
    if(typeof window.BDLScreenCompat.getSnapshot !== "function"){
      window.BDLScreenCompat.getSnapshot = getSnapshot;
    }
    if(!window.BDLScreenCompat.snapshot){
      window.BDLScreenCompat.snapshot = snapshot();
    }
  }

  window.COOBridge = {
    version:"1.0.0-coo-bridge.1",
    getSnapshot:getSnapshot,
    snapshot:snapshot
  };
})(window);
