/* =========================================================
Archivo: bdl.service.stats.js
Ruta: /BDLocal/services/bdl.service.stats.js
Función:
- Servicio de estadísticas por período.
- Calcular resúmenes sin que Stats tenga que leer y procesar toda la base directamente.
- Preparar futura caché reconstruible en BDLocal/views.
Con qué se conecta:
- BDLocal/services/bdl.service.estudiantes.js
- BDLocal/repositories/bdl.repo.requisitos.js
- BDLocal/repositories/bdl.repo.notas.js
========================================================= */
(function(window){
  "use strict";

  var Services = window.BDLServices;
  if(!Services){ return; }

  function text(value){ return Services.text(value); }

  function groupCount(rows, getter){
    var map = Object.create(null);
    (rows || []).forEach(function(row){
      var key = text(getter(row) || "SIN_DATO") || "SIN_DATO";
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }

  function resumenPeriodo(options){
    options = options || {};
    var estudiantes = Services.get("estudiantes");
    if(!estudiantes || typeof estudiantes.list !== "function"){
      return Promise.resolve({ total: 0, activos: 0, retirados: 0, porCarrera: {}, porSede: {}, porDivision: {} });
    }

    return estudiantes.list({ periodoId: options.periodoId }).then(function(rows){
      var activos = rows.filter(function(row){ return text(row.estadoMatricula).toUpperCase() !== "RETIRADO"; });
      var retirados = rows.filter(function(row){ return text(row.estadoMatricula).toUpperCase() === "RETIRADO"; });

      return {
        periodoId: text(options.periodoId),
        total: rows.length,
        activos: activos.length,
        retirados: retirados.length,
        porCarrera: groupCount(rows, function(row){ return row.carrera || row.NombreCarrera || row.nombreCarrera; }),
        porSede: groupCount(rows, function(row){ return row.sede || row.Sede; }),
        porDivision: groupCount(rows, function(row){ return row.division || row.Division || row.división; }),
        generatedAt: new Date().toISOString()
      };
    });
  }

  var api = { resumenPeriodo: resumenPeriodo, groupCount: groupCount };
  Services.register("stats", api);
  window.BDLServiceStats = api;
})(window);
