/* =========================================================
Nombre completo: gs.config.js
Ruta: /BDLocal/connections/google-sheets/gs.config.js
Función:
- Leer configuración local de Google Sheets.
- Preparar envío opcional mediante Apps Script Web App.
- No guarda secretos privados.
- Diferenciar referencia visible de envío real incremental.
========================================================= */
(function(window){
  "use strict";

  var STORAGE_KEY = "REQ_GOOGLE_SHEETS_CONFIG_V1";

  function read(){
    if(window.BDLConnSettings){ return window.BDLConnSettings.get("googleSheets"); }
    try{
      var raw = window.localStorage.getItem(STORAGE_KEY) || "";
      return raw ? JSON.parse(raw) : null;
    }catch(error){ return null; }
  }

  function isEnabled(){
    var cfg = read();
    return !!(cfg && cfg.enabled === true);
  }

  function sheetId(){
    var cfg = read();
    return cfg && cfg.sheetId ? String(cfg.sheetId).trim() : "";
  }

  function webAppUrl(){
    var cfg = read();
    return cfg && cfg.webAppUrl ? String(cfg.webAppUrl).trim() : "";
  }

  function hasReference(){
    return !!sheetId();
  }

  function canSend(){
    return !!(isEnabled() && sheetId() && webAppUrl());
  }

  function isConfigured(){
    return canSend();
  }

  window.BDLGoogleSheetsConfig = {
    storageKey: STORAGE_KEY,
    read: read,
    isEnabled: isEnabled,
    isConfigured: isConfigured,
    hasReference: hasReference,
    canSend: canSend,
    sheetId: sheetId,
    webAppUrl: webAppUrl,
    role: "reporte_visible"
  };
})(window);
