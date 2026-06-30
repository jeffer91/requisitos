/* =========================================================
Nombre completo: gs.diagnostics.js
Ruta: /BDLocal/connections/google-sheets/gs.diagnostics.js
Función:
- Diagnóstico del conector Google Sheets incremental.
========================================================= */
(function(window){
  "use strict";

  function diagnostics(){
    var cfgApi = window.BDLGoogleSheetsConfig;
    var cfg = cfgApi ? cfgApi.read() : null;
    var rows = window.BDLGoogleSheetsExportReport ? window.BDLGoogleSheetsExportReport.rows() : [];
    var queue = window.BDLGoogleSheetsQueue && window.BDLGoogleSheetsQueue.counts ? window.BDLGoogleSheetsQueue.counts() : {};
    var incremental = window.BDLGoogleSheetsIncremental && window.BDLGoogleSheetsIncremental.status ? window.BDLGoogleSheetsIncremental.status() : null;
    return Promise.resolve({
      id: "googleSheets",
      role: "reporte_visible_incremental",
      configured: !!(cfgApi && cfgApi.canSend && cfgApi.canSend()),
      enabled: !!(cfgApi && cfgApi.isEnabled && cfgApi.isEnabled()),
      sheetId: cfg && cfg.sheetId ? cfg.sheetId : "",
      webAppConfigured: !!(cfg && cfg.webAppUrl),
      configLoaded: !!window.BDLGoogleSheetsConfig,
      queueLoaded: !!window.BDLGoogleSheetsQueue,
      mapperLoaded: !!window.BDLGoogleSheetsMapper,
      exportLoaded: !!window.BDLGoogleSheetsExportReport,
      healthLoaded: !!window.BDLGoogleSheetsHealth,
      incrementalLoaded: !!window.BDLGoogleSheetsIncremental,
      previewRows: rows.length,
      queue: queue,
      incremental: incremental,
      at: new Date().toISOString()
    });
  }

  window.BDLGoogleSheetsDiagnostics = { diagnostics: diagnostics };
})(window);