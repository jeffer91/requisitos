/* =========================================================
Archivo: bdl.service.estudiantes.js
Ruta: /BDLocal/services/bdl.service.estudiantes.js
Función:
- Servicio general de estudiantes sobre modelo DB_VERSION 2.
- Usar matriculas_periodo como base central.
- Hidratar datos personales desde personas.
- Consultar por índice periodoId cuando existe.
- Mantener fallback legacy mediante repositorios.
Con qué se conecta:
- BDLocal/services/bdl.service.index.js
- BDLocal/repositories/bdl.repo.matriculas.js
- BDLocal/repositories/bdl.repo.personas.js
========================================================= */
(function(window){
  "use strict";

  var Services = window.BDLServices;
  if(!Services){ return; }

  function text(value){ return Services.text(value); }
  function matriculasRepo(){ return Services.repo("matriculas") || Services.repo("matriculas_periodo"); }
  function personasRepo(){ return Services.repo("personas"); }
  function repos(){ return Services.repos ? Services.repos() : null; }

  function isActive(row){
    var estado = text(row && row.estadoMatricula).toUpperCase();
    return estado !== "RETIRADO";
  }

  function queryMatriculas(options){
    options = options || {};
    var helper = repos();
    var repo = matriculasRepo();
    var periodoId = text(options.periodoId);

    if(periodoId && helper && typeof helper.safeQueryByIndex === "function"){
      var store = helper.storeName("matriculasPeriodo", "matriculas_periodo");
      return helper.safeQueryByIndex(store, "periodoId", periodoId).then(function(rows){
        rows = Array.isArray(rows) ? rows : [];
        if(rows.length){ return rows; }
        return repo && typeof repo.list === "function" ? repo.list(options) : [];
      });
    }

    return repo && typeof repo.list === "function" ? repo.list(options) : Promise.resolve([]);
  }

  function hydratePersonas(rows){
    rows = Array.isArray(rows) ? rows : [];
    var repo = personasRepo();
    if(!repo || typeof repo.getByCedula !== "function" || !rows.length){ return Promise.resolve(rows); }

    var cache = Object.create(null);
    var chain = Promise.resolve();

    rows.forEach(function(row){
      var cedula = text(row && row.cedula);
      if(!cedula || cache[cedula]){ return; }
      cache[cedula] = true;
      chain = chain.then(function(){
        return repo.getByCedula(cedula).then(function(persona){ cache[cedula] = persona || null; }).catch(function(){ cache[cedula] = null; });
      });
    });

    return chain.then(function(){
      return rows.map(function(row){
        row = Object.assign({}, row || {});
        var persona = cache[text(row.cedula)] || null;
        if(persona){
          row.nombreCompleto = text(persona.nombreCompleto || persona.nombres || row.nombreCompleto || row.nombres);
          row.nombres = text(persona.nombres || persona.nombreCompleto || row.nombres || row.Nombres);
          row.Nombres = row.Nombres || row.nombres;
          row.correoPersonal = row.correoPersonal || persona.correoPersonal || "";
          row.correoInstitucional = row.correoInstitucional || persona.correoInstitucional || "";
          row.celular = row.celular || persona.celular || "";
          row._persona = persona;
        }
        row.id = row.id || row.idEstudiantePeriodo;
        row.studentId = row.studentId || row.idEstudiantePeriodo;
        row.periodId = row.periodId || row.periodoId;
        row.NombreCarrera = row.NombreCarrera || row.nombreCarrera || row.carrera;
        return row;
      });
    });
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
      rows = rows.filter(function(row){ return Services.normalizeSearch(row.carrera || row.NombreCarrera || row.nombreCarrera).indexOf(Services.normalizeSearch(options.carrera)) >= 0; });
    }
    if(text(options.division)){
      rows = rows.filter(function(row){ return Services.normalizeSearch(row.division || row.Division || row.división).indexOf(Services.normalizeSearch(options.division)) >= 0; });
    }
    if(text(options.sede)){
      rows = rows.filter(function(row){ return Services.normalizeSearch(row.sede || row.Sede).indexOf(Services.normalizeSearch(options.sede)) >= 0; });
    }
    if(text(options.search)){
      rows = rows.filter(function(row){
        return Services.contains(row, options.search, ["cedula", "nombreCompleto", "nombres", "Nombres", "carrera", "NombreCarrera", "nombreCarrera", "sede", "Sede", "division"]);
      });
    }
    return Services.sortBy(rows, options.sortKey || "nombres", options.sortDir || "asc");
  }

  function list(options){
    options = options || {};
    return queryMatriculas(options).then(function(rows){
      var needsPersonaBeforeFilter = !!text(options.search) || text(options.sortKey || "") === "nombres" || text(options.sortKey || "") === "nombreCompleto";
      var step = needsPersonaBeforeFilter ? hydratePersonas(rows) : Promise.resolve(rows);
      return step.then(function(hydrated){ return filterRows(hydrated, options); }).then(function(filtered){ return needsPersonaBeforeFilter ? filtered : hydratePersonas(filtered); });
    });
  }

  function page(options){
    options = Object.assign({ page: 1, limit: 25 }, options || {});
    return queryMatriculas(options).then(function(rows){
      var needsPersonaBeforeFilter = !!text(options.search) || text(options.sortKey || "") === "nombres" || text(options.sortKey || "") === "nombreCompleto";
      return (needsPersonaBeforeFilter ? hydratePersonas(rows) : Promise.resolve(rows)).then(function(base){
        var filtered = filterRows(base, options);
        var paged = Services.paginate(filtered, options);
        return hydratePersonas(paged.rows).then(function(hydratedRows){
          paged.rows = hydratedRows;
          paged.source = "matriculas_periodo";
          paged.queryMode = text(options.periodoId) ? "indexed_periodoId" : "repository";
          return paged;
        });
      });
    });
  }

  function getByPeriodoCedula(periodoId, cedula){
    var repo = matriculasRepo();
    if(repo && typeof repo.getByPeriodoCedula === "function"){
      return repo.getByPeriodoCedula(periodoId, cedula).then(function(row){
        return row ? hydratePersonas([row]).then(function(rows){ return rows[0] || null; }) : null;
      });
    }
    return list({ periodoId: periodoId, cedula: cedula }).then(function(rows){ return rows[0] || null; });
  }

  var api = { list:list, page:page, filterRows:filterRows, getByPeriodoCedula:getByPeriodoCedula, hydratePersonas:hydratePersonas, isActive:isActive };
  Services.register("estudiantes", api);
  window.BDLServiceEstudiantes = api;
})(window);
