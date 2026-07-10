/* =========================================================
Archivo: bdl.service.tabla.js
Ruta: /BDLocal/services/bdl.service.tabla.js
Función:
- Servicio de consulta para Tabla principal.
- Entregar estudiantes filtrados y paginados.
- Evitar que la pantalla Tabla cargue toda la base y filtre en el DOM.
Con qué se conecta:
- BDLocal/services/bdl.service.estudiantes.js
========================================================= */
(function(window){
  "use strict";

  var Services = window.BDLServices;
  if(!Services){ return; }

  function getPage(options){
    options = Object.assign({ page: 1, limit: 25 }, options || {});
    var estudiantes = Services.get("estudiantes");
    if(!estudiantes || typeof estudiantes.page !== "function"){
      return Promise.resolve({ rows: [], page: 1, limit: options.limit, total: 0, totalPages: 1, hasPrev: false, hasNext: false });
    }
    return estudiantes.page(options);
  }

  function getFiltered(options){
    var estudiantes = Services.get("estudiantes");
    if(!estudiantes || typeof estudiantes.list !== "function"){
      return Promise.resolve([]);
    }
    return estudiantes.list(options || {});
  }

  var api = { getPage: getPage, getFiltered: getFiltered };
  Services.register("tabla", api);
  window.BDLServiceTabla = api;
})(window);
