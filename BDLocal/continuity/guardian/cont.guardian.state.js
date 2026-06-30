/* =========================================================
Nombre completo: cont.guardian.state.js
Ruta: /BDLocal/continuity/guardian/cont.guardian.state.js
Función:
- Mantener estado actual del motor de continuidad.
========================================================= */
(function(window){
  "use strict";

  var state = {
    mode: "normal",
    activeTarget: "firebase",
    lastCheckAt: "",
    running: false,
    failures: {}
  };

  function get(){ return Object.assign({}, state, { failures:Object.assign({}, state.failures) }); }
  function patch(next){ state = Object.assign({}, state, next || {}); return get(); }
  function setMode(mode, target){ state.mode = mode || state.mode; if(target){ state.activeTarget = target; } return get(); }
  function addFailure(id){ state.failures[id] = Number(state.failures[id] || 0) + 1; return state.failures[id]; }
  function clearFailure(id){ state.failures[id] = 0; return 0; }

  window.BDLContGuardianState = { get:get, patch:patch, setMode:setMode, addFailure:addFailure, clearFailure:clearFailure };
})(window);
