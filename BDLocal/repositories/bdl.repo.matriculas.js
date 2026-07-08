/* =========================================================
Archivo: bdl.repo.matriculas.js
Ruta: /BDLocal/repositories/bdl.repo.matriculas.js
Función:
- Repositorio real de matriculas_periodo.
- Leer por índices cuando se consulta período, cédula o estudiante.
- Usar estudiantes legacy solo como fallback.
- Mantener idEstudiantePeriodo como llave central.
========================================================= */
(function(window){
  "use strict";

  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  var VERSION = "1.1.0-indexed";

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function normalizeBasic(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeKey(value){
    return normalizeBasic(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
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
    return Repos.storeName("matriculasPeriodo", "matriculas_periodo");
  }

  function legacy(){
    return Repos.get("estudiantes") || window.BDLRepoEstudiantesV2 || null;
  }

  function makeId(periodoId, cedula){
    periodoId = canonicalPeriodId(periodoId);
    cedula = normalizeCedula(cedula);
    return periodoId && cedula ? periodoId + "__" + cedula : "";
  }

  function normalize(row, context){
    row = Object.assign({}, row || {});
    context = Object.assign({}, context || {});

    if(window.BDLRulesMatricula && typeof window.BDLRulesMatricula.buildMatricula === "function"){
      row = window.BDLRulesMatricula.buildMatricula(row, context) || row;
    }

    var periodoId = canonicalPeriodId(
      row.periodoId ||
      row.periodId ||
      row.periodoCanonicoId ||
      row._periodoId ||
      row._bl2PeriodoId ||
      context.periodoId ||
      context.periodId ||
      ""
    );

    var cedula = normalizeCedula(
      row.cedula ||
      row._cedula ||
      row.numeroIdentificacion ||
      row.NumeroIdentificacion ||
      row.Cedula ||
      row["Cédula"] ||
      context.cedula ||
      ""
    );

    var carrera = text(row.carrera || row.NombreCarrera || row.nombreCarrera || row.Carrera || row._carrera || "");
    var codigoCarrera = text(row.codigoCarrera || row.CodigoCarrera || row.codCarrera || "");
    var division = text(row.division || row.Division || row["División"] || row._division || "Sin división");
    var sede = text(row.sede || row.Sede || row.campus || row._sede || "");
    var estado = text(row.estadoMatricula || row.EstadoMatricula || row._estadoMatricula || "ACTIVO").toUpperCase() === "RETIRADO" ? "RETIRADO" : "ACTIVO";

    var id = text(row.idEstudiantePeriodo || row.studentId || row.id || makeId(periodoId, cedula));

    return {
      idEstudiantePeriodo: id,
      studentId: id,
      id: id,

      periodoId: periodoId,
      periodId: periodoId,
      periodoCanonicoId: periodoId,

      cedula: cedula,
      _cedula: cedula,
      numeroIdentificacion: cedula,
      NumeroIdentificacion: cedula,

      carrera: carrera,
      nombreCarrera: text(row.nombreCarrera || row.NombreCarrera || carrera),
      NombreCarrera: text(row.NombreCarrera || row.nombreCarrera || carrera),
      Carrera: text(row.Carrera || carrera),
      codigoCarrera: codigoCarrera,
      CodigoCarrera: codigoCarrera,

      carreraKey: normalizeKey(carrera || codigoCarrera),
      division: division,
      Division: division,
      divisionKey: normalizeKey(division),
      sede: sede,
      Sede: sede,

      estadoMatricula: estado,
      _estadoMatricula: estado,

      paralelo: text(row.paralelo || row.Paralelo || ""),
      jornada: text(row.jornada || row.Jornada || ""),

      periodoLabel: text(row.periodoLabel || row.periodoCanonicoLabel || row.Periodo || row.periodo || ""),
      updatedAt: text(row.updatedAt) || new Date().toISOString(),
      createdAt: text(row.createdAt) || text(row.importedAt) || new Date().toISOString(),
      origen: text(row.origen || row.source || "matriculas_periodo")
    };
  }

  function applyFilters(rows, options){
    options = options || {};
    rows = Array.isArray(rows) ? rows.map(function(row){ return normalize(row, options); }) : [];

    var periodoId = canonicalPeriodId(options.periodoId || options.periodId || "");
    var cedula = normalizeCedula(options.cedula || options.numeroIdentificacion || "");
    var idEstudiantePeriodo = text(options.idEstudiantePeriodo || options.studentId || options.id || "");
    var division = text(options.division || "");
    var carrera = text(options.carrera || options.NombreCarrera || options.career || "");
    var estado = text(options.estadoMatricula || options.matricula || "");

    if(periodoId){
      rows = rows.filter(function(row){
        return canonicalPeriodId(row.periodoId || row.periodId) === periodoId;
      });
    }

    if(cedula){
      rows = rows.filter(function(row){
        return normalizeCedula(row.cedula || row.numeroIdentificacion) === cedula;
      });
    }

    if(idEstudiantePeriodo){
      rows = rows.filter(function(row){
        return text(row.idEstudiantePeriodo || row.studentId || row.id) === idEstudiantePeriodo;
      });
    }

    if(division){
      rows = rows.filter(function(row){
        return normalizeKey(row.division || row.Division) === normalizeKey(division);
      });
    }

    if(carrera){
      rows = rows.filter(function(row){
        return normalizeKey([row.carrera, row.nombreCarrera, row.NombreCarrera, row.Carrera, row.codigoCarrera, row.CodigoCarrera].join(" ")) === normalizeKey(carrera) ||
               normalizeBasic([row.carrera, row.nombreCarrera, row.NombreCarrera, row.Carrera, row.codigoCarrera, row.CodigoCarrera].join(" ")).toLowerCase().indexOf(normalizeBasic(carrera).toLowerCase()) >= 0;
      });
    }

    if(estado){
      if(estado.toUpperCase() === "ACTIVO"){
        rows = rows.filter(function(row){
          return text(row.estadoMatricula || row._estadoMatricula).toUpperCase() !== "RETIRADO";
        });
      }else if(estado.toUpperCase() !== "TODOS" && estado.toUpperCase() !== "TODO"){
        rows = rows.filter(function(row){
          return text(row.estadoMatricula || row._estadoMatricula).toUpperCase() === estado.toUpperCase();
        });
      }
    }

    return rows;
  }

  function legacyList(options){
    var repo = legacy();
    if(!repo || typeof repo.list !== "function"){
      return Promise.resolve([]);
    }

    return repo.list(options || {}).then(function(rows){
      return applyFilters(rows || [], options).filter(function(row){
        return !!row.idEstudiantePeriodo;
      });
    }).catch(function(){
      return [];
    });
  }

  function queryIndexed(options){
    options = options || {};

    var periodoId = canonicalPeriodId(options.periodoId || options.periodId || "");
    var cedula = normalizeCedula(options.cedula || options.numeroIdentificacion || "");
    var idEstudiantePeriodo = text(options.idEstudiantePeriodo || options.studentId || options.id || "");

    if(idEstudiantePeriodo){
      return Repos.safeQueryByIndex(store(), "idEstudiantePeriodo", idEstudiantePeriodo).then(function(rows){
        rows = Array.isArray(rows) ? rows : [];
        if(rows.length){ return rows; }

        return Repos.safeGetAll(store()).then(function(allRows){
          return (allRows || []).filter(function(row){
            return text(row.idEstudiantePeriodo || row.studentId || row.id) === idEstudiantePeriodo;
          });
        });
      });
    }

    if(periodoId && cedula){
      return Repos.safeQueryByIndex(store(), "periodo_cedula", [periodoId, cedula]);
    }

    if(periodoId){
      return Repos.safeQueryByIndex(store(), "periodoId", periodoId);
    }

    if(cedula){
      return Repos.safeQueryByIndex(store(), "cedula", cedula);
    }

    return Promise.resolve(null);
  }

  function list(options){
    options = options || {};

    var hasIndexedFilter = !!text(
      options.idEstudiantePeriodo ||
      options.studentId ||
      options.id ||
      options.periodoId ||
      options.periodId ||
      options.cedula ||
      options.numeroIdentificacion ||
      ""
    );

    if(hasIndexedFilter){
      return queryIndexed(options).then(function(rows){
        rows = applyFilters(rows || [], options);

        if(rows.length){
          return rows;
        }

        return Repos.safeGetAll(store()).then(function(allRows){
          var filtered = applyFilters(allRows || [], options);
          if(filtered.length){ return filtered; }
          return legacyList(options);
        });
      });
    }

    return Repos.safeGetAll(store()).then(function(rows){
      rows = applyFilters(rows || [], options);
      if(rows.length){ return rows; }
      return legacyList(options);
    });
  }

  function page(options){
    options = Object.assign({ page: 1, limit: 25 }, options || {});

    return list(options).then(function(rows){
      var result = Repos.paginate(rows, options);
      result.source = "matriculas_periodo";
      result.queryMode = text(options.periodoId || options.periodId || options.cedula || options.idEstudiantePeriodo) ? "indexed_or_fallback" : "full_or_legacy";
      return result;
    });
  }

  function getById(id){
    id = text(id);
    if(!id){ return Promise.resolve(null); }

    return list({ idEstudiantePeriodo: id }).then(function(rows){
      return rows[0] || null;
    });
  }

  function getByPeriodoCedula(periodoId, cedula){
    var id = makeId(periodoId, cedula);

    if(!id){
      return Promise.resolve(null);
    }

    return getById(id).then(function(found){
      if(found){ return found; }

      return list({
        periodoId: periodoId,
        cedula: cedula
      }).then(function(rows){
        return rows[0] || null;
      });
    });
  }

  function save(row){
    var item = normalize(row || {});

    if(!item.idEstudiantePeriodo){
      return Promise.reject(new Error("Matrícula sin idEstudiantePeriodo."));
    }

    return Repos.safePut(store(), item);
  }

  function saveMany(rows, context){
    rows = Array.isArray(rows) ? rows : [];
    context = context || {};

    var now = new Date().toISOString();

    var items = rows.map(function(row){
      row = normalize(row || {}, context);
      row.updatedAt = row.updatedAt || now;
      return row;
    }).filter(function(row){
      return !!row.idEstudiantePeriodo;
    });

    if(!items.length){
      return Promise.resolve([]);
    }

    return Repos.bulkPut(store(), items);
  }

  var api = {
    version: VERSION,
    list: list,
    page: page,
    getById: getById,
    getByPeriodoCedula: getByPeriodoCedula,
    save: save,
    saveMany: saveMany,
    normalize: normalize,
    legacyList: legacyList
  };

  Repos.register("matriculas", api);
  Repos.register("matriculas_periodo", api);
  window.BDLRepoMatriculas = api;
})(window);