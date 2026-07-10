/* =========================================================
Nombre completo: global.core.js
Ruta o ubicación: /Requisitos/Global/global.core.js
Función:
- Leer datos desde ConGlobal/BDLocalGlobal/BDLocalConexiones.
- Aplicar filtros superiores del módulo Global.
- Detectar carreras, requisitos, períodos y tipo de carrera.
- Preparar estructuras base para secciones con tablas inteligentes.
- Detectar graduados mediante AprobacionTitulacion = CUMPLE.
- Agrupar graduados por período respetando los filtros superiores.
- Evitar contabilizar dos veces al mismo estudiante en un período.
Con qué se conecta:
- BDLocal/conexiones/cone.global.js
- BDLocal/adapters/bdl.screen-deps.js
- global.config.js
- global.app.js
- global.chart.js
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.1.0-graduados";
  var config = window.GlobalConfig || {};

  var state = {
    ready: false,
    loading: null,
    snapshot: null,
    lastFilters: null,
    lastData: null,
    errors: []
  };

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function norm(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function key(value){
    return norm(value).replace(/[^a-z0-9]+/g, "");
  }

  function clone(value){
    if(value === undefined){
      return undefined;
    }

    try{
      return JSON.parse(JSON.stringify(value));
    }catch(error){
      return value;
    }
  }

  function emit(name, detail){
    try{
      window.dispatchEvent(
        new CustomEvent(name, {
          detail: detail || {}
        })
      );
    }catch(error){}
  }

  function addError(message, error){
    state.errors.push({
      message: message,
      detail: error && error.message
        ? error.message
        : text(error),
      at: new Date().toISOString()
    });

    try{
      console.warn("[GlobalCore] " + message, error || "");
    }catch(consoleError){}
  }

  function graduationConfig(){
    var settings = config.graduados || {};

    return {
      campo: text(
        settings.campo || "AprobacionTitulacion"
      ) || "AprobacionTitulacion",

      valorEsperado: text(
        settings.valorEsperado || "CUMPLE"
      ).toUpperCase() || "CUMPLE",

      contarUnicoPorPeriodo:
        settings.contarUnicoPorPeriodo !== false
    };
  }

  function strictStatus(value){
    return text(value).toUpperCase();
  }

  function api(){
    if(window.ConGlobal){
      return window.ConGlobal;
    }

    if(window.BDLocalGlobal){
      return window.BDLocalGlobal;
    }

    if(
      window.BDLocalConexiones &&
      typeof window.BDLocalConexiones.get === "function"
    ){
      return window.BDLocalConexiones.get("global");
    }

    return null;
  }

  function loadScript(relative){
    var src;

    try{
      src = new URL(relative, window.location.href).href;
    }catch(error){
      src = relative;
    }

    var alreadyLoaded = Array.prototype.slice
      .call(document.scripts || [])
      .some(function(script){
        return (
          script.src === src ||
          script.getAttribute("data-global-core-src") === src
        );
      });

    if(alreadyLoaded){
      return Promise.resolve(src);
    }

    return new Promise(function(resolve, reject){
      var script = document.createElement("script");

      script.src = src;
      script.async = false;
      script.defer = false;
      script.setAttribute("data-global-core-src", src);

      script.onload = function(){
        resolve(src);
      };

      script.onerror = function(){
        reject(
          new Error("No se pudo cargar " + src)
        );
      };

      document.head.appendChild(script);
    });
  }

  function ensureConnection(){
    if(api()){
      return Promise.resolve(api());
    }

    if(
      window.BDLocalScreenDeps &&
      typeof window.BDLocalScreenDeps.ready === "function"
    ){
      return window.BDLocalScreenDeps
        .ready()
        .then(function(){
          return api();
        });
    }

    if(
      window.BDLScreenDepsReady &&
      typeof window.BDLScreenDepsReady.then === "function"
    ){
      return window.BDLScreenDepsReady.then(function(){
        return api();
      });
    }

    return loadScript("../BDLocal/adapters/bdl.screen-deps.js")
      .then(function(){
        if(
          window.BDLocalScreenDeps &&
          typeof window.BDLocalScreenDeps.ready === "function"
        ){
          return window.BDLocalScreenDeps.ready();
        }

        return true;
      })
      .then(function(){
        return api();
      })
      .catch(function(error){
        addError(
          "No se pudo inicializar BDLocal para Global",
          error
        );

        return api();
      });
  }

  function ready(options){
    options = options || {};

    if(state.ready && !options.force){
      return Promise.resolve(status());
    }

    if(state.loading && !options.force){
      return state.loading;
    }

    state.loading = ensureConnection()
      .then(function(connection){
        if(
          connection &&
          typeof connection.ready === "function"
        ){
          return connection.ready().then(function(){
            return connection;
          });
        }

        return connection;
      })
      .then(function(){
        return refresh({
          force: true
        });
      })
      .then(function(){
        state.ready = true;

        emit(
          "global:core-ready",
          status()
        );

        return status();
      })
      .catch(function(error){
        addError(
          "Error inicializando GlobalCore",
          error
        );

        state.ready = true;
        return status();
      })
      .finally(function(){
        state.loading = null;
      });

    return state.loading;
  }

  function refresh(options){
    options = options || {};

    return ensureConnection()
      .then(function(connection){
        if(
          connection &&
          typeof connection.refresh === "function" &&
          options.force
        ){
          return connection
            .refresh({
              source: "GlobalCore.refresh"
            })
            .then(function(){
              return connection;
            })
            .catch(function(){
              return connection;
            });
        }

        return connection;
      })
      .then(function(connection){
        var snapshot;

        if(
          connection &&
          typeof connection.snapshot === "function"
        ){
          snapshot = connection.snapshot({
            filters: {
              matricula: ""
            }
          });
        }else if(
          connection &&
          typeof connection.getSnapshot === "function"
        ){
          snapshot = connection.getSnapshot({
            filters: {
              matricula: ""
            }
          });
        }else{
          snapshot = fallbackSnapshot();
        }

        state.snapshot = normalizeSnapshot(
          snapshot || fallbackSnapshot()
        );

        emit("global:data-refreshed", {
          status: status(),
          at: new Date().toISOString()
        });

        return state.snapshot;
      });
  }

  function fallbackSnapshot(){
    var repo =
      window.ExcelLocalRepo ||
      window.BL2DataEngine ||
      null;

    var periods = [];
    var students = [];
    var requirements = [];

    try{
      if(
        repo &&
        typeof repo.listPeriods === "function"
      ){
        periods = repo.listPeriods() || [];
      }else if(
        repo &&
        typeof repo.getPeriods === "function"
      ){
        periods = repo.getPeriods() || [];
      }
    }catch(error){
      addError(
        "No se pudieron leer períodos en fallback",
        error
      );
    }

    try{
      if(
        repo &&
        typeof repo.listStudents === "function"
      ){
        var result = repo.listStudents({
          matricula: ""
        });

        students = Array.isArray(result)
          ? result
          : (
            result &&
            Array.isArray(result.rows)
              ? result.rows
              : []
          );
      }else if(
        repo &&
        typeof repo.getStudents === "function"
      ){
        students = repo.getStudents({
          matricula: ""
        }) || [];
      }
    }catch(error2){
      addError(
        "No se pudieron leer estudiantes en fallback",
        error2
      );
    }

    try{
      if(
        repo &&
        typeof repo.getRequirements === "function"
      ){
        requirements =
          repo.getRequirements({}) || [];
      }
    }catch(error3){
      addError(
        "No se pudieron leer requisitos en fallback",
        error3
      );
    }

    return {
      ok: true,
      source: "GlobalCore.fallback",
      meta: {},
      periods: periods,
      students: students,
      requirements: requirements,
      careers: [],
      requirementCatalog: [],
      diagnostics: [],
      generatedAt: new Date().toISOString()
    };
  }

  function normalizePeriod(period){
    period = period || {};

    var id = text(
      period.periodoCanonicoId ||
      period.periodoId ||
      period.periodId ||
      period.id ||
      period.value ||
      period.key ||
      period.label ||
      period.nombre
    );

    var label = text(
      period.periodoCanonicoLabel ||
      period.periodoLabel ||
      period.label ||
      period.nombre ||
      period.name ||
      id
    );

    if(!id && !label){
      return null;
    }

    return Object.assign({}, period, {
      id: id || label,
      value: id || label,
      key: id || label,
      label: label || id,
      periodoId: id || label,
      periodoLabel: label || id
    });
  }

  function rowPeriodId(row){
    row = row || {};

    return text(
      row.periodoCanonicoId ||
      row.periodoId ||
      row.periodId ||
      row.ultimoPeriodoId ||
      row.idPeriodo ||
      row._periodoId ||
      row._bl2PeriodoId ||
      row.PeriodoId ||
      row.Periodo
    );
  }

  function rowPeriodLabel(row){
    row = row || {};

    return text(
      row.periodoCanonicoLabel ||
      row.periodoLabel ||
      row.periodo ||
      row.Periodo ||
      row._periodo ||
      row._bl2Periodo ||
      rowPeriodId(row)
    );
  }

  function cedula(row){
    row = row || {};

    return text(
      row.cedula ||
      row.Cedula ||
      row["Cédula"] ||
      row.numeroIdentificacion ||
      row.NumeroIdentificacion ||
      row.identificacion ||
      row.Identificacion ||
      row._cedula
    );
  }

  function careerName(row){
    row = row || {};

    return text(
      row.NombreCarrera ||
      row.nombreCarrera ||
      row.carrera ||
      row.Carrera ||
      row._carrera
    ) || "SIN CARRERA";
  }

  function careerCode(row){
    row = row || {};

    return text(
      row.CodigoCarrera ||
      row.codigoCarrera ||
      row.codigo ||
      row._codigoCarrera ||
      careerName(row)
    );
  }

  function studentName(row){
    row = row || {};

    return text(
      row.Nombres ||
      row.nombres ||
      row.Nombre ||
      row.nombre ||
      row.Estudiante ||
      row.estudiante ||
      row._nombres
    );
  }

  function divisionName(row){
    row = row || {};

    return text(
      row.division ||
      row.Division ||
      row["División"] ||
      row._division ||
      row._bl2Division ||
      "Sin división"
    ) || "Sin división";
  }

  function matriculaState(row){
    row = row || {};

    var value = text(
      row.estadoMatricula ||
      row.EstadoMatricula ||
      row._estadoMatricula ||
      "ACTIVO"
    ).toUpperCase();

    return value === "RETIRADO"
      ? "RETIRADO"
      : "ACTIVO";
  }

  function typeCareer(nombreCarrera){
    if(
      config.reglas &&
      typeof config.reglas.tipoCarrera === "function"
    ){
      return config.reglas.tipoCarrera(
        nombreCarrera
      );
    }

    return text(nombreCarrera)
      .toUpperCase()
      .indexOf("UNIVERSITARIA") >= 0
        ? "UNIVERSITARIA"
        : "SUPERIOR";
  }

  function normalizeRequirement(requirement){
    requirement = Object.assign(
      {},
      requirement || {}
    );

    var id = text(
      requirement.requisitoId ||
      requirement.requisito ||
      requirement.campo ||
      requirement.key ||
      requirement.id ||
      requirement.nombre ||
      requirement.label
    );

    if(!id){
      return null;
    }

    requirement.id = id;
    requirement.key =
      requirement.key || id;

    requirement.label = text(
      requirement.label ||
      requirement.nombre ||
      id
    );

    return requirement;
  }

  function requirementValue(row, requirementId){
    row = row || {};

    if(!requirementId){
      return "";
    }

    if(
      Object.prototype.hasOwnProperty.call(
        row,
        requirementId
      )
    ){
      return row[requirementId];
    }

    var wanted = key(requirementId);
    var found = "";

    Object.keys(row).some(function(propertyName){
      if(key(propertyName) === wanted){
        found = row[propertyName];
        return true;
      }

      return false;
    });

    return found;
  }

  function graduationValue(row){
    var settings = graduationConfig();

    return text(
      requirementValue(
        row || {},
        settings.campo
      )
    );
  }

  function isGraduate(row){
    var settings = graduationConfig();

    return (
      strictStatus(
        graduationValue(row)
      ) === settings.valorEsperado
    );
  }

  function normalizeStudent(row){
    row = Object.assign({}, row || {});

    var carrera = careerName(row);
    var periodoId = rowPeriodId(row);
    var periodoLabel =
      rowPeriodLabel(row) ||
      periodoId ||
      "SIN PERÍODO";

    var tipo = typeCareer(carrera);

    row._globalCedula = cedula(row);
    row._globalNombres = studentName(row);
    row._globalCarrera = carrera;
    row._globalCodigoCarrera = careerCode(row);
    row._globalTipoCarrera = tipo;
    row._globalPeriodoId = periodoId;
    row._globalPeriodoLabel = periodoLabel;
    row._globalDivision = divisionName(row);
    row._globalEstadoMatricula =
      matriculaState(row);

    row._globalAprobacionTitulacion =
      graduationValue(row);

    row._globalEsGraduado =
      isGraduate(row);

    return row;
  }

  function normalizeCareer(career){
    career = career || {};

    var nombre = text(
      career.nombre ||
      career.name ||
      career.label ||
      career.carrera
    );

    var codigo = text(
      career.codigo ||
      career.id ||
      career.key ||
      nombre
    );

    if(!nombre){
      return null;
    }

    return {
      id: (codigo || nombre).toUpperCase(),
      codigo: codigo || nombre,
      nombre: nombre,
      tipo: text(
        career.tipo ||
        typeCareer(nombre)
      )
    };
  }

  function buildCareerCatalog(students){
    var map = Object.create(null);

    students.forEach(function(row){
      var nombre =
        row._globalCarrera ||
        careerName(row);

      var codigo =
        row._globalCodigoCarrera ||
        careerCode(row);

      var id = (
        codigo || nombre
      ).toUpperCase();

      if(!nombre || map[id]){
        return;
      }

      map[id] = {
        id: id,
        codigo: codigo,
        nombre: nombre,
        tipo: typeCareer(nombre)
      };
    });

    return Object.keys(map)
      .map(function(id){
        return map[id];
      })
      .sort(function(a, b){
        return a.nombre.localeCompare(
          b.nombre,
          "es",
          {
            sensitivity: "base"
          }
        );
      });
  }

  function buildRequirementCatalog(
    students,
    requirements
  ){
    var map = Object.create(null);

    var reserved = {
      id: true,
      _id: true,
      cedula: true,
      Cedula: true,
      "Cédula": true,
      numeroIdentificacion: true,
      NumeroIdentificacion: true,
      nombres: true,
      Nombres: true,
      nombre: true,
      Nombre: true,
      estudiante: true,
      Estudiante: true,
      carrera: true,
      Carrera: true,
      nombreCarrera: true,
      NombreCarrera: true,
      codigoCarrera: true,
      CodigoCarrera: true,
      periodo: true,
      Periodo: true,
      periodoId: true,
      periodId: true,
      periodoLabel: true,
      division: true,
      Division: true,
      estadoMatricula: true,
      EstadoMatricula: true,
      createdAt: true,
      updatedAt: true
    };

    requirements.forEach(function(requirement){
      var normalized =
        normalizeRequirement(requirement);

      if(normalized){
        map[normalized.id] = normalized;
      }
    });

    students.forEach(function(row){
      Object.keys(row || {}).forEach(
        function(propertyName){
          if(
            reserved[propertyName] ||
            propertyName.indexOf("_global") === 0
          ){
            return;
          }

          var value = text(
            row[propertyName]
          ).toUpperCase();

          if(
            [
              "CUMPLE",
              "NO CUMPLE",
              "PENDIENTE"
            ].indexOf(value) >= 0
          ){
            map[propertyName] = {
              id: propertyName,
              key: propertyName,
              label: propertyName
            };
          }
        }
      );
    });

    return Object.keys(map)
      .map(function(id){
        return map[id];
      })
      .sort(function(a, b){
        return a.label.localeCompare(
          b.label,
          "es",
          {
            sensitivity: "base"
          }
        );
      });
  }

  function normalizeSnapshot(snapshot){
    snapshot = snapshot || {};

    var periods = Array.isArray(snapshot.periods)
      ? snapshot.periods
          .map(normalizePeriod)
          .filter(Boolean)
      : [];

    var students = Array.isArray(snapshot.students)
      ? snapshot.students
          .map(normalizeStudent)
      : [];

    var requirements =
      Array.isArray(snapshot.requirements)
        ? snapshot.requirements
            .map(normalizeRequirement)
            .filter(Boolean)
        : [];

    var careers =
      Array.isArray(snapshot.careers) &&
      snapshot.careers.length
        ? snapshot.careers
        : buildCareerCatalog(students);

    var requirementCatalog =
      Array.isArray(snapshot.requirementCatalog) &&
      snapshot.requirementCatalog.length
        ? snapshot.requirementCatalog
        : buildRequirementCatalog(
          students,
          requirements
        );

    return {
      ok: snapshot.ok !== false,
      source:
        snapshot.source ||
        "GlobalCore",

      meta:
        snapshot.meta || {},

      periods: periods,
      students: students,
      requirements: requirements,

      careers: careers
        .map(normalizeCareer)
        .filter(Boolean),

      requirementCatalog:
        requirementCatalog
          .map(normalizeRequirement)
          .filter(Boolean),

      diagnostics:
        Array.isArray(snapshot.diagnostics)
          ? snapshot.diagnostics
          : [],

      generatedAt:
        snapshot.generatedAt ||
        new Date().toISOString()
    };
  }

  function comparePeriod(a, b){
    return text(a).localeCompare(
      text(b),
      "es",
      {
        sensitivity: "base"
      }
    );
  }

  function insidePeriodRange(row, filters){
    filters = filters || {};

    var period = text(
      row._globalPeriodoId ||
      row._globalPeriodoLabel
    );

    var desde = text(
      filters.periodoDesde
    );

    var hasta = text(
      filters.periodoHasta
    );

    if(
      desde &&
      comparePeriod(period, desde) < 0
    ){
      return false;
    }

    if(
      hasta &&
      comparePeriod(period, hasta) > 0
    ){
      return false;
    }

    return true;
  }

  function cellStatus(value){
    var normalized = norm(value);

    if(
      [
        "cumple",
        "si",
        "sí",
        "aprobado",
        "aprobada",
        "ok",
        "validado",
        "validada"
      ].indexOf(normalized) >= 0
    ){
      return "CUMPLE";
    }

    if(
      [
        "pendiente",
        "por revisar",
        "revision",
        "revisión"
      ].indexOf(normalized) >= 0
    ){
      return "PENDIENTE";
    }

    if(!normalized){
      return "PENDIENTE";
    }

    return "NO CUMPLE";
  }

  function studentCompliance(row, catalog){
    catalog = Array.isArray(catalog)
      ? catalog
      : [];

    var cumple = 0;
    var pendiente = 0;
    var noCumple = 0;

    catalog.forEach(function(requirement){
      var status = cellStatus(
        requirementValue(
          row,
          requirement.id ||
          requirement.key
        )
      );

      if(status === "CUMPLE"){
        cumple += 1;
      }else if(status === "PENDIENTE"){
        pendiente += 1;
      }else{
        noCumple += 1;
      }
    });

    return {
      cumple: cumple,
      pendiente: pendiente,
      noCumple: noCumple,
      total: catalog.length,

      aprobado:
        catalog.length > 0 &&
        noCumple === 0 &&
        pendiente === 0,

      porcentaje:
        catalog.length > 0
          ? Math.round(
            (
              cumple /
              catalog.length
            ) * 100
          )
          : 0
    };
  }

  function graduateIdentity(row){
    row = row || {};

    var period = text(
      row._globalPeriodoId ||
      row._globalPeriodoLabel ||
      rowPeriodId(row) ||
      rowPeriodLabel(row)
    );

    var student = text(
      row._globalCedula ||
      cedula(row) ||
      row.id ||
      row._id ||
      studentName(row)
    );

    return period + "__" + student;
  }

  function uniqueGraduates(rows){
    var settings = graduationConfig();

    var source = (
      Array.isArray(rows)
        ? rows
        : []
    ).filter(isGraduate);

    if(!settings.contarUnicoPorPeriodo){
      return source.slice();
    }

    var seen = Object.create(null);

    return source.filter(function(row){
      var identity =
        graduateIdentity(row);

      if(
        !identity ||
        identity === "__"
      ){
        return true;
      }

      if(seen[identity]){
        return false;
      }

      seen[identity] = true;
      return true;
    });
  }

  function groupGraduatesByPeriod(rows){
    var map = Object.create(null);

    uniqueGraduates(rows).forEach(
      function(row){
        var periodId = text(
          row._globalPeriodoId ||
          rowPeriodId(row)
        );

        var periodLabel = text(
          row._globalPeriodoLabel ||
          rowPeriodLabel(row) ||
          periodId ||
          "SIN PERÍODO"
        );

        var mapKey =
          periodId ||
          periodLabel;

        if(!map[mapKey]){
          map[mapKey] = {
            id: mapKey,
            periodoId:
              periodId || mapKey,
            periodo: periodLabel,
            label: periodLabel,
            cantidadGraduados: 0,
            total: 0
          };
        }

        map[mapKey].cantidadGraduados += 1;
        map[mapKey].total += 1;
      }
    );

    return Object.keys(map)
      .map(function(id){
        return map[id];
      })
      .sort(function(a, b){
        return comparePeriod(
          a.periodoId ||
          a.periodo,

          b.periodoId ||
          b.periodo
        );
      });
  }

  function applyFilters(filters){
    filters = filters || {};

    var snapshot =
      state.snapshot ||
      normalizeSnapshot(
        fallbackSnapshot()
      );

    var carrera = text(
      filters.carrera
    );

    var requisito = text(
      filters.requisito
    );

    var tipo = text(
      filters.tipoCarrera
    ).toUpperCase();

    var division = text(
      filters.division
    );

    var catalog = requisito
      ? snapshot.requirementCatalog.filter(
        function(requirement){
          return (
            requirement.id === requisito ||
            requirement.key === requisito
          );
        }
      )
      : snapshot.requirementCatalog;

    var rows = snapshot.students.filter(
      function(row){
        if(
          !insidePeriodRange(
            row,
            filters
          )
        ){
          return false;
        }

        if(
          carrera &&
          row._globalCodigoCarrera !== carrera &&
          row._globalCarrera !== carrera
        ){
          return false;
        }

        if(
          tipo &&
          row._globalTipoCarrera !== tipo
        ){
          return false;
        }

        if(
          division &&
          key(row._globalDivision) !==
          key(division)
        ){
          return false;
        }

        if(
          requisito &&
          !text(
            requirementValue(
              row,
              requisito
            )
          )
        ){
          return false;
        }

        return true;
      }
    );

    rows = rows.map(function(row){
      var copy = Object.assign(
        {},
        row
      );

      copy._globalCumplimiento =
        studentCompliance(
          copy,
          catalog
        );

      copy._globalAprobacionTitulacion =
        graduationValue(copy);

      copy._globalEsGraduado =
        isGraduate(copy);

      return copy;
    });

    state.lastFilters =
      clone(filters);

    state.lastData = buildData(
      rows,
      snapshot,
      filters,
      catalog
    );

    return state.lastData;
  }

  function uniqueCount(list, getter){
    var map = Object.create(null);

    list.forEach(function(item){
      var value = text(
        getter(item)
      );

      if(value){
        map[value] = true;
      }
    });

    return Object.keys(map).length;
  }

  function groupCount(list, getter){
    var map = Object.create(null);

    list.forEach(function(item){
      var value = text(
        getter(item)
      ) || "SIN DATO";

      if(!map[value]){
        map[value] = {
          id: value,
          label: value,
          total: 0
        };
      }

      map[value].total += 1;
    });

    return Object.keys(map)
      .map(function(id){
        return map[id];
      })
      .sort(function(a, b){
        return (
          b.total - a.total ||
          a.label.localeCompare(
            b.label,
            "es",
            {
              sensitivity: "base"
            }
          )
        );
      });
  }

  function buildData(
    rows,
    snapshot,
    filters,
    catalog
  ){
    rows = Array.isArray(rows)
      ? rows
      : [];

    catalog = Array.isArray(catalog)
      ? catalog
      : [];

    var cumplimientoTotal = rows.reduce(
      function(result, row){
        var compliance =
          row._globalCumplimiento ||
          studentCompliance(
            row,
            catalog
          );

        result.cumple +=
          compliance.cumple;

        result.pendiente +=
          compliance.pendiente;

        result.noCumple +=
          compliance.noCumple;

        result.total +=
          compliance.total;

        if(compliance.aprobado){
          result.estudiantesCumplen += 1;
        }

        return result;
      },
      {
        cumple: 0,
        pendiente: 0,
        noCumple: 0,
        total: 0,
        estudiantesCumplen: 0
      }
    );

    var graduateRows =
      uniqueGraduates(rows);

    var graduatesByPeriod =
      groupGraduatesByPeriod(
        graduateRows
      );

    var graduateSettings =
      graduationConfig();

    var resumen = {
      totalEstudiantes: rows.length,

      totalCarreras: uniqueCount(
        rows,
        function(row){
          return (
            row._globalCodigoCarrera ||
            row._globalCarrera
          );
        }
      ),

      totalPeriodos: uniqueCount(
        rows,
        function(row){
          return (
            row._globalPeriodoId ||
            row._globalPeriodoLabel
          );
        }
      ),

      totalRequisitos:
        catalog.length,

      porcentajeCumplimiento:
        cumplimientoTotal.total
          ? Math.round(
            (
              cumplimientoTotal.cumple /
              cumplimientoTotal.total
            ) * 100
          )
          : 0,

      estudiantesCumplen:
        cumplimientoTotal.estudiantesCumplen,

      totalGraduados:
        graduateRows.length,

      activos: rows.filter(
        function(row){
          return (
            row._globalEstadoMatricula !==
            "RETIRADO"
          );
        }
      ).length,

      retirados: rows.filter(
        function(row){
          return (
            row._globalEstadoMatricula ===
            "RETIRADO"
          );
        }
      ).length
    };

    return {
      ok: true,
      source: "GlobalCore",

      filters:
        clone(filters || {}),

      snapshotMeta:
        clone(snapshot.meta || {}),

      resumen: resumen,
      students: rows,

      /*
       * Listado interno de graduados.
       * No se mostrará necesariamente en la tabla principal,
       * pero queda disponible para reportes futuros.
       */
      graduates: graduateRows,

      graduados: {
        campo:
          graduateSettings.campo,

        valorEsperado:
          graduateSettings.valorEsperado,

        total:
          graduateRows.length,

        estudiantes:
          graduateRows,

        porPeriodo:
          graduatesByPeriod
      },

      periods:
        snapshot.periods,

      careers:
        snapshot.careers,

      requirements:
        catalog,

      catalogs: {
        periods:
          snapshot.periods,

        careers:
          snapshot.careers,

        requirements:
          snapshot.requirementCatalog
      },

      groups: {
        byPeriodo: groupCount(
          rows,
          function(row){
            return (
              row._globalPeriodoLabel ||
              row._globalPeriodoId
            );
          }
        ),

        byCarrera: groupCount(
          rows,
          function(row){
            return row._globalCarrera;
          }
        ),

        byTipoCarrera: groupCount(
          rows,
          function(row){
            return row._globalTipoCarrera;
          }
        ),

        byEstadoMatricula: groupCount(
          rows,
          function(row){
            return row._globalEstadoMatricula;
          }
        ),

        byPeriodoGraduados:
          graduatesByPeriod
      },

      generatedAt:
        new Date().toISOString()
    };
  }

  function getFilterOptions(){
    var snapshot =
      state.snapshot ||
      normalizeSnapshot(
        fallbackSnapshot()
      );

    var divisionMap =
      Object.create(null);

    (
      snapshot.students || []
    ).forEach(function(row){
      var division = text(
        row._globalDivision ||
        divisionName(row)
      );

      if(division){
        divisionMap[
          key(division)
        ] = division;
      }
    });

    var divisions = Object.keys(
      divisionMap
    ).map(function(id){
      return {
        id: id,
        value: divisionMap[id],
        label: divisionMap[id],
        nombre: divisionMap[id]
      };
    }).sort(function(a, b){
      return a.label.localeCompare(
        b.label,
        "es",
        {
          sensitivity: "base"
        }
      );
    });

    return {
      periods:
        snapshot.periods.slice(),

      careers:
        snapshot.careers.slice(),

      divisions:
        divisions,

      requirements:
        snapshot.requirementCatalog.slice(),

      tiposCarrera:
        (
          config.filtros &&
          config.filtros.tiposCarrera
        ) || []
    };
  }

  function status(){
    var snapshot =
      state.snapshot || {
        periods: [],
        students: [],
        requirementCatalog: [],
        careers: []
      };

    return {
      ok:
        state.errors.length === 0,

      ready:
        state.ready,

      version:
        VERSION,

      periods:
        (
          snapshot.periods || []
        ).length,

      students:
        (
          snapshot.students || []
        ).length,

      careers:
        (
          snapshot.careers || []
        ).length,

      requirements:
        (
          snapshot.requirementCatalog || []
        ).length,

      errors:
        state.errors.slice(-10),

      updatedAt:
        new Date().toISOString()
    };
  }

  window.GlobalCore = {
    version:
      VERSION,

    ready:
      ready,

    refresh:
      refresh,

    status:
      status,

    getSnapshot: function(){
      return clone(
        state.snapshot ||
        normalizeSnapshot(
          fallbackSnapshot()
        )
      );
    },

    getFilterOptions:
      getFilterOptions,

    applyFilters:
      applyFilters,

    buildData:
      applyFilters,

    helpers: {
      typeCareer:
        typeCareer,

      cellStatus:
        cellStatus,

      requirementValue:
        requirementValue,

      graduationValue:
        graduationValue,

      isGraduate:
        isGraduate,

      uniqueGraduates:
        uniqueGraduates,

      groupGraduatesByPeriod:
        groupGraduatesByPeriod,

      studentCompliance:
        studentCompliance,

      normalizeStudent:
        normalizeStudent
    }
  };

  ready({
    force: false
  });
})(window, document);