/* =========================================================
Nombre completo: sb.client.js
Ruta: /BDLocal/connections/supabase/sb.client.js
Función:
- Cliente REST mínimo para Supabase usando URL y anon key.
- Respeta activado/pausado desde Ajustes.
- Permite guardar y leer registros flexibles de fallback.
========================================================= */
(function(window){
  "use strict";

  function config(){
    if(!window.BDLSupabaseConfig){ throw new Error("BDLSupabaseConfig no está disponible."); }
    var cfg = window.BDLSupabaseConfig.read();
    if(!cfg || cfg.enabled !== true){ throw new Error("Supabase está pausado en Ajustes."); }
    if(!cfg.url || !cfg.anonKey){ throw new Error("Supabase no configurado. Falta URL o anonKey."); }
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

  function joinQuery(parts){
    parts = (parts || []).filter(Boolean);
    return parts.length ? ("?" + parts.join("&")) : "";
  }

  function filter(op, field, value){
    return encodeURIComponent(field) + "=" + op + "." + encodeURIComponent(String(value == null ? "" : value));
  }

  function order(field, desc){ return "order=" + encodeURIComponent(field) + (desc ? ".desc" : ".asc"); }
  function limit(n){ return "limit=" + encodeURIComponent(String(Number(n || 0))); }
  function select(cols){ return "select=" + encodeURIComponent(cols || "*"); }

  function upsert(table, rows, conflict){
    if(!Array.isArray(rows)){ rows = [rows]; }
    var url = window.BDLSupabaseConfig.restUrl(table) + joinQuery(conflict ? ["on_conflict=" + encodeURIComponent(conflict)] : []);
    return request(url, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(rows) });
  }

  function list(table, query){
    var url = window.BDLSupabaseConfig.restUrl(table) + (query || "?select=*");
    return request(url, { method: "GET" });
  }

  function selectRows(table, filters){
    filters = filters || [];
    var query = joinQuery([select("*")].concat(filters));
    return list(table, query);
  }

  window.BDLSupabaseClient = {
    config: config,
    request: request,
    upsert: upsert,
    list: list,
    selectRows: selectRows,
    query: {
      join: joinQuery,
      eq: function(field, value){ return filter("eq", field, value); },
      gt: function(field, value){ return filter("gt", field, value); },
      gte: function(field, value){ return filter("gte", field, value); },
      order: order,
      limit: limit,
      select: select
    }
  };
})(window);
