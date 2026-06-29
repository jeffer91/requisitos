/* =========================================================
Nombre completo: baselocal.manual.js
Ruta o ubicación: /Requisitos/BaseLocal/baselocal.manual.js
Función o funciones:
- Entregar referencias copiables para que otras pantallas lean BaseLocal.
Con qué se conecta:
- baselocal.app.js
========================================================= */
(function(window){
  "use strict";
  var refs=['<script src="../Gestion/Excel/excel-local/excel-local.config.js"></script>','<script src="../Gestion/Excel/excel-local/excel-local.storage.js"></script>','<script src="../Gestion/Excel/excel-local/excel-local.bridge.js"></script>','<script src="../Gestion/Excel/excel-local.repo.js"></script>','<script src="../BaseLocal/baselocal.core.js"></script>'];
  function getManual(){return refs.join("\n")+"\n\nUso:\nvar estudiantes = window.BaseLocalAPI.getStudents();\nvar periodos = window.BaseLocalAPI.getPeriods();\nvar diagnostico = window.BaseLocalAPI.getDiagnostics();";}
  window.BaseLocalManual={getManual:getManual,refs:refs.slice()};
})(window);
