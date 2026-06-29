/* =========================================================
Nombre completo: excel-historial.repo.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-historial.repo.js
Función o funciones:
- Repositorio de historial local para compatibilidad.
- Lee historial desde ExcelLocalRepo.
Con qué se conecta:
- excel-local.repo.js
========================================================= */
(function(window){
  "use strict";
  function list(){return window.ExcelLocalRepo&&window.ExcelLocalRepo.listHistory?window.ExcelLocalRepo.listHistory():[];}
  window.ExcelHistorialRepo={list:list,listAll:list};
})(window);
