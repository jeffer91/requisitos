/* =========================================================
Nombre completo: sb.adapter.js
Ruta: /BDLocal/connections/supabase/sb.adapter.js
Función:
- Registrar Supabase como respaldo automático de Firebase.
- Exponer health, escritura, lectura y diagnóstico.
========================================================= */
(function(window){
  "use strict";

  function recordsTable(){
    var tables = window.BDLSupabaseConfig ? window.BDLSupabaseConfig.tables : {};
    return tables.records || "app_records";
  }

  function ensureMain(){
    if(!window.BDLSupabaseClient){ return Promise.reject(new Error("BDLSupabaseClient no está disponible.")); }
    if(!window.BDLSupabaseMapper){ return Promise.reject(new Error("BDLSupabaseMapper no está disponible.")); }
    return Promise.resolve(true);
  }

  function health(){
    if(window.BDLSupabaseHealth && typeof window.BDLSupabaseHealth.health === "function"){
      return window.BDLSupabaseHealth.health();
    }
    return Promise.resolve({ id:"supabase", ok:false, status:"no_configurado", message:"Health Supabase no disponible", role:"respaldo_automatico_firebase", at:new Date().toISOString() });
  }

  function sendItem(item){
    return ensureMain().then(function(){
      var row = window.BDLSupabaseMapper.itemToRecord(item || {});
      return window.BDLSupabaseClient.upsert(recordsTable(), [row], "id").then(function(result){
        return { ok:true, target:"supabase", table:recordsTable(), row:row, result:result };
      });
    });
  }

  function listUpdated(collectionName, since, limit){
    return ensureMain().then(function(){
      var C = window.BDLSupabaseClient;
      var Q = C.query;
      var tableKey = window.BDLSupabaseMapper.localTableFromCollection(collectionName);
      var filters = [
        Q.eq("module_key", (window.BDLSyncConfig && window.BDLSyncConfig.supabase && window.BDLSyncConfig.supabase.moduleKey) || "requisitos"),
        Q.eq("table_key", tableKey),
        Q.order("updated_at", true),
        Q.limit(limit || (window.BDLSyncConfig && window.BDLSyncConfig.limites ? window.BDLSyncConfig.limites.loteBajada : 2000))
      ];
      if(since){ filters.splice(2, 0, Q.gt("updated_at", since)); }
      return C.selectRows(recordsTable(), filters).then(function(rows){
        rows = Array.isArray(rows) ? rows : [];
        return rows.map(function(row){ return window.BDLSupabaseMapper.recordToPayload(row); });
      });
    });
  }

  function sendEvent(event){
    if(window.BDLSupabaseUploadCritical && typeof window.BDLSupabaseUploadCritical.sendEvent === "function"){
      return window.BDLSupabaseUploadCritical.sendEvent(event);
    }
    return Promise.reject(new Error("Respaldo crítico Supabase no disponible."));
  }

  function sendEvents(events){
    if(window.BDLSupabaseUploadCritical && typeof window.BDLSupabaseUploadCritical.sendEvents === "function"){
      return window.BDLSupabaseUploadCritical.sendEvents(events || []);
    }
    return Promise.reject(new Error("Respaldo crítico Supabase no disponible."));
  }

  function listCritical(limit){
    if(window.BDLSupabaseRestoreCritical && typeof window.BDLSupabaseRestoreCritical.listCritical === "function"){
      return window.BDLSupabaseRestoreCritical.listCritical(limit || 200);
    }
    return Promise.reject(new Error("Lectura crítica Supabase no disponible."));
  }

  function diagnostics(){
    if(window.BDLSupabaseDiagnostics && typeof window.BDLSupabaseDiagnostics.diagnostics === "function"){
      return window.BDLSupabaseDiagnostics.diagnostics();
    }
    return Promise.resolve({ id:"supabase", ok:false, message:"Diagnóstico Supabase no disponible" });
  }

  var api = window.BDLConnInterface ? window.BDLConnInterface.createDefinition({
    id: "supabase",
    name: "Supabase",
    role: "respaldo_automatico_firebase",
    priority: 3,
    capabilities: ["cloud", "write", "read", "sync", "fallback", "critical_backup", "restore", "diagnostics"],
    health: health,
    test: health,
    upload: sendItem,
    download: listUpdated,
    backup: sendEvents,
    restore: listCritical,
    diagnostics: diagnostics
  }) : { id:"supabase", name:"Supabase", health:health, test:health, upload:sendItem, download:listUpdated, diagnostics:diagnostics };

  api.sendItem = sendItem;
  api.listUpdated = listUpdated;
  api.sendEvent = sendEvent;
  api.sendEvents = sendEvents;
  api.listCritical = listCritical;

  if(window.BDLConnRegistry){ window.BDLConnRegistry.register(api); }
  window.BDLConnSupabase = api;
})(window);
