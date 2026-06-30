/* =========================================================
Nombre completo: cont.route.supabase.js
Ruta: /BDLocal/continuity/router/cont.route.supabase.js
Función:
- Enviar eventos manuales/críticos a Supabase cuando corresponda.
========================================================= */
(function(window){
  "use strict";

  function send(event){
    if(!window.BDLConnSupabase || typeof window.BDLConnSupabase.sendEvent !== "function"){
      return Promise.reject(new Error("Conector Supabase no disponible."));
    }
    return window.BDLConnSupabase.sendEvent(event);
  }

  window.BDLContRouteSupabase = { send: send };
})(window);
