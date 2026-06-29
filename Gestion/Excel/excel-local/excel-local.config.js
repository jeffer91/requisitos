/* =========================================================
Nombre completo: excel-local.config.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-local/excel-local.config.js
Función o funciones:
- Configurar la base local rápida del módulo Excel.
- Centralizar claves de localStorage y nombres de colección local.
Con qué se conecta:
- excel-local.storage.js
- excel-local.bridge.js
- excel-local.repo.js
========================================================= */
(function(window){
  "use strict";
  var KEY_PREFIX="REQ_EXCEL_LOCAL_V1";
  var config={
    appName:"Requisitos",
    moduleName:"ExcelLocal",
    version:"1.0.0",
    keys:{
      snapshot:KEY_PREFIX+":snapshot",
      meta:KEY_PREFIX+":meta",
      queue:KEY_PREFIX+":queue",
      updatedAt:KEY_PREFIX+":updatedAt"
    },
    collections:{periods:"periods",students:"students",history:"history",diagnostics:"diagnostics"}
  };
  window.ExcelLocalConfig=config;
})(window);
