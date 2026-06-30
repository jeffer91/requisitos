/* =========================================================
Nombre completo: fb.config.js
Ruta: /BDLocal/connections/firebase/fb.config.js
Función:
- Centralizar configuración del conector Firebase.
- Leer configuración existente sin duplicar lógica.
========================================================= */
(function(window){
  "use strict";

  function syncConfig(){ return window.BDLSyncConfig || {}; }

  function collections(){
    var cfg = syncConfig();
    return cfg.collections || { estudiantes:"Estudiantes", periodos:"periodos" };
  }

  function limits(){
    var cfg = syncConfig();
    return cfg.limites || { loteSubida:100, loteBajada:2000 };
  }

  function now(){
    var cfg = syncConfig();
    return typeof cfg.now === "function" ? cfg.now() : new Date().toISOString();
  }

  window.BDLFirebaseConfig = {
    collections: collections,
    limits: limits,
    now: now,
    role: "nube_principal"
  };
})(window);
