/* =========================================================
Nombre completo: excel-delete.service.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-delete.service.js
Función o funciones:
- Servicio local de borrado básico para períodos en BaseLocal.
- Mantener compatibilidad con nombres anteriores del módulo Excel.
Con qué se conecta:
- excel-local.repo.js
========================================================= */
(function(window){
  "use strict";
  function clearPeriod(periodId){if(!window.ExcelLocalRepo)throw new Error("ExcelLocalRepo no disponible.");return window.ExcelLocalRepo.clearPeriod(periodId);}
  function clearAll(){if(!window.ExcelLocalRepo)throw new Error("ExcelLocalRepo no disponible.");return window.ExcelLocalRepo.clearAll();}
  window.ExcelDeleteService={clearPeriod:clearPeriod,clearAll:clearAll};
})(window);
