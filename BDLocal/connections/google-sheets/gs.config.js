/* =========================================================
Nombre completo: gs.config.js
Ruta: /BDLocal/connections/google-sheets/gs.config.js
Función:
- Leer configuración local de Google Sheets.
- Preparar envío opcional mediante Apps Script Web App.
- No guarda secretos privados.
========================================================= */
(function(window){
  "use strict";

  var STORAGE_KEY = "REQ_GOOGLE_SHEETS_CONFIG_V1";

  function read(){
    try{
      var raw = window.localStorage.getItem(STORAGE_KEY) || "";
      return raw ? JSON.parse(raw) : null;
    }catch(error){ return null; }
  }

  function isConfigured(){
    var cfg = read();
    return !!(cfg && (cfg.webAppUrl || cfg.sheetId));
  }

  function webAppUrl(){
    var cfg = read();
    return cfg && cfg.webAppUrl ? String(cfg.webAppUrl).trim() : "";
  }

  window.BDLGoogleSheetsConfig = {
    storageKey: STORAGE_KEY,
    read: read,
    isConfigured: isConfigured,
    webAppUrl: webAppUrl,
    role: "reporte_visible"
  };
})(window);
