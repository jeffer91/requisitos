/* =========================================================
Nombre completo: sb.diagnostics.js
Ruta: /BDLocal/connections/supabase/sb.diagnostics.js
Función:
- Entregar diagnóstico simple de Supabase.
========================================================= */
(function(window){
  "use strict";

  function diagnostics(){
    var cfg = window.BDLSupabaseConfig ? window.BDLSupabaseConfig.read() : null;
    var events = window.BDLContEventRepo && window.BDLContEventRepo.list ? window.BDLContEventRepo.list() : [];
    var manuales = events.filter(function(e){ return e && (e.prioridad === "manual" || e.prioridad === "critico"); });
    return Promise.resolve({
      id: "supabase",
      role: "nube_secundaria_critica",
      configured: !!(cfg && cfg.url && cfg.anonKey),
      url: cfg && cfg.url ? cfg.url : "",
      clientLoaded: !!window.BDLSupabaseClient,
      mapperLoaded: !!window.BDLSupabaseMapper,
      healthLoaded: !!window.BDLSupabaseHealth,
      uploadLoaded: !!window.BDLSupabaseUploadCritical,
      restoreLoaded: !!window.BDLSupabaseRestoreCritical,
      manualCriticalEventsLocal: manuales.length,
      at: new Date().toISOString()
    });
  }

  window.BDLSupabaseDiagnostics = { diagnostics: diagnostics };
})(window);
