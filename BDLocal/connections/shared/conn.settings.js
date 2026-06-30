/* =========================================================
Nombre completo: conn.settings.js
Ruta: /BDLocal/connections/shared/conn.settings.js
Función:
- Guardar y leer ajustes de conexiones.
- Persistir en localStorage y, si está disponible, también en BDLocal/app_config.
- No expone claves privadas de servidor.
========================================================= */
(function(window){
  "use strict";

  var PREFIX = "REQ_CONN_SETTINGS_V1:";
  var LEGACY = {
    firebase:"REQ_FIREBASE_CONFIG_V1",
    supabase:"REQ_SUPABASE_CONFIG_V1",
    googleSheets:"REQ_GOOGLE_SHEETS_CONFIG_V1",
    excel:"REQ_EXCEL_CONFIG_V1"
  };

  var DEFAULTS = {
    bdlocal:{ id:"bdlocal", enabled:true, name:"BL / BDLocal", mode:"local", notes:"Base local principal" },
    firebase:{ id:"firebase", enabled:true, name:"Firebase", projectId:"", apiKey:"", authDomain:"", storageBucket:"", appId:"", notes:"Nube principal" },
    supabase:{ id:"supabase", enabled:false, name:"Supabase", url:"", anonKey:"", notes:"Nube secundaria para datos críticos" },
    excel:{ id:"excel", enabled:false, name:"Excel", mode:"download", folderName:"", notes:"Respaldo portable / cierre del día" },
    googleSheets:{ id:"googleSheets", enabled:false, name:"Google Sheets", sheetId:"", webAppUrl:"", notes:"Reporte visible" }
  };

  function clone(value){ return JSON.parse(JSON.stringify(value || {})); }
  function key(id){ return PREFIX + String(id || ""); }

  function readLocal(id){
    try{
      var raw = window.localStorage.getItem(key(id));
      if(raw){ return JSON.parse(raw); }
      if(LEGACY[id]){
        var old = window.localStorage.getItem(LEGACY[id]);
        if(old){
          try{ return JSON.parse(old); }catch(error){ return { enabled:true, value:old }; }
        }
      }
    }catch(error){}
    return null;
  }

  function normalize(id, data){
    id = String(id || "");
    var base = clone(DEFAULTS[id] || { id:id, enabled:false });
    data = data && typeof data === "object" ? data : {};
    var out = Object.assign(base, data, { id:id });
    out.enabled = out.enabled === true;
    out.updatedAt = out.updatedAt || "";
    return out;
  }

  function get(id){ return normalize(id, readLocal(id)); }

  function list(){
    return ["bdlocal", "firebase", "supabase", "excel", "googleSheets"].map(get);
  }

  function save(id, data){
    id = String(id || "");
    var current = get(id);
    var next = normalize(id, Object.assign({}, current, data || {}, { updatedAt:new Date().toISOString() }));
    try{ window.localStorage.setItem(key(id), JSON.stringify(next)); }catch(error){}
    if(LEGACY[id]){
      try{ window.localStorage.setItem(LEGACY[id], JSON.stringify(next)); }catch(error){}
    }
    if(window.BDLRepoConfig && typeof window.BDLRepoConfig.guardar === "function"){
      try{ window.BDLRepoConfig.guardar("conexion__" + id, next).catch(function(){}); }catch(error){}
    }
    try{ window.dispatchEvent(new CustomEvent("bdlocal:connection-settings-changed", { detail:{ id:id, settings:next } })); }catch(error){}
    return next;
  }

  function setEnabled(id, enabled){ return save(id, { enabled:enabled === true }); }

  function isEnabled(id){ return get(id).enabled === true; }

  function isConfigured(id){
    var s = get(id);
    if(id === "bdlocal"){ return true; }
    if(id === "firebase"){
      return s.enabled && (!!s.projectId || !!window.firebaseConfig || !!window.FIREBASE_CONFIG || !!window.firebase || !!window.db || !!window.BDLSyncFirebase);
    }
    if(id === "supabase"){ return s.enabled && !!s.url && !!s.anonKey; }
    if(id === "excel"){ return s.enabled === true; }
    if(id === "googleSheets"){ return s.enabled && (!!s.webAppUrl || !!s.sheetId); }
    return s.enabled === true;
  }

  function publicView(id){
    var s = get(id);
    var out = Object.assign({}, s);
    if(out.apiKey){ out.apiKey = "********"; }
    if(out.anonKey){ out.anonKey = "********"; }
    return out;
  }

  window.BDLConnSettings = {
    get:get,
    list:list,
    save:save,
    setEnabled:setEnabled,
    isEnabled:isEnabled,
    isConfigured:isConfigured,
    publicView:publicView,
    storagePrefix:PREFIX
  };
})(window);