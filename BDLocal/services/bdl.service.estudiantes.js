/* =========================================================
Archivo: bdl.service.estudiantes.js
Ruta: /BDLocal/services/bdl.service.estudiantes.js
Función:
- Servicio general de estudiantes.
- Entregar listas y páginas filtradas sin que pantallas carguen toda la base.
- Mantener compatibilidad con repositorio actual de estudiantes.
Con qué se conecta:
- BDLocal/services/bdl.service.index.js
- BDLocal/repositories/bdl.repo.estudiantes.js
========================================================= */
(function(window){
  "use strict";

  var Services = window.BDLServices;
  if(!Services){ return; }

  function text(value){ return Services.text(value); }
  function repo(){ return Services.repo("estudiantes"); }

  function isActive(row){
    var estado = Services.normalizeSearch(row && row.estadoMatricula).toUpperCase();
    return estado !== "RETIRADO";
  }

  function filterRows(rows, options){
    rows = Array.isArray(rows) ? rows : [];
    options = options || {};

    if(text(options.matricula) === "ACTIVO" || text(options.estadoMatricula) === "ACTIVO"){
      rows = rows.filter(isActive);
    }

    if(text(options.estadoMatricula) && text(options.estadoMatricula) !== "ACTIVO"){
      rows = rows.filter(function(row){ return text(row.estadoMatricula).toUpperCase() === text(options.estadoMatricula).toUpperCase(); });
    }

    if(text(options.carrera)){
      rows = rows.filter(function(row){
        return Services.normalizeSearch(row.carrera || row.NombreCarrera || row.nombreCarrera).indexOf(Services.normalizeSearch(options.carrera)) >= 0;
      });
    }

    if(text(options.division)){
      rows = rows.filter(function(row){
        return Services.normalizeSearch(row.division || row.Division || row.división).indexOf(Services.normalizeSearch(options.division)) >= 0;
      });
    }

    if(text(options.sede)){
      rows = rows.filter(function(row){
        return Services.normalizeSearch(row.sede || row.Sede).indexOf(Services.normalizeSearch(options.sede)) >= 0;
      });
    }

    if(text(options.search)){
      rows = rows.filter(function(row){
        return Services.contains(row, options.search, ["cedula", "nombres", "Nombres", "nombre", "carrera", "NombreCarrera", "sede", "Sede", "division"]);
      });
    }

    return Services.sortBy(rows, options.sortKey || "nombres", options.sortDir || "asc");
  }

  function list(options){
    options = options || {};
    var currentRepo = repo();
    if(currentRepo && typeof currentRepo.list === "function"){
      return currentRepo.list(options).then(function(rows){ return filterRows(rows, options); });
    }
    return Promise.resolve([]);
  }

  function page(options){
    options = Object.assign({ page: 1, limit: 25 }, options || {});
    return list(options).then(function(rows){ return Services.paginate(rows, options); });
  }

  function getByPeriodoCedula(periodoId, cedula){
    var currentRepo = repo();
    if(currentRepo && typeof currentRepo.getByPeriodoCedula === "function"){
      return currentRepo.getByPeriodoCedula(periodoId, cedula);
    }
    return list({ periodoId: periodoId, cedula: cedula }).then(function(rows){ return rows[0] || null; });
  }

  var api = {
    list: list,
    page: page,
    filterRows: filterRows,
    getByPeriodoCedula: getByPeriodoCedula,
    isActive: isActive
  };

  Services.register("estudiantes", api);
  window.BDLServiceEstudiantes = api;
})(window);
