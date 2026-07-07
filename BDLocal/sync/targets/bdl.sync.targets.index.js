/* =========================================================
Archivo: bdl.sync.targets.index.js
Ruta: /BDLocal/sync/targets/bdl.sync.targets.index.js
Función:
- Crear el registro de destinos de sincronización.
- Preparar Firebase, Supabase y Google Sheets como destinos separados.
- No ejecutar sincronización todavía; solo registrar adaptadores futuros.
Con qué se conecta:
- BDLocal/sync/bdl.sync.index.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.1.0-block1";
  var targets = Object.create(null);

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function register(name, adapter){
    name = text(name);
    if(!name || !adapter){ return false; }
    targets[name] = adapter;
    return true;
  }

  function get(name){
    return targets[text(name)] || null;
  }

  window.BDLSyncTargets = {
    version: VERSION,
    register: register,
    get: get,
    list: function(){ return Object.keys(targets); }
  };
})(window);
