/* =========================================================
Nombre completo: excel-save.service.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-save.service.js
Función o funciones:
- Servicio local de guardado para compatibilidad con módulos antiguos.
- Redirige el guardado al repositorio local del Bloque 3.
Con qué se conecta:
- excel-local.repo.js
========================================================= */
(function(window){
  "use strict";
  function saveAnalysis(payload){if(!window.ExcelLocalRepo||typeof window.ExcelLocalRepo.saveAnalysis!=="function")throw new Error("ExcelLocalRepo no disponible.");return window.ExcelLocalRepo.saveAnalysis(payload||{});}
  window.ExcelSaveService={saveAnalysis:saveAnalysis};
})(window);
