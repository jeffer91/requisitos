/* =========================================================
Nombre completo: cont.alert.service.js
Ruta: /BDLocal/continuity/alerts/cont.alert.service.js
Función:
- Emitir avisos de continuidad sin saturar al usuario.
========================================================= */
(function(window){
  "use strict";

  function notify(key, detail){
    var cfg = window.BDLContRulesConfig || {};
    var throttle = window.BDLContAlertThrottle;
    if(throttle && !throttle.canShow(key, cfg.alertCooldownMs || 60000)){ return false; }
    var message = window.BDLContAlertMessages ? window.BDLContAlertMessages.get(key) : key;
    var payload = Object.assign({ key:key, message:message, at:new Date().toISOString() }, detail || {});
    try{ window.dispatchEvent(new CustomEvent("bdlocal:continuity-alert", { detail:payload })); }catch(error){}
    return payload;
  }

  window.BDLContAlertService = { notify:notify };
})(window);
