/* =========================================================
Archivo: bdl.service.estudiantes.js
Ruta: /BDLocal/services/bdl.service.estudiantes.js
Función:
- Servicio general de estudiantes sobre modelo DB_VERSION 2.
- Usar matriculas_periodo como base central.
- Hidratar datos personales desde personas.
- Consultar por índices cuando existen.
- Hidratar personas por lote cuando sea necesario.
- Mantener fallback legacy mediante repositorios.
Con qué se conecta:
- BDLocal/services/bdl.service.index.js
- BDLocal/repositories/bdl.repo.matriculas.js
- BDLocal/repositories/bdl.repo.personas.js
- BDLocal/repositories/bdl.repo.estudiantes.js
========================================================= */
(function(window){
  "use strict";

  var Services = window.BDLServices;
  if(!Services){ return; }

  var VERSION = "1.1.0-batch-hydrate";

  function text(value){
    return Services.text ? Services.text(value) : String(value == null ? "" : value).trim();
  }

  function normalizeSearch(value){
    return Services.normalizeSearch ? Services.normalizeSearch(value) : text(value).toLowerCase();
  }

  function normalizeCedula(value){
    var raw = text(value).replace(/[^0-9A-Za-z]/g, "");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function canonicalPeriodId(value){
    value = text(value);
    if(!value){ return ""; }
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match ? match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4] : value.replace(/_+/g, "__");
  }

  function matriculasRepo(){
    return Services.repo("matriculas") || Services.repo("matriculas_periodo");
  }

  function personasRepo(){
    return Services.repo("personas");
  }

  function estudiantesRepo(){
    return Services.repo("estudiantes") || window.BDLRepoEstudiantesV2 || null;
  }

  function repos(){
    return Services.repos ? Services.repos() : null;
  }

  function isActive(row){
    var estado = text(row && (row.estadoMatricula || row._estadoMatricula)).toUpperCase();
    return estado !== "RETIRADO";
  }

  function normalizeMatricula(row){
    row = Object.assign({}, row || {});

    var periodoId = canonicalPeriodId(
      row.periodoId ||
      row.periodId ||
      row.periodoCanonicoId ||
      row._periodoId ||
      row._bl2PeriodoId ||
      ""
    );

    var cedula = normalizeCedula(
      row.cedula ||
      row._cedula ||
      row.numeroIdentificacion ||
      row.NumeroIdentificacion ||
      row.Cedula ||
      row["Cédula"] ||
      ""
    );

    var idEstudiantePeriodo = text(row.idEstudiantePeriodo || row.studentId || row.id || "");
    if(!idEstudiantePeriodo && periodoId && cedula){
      idEstudiantePeriodo = periodoId + "__" + cedula;
    }

    var carrera = text(row.carrera || row.NombreCarrera || row.nombreCarrera || row.Carrera || row._carrera || "");
    var division = text(row.division || row.Division || row["División"] || row._division || "Sin división");
    var sede = text(row.sede || row.Sede || row._sede || "");

    row.idEstudiantePeriodo = idEstudiantePeriodo;
    row.studentId = row.studentId || idEstudiantePeriodo;
    row.id = row.id || idEstudiantePeriodo || (periodoId && cedula ? cedula + "__" + periodoId : cedula);
    row._id = row._id || row.id;

    row.periodoId = periodoId;
    row.periodId = periodoId;
    row.periodoCanonicoId = row.periodoCanonicoId || periodoId;
    row._periodoId = row._periodoId || periodoId;

    row.cedula = cedula;
    row._cedula = row._cedula || cedula;
    row.numeroIdentificacion = row.numeroIdentificacion || cedula;
    row.NumeroIdentificacion = row.NumeroIdentificacion || cedula;

    row.carrera = carrera;
    row.NombreCarrera = row.NombreCarrera || carrera;
    row.nombreCarrera = row.nombreCarrera || carrera;
    row.Carrera = row.Carrera || carrera;
    row._carrera = row._carrera || carrera || "SIN CARRERA";

    row.division = division;
    row.Division = row.Division || division;
    row._division = row._division || division;

    row.sede = sede;
    row.Sede = row.Sede || sede;
    row._sede = row._sede || sede || "SIN SEDE";

    row.estadoMatricula = text(row.estadoMatricula || row.EstadoMatricula || row._estadoMatricula || "ACTIVO").toUpperCase() === "RETIRADO" ? "RETIRADO" : "ACTIVO";
    row._estadoMatricula = row.estadoMatricula;

    return row;
  }

  function mergePersona(row, persona){
    row = Object.assign({}, row || {});
    persona = persona || null;

    if(persona){
      var nombres = text(
        persona.nombreCompleto ||
        persona.nombres ||
        persona.Nombres ||
        row.nombreCompleto ||
        row.nombres ||
        row.Nombres ||
        ""
      );

      row.nombreCompleto = row.nombreCompleto || nombres;
      row.nombres = row.nombres || nombres;
      row.Nombres = row.Nombres || nombres;

      row.correoPersonal = row.correoPersonal || persona.correoPersonal || persona.CorreoPersonal || "";
      row.CorreoPersonal = row.CorreoPersonal || row.correoPersonal || "";

      row.correoInstitucional = row.correoInstitucional || persona.correoInstitucional || persona.CorreoInstitucional || "";
      row.CorreoInstitucional = row.CorreoInstitucional || row.correoInstitucional || "";

      row.celular = row.celular || persona.celular || persona.Celular || persona.telefono || "";
      row.Celular = row.Celular || row.celular || "";

      row._persona = persona;
    }

    row.NombreCarrera = row.NombreCarrera || row.nombreCarrera || row.carrera;
    row.nombreCarrera = row.nombreCarrera || row.NombreCarrera || row.carrera;
    row.Carrera = row.Carrera || row.NombreCarrera || row.carrera;

    return row;
  }

  function uniqueCedulas(rows){
    var map = Object.create(null);
    var out = [];

    (Array.isArray(rows) ? rows : []).forEach(function(row){
      var cedula = normalizeCedula(row && row.cedula);
      if(cedula && !map[cedula]){
        map[cedula] = true;
        out.push(cedula);
      }
    });

    return out;
  }

  function hydratePersonas(rows, options){
    rows = Array.isArray(rows) ? rows.map(normalizeMatricula) : [];
    options = options || {};

    var repo = personasRepo();
    if(!repo || !rows.length){
      return Promise.resolve(rows);
    }

    var cedulas = uniqueCedulas(rows);
    if(!cedulas.length){
      return Promise.resolve(rows);
    }

    /*
      Para muchas filas conviene leer personas una sola vez y armar mapa.
      Para pocas filas conviene usar getByCedula para evitar escanear todo.
    */
    var helper = repos();
    var threshold = Number(options.batchThreshold || 40);

    if(cedulas.length >= threshold && helper && typeof helper.safeGetAll === "function"){
      var storeName = helper.storeName("personas", "personas");

      return helper.safeGetAll(storeName).then(function(personas){
        var map = Object.create(null);

        (Array.isArray(personas) ? personas : []).forEach(function(persona){
          var cedula = normalizeCedula(persona && persona.cedula);
          if(cedula){ map[cedula] = persona; }
        });

        return rows.map(function(row){
          return mergePersona(row, map[normalizeCedula(row.cedula)] || null);
        });
      }).catch(function(){
        return rows;
      });
    }

    if(typeof repo.getByCedula !== "function"){
      return Promise.resolve(rows);
    }

    var personaMap = Object.create(null);

    return Promise.all(cedulas.map(function(cedula){
      return repo.getByCedula(cedula).then(function(persona){
        personaMap[cedula] = persona || null;
      }).catch(function(){
        personaMap[cedula] = null;
      });
    })).then(function(){
      return rows.map(function(row){
        return mergePersona(row, personaMap[normalizeCedula(row.cedula)] || null);
      });
    });
  }

  function queryMatriculasIndexed(options){
    options = options || {};

    var helper = repos();
    if(!helper || typeof helper.safeQueryByIndex !== "function"){
      return Promise.resolve(null);
    }

    var periodoId = canonicalPeriodId(options.periodoId || options.periodId || "");
    var cedula = normalizeCedula(options.cedula || options.numeroIdentificacion || "");
    var storeName = helper.storeName("matriculasPeriodo", "matriculas_periodo");

    if(periodoId && cedula){
      return helper.safeQueryByIndex(storeName, "periodo_cedula", [periodoId, cedula]);
    }

    if(periodoId){
      return helper.safeQueryByIndex(storeName, "periodoId", periodoId);
    }

    if(cedula){
      return helper.safeQueryByIndex(storeName, "cedula", cedula);
    }

    return Promise.resolve(null);
  }

  function queryMatriculas(options){
    options = options || {};

    var repo = matriculasRepo();
    var legacy = estudiantesRepo();

    return queryMatriculasIndexed(options).then(function(rows){
      if(Array.isArray(rows) && rows.length){
        return rows.map(normalizeMatricula);
      }

      if(repo && typeof repo.list === "function"){
        return repo.list(options).then(function(repoRows){
          repoRows = Array.isArray(repoRows) ? repoRows : [];
          if(repoRows.length){ return repoRows.map(normalizeMatricula); }

          if(legacy && typeof legacy.list === "function"){
            return legacy.list(options).then(function(legacyRows){
              return (Array.isArray(legacyRows) ? legacyRows : []).map(normalizeMatricula);
            });
          }

          return [];
        });
      }

      if(legacy && typeof legacy.list === "function"){
        return legacy.list(options).then(function(legacyRows){
          return (Array.isArray(legacyRows) ? legacyRows : []).map(normalizeMatricula);
        });
      }

      return [];
    });
  }

  function filterRows(rows, options){
    rows = Array.isArray(rows) ? rows.map(normalizeMatricula) : [];
    options = options || {};

    var periodoId = canonicalPeriodId(options.periodoId || options.periodId || "");
    var cedula = normalizeCedula(options.cedula || options.numeroIdentificacion || "");
    var matricula = text(options.matricula || options.estadoMatricula || "");
    var carrera = text(options.carrera || options.career || "");
    var division = text(options.division || "");
    var sede = text(options.sede || "");
    var search = text(options.search || options.busqueda || options.query || "");

    if(periodoId){
      rows = rows.filter(function(row){ return canonicalPeriodId(row.periodoId || row.periodId) === periodoId; });
    }

    if(cedula){
      rows = rows.filter(function(row){ return normalizeCedula(row.cedula) === cedula; });
    }

    if(matricula){
      if(matricula.toUpperCase() === "ACTIVO"){
        rows = rows.filter(isActive);
      }else if(matricula.toUpperCase() !== "TODOS" && matricula.toUpperCase() !== "TODO"){
        rows = rows.filter(function(row){
          return text(row.estadoMatricula || row._estadoMatricula).toUpperCase() === matricula.toUpperCase();
        });
      }
    }

    if(carrera){
      rows = rows.filter(function(row){
        return normalizeSearch(row.carrera || row.NombreCarrera || row.nombreCarrera || row.Carrera).indexOf(normalizeSearch(carrera)) >= 0;
      });
    }

    if(division){
      rows = rows.filter(function(row){
        var current = row.division || row.Division || row._division || "";
        if(normalizeSearch(current) === normalizeSearch(division)){ return true; }

        try{
          if(window.BLDivisionesService && typeof window.BLDivisionesService.hasDivision === "function"){
            return window.BLDivisionesService.hasDivision(row, division);
          }
        }catch(error){}

        return false;
      });
    }

    if(sede){
      rows = rows.filter(function(row){
        return normalizeSearch(row.sede || row.Sede || row._sede).indexOf(normalizeSearch(sede)) >= 0;
      });
    }

    if(search){
      rows = rows.filter(function(row){
        var haystack = [
          row.cedula,
          row.numeroIdentificacion,
          row.NumeroIdentificacion,
          row.nombreCompleto,
          row.nombres,
          row.Nombres,
          row.carrera,
          row.NombreCarrera,
          row.nombreCarrera,
          row.Carrera,
          row.sede,
          row.Sede,
          row.division,
          row.Division,
          row._division,
          row.correoPersonal,
          row.correoInstitucional,
          row.CorreoPersonal,
          row.CorreoInstitucional,
          row.celular,
          row.Celular
        ].join(" ");

        return normalizeSearch(haystack).indexOf(normalizeSearch(search)) >= 0;
      });
    }

    return sortRows(rows, options);
  }

  function sortRows(rows, options){
    rows = Array.isArray(rows) ? rows.slice() : [];
    options = options || {};

    var key = text(options.sortKey || "nombres");
    var dir = text(options.sortDir || "asc").toLowerCase() === "desc" ? -1 : 1;

    return rows.sort(function(a, b){
      var av = "";
      var bv = "";

      if(key === "nombres" || key === "nombreCompleto"){
        av = normalizeSearch(a.nombreCompleto || a.nombres || a.Nombres);
        bv = normalizeSearch(b.nombreCompleto || b.nombres || b.Nombres);
      }else if(key === "carrera" || key === "NombreCarrera"){
        av = normalizeSearch(a.carrera || a.NombreCarrera || a.nombreCarrera);
        bv = normalizeSearch(b.carrera || b.NombreCarrera || b.nombreCarrera);
      }else{
        av = normalizeSearch(a[key]);
        bv = normalizeSearch(b[key]);
      }

      if(av < bv){ return -1 * dir; }
      if(av > bv){ return 1 * dir; }
      return 0;
    });
  }

  function needsPersonaBeforeFilter(options){
    options = options || {};
    var sortKey = text(options.sortKey || "nombres");
    return !!text(options.search || options.busqueda || options.query) ||
           sortKey === "nombres" ||
           sortKey === "nombreCompleto";
  }

  function list(options){
    options = options || {};

    return queryMatriculas(options).then(function(rows){
      if(needsPersonaBeforeFilter(options)){
        return hydratePersonas(rows, options).then(function(hydrated){
          return filterRows(hydrated, options);
        });
      }

      var filtered = filterRows(rows, options);
      return hydratePersonas(filtered, options);
    });
  }

  function page(options){
    options = Object.assign({ page: 1, limit: 25 }, options || {});

    return queryMatriculas(options).then(function(rows){
      if(needsPersonaBeforeFilter(options)){
        return hydratePersonas(rows, options).then(function(hydrated){
          var filtered = filterRows(hydrated, options);
          var paged = Services.paginate(filtered, options);
          paged.rows = paged.rows || [];
          paged.source = "matriculas_periodo";
          paged.queryMode = text(options.periodoId || options.periodId) ? "indexed_periodoId" : "repository";
          paged.personasHydrated = true;
          return paged;
        });
      }

      var filtered = filterRows(rows, options);
      var paged = Services.paginate(filtered, options);

      return hydratePersonas(paged.rows || [], options).then(function(hydratedRows){
        paged.rows = hydratedRows;
        paged.source = "matriculas_periodo";
        paged.queryMode = text(options.periodoId || options.periodId) ? "indexed_periodoId" : "repository";
        paged.personasHydrated = true;
        return paged;
      });
    });
  }

  function getByPeriodoCedula(periodoId, cedula){
    periodoId = canonicalPeriodId(periodoId);
    cedula = normalizeCedula(cedula);

    if(!periodoId || !cedula){
      return Promise.resolve(null);
    }

    return queryMatriculas({ periodoId: periodoId, cedula: cedula }).then(function(rows){
      rows = Array.isArray(rows) ? rows : [];
      if(!rows.length){ return null; }

      return hydratePersonas([rows[0]], { batchThreshold: 999 }).then(function(hydrated){
        return hydrated[0] || null;
      });
    });
  }

  function save(row){
    var repo = matriculasRepo();
    if(!repo || typeof repo.save !== "function"){
      return Promise.reject(new Error("Repositorio de matrículas no disponible."));
    }
    return repo.save(row || {});
  }

  function saveMany(rows){
    var repo = matriculasRepo();
    if(!repo || typeof repo.saveMany !== "function"){
      return Promise.reject(new Error("Repositorio de matrículas no disponible."));
    }
    return repo.saveMany(Array.isArray(rows) ? rows : []);
  }

  var api = {
    version: VERSION,
    list: list,
    page: page,
    filterRows: filterRows,
    getByPeriodoCedula: getByPeriodoCedula,
    hydratePersonas: hydratePersonas,
    isActive: isActive,
    normalizeMatricula: normalizeMatricula,
    save: save,
    saveMany: saveMany
  };

  Services.register("estudiantes", api);
  window.BDLServiceEstudiantes = api;
})(window);