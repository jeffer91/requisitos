/* =========================================================
Nombre completo: cont.route.decider.js
Ruta: /BDLocal/continuity/router/cont.route.decider.js
Función:
- Decidir ruta de protección para cada evento.
- No escribe datos directamente.
========================================================= */
(function(window){
  "use strict";

  function decide(event){
    event = event || {};
    var priority = String(event.prioridad || "recuperable").toLowerCase();
    var guardian = window.BDLContGuardianState ? window.BDLContGuardianState.get() : { mode:"normal", activeTarget:"firebase" };
    var targets = ["firebase"];

    if(priority === "critico"){
      targets = ["firebase", "supabase", "excel"];
    }else if(priority === "manual"){
      targets = guardian.mode === "normal" ? ["firebase", "supabase"] : ["supabase", "excel"];
    }else{
      targets = guardian.mode === "normal" ? ["firebase"] : ["excel"];
    }

    if(guardian.mode === "emergencia_supabase" && targets.indexOf("supabase") < 0){ targets.unshift("supabase"); }
    if(guardian.mode === "respaldo_local" && targets.indexOf("excel") < 0){ targets.push("excel"); }

    return {
      eventId: event.id || "",
      priority: priority,
      mode: guardian.mode || "normal",
      activeTarget: guardian.activeTarget || "firebase",
      targets: targets
    };
  }

  window.BDLContRouteDecider = { decide: decide };
})(window);
