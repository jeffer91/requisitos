/* =========================================================
Archivo: bdl.repo.estudiantes.js
Ruta: /BDLocal/repositories/bdl.repo.estudiantes.js
Función:
- Repositorio compatible de estudiantes actuales.
- Usar índices de IndexedDB cuando existan.
- Evitar safeGetAll() cuando se consulta por período o cédula.
- Mantener fallback seguro para bases antiguas o índices no migrados.
- Proveer filtros básicos por período, cédula y paginación.
Con qué se conecta:
- BDLocal/repositories/bdl.repo.index.js
- BDLocal/bl2.db.js
========================================================= */
(function(window){
  "use strict";

  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  var VERSION = "1.1.0-indexed";

  function text(value){
    return String(value == null ? "" : value).trim();
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

  function store(){
    return Repos.storeName("estudiantes", "estudiantes");
  }

  function normalize(row){
    row = Object.assign({}, row || {});

    var periodoId = canonicalPeriodId(
      row.periodoCanonicoId ||
      row.periodoId ||
      row.periodId ||
      row.ultimoPeriodoId ||
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

    var nombres = text(row.Nombres || row.nombres || row.nombreCompleto || row.Nombre || row.nombre || row.Estudiante || row.estudiante || "");
    var carrera = text(row.NombreCarrera || row.nombreCarrera || row.Carrera || row.carrera || row._carrera || "");
    var division = text(row.division || row.Division || row["División"] || row._division || "Sin división");
    var estado = text(row.estadoMatricula || row.EstadoMatricula || row._estadoMatricula || "ACTIVO").toUpperCase() === "RETIRADO" ? "RETIRADO" : "ACTIVO";

    row.periodoId = periodoId;
    row.periodId = periodoId;
    row.periodoCanonicoId = row.periodoCanonicoId || periodoId;
    row.ultimoPeriodoId = row.ultimoPeriodoId || periodoId;
    row._periodoId = row._periodoId || periodoId;

    row.cedula = cedula;
    row._cedula = row._cedula || cedula;
    row.numeroIdentificacion = row.numeroIdentificacion || cedula;
    row.NumeroIdentificacion = row.NumeroIdentificacion || cedula;

    row.Nombres = row.Nombres || nombres;
    row.nombres = row.nombres || nombres;
    row.nombreCompleto = row.nombreCompleto || nombres;

    row.NombreCarrera = row.NombreCarrera || carrera;
    row.nombreCarrera = row.nombreCarrera || carrera;
    row.Carrera = row.Carrera || carrera;
    row.carrera = row.carrera || carrera;
    row._carrera = row._carrera || carrera || "SIN CARRERA";

    row.division = division;
    row.Division = row.Division || division;
    row._division = row._division || division;

    row.estadoMatricula = estado;
    row._estadoMatricula = estado;

    row.id = row.id || row._id || (cedula && periodoId ? cedula + "__" + periodoId : cedula);
    row._id = row._id || row.id;
    row.studentId = row.studentId || row.id;

    row.updatedAt = row.updatedAt || new Date().toISOString();

    return row;
  }

  function applyFilters(rows, options){
    options = options || {};
    rows = Array.isArray(rows) ? rows.map(normalize) : [];

    var periodoId = canonicalPeriodId(options.periodoId || options.periodId || "");
    var cedula = normalizeCedula(options.cedula || options.numeroIdentificacion || "");
    var matricula = text(options.matricula || options.estadoMatricula || "");
    var division = text(options.division || "");
    var carrera = text(options.carrera || "");

    if(periodoId){
      rows = Repos.byPeriodo(rows, periodoId);
    }

    if(cedula){
      rows = Repos.byCedula(rows, cedula);
    }

    if(matricula){
      rows = rows.filter(function(row){
        return text(row.estadoMatricula || row._estadoMatricula).toUpperCase() === matricula.toUpperCase();
      });
    }

    if(division){
      rows = rows.filter(function(row){
        return text(row.division || row._division) === division;
      });
    }

    if(carrera){
      rows = rows.filter(function(row){
        return text(row.NombreCarrera || row.nombreCarrera || row.Carrera || row.carrera) === carrera;
      });
    }

    return rows;
  }

  function queryIndexed(options){
    options = options || {};

    var periodoId = canonicalPeriodId(options.periodoId || options.periodId || "");
    var cedula = normalizeCedula(options.cedula || options.numeroIdentificacion || "");
    var storeName = store();

    if(periodoId && cedula){
      return Repos.safeQueryByIndex(storeName, "periodo_cedula", [periodoId, cedula]).then(function(rows){
        rows = applyFilters(rows, options);
        return rows;
      });
    }

    if(periodoId){
      return Repos.safeQueryByIndex(storeName, "periodoId", periodoId).then(function(rows){
        rows = applyFilters(rows, options);
        return rows;
      });
    }

    if(cedula){
      return Repos.safeQueryByIndex(storeName, "cedula", cedula).then(function(rows){
        rows = applyFilters(rows, options);
        return rows;
      });
    }

    return Promise.resolve(null);
  }

  function queryFallback(options){
    options = options || {};
    return Repos.safeGetAll(store()).then(function(rows){
      return applyFilters(rows, options);
    });
  }

  function list(options){
    options = options || {};

    var hasIndexedFilter = !!text(options.periodoId || options.periodId || options.cedula || options.numeroIdentificacion);

    if(!hasIndexedFilter){
      return queryFallback(options);
    }

    return queryIndexed(options).then(function(rows){
      rows = Array.isArray(rows) ? rows : [];

      if(rows.length){
        return rows;
      }

      /*
        Fallback necesario:
        - Si la base es antigua y aún no creó el índice.
        - Si el índice existe pero los registros viejos no tienen periodoId/cédula normalizados.
      */
      return queryFallback(options);
    });
  }

  function page(options){
    options = Object.assign({ page: 1, limit: 25 }, options || {});
    return list(options).then(function(rows){
      var paged = Repos.paginate(rows, options);
      paged.source = "estudiantes";
      paged.queryMode = text(options.periodoId || options.periodId || options.cedula) ? "indexed_or_fallback" : "full_fallback";
      return paged;
    });
  }

  function getByPeriodoCedula(periodoId, cedula){
    periodoId = canonicalPeriodId(periodoId);
    cedula = normalizeCedula(cedula);

    if(!periodoId || !cedula){
      return Promise.resolve(null);
    }

    return list({ periodoId: periodoId, cedula: cedula }).then(function(rows){
      return rows[0] || null;
    });
  }

  function getByCedula(cedula, periodoId){
    return list({ cedula: cedula, periodoId: periodoId || "" }).then(function(rows){
      return rows[0] || null;
    });
  }

  function save(row){
    row = normalize(row || {});
    if(!row.id){
      return Promise.reject(new Error("Estudiante sin ID."));
    }
    return Repos.safePut(store(), row);
  }

  function saveMany(rows){
    rows = Array.isArray(rows) ? rows : [];
    var now = new Date().toISOString();

    rows = rows.map(function(row){
      row = normalize(row || {});
      row.updatedAt = row.updatedAt || now;
      return row;
    }).filter(function(row){
      return !!row.id;
    });

    if(!rows.length){
      return Promise.resolve(0);
    }

    return Repos.bulkPut(store(), rows);
  }

  var api = {
    version: VERSION,
    list: list,
    page: page,
    getByPeriodoCedula: getByPeriodoCedula,
    getByCedula: getByCedula,
    save: save,
    saveMany: saveMany,
    normalize: normalize
  };

  Repos.register("estudiantes", api);
  window.BDLRepoEstudiantesV2 = api;
})(window);