/* =========================================================
Nombre completo: conn.response.js
Ruta: /BDLocal/connections/shared/conn.response.js
Función:
- Normalizar respuestas de conectores.
- Evitar que cada base invente estados diferentes.
========================================================= */
(function(window){
  "use strict";

  function now(){ return new Date().toISOString(); }

  function ok(data){
    return Object.assign({ ok:true, status:"ok", message:"OK", at:now() }, data || {});
  }

  function error(message, data){
    return Object.assign({ ok:false, status:"error", message:message || "Error de conexión", at:now() }, data || {});
  }

  function unavailable(reason, data){
    return Object.assign({ ok:false, status:reason || "unavailable", message:"Base no disponible", at:now() }, data || {});
  }

  window.BDLConnResponse = {
    ok: ok,
    error: error,
    unavailable: unavailable
  };
})(window);
