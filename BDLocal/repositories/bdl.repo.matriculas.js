/* =========================================================
Archivo: bdl.repo.matriculas.js
Ruta: /BDLocal/repositories/bdl.repo.matriculas.js
Función:
- Repositorio virtual de matrículas por período.
- Construir registros idEstudiantePeriodo desde la tabla actual estudiantes.
- Preparar la futura tabla matriculas_periodo.
Con qué se conecta:
- BDLocal/repositories/bdl.repo.estudiantes.js
- BDLocal/rules/bdl.rules.matricula.js
========================================================= */
(function(window){
  "use strict";

  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }
  function studentRepo(){ return Repos.get("estudiantes") || window.BDLRepoEstudiantesV2 || null; }

  function buildMatricula(row, context){
    if(window.BDLRulesMatricula && typeof window.BDLRulesMatricula.buildMatricula === "function"){
      return window.BDLRulesMatricula.buildMatricula(row || {}, context || {});
    }

    var periodoId = text((row && row.periodoId) || (context && context.periodoId) || "");
    var cedula = text(row && row.cedula);
    return {
      idEstudiantePeriodo: periodoId && cedula ? periodoId + "__" + cedula : "",
      periodoId: periodoId,
      cedula: cedula,
      carrera: text(row && (row.carrera || row.NombreCarrera)),
      sede: text(row && (row.sede || row.Sede)),
      division: text(row && row.division),
      estadoMatricula: text(row && row.estadoMatricula) || "ACTIVO",
      updatedAt: text(row && row.updatedAt) || new Date().toISOString()
    };
  }

  function list(options){
    options = options || {};
    var repo = studentRepo();
    if(!repo){ return Promise.resolve([]); }

    return repo.list(options).then(function(rows){
      return rows.map(function(row){ return buildMatricula(row, options); }).filter(function(row){ return !!row.idEstudiantePeriodo; });
    });
  }

  function page(options){
    return list(options || {}).then(function(rows){ return Repos.paginate(rows, options || {}); });
  }

  function getById(idEstudiantePeriodo){
    idEstudiantePeriodo = text(idEstudiantePeriodo);
    return list({}).then(function(rows){
      return rows.find(function(row){ return text(row.idEstudiantePeriodo) === idEstudiantePeriodo; }) || null;
    });
  }

  function getByPeriodoCedula(periodoId, cedula){
    return getById(text(periodoId) + "__" + text(cedula));
  }

  var api = {
    list: list,
    page: page,
    getById: getById,
    getByPeriodoCedula: getByPeriodoCedula,
    buildMatricula: buildMatricula
  };

  Repos.register("matriculas", api);
  window.BDLRepoMatriculas = api;
})(window);
