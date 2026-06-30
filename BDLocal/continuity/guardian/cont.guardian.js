/* =========================================================
Nombre completo: cont.guardian.js
Ruta: /BDLocal/continuity/guardian/cont.guardian.js
Función:
- Motor inicial de continuidad automática.
- Revisa estados y decide modo general.
- No sincroniza datos todavía.
========================================================= */
(function(window){
  "use strict";

  function byId(rows, id){ return (rows || []).find(function(row){ return row && row.id === id; }) || null; }

  function decide(rows){
    var firebase = byId(rows, "firebase");
    var supabase = byId(rows, "supabase");
    if(firebase && firebase.ok){
      if(window.BDLContGuardianState){ window.BDLContGuardianState.clearFailure("firebase"); }
      return { mode:"normal", activeTarget:"firebase", reason:"firebase_ok" };
    }
    if(window.BDLContGuardianState){ window.BDLContGuardianState.addFailure("firebase"); }
    if(supabase && supabase.ok){
      if(window.BDLContAlertService){ window.BDLContAlertService.notify("firebase_down"); }
      return { mode:"emergencia_supabase", activeTarget:"supabase", reason:"firebase_down_supabase_ok" };
    }
    if(window.BDLContAlertService){ window.BDLContAlertService.notify("supabase_down"); }
    return { mode:"respaldo_local", activeTarget:"excel", reason:"clouds_down" };
  }

  function checkNow(){
    if(window.BDLContGuardianState){ window.BDLContGuardianState.patch({ running:true, lastCheckAt:new Date().toISOString() }); }
    var checker = window.BDLContHealthChecker;
    if(!checker){ return Promise.resolve({ ok:false, message:"Health checker no disponible." }); }
    return checker.checkAll().then(function(rows){
      var decision = decide(rows);
      if(window.BDLContGuardianState){ window.BDLContGuardianState.setMode(decision.mode, decision.activeTarget); window.BDLContGuardianState.patch({ running:false, lastCheckAt:new Date().toISOString() }); }
      try{ window.dispatchEvent(new CustomEvent("bdlocal:continuity-status", { detail:{ decision:decision, health:rows } })); }catch(error){}
      return { ok:true, decision:decision, health:rows };
    }).catch(function(error){
      if(window.BDLContGuardianState){ window.BDLContGuardianState.patch({ running:false }); }
      return { ok:false, error:error };
    });
  }

  function status(){
    return window.BDLContGuardianState ? window.BDLContGuardianState.get() : { mode:"preparado" };
  }

  window.BDLContGuardian = { checkNow:checkNow, status:status, decide:decide };
})(window);
