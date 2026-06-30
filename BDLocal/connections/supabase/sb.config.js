/* =========================================================
Nombre completo: sb.config.js
Ruta: /BDLocal/connections/supabase/sb.config.js
Función:
- Leer configuración local de Supabase.
- Definir tablas críticas recomendadas.
- No guardar claves de servicio.
========================================================= */
(function(window){
  "use strict";

  var STORAGE_KEY = "REQ_SUPABASE_CONFIG_V1";

  var TABLES = {
    divisiones: "manual_divisiones",
    notas: "manual_notas",
    telegram: "manual_telegram",
    titulos: "manual_titulos",
    decisiones: "manual_decisiones",
    eventos: "sync_eventos",
    emergencias: "sync_emergencias"
  };

  function read(){
    if(window.BDLConnSettings){ return window.BDLConnSettings.get("supabase"); }
    try{
      var raw = window.localStorage.getItem(STORAGE_KEY) || "";
      return raw ? JSON.parse(raw) : null;
    }catch(error){ return null; }
  }

  function isEnabled(){
    var cfg = read();
    return !!(cfg && cfg.enabled === true);
  }

  function isConfigured(){
    var cfg = read();
    return !!(cfg && cfg.enabled === true && cfg.url && cfg.anonKey);
  }

  function normalizeUrl(url){
    url = String(url || "").trim();
    return url.replace(/\/+$/, "");
  }

  function restUrl(table){
    var cfg = read();
    if(!cfg || !cfg.url){ return ""; }
    return normalizeUrl(cfg.url) + "/rest/v1/" + encodeURIComponent(table);
  }

  window.BDLSupabaseConfig = {
    storageKey: STORAGE_KEY,
    tables: TABLES,
    read: read,
    isEnabled: isEnabled,
    isConfigured: isConfigured,
    restUrl: restUrl
  };
})(window);