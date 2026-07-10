/* =========================================================
Archivo: bdl.service.coordi.js
Ruta: /BDLocal/services/bdl.service.coordi.js
Función:
- Servicio de consulta para Coordi.
- Preparar consultas de pendientes sin depender internamente de la pantalla Tabla.
- Mantener el servicio liviano hasta definir reglas específicas de Coordi.
Con qué se conecta:
- BDLocal/services/bdl.service.estudiantes.js
- BDLocal/repositories/bdl.repo.requisitos.js
========================================================= */
(function(window){
  "use strict";

  var Services = window.BDLServices;
  if(!Services){ return; }

  function pendientesRequisitos(options){
    options = options || {};
    var requisitosRepo = Services.repo("requisitos");
    if(!requisitosRepo || typeof requisitosRepo.list !== "function"){
      return Promise.resolve([]);
    }

    return requisitosRepo.list(options).then(function(rows){
      return (rows || []).filter(function(row){
        var estado = Services.normalizeSearch(row.estado || row.valor || row.value);
        return estado === "pendiente" || estado === "no cumple" || estado === "nocumple";
      });
    });
  }

  function estudiantesPendientes(options){
    options = options || {};
    var estudiantes = Services.get("estudiantes");
    if(!estudiantes || typeof estudiantes.list !== "function"){
      return Promise.resolve([]);
    }

    return Promise.all([
      estudiantes.list(options),
      pendientesRequisitos(options)
    ]).then(function(result){
      var rows = result[0] || [];
      var pendientes = result[1] || [];
      var map = Object.create(null);

      pendientes.forEach(function(req){
        var key = Services.text(req.periodoId) + "__" + Services.text(req.cedula);
        map[key] = (map[key] || 0) + 1;
      });

      return rows.filter(function(row){
        var key = Services.text(row.periodoId) + "__" + Services.text(row.cedula);
        return !!map[key];
      }).map(function(row){
        row = Object.assign({}, row);
        var key = Services.text(row.periodoId) + "__" + Services.text(row.cedula);
        row.totalPendientes = map[key] || 0;
        return row;
      });
    });
  }

  var api = {
    pendientesRequisitos: pendientesRequisitos,
    estudiantesPendientes: estudiantesPendientes
  };

  Services.register("coordi", api);
  window.BDLServiceCoordi = api;
})(window);
