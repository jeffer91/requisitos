/* =========================================================
Nombre completo: bl.tabs.js
Ruta: /BDLocal/ui/bl.tabs.js
Función:
- Manejar el submenú interno de BL.
- Mostrar un panel a la vez sin afectar la lógica vieja.
========================================================= */
(function(window, document){
  "use strict";

  function all(selector){ return Array.prototype.slice.call(document.querySelectorAll(selector)); }

  function activate(tab){
    tab = tab || "local";
    all("[data-bl-tab]").forEach(function(btn){
      btn.classList.toggle("active", btn.getAttribute("data-bl-tab") === tab);
    });
    all("[data-bl-panel]").forEach(function(panel){
      panel.classList.toggle("active", panel.getAttribute("data-bl-panel") === tab);
    });
    try{ window.localStorage.setItem("REQ_BL_ACTIVE_TAB_V1", tab); }catch(error){}
    try{ window.dispatchEvent(new CustomEvent("bl:tab-changed", { detail:{ tab:tab } })); }catch(error){}
  }

  function boot(){
    all("[data-bl-tab]").forEach(function(btn){
      btn.addEventListener("click", function(){ activate(btn.getAttribute("data-bl-tab")); });
    });
    var saved = "";
    try{ saved = window.localStorage.getItem("REQ_BL_ACTIVE_TAB_V1") || ""; }catch(error){}
    activate(saved || "local");
  }

  window.BLTabs = { boot: boot, activate: activate };
})(window, document);
