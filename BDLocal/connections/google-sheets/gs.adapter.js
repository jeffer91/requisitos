/* =========================================================
Nombre completo: gs.adapter.js
Ruta: /BDLocal/connections/google-sheets/gs.adapter.js
Función:
- Registrar Google Sheets como reporte visible/revisión.
========================================================= */
(function(window){
  "use strict";

  function health(){
    var raw = "";
    try{ raw = window.localStorage.getItem("REQ_GOOGLE_SHEETS_CONFIG_V1") || ""; }catch(error){}
    var configured = !!raw;
    return Promise.resolve({
      id: "googleSheets",
      ok: configured,
      status: configured ? "configurado" : "no_configurado",
      message: configured ? "Google Sheets configurado. Falta prueba profunda." : "Google Sheets no configurado todavía.",
      role: "reporte_visible",
      at: new Date().toISOString()
    });
  }

  var api = window.BDLConnInterface ? window.BDLConnInterface.createDefinition({
    id: "googleSheets",
    name: "Google Sheets",
    role: "reporte_visible",
    priority: 5,
    capabilities: ["report", "export", "review"],
    health: health,
    test: health
  }) : { id:"googleSheets", name:"Google Sheets", health:health, test:health };

  if(window.BDLConnRegistry){ window.BDLConnRegistry.register(api); }
  window.BDLConnGoogleSheets = api;
})(window);
