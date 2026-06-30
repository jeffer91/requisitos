/* =========================================================
Nombre completo: gs.health.js
Ruta: /BDLocal/connections/google-sheets/gs.health.js
Función:
- Evaluar estado de configuración de Google Sheets.
- Mostrar estado de cola incremental.
========================================================= */
(function(window){
  "use strict";

  function health(){
    var cfgApi = window.BDLGoogleSheetsConfig;
    var enabled = !!(cfgApi && cfgApi.isEnabled && cfgApi.isEnabled());
    var configured = !!(cfgApi && cfgApi.canSend && cfgApi.canSend());
    var cfg = cfgApi ? cfgApi.read() : null;
    var counts = window.BDLGoogleSheetsQueue && window.BDLGoogleSheetsQueue.counts ? window.BDLGoogleSheetsQueue.counts() : {};
    var incremental = window.BDLGoogleSheetsIncremental && window.BDLGoogleSheetsIncremental.status ? window.BDLGoogleSheetsIncremental.status() : null;

    if(!enabled){
      return Promise.resolve({
        id: "googleSheets",
        ok: false,
        status: "pausado",
        message: "Google Sheets está pausado en Ajustes.",
        role: "reporte_visible_incremental",
        sheetId: "",
        webAppConfigured: false,
        queue: counts,
        at: new Date().toISOString()
      });
    }

    return Promise.resolve({
      id: "googleSheets",
      ok: configured,
      status: configured ? "configurado" : "no_configurado",
      message: configured ? "Google Sheets configurado para envío incremental lento." : "Google Sheets activo, pero falta Sheet ID o Web App URL.",
      role: "reporte_visible_incremental",
      sheetId: cfg && cfg.sheetId ? cfg.sheetId : "",
      webAppConfigured: !!(cfg && cfg.webAppUrl),
      queue: counts,
      incremental: incremental,
      at: new Date().toISOString()
    });
  }

  window.BDLGoogleSheetsHealth = { health: health };
})(window);