/* =========================================================
Nombre completo: ex.close-day.js
Ruta: /BDLocal/connections/excel/ex.close-day.js
Función:
- Ejecutar cierre del día / proteger trabajo.
- Genera respaldo completo JSON y respaldo CSV de eventos manuales/críticos.
========================================================= */
(function(window){
  "use strict";

  function closeDay(){
    if(!window.BDLExcelBackup){ return Promise.reject(new Error("BDLExcelBackup no está disponible.")); }
    var report = { ok:true, startedAt:new Date().toISOString(), json:null, csv:null, finishedAt:"" };
    return window.BDLExcelBackup.backupJson().then(function(jsonResult){
      report.json = jsonResult;
      return window.BDLExcelBackup.backupCriticalCsv().catch(function(error){
        return { ok:false, error:error && error.message ? error.message : String(error) };
      });
    }).then(function(csvResult){
      report.csv = csvResult;
      report.finishedAt = new Date().toISOString();
      try{ window.dispatchEvent(new CustomEvent("bdlocal:close-day-created", { detail:report })); }catch(error){}
      return report;
    });
  }

  window.BDLExcelCloseDay = { closeDay: closeDay };
})(window);
