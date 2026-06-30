/* =========================================================
Nombre completo: cont.route.fallback.js
Ruta: /BDLocal/continuity/router/cont.route.fallback.js
Función:
- Intentar proteger un evento siguiendo la ruta decidida.
- Ejecuta Supabase si corresponde.
- Marca respaldo Excel/local como pendiente de cierre del día, sin descargar archivos por cada evento.
========================================================= */
(function(window){
  "use strict";

  function protect(event){
    var decision = window.BDLContRouteDecider ? window.BDLContRouteDecider.decide(event) : { targets:["firebase"] };
    var result = { eventId:event && event.id, decision:decision, supabase:null, excel:null, skipped:[] };
    var chain = Promise.resolve(result);

    if(decision.targets.indexOf("supabase") >= 0){
      chain = chain.then(function(){
        if(!window.BDLContRouteSupabase){ result.skipped.push("supabase_no_disponible"); return result; }
        return window.BDLContRouteSupabase.send(event).then(function(r){ result.supabase = r; return result; }).catch(function(error){ result.supabase = { ok:false, error:error && error.message ? error.message : String(error) }; return result; });
      });
    }

    if(decision.targets.indexOf("excel") >= 0){
      chain = chain.then(function(){
        if(event){ event.estadoRespaldo = "pendiente_cierre_dia"; }
        result.excel = { ok:true, status:"pendiente_cierre_dia", message:"El evento queda incluido en el cierre del día o respaldo manual." };
        return result;
      });
    }

    return chain;
  }

  window.BDLContRouteFallback = { protect: protect };
})(window);