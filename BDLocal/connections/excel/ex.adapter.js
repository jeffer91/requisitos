/* =========================================================
Nombre completo: ex.adapter.js
Ruta: /BDLocal/connections/excel/ex.adapter.js
Función:
- Registrar Excel como respaldo portable/cierre del día.
- Exponer health, backup, cierre del día y diagnóstico.
========================================================= */
(function(window){
  "use strict";

  function health(){
    var ok = typeof Blob !== "undefined" && !!window.URL;
    return Promise.resolve({
      id: "excel",
      ok: ok,
      status: ok ? "disponible" : "no_disponible",
      message: ok ? "Exportación de respaldos disponible" : "El navegador no permite generar archivos",
      role: "respaldo_portable",
      at: new Date().toISOString()
    });
  }

  function backup(){
    if(!window.BDLExcelBackup){ return Promise.reject(new Error("BDLExcelBackup no está disponible.")); }
    return window.BDLExcelBackup.backupJson();
  }

  function backupCriticalCsv(){
    if(!window.BDLExcelBackup){ return Promise.reject(new Error("BDLExcelBackup no está disponible.")); }
    return window.BDLExcelBackup.backupCriticalCsv();
  }

  function closeDay(){
    if(!window.BDLExcelCloseDay){ return Promise.reject(new Error("BDLExcelCloseDay no está disponible.")); }
    return window.BDLExcelCloseDay.closeDay();
  }

  function diagnostics(){
    if(window.BDLExcelDiagnostics && typeof window.BDLExcelDiagnostics.diagnostics === "function"){
      return window.BDLExcelDiagnostics.diagnostics();
    }
    return Promise.resolve({ id:"excel", ok:false, message:"Diagnóstico Excel no disponible" });
  }

  var api = window.BDLConnInterface ? window.BDLConnInterface.createDefinition({
    id: "excel",
    name: "Excel",
    role: "respaldo_portable",
    priority: 4,
    capabilities: ["backup", "export", "restore", "close_day", "diagnostics"],
    health: health,
    test: health,
    backup: backup,
    diagnostics: diagnostics
  }) : { id:"excel", name:"Excel", health:health, test:health, backup:backup, diagnostics:diagnostics };

  api.backupCriticalCsv = backupCriticalCsv;
  api.closeDay = closeDay;

  if(window.BDLConnRegistry){ window.BDLConnRegistry.register(api); }
  window.BDLConnExcel = api;
})(window);