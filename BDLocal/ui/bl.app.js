/* =========================================================
Nombre completo: bl.app.js
Ruta: /BDLocal/ui/bl.app.js
Función:
- Inicializar la nueva capa visual de BL.
- No reemplaza todavía bl.ui.js.
========================================================= */
(function(window, document){
  "use strict";

  function bind(id, handler){ var node = document.getElementById(id); if(node){ node.addEventListener("click", handler); } }

  function renderAll(){
    if(window.BLPanelStatus){ window.BLPanelStatus.render(); }
    if(window.BLPanelSettings){ window.BLPanelSettings.render(); }
    if(window.BLPanelDiagnostics){ window.BLPanelDiagnostics.render(); }
  }

  function boot(){
    if(window.BLTabs){ window.BLTabs.boot(); }
    if(window.BLPanelCloseDay){ window.BLPanelCloseDay.bind(); }
    renderAll();
    bind("blBtnCheckContinuity", function(){
      if(window.BLPanelStatus){ window.BLPanelStatus.check().then(function(){ if(window.BLPanelDiagnostics){ window.BLPanelDiagnostics.render(); } }); }
    });
    bind("blBtnShowContinuityStatus", function(){
      if(window.BLPanelDiagnostics){ window.BLPanelDiagnostics.render(); }
      if(window.BLTabs){ window.BLTabs.activate("diagnostics"); }
    });
    setTimeout(function(){
      if(window.BLPanelStatus){ window.BLPanelStatus.check(); }
    }, 300);
  }

  if(document.readyState === "loading"){ document.addEventListener("DOMContentLoaded", boot); }
  else{ boot(); }

  window.BLApp = { boot: boot, renderAll: renderAll };
})(window, document);