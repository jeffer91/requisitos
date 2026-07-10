/* =========================================================
Archivo: bdl.service.reportes.js
Ruta: /BDLocal/services/bdl.service.reportes.js
Función:
- Servicio de reportes filtrados.
- Entregar el dataset completo filtrado para exportaciones, no solo la página visible.
- Evitar que Reportes dependa del DOM o de datos renderizados.
Con qué se conecta:
- BDLocal/services/bdl.service.estudiantes.js
- BDLocal/services/bdl.service.defensas.js
========================================================= */
(function(window){
  "use strict";

  var Services = window.BDLServices;
  if(!Services){ return; }

  function estudiantes(options){
    var service = Services.get("estudiantes");
    if(!service || typeof service.list !== "function"){
      return Promise.resolve([]);
    }
    return service.list(options || {});
  }

  function defensas(options){
    var service = Services.get("defensas");
    if(!service || typeof service.getFiltered !== "function"){
      return Promise.resolve([]);
    }
    return service.getFiltered(options || {});
  }

  function exportData(tipo, options){
    tipo = Services.text(tipo || "estudiantes").toLowerCase();
    if(tipo === "defensas" || tipo === "defart"){
      return defensas(options || {});
    }
    return estudiantes(options || {});
  }

  var api = { estudiantes: estudiantes, defensas: defensas, exportData: exportData };
  Services.register("reportes", api);
  window.BDLServiceReportes = api;
})(window);
