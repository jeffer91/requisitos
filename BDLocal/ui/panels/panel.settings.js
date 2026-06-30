/* =========================================================
Nombre completo: panel.settings.js
Ruta: /BDLocal/ui/panels/panel.settings.js
Función:
- Renderizar resumen inicial de ajustes de bases.
- Todavía no guarda credenciales reales.
========================================================= */
(function(window, document){
  "use strict";

  function configured(key){
    try{ return !!window.localStorage.getItem(key); }catch(error){ return false; }
  }

  function render(){
    var box = document.getElementById("blSettingsSummary");
    if(!box){ return; }
    box.innerHTML = [
      { name:"Firebase", status: configured("REQ_FIREBASE_CONFIG_V1") || !!window.firebaseConfig ? "configurado/cargado" : "configuración por defecto o pendiente" },
      { name:"Supabase", status: configured("REQ_SUPABASE_CONFIG_V1") ? "configurado" : "no configurado" },
      { name:"Excel", status: "disponible como respaldo local/exportable" },
      { name:"Google Sheets", status: configured("REQ_GOOGLE_SHEETS_CONFIG_V1") ? "configurado" : "no configurado" }
    ].map(function(item){
      return '<div class="bl-mini-card"><strong>'+item.name+'</strong><span>'+item.status+'</span></div>';
    }).join("");
  }

  window.BLPanelSettings = { render: render };
})(window, document);
