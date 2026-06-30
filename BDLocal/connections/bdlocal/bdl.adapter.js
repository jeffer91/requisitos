/* =========================================================
Nombre completo: bdl.adapter.js
Ruta: /BDLocal/connections/bdlocal/bdl.adapter.js
Función:
- Registrar BDLocal como conexión principal local.
- Reportar si el núcleo local está disponible.
========================================================= */
(function(window){
  "use strict";

  function health(){
    var ok = !!(window.BDLocal || window.BDLDB);
    return Promise.resolve({
      id: "bdlocal",
      ok: ok,
      status: ok ? "ok" : "error",
      message: ok ? "BDLocal disponible" : "BDLocal no disponible",
      role: "base_local_principal",
      at: new Date().toISOString()
    });
  }

  var api = window.BDLConnInterface ? window.BDLConnInterface.createDefinition({
    id: "bdlocal",
    name: "BL / BDLocal",
    role: "base_local_principal",
    priority: 1,
    capabilities: ["local", "read", "write", "work_offline"],
    health: health,
    test: health
  }) : { id:"bdlocal", name:"BL / BDLocal", health:health, test:health };

  if(window.BDLConnRegistry){ window.BDLConnRegistry.register(api); }
  window.BDLConnBDLocal = api;
})(window);
