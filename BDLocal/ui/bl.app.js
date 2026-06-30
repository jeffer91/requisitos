/* =========================================================
Nombre completo: bl.app.js
Ruta: /BDLocal/ui/bl.app.js
Función:
- Inicializar la nueva capa visual de BL.
- No reemplaza todavía bl.ui.js.
========================================================= */
(function(window, document){
  "use strict";

  function bind(id, handler){ var node = document.getElementById(id); if(node){ node.addEventListener("click", handler); } }
  function print(id, value){
    var node = document.getElementById(id);
    if(!node){ return; }
    try{ node.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2); }
    catch(error){ node.textContent = String(value); }
  }

  function renderAll(){
    if(window.BLPanelStatus){ window.BLPanelStatus.render(); }
    if(window.BLPanelSettings){ window.BLPanelSettings.render(); }
    if(window.BLPanelDiagnostics){ window.BLPanelDiagnostics.render(); }
  }

  function syncSupabaseNow(){
    print("blSupabaseOutput", "Sincronizando con Supabase...");
    if(window.BDLConnSettings && typeof window.BDLConnSettings.setEnabled === "function"){
      window.BDLConnSettings.setEnabled("supabase", true);
    }
    if(window.BDLConnFirebase && window.BDLConnSettings && typeof window.BDLConnSettings.setEnabled === "function"){
      window.BDLConnSettings.setEnabled("firebase", false);
    }
    if(window.BDLSyncEngine && typeof window.BDLSyncEngine.syncNow === "function"){
      return window.BDLSyncEngine.syncNow({ manual:true, full:false }).then(function(result){
        print("blSupabaseOutput", result);
        if(window.BLPanelStatus){ window.BLPanelStatus.check(); }
        return result;
      }).catch(function(error){
        print("blSupabaseOutput", { ok:false, error:error && error.message ? error.message : String(error) });
      });
    }
    if(window.BDLSync && typeof window.BDLSync.syncNow === "function"){
      return window.BDLSync.syncNow({ manual:true, full:false }).then(function(result){
        print("blSupabaseOutput", result);
        return result;
      }).catch(function(error){
        print("blSupabaseOutput", { ok:false, error:error && error.message ? error.message : String(error) });
      });
    }
    print("blSupabaseOutput", "Motor de sincronización no disponible.");
    return Promise.resolve({ ok:false });
  }

  function boot(){
    if(window.BLTabs){ window.BLTabs.boot(); }
    if(window.BLPanelCloseDay){ window.BLPanelCloseDay.bind(); }
    if(window.BLPanelSheets){ window.BLPanelSheets.bind(); }
    renderAll();
    bind("blBtnCheckContinuity", function(){
      if(window.BLPanelStatus){ window.BLPanelStatus.check().then(function(){ if(window.BLPanelDiagnostics){ window.BLPanelDiagnostics.render(); } }); }
    });
    bind("blBtnShowContinuityStatus", function(){
      if(window.BLPanelDiagnostics){ window.BLPanelDiagnostics.render(); }
      if(window.BLTabs){ window.BLTabs.activate("diagnostics"); }
    });
    bind("blBtnSupabaseManualSync", syncSupabaseNow);
    setTimeout(function(){
      if(window.BLPanelStatus){ window.BLPanelStatus.check(); }
    }, 300);
  }

  if(document.readyState === "loading"){ document.addEventListener("DOMContentLoaded", boot); }
  else{ boot(); }

  window.BLApp = { boot: boot, renderAll: renderAll, syncSupabaseNow: syncSupabaseNow };
})(window, document);
