/* =========================================================
Nombre completo: sb.upload-critical.js
Ruta: /BDLocal/connections/supabase/sb.upload-critical.js
Función:
- Guardar eventos manuales/críticos en Supabase.
- Se usa como nube secundaria cuando Firebase falla o para datos críticos.
========================================================= */
(function(window){
  "use strict";

  function isAllowed(event){
    event = event || {};
    var p = String(event.prioridad || "").toLowerCase();
    return p === "manual" || p === "critico";
  }

  function sendEvent(event){
    if(!isAllowed(event)){ return Promise.resolve({ skipped:true, reason:"dato_recuperable", event:event }); }
    if(!window.BDLSupabaseClient){ return Promise.reject(new Error("BDLSupabaseClient no está disponible.")); }
    if(!window.BDLSupabaseMapper){ return Promise.reject(new Error("BDLSupabaseMapper no está disponible.")); }
    var table = window.BDLSupabaseMapper.tableForEvent(event);
    var row = window.BDLSupabaseMapper.eventToRow(event);
    return window.BDLSupabaseClient.upsert(table, row).then(function(result){
      event.estadoSupabase = "sincronizado";
      event.updatedAt = new Date().toISOString();
      return { ok:true, table:table, row:row, result:result };
    });
  }

  function sendEvents(events){
    events = Array.isArray(events) ? events : [];
    var summary = { total:events.length, ok:0, skipped:0, error:0, details:[] };
    var chain = Promise.resolve(summary);
    events.forEach(function(event){
      chain = chain.then(function(){
        return sendEvent(event).then(function(result){
          if(result && result.skipped){ summary.skipped += 1; }
          else{ summary.ok += 1; }
          summary.details.push(result);
          return summary;
        }).catch(function(error){
          summary.error += 1;
          summary.details.push({ ok:false, error:error && error.message ? error.message : String(error), event:event });
          return summary;
        });
      });
    });
    return chain;
  }

  window.BDLSupabaseUploadCritical = {
    sendEvent: sendEvent,
    sendEvents: sendEvents
  };
})(window);
