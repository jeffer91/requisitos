/* =========================================================
Nombre completo: sb.client.js
Ruta: /BDLocal/connections/supabase/sb.client.js
Función:
- Cliente REST mínimo para Supabase usando URL y anon key.
- No usa service_role ni claves privadas.
========================================================= */
(function(window){
  "use strict";

  function config(){
    if(!window.BDLSupabaseConfig){ throw new Error("BDLSupabaseConfig no está disponible."); }
    var cfg = window.BDLSupabaseConfig.read();
    if(!cfg || !cfg.url || !cfg.anonKey){ throw new Error("Supabase no configurado. Falta URL o anonKey."); }
    return cfg;
  }

  function headers(extra){
    var cfg = config();
    return Object.assign({
      apikey: cfg.anonKey,
      Authorization: "Bearer " + cfg.anonKey,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    }, extra || {});
  }

  function request(pathOrUrl, options){
    options = options || {};
    var url = pathOrUrl;
    if(!/^https?:\/\//i.test(url)){
      var cfg = config();
      url = String(cfg.url || "").replace(/\/+$/, "") + pathOrUrl;
    }
    return fetch(url, Object.assign({}, options, { headers: headers(options.headers) })).then(function(res){
      return res.text().then(function(text){
        var data = null;
        try{ data = text ? JSON.parse(text) : null; }catch(error){ data = text; }
        if(!res.ok){
          var msg = data && data.message ? data.message : ("Supabase error " + res.status);
          var err = new Error(msg);
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  function upsert(table, rows){
    if(!Array.isArray(rows)){ rows = [rows]; }
    var url = window.BDLSupabaseConfig.restUrl(table);
    return request(url, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(rows)
    });
  }

  function list(table, query){
    var url = window.BDLSupabaseConfig.restUrl(table) + (query || "?select=*");
    return request(url, { method: "GET" });
  }

  window.BDLSupabaseClient = {
    config: config,
    request: request,
    upsert: upsert,
    list: list
  };
})(window);
