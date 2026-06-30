/* =========================================================
Nombre completo: sb.restore-critical.js
Ruta: /BDLocal/connections/supabase/sb.restore-critical.js
Función:
- Leer datos críticos desde Supabase para revisión o restauración futura.
- No restaura automáticamente sobre BDLocal.
========================================================= */
(function(window){
  "use strict";

  function listTable(table, limit){
    if(!window.BDLSupabaseClient){ return Promise.reject(new Error("BDLSupabaseClient no está disponible.")); }
    limit = Number(limit || 200);
    return window.BDLSupabaseClient.list(table, "?select=*&order=updated_at.desc&limit=" + encodeURIComponent(limit));
  }

  function listCritical(limit){
    var tables = window.BDLSupabaseConfig ? window.BDLSupabaseConfig.tables : {};
    var names = [tables.notas, tables.divisiones, tables.telegram, tables.titulos, tables.decisiones].filter(Boolean);
    var result = {};
    var chain = Promise.resolve();
    names.forEach(function(table){
      chain = chain.then(function(){
        return listTable(table, limit).then(function(rows){ result[table] = rows || []; }).catch(function(error){ result[table] = { error:error && error.message ? error.message : String(error) }; });
      });
    });
    return chain.then(function(){ return result; });
  }

  window.BDLSupabaseRestoreCritical = {
    listTable: listTable,
    listCritical: listCritical
  };
})(window);
