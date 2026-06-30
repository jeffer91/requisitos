/* =========================================================
Nombre completo: cont.alert.messages.js
Ruta: /BDLocal/continuity/alerts/cont.alert.messages.js
Función:
- Centralizar mensajes entendibles del motor de continuidad.
========================================================= */
(function(window){
  "use strict";

  var MESSAGES = {
    firebase_down: "Firebase no está sincronizando. Desde ahora los datos importantes se están protegiendo en Supabase.",
    supabase_down: "Supabase no está disponible. Se activó respaldo local de emergencia.",
    firebase_recovered: "Firebase volvió a estar disponible. La app intentará subir los cambios pendientes.",
    protected_local: "Tus datos siguen guardados en BL. No se perdió información."
  };

  function get(key){ return MESSAGES[key] || key || "Cambio de estado de continuidad."; }

  window.BDLContAlertMessages = { get:get, all:MESSAGES };
})(window);
