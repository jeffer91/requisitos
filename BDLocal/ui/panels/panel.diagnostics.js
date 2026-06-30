/* =========================================================
Nombre completo: panel.diagnostics.js
Ruta: /BDLocal/ui/panels/panel.diagnostics.js
Función:
- Mostrar diagnóstico inicial del motor de continuidad.
========================================================= */
(function(window, document){
  "use strict";

  function safeJson(value){ try{ return JSON.stringify(value, null, 2); }catch(error){ return String(value); } }

  function render(){
    var box = document.getElementById("blContinuityDiagnostics");
    if(!box){ return; }
    var data = window.BDLContinuity && typeof window.BDLContinuity.status === "function" ? window.BDLContinuity.status() : { ok:false, message:"Motor no disponible" };
    box.textContent = safeJson(data);
  }

  window.addEventListener("bdlocal:continuity-status", render);
  window.BLPanelDiagnostics = { render: render };
})(window, document);
