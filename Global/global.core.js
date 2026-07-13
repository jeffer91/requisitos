/* =========================================================
Nombre completo: global.core.js
Ruta o ubicación: /Requisitos/Global/global.core.js
Función:
- Leer datos desde ConGlobal/BDLocalGlobal/BDLocalConexiones.
- Hidratar estudiantes con requisitos del mismo período.
- Aplicar filtros superiores del módulo Global.
- Preparar indicadores, agrupaciones, catálogos y graduados.
- Evitar duplicados por estudiante y período.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION =
    "1.2.0-hydrated-global";

  var config =
    window.GlobalConfig ||
    {};

  var state = {
    ready:
      false,

    loading:
      null,

    snapshot:
      null,

    lastFilters:
      null,

    lastData:
      null,

    errors:
      []
  };

  function text(value){
    return String(
      value == null
        ? ""
        : value
    ).trim();
  }

  function norm(value){
    return text(value)
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim()
      .toLowerCase();
  }

  function key(value){
    return norm(value)
      .replace(
        /[^a-z0-9]+/g,
        ""
      );
  }

  function clone(value){
    if(value === undefined){
      return undefined;
    }

    try{
      return JSON.parse(
        JSON.stringify(value)
      );
    }catch(error){
      return value;
    }
  }

  function array(value){
    return Array.isArray(value)
      ? value
      : [];
  }

  function emit(name, detail){
    try{
      window.dispatchEvent(
        new CustomEvent(
          name,
          {
            detail:
              detail || {}
          }
        )
      );
    }catch(error){}
  }

  function addError(
    message,
    error
  ){
    state.errors.push({
      message:
        message,

      detail:
        error &&
        error.message
          ? error.message
          : text(error),

      at:
        new Date()
          .toISOString()
    });

    if(state.errors.length > 20){
      state.errors =
        state.errors.slice(-20);
    }

    try{
      console.warn(
        "[GlobalCore] " +
        message,
        error || ""
      );
    }catch(consoleError){}
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
      typeof window
        .BDLocalConexiones
        .get === "function"
    ){
      return window
        .BDLocalConexiones
        .get("global");
    }

    return null;
  }

  function loadScript(relative){
    var src;

    try{
      src =
        new URL(
          relative,
          window.location.href
        ).href;
    }catch(error){
      src = relative;
    }

    var exists =
      Array.prototype
        .slice
        .call(
          document.scripts ||
          []
        )
        .some(function(script){
          return (
            script.src === src ||
            script.getAttribute(
              "data-global-core-src"
            ) === src
          );
        });

    if(exists){
      return Promise.resolve(src);
    }

    return new Promise(
      function(resolve, reject){
        var script =
          document.createElement(
            "script"
          );

        script.src =
          src;

        script.async =
          false;

        script.defer =
          false;

        script.setAttribute(
          "data-global-core-src",
          src
        );

        script.onload =
          function(){
            resolve(src);
          };

        script.onerror =
          function(){
            reject(
              new Error(
                "No se pudo cargar " +
                src
              )
            );
          };

        (
          document.head ||
          document.documentElement
        ).appendChild(script);
      }
    );
  }

  function ensureConnection(){
    if(api()){
      return Promise.resolve(
        api()
      );
    }

    if(
      window.BDLocalScreenDeps &&
      typeof window
        .BDLocalScreenDeps
        .ready === "function"
    ){
      return window
        .BDLocalScreenDeps
        .ready()
        .then(api);
    }

    if(
      window.BDLScreenDepsReady &&
      typeof window
        .BDLScreenDepsReady
        .then === "function"
    ){
      return window
        .BDLScreenDepsReady
        .then(api);
    }

    return loadScript(
      "../BDLocal/adapters/bdl.screen-deps.js"
    )
      .then(function(){
        if(
          window.BDLocalScreenDeps &&
          typeof window
            .BDLocalScreenDeps
            .ready ===
            "function"
        ){
          return window
            .BDLocalScreenDeps
            .ready();
        }

        return true;
      })
      .then(api)
      .catch(function(error){
        addError(
          "No se pudo inicializar BDLocal para Global",
          error
        );

        return api();
      });
  }

  function graduationConfig(){
    var settings =
      config.graduados ||
      {};

    return {
      campo:
        text(
          settings.campo ||
          "AprobacionTitulacion"
        ) ||
        "AprobacionTitulacion",

      valorEsperado:
        text(
          settings.valorEsperado ||
          "CUMPLE"
        ).toUpperCase() ||
        "CUMPLE",

      contarUnicoPorPeriodo:
        settings
          .contarUnicoPorPeriodo !==
        false
    };
  }

  function normalizePeriod(period){
    period =
      period || {};

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

    return Object.assign(
      {},
      period,
      {
        id:
          id || label,

        value:
          id || label,

        key:
          id || label,

        label:
          label || id,

        periodoId:
          id || label,

        periodoLabel:
          label || id
      }
    );
  }

  function rowPeriodId(row){
    row =
      row || {};

    return text(
      row.periodoCanonicoId ||
      row.periodoId ||
      row.periodId ||
      row.ultimoPeriodoId ||
      row.idPeriodo ||
      row._periodoId ||
      row._bl2PeriodoId ||
      row.PeriodoId ||
      row.periodo ||
      row.Periodo
    );
  }

  function rowPeriodLabel(row){
    row =
      row || {};

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
    row =
      row || {};

    var value = text(
      row.cedula ||
      row.Cedula ||
      row["Cédula"] ||
      row.numeroIdentificacion ||
      row.NumeroIdentificacion ||
      row.identificacion ||
      row.Identificacion ||
      row._cedula ||
      row._bl2Id
    );

    try{
      if(
        window.BDLocalConUtils &&
        typeof window
          .BDLocalConUtils
          .normalizeCedula ===
          "function"
      ){
        return window
          .BDLocalConUtils
          .normalizeCedula(value);
      }
    }catch(error){}

    return value.replace(
      /[^0-9A-Za-z]/g,
      ""
    );
  }

  function studentName(row){
    row =
      row || {};

    return text(
      row.Nombres ||
      row.nombres ||
      row.Nombre ||
      row.nombre ||
      row.Estudiante ||
      row.estudiante ||
      row._nombres ||
      row._bl2Nombre
    );
  }

  function careerName(row){
    row =
      row || {};

    return text(
      row.NombreCarrera ||
      row.nombreCarrera ||
      row.carrera ||
      row.Carrera ||
      row._carrera ||
      row._bl2Carrera
    ) || "SIN CARRERA";
  }

  function careerCode(row){
    row =
      row || {};

    return text(
      row.CodigoCarrera ||
      row.codigoCarrera ||
      row.codigo ||
      row._codigoCarrera ||
      careerName(row)
    );
  }

  function divisionName(row){
    row =
      row || {};

    var divisions =
      array(
        row.divisiones
      );

    var firstDivision =
      divisions.length
        ? text(
            divisions[0].nombre ||
            divisions[0].label ||
            divisions[0].division ||
            divisions[0]
          )
        : "";

    return text(
      row.division ||
      row.Division ||
      row["División"] ||
      row._division ||
      row._bl2Division ||
      row.divisionPrincipal ||
      firstDivision ||
      "Sin división"
    ) || "Sin división";
  }

  function matriculaState(row){
    row =
      row || {};

    var value = text(
      row.estadoMatricula ||
      row.EstadoMatricula ||
      row._estadoMatricula ||
      row._bl2EstadoMatricula ||
      "ACTIVO"
    ).toUpperCase();

    return value === "RETIRADO"
      ? "RETIRADO"
      : "ACTIVO";
  }

  function typeCareer(name){
    if(
      config.reglas &&
      typeof config
        .reglas
        .tipoCarrera ===
        "function"
    ){
      return config
        .reglas
        .tipoCarrera(name);
    }

    return text(name)
      .toUpperCase()
      .indexOf(
        "UNIVERSITARIA"
      ) >= 0
        ? "UNIVERSITARIA"
        : "SUPERIOR";
  }

  function requirementName(
    requirement
  ){
    requirement =
      requirement || {};

    return text(
      requirement.requisitoId ||
      requirement.requisitoKey ||
      requirement.requisito ||
      requirement.nombreRequisito ||
      requirement.requisitoNombre ||
      requirement.campo ||
      requirement.field ||
      requirement.key ||
      requirement.id ||
      requirement.nombre ||
      requirement.label
    );
  }

  function requirementRecordValue(
    requirement
  ){
    requirement =
      requirement || {};

    if(
      Object.prototype.hasOwnProperty.call(
        requirement,
        "estado"
      )
    ){
      return requirement.estado;
    }

    if(
      Object.prototype.hasOwnProperty.call(
        requirement,
        "estadoKey"
      )
    ){
      return requirement.estadoKey;
    }

    if(
      Object.prototype.hasOwnProperty.call(
        requirement,
        "valor"
      )
    ){
      return requirement.valor;
    }

    if(
      Object.prototype.hasOwnProperty.call(
        requirement,
        "value"
      )
    ){
      return requirement.value;
    }

    if(
      Object.prototype.hasOwnProperty.call(
        requirement,
        "cumple"
      )
    ){
      return requirement.cumple;
    }

    if(
      Object.prototype.hasOwnProperty.call(
        requirement,
        "resultado"
      )
    ){
      return requirement.resultado;
    }

    return "";
  }

  function normalizeRequirement(
    requirement
  ){
    requirement =
      Object.assign(
        {},
        requirement || {}
      );

    var id =
      requirementName(
        requirement
      );

    if(!id){
      return null;
    }

    requirement.id =
      id;

    requirement.key =
      requirement.key ||
      id;

    requirement.label =
      text(
        requirement.label ||
        requirement.nombre ||
        requirement.nombreRequisito ||
        id
      );

    return requirement;
  }

  function samePeriod(a, b){
    try{
      if(
        window.BDLocalConUtils &&
        typeof window
          .BDLocalConUtils
          .samePeriod ===
          "function"
      ){
        return window
          .BDLocalConUtils
          .samePeriod(
            a,
            b
          );
      }
    }catch(error){}

    return key(a) === key(b);
  }

  function identityKey(row){
    var period =
      rowPeriodId(row);

    var identity =
      cedula(row);

    return period && identity
      ? period +
        "__" +
        identity
      : "";
  }

  function putValue(
    target,
    property,
    value
  ){
    if(
      !property ||
      value === undefined ||
      value === null ||
      text(value) === ""
    ){
      return;
    }

    if(
      !Object.prototype.hasOwnProperty.call(
        target,
        property
      ) ||
      text(
        target[property]
      ) === ""
    ){
      target[property] =
        value;
    }
  }

  function applyRequirementAlias(
    target,
    name,
    value
  ){
    var id =
      key(name);

    putValue(
      target,
      name,
      value
    );

    if(id.indexOf("academ") >= 0){
      putValue(
        target,
        "Académico",
        value
      );
    }

    if(id.indexOf("document") >= 0){
      putValue(
        target,
        "Documentación",
        value
      );
    }

    if(
      id.indexOf("financier") >= 0 ||
      id.indexOf("pago") >= 0
    ){
      putValue(
        target,
        "Financiero",
        value
      );
    }

    if(id.indexOf("titulacion") >= 0){
      putValue(
        target,
        "Titulación",
        value
      );
    }

    if(id.indexOf("practic") >= 0){
      putValue(
        target,
        "PrácticasVinculacion",
        value
      );
    }

    if(id.indexOf("vincul") >= 0){
      putValue(
        target,
        "Vinculación",
        value
      );
    }

    if(id.indexOf("seguimiento") >= 0){
      putValue(
        target,
        "SeguimientoGraduados",
        value
      );
    }

    if(id.indexOf("ingles") >= 0){
      putValue(
        target,
        "Inglés",
        value
      );
    }

    if(
      id.indexOf("actualizacion") >= 0 &&
      id.indexOf("dato") >= 0
    ){
      putValue(
        target,
        "ActualizaciónDatos",
        value
      );
    }

    if(
      id === "aprobaciontitulacion" ||
      (
        id.indexOf("aprobacion") >= 0 &&
        id.indexOf("titulacion") >= 0
      )
    ){
      putValue(
        target,
        "AprobacionTitulacion",
        value
      );
    }
  }

  function hydrateStudents(
    students,
    requirements
  ){
    var byIdentity =
      Object.create(null);

    var byCedula =
      Object.create(null);

    array(
      requirements
    ).forEach(function(requirement){
      var id =
        identityKey(
          requirement
        );

      var identity =
        cedula(
          requirement
        );

      if(id){
        if(!byIdentity[id]){
          byIdentity[id] = [];
        }

        byIdentity[id]
          .push(requirement);
      }

      if(identity){
        if(!byCedula[identity]){
          byCedula[identity] = [];
        }

        byCedula[identity]
          .push(requirement);
      }
    });

    var dedup =
      Object.create(null);

    var withoutIdentity = [];

    array(
      students
    ).forEach(function(student){
      var row =
        Object.assign(
          {},
          student || {}
        );

      var id =
        identityKey(row);

      var identity =
        cedula(row);

      var linked =
        id &&
        byIdentity[id]
          ? byIdentity[id].slice()
          : array(
              byCedula[identity]
            ).filter(function(requirement){
              var reqPeriod =
                rowPeriodId(
                  requirement
                );

              var studentPeriod =
                rowPeriodId(row);

              return (
                !reqPeriod ||
                !studentPeriod ||
                samePeriod(
                  reqPeriod,
                  studentPeriod
                )
              );
            });

      row._globalRequirements =
        linked.map(clone);

      row.requisitos =
        linked.map(clone);

      linked.forEach(
        function(requirement){
          applyRequirementAlias(
            row,
            requirementName(
              requirement
            ),
            requirementRecordValue(
              requirement
            )
          );
        }
      );

      if(id){
        if(!dedup[id]){
          dedup[id] =
            row;
        }else{
          Object.keys(
            row
          ).forEach(function(property){
            putValue(
              dedup[id],
              property,
              row[property]
            );
          });
        }
      }else{
        withoutIdentity.push(
          row
        );
      }
    });

    return Object.keys(
      dedup
    ).map(function(id){
      return dedup[id];
    }).concat(
      withoutIdentity
    );
  }

  function requirementValue(
    row,
    requirementId
  ){
    row =
      row || {};

    if(!requirementId){
      return "";
    }

    if(
      Object.prototype.hasOwnProperty.call(
        row,
        requirementId
      )
    ){
      return row[
        requirementId
      ];
    }

    var wanted =
      key(requirementId);

    var found = "";

    Object.keys(
      row
    ).some(function(property){
      if(
        key(property) ===
        wanted
      ){
        found =
          row[property];

        return true;
      }

      return false;
    });

    if(text(found) !== ""){
      return found;
    }

    array(
      row._globalRequirements
    ).concat(
      array(
        row.requisitos
      )
    ).some(function(requirement){
      if(
        key(
          requirementName(
            requirement
          )
        ) !== wanted
      ){
        return false;
      }

      found =
        requirementRecordValue(
          requirement
        );

      return true;
    });

    return found;
  }

  function graduationValue(row){
    return text(
      requirementValue(
        row || {},
        graduationConfig()
          .campo
      )
    );
  }

  function isGraduate(row){
    return (
      graduationValue(row)
        .toUpperCase() ===
      graduationConfig()
        .valorEsperado
    );
  }

  function normalizeStudent(row){
    row =
      Object.assign(
        {},
        row || {}
      );

    var career =
      careerName(row);

    var periodId =
      rowPeriodId(row);

    var periodLabel =
      rowPeriodLabel(row) ||
      periodId ||
      "SIN PERÍODO";

    row._globalCedula =
      cedula(row);

    row._globalNombres =
      studentName(row);

    row._globalCarrera =
      career;

    row._globalCodigoCarrera =
      careerCode(row);

    row._globalTipoCarrera =
      typeCareer(career);

    row._globalPeriodoId =
      periodId;

    row._globalPeriodoLabel =
      periodLabel;

    row._globalDivision =
      divisionName(row);

    row._globalEstadoMatricula =
      matriculaState(row);

    row._globalAprobacionTitulacion =
      graduationValue(row);

    row._globalEsGraduado =
      isGraduate(row);

    return row;
  }

  function normalizeCareer(career){
    career =
      career || {};

    var name = text(
      career.nombre ||
      career.name ||
      career.label ||
      career.carrera
    );

    var code = text(
      career.codigo ||
      career.id ||
      career.key ||
      name
    );

    if(!name){
      return null;
    }

    return {
      id:
        (
          code ||
          name
        ).toUpperCase(),

      codigo:
        code || name,

      nombre:
        name,

      tipo:
        text(
          career.tipo ||
          typeCareer(name)
        )
    };
  }

  function buildCareerCatalog(
    students
  ){
    var map =
      Object.create(null);

    array(
      students
    ).forEach(function(row){
      var name =
        row._globalCarrera ||
        careerName(row);

      var code =
        row._globalCodigoCarrera ||
        careerCode(row);

      var id =
        key(
          code || name
        );

      if(
        !name ||
        map[id]
      ){
        return;
      }

      map[id] = {
        id:
          (
            code ||
            name
          ).toUpperCase(),

        codigo:
          code,

        nombre:
          name,

        tipo:
          typeCareer(name)
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
            sensitivity:
              "base"
          }
        );
      });
  }

  function buildRequirementCatalog(
    students,
    requirements
  ){
    var map =
      Object.create(null);

    var reserved = {
      id: true,
      _id: true,
      cedula: true,
      Cedula: true,
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
      updatedAt: true,
      requisitos: true
    };

    array(
      requirements
    ).forEach(function(requirement){
      var normalized =
        normalizeRequirement(
          requirement
        );

      if(normalized){
        map[
          key(normalized.id)
        ] = normalized;
      }
    });

    array(
      students
    ).forEach(function(row){
      Object.keys(
        row || {}
      ).forEach(function(property){
        if(
          reserved[property] ||
          property.indexOf(
            "_global"
          ) === 0
        ){
          return;
        }

        var value =
          text(
            row[property]
          ).toUpperCase();

        if(
          [
            "CUMPLE",
            "NO CUMPLE",
            "PENDIENTE"
          ].indexOf(value) < 0
        ){
          return;
        }

        var id =
          key(property);

        if(!map[id]){
          map[id] = {
            id:
              property,

            key:
              property,

            label:
              property
          };
        }
      });
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
            sensitivity:
              "base"
          }
        );
      });
  }

  function normalizeSnapshot(snapshot){
    snapshot =
      snapshot || {};

    var periods =
      array(
        snapshot.periods
      )
        .map(normalizePeriod)
        .filter(Boolean);

    var requirements =
      array(
        snapshot.requirements
      )
        .map(normalizeRequirement)
        .filter(Boolean);

    var students =
      hydrateStudents(
        array(
          snapshot.students
        ),
        array(
          snapshot.requirements
        )
      ).map(
        normalizeStudent
      );

    var careers =
      array(
        snapshot.careers
      ).length
        ? array(
            snapshot.careers
          )
            .map(normalizeCareer)
            .filter(Boolean)
        : buildCareerCatalog(
            students
          );

    var requirementCatalog =
      array(
        snapshot.requirementCatalog
      ).length
        ? array(
            snapshot.requirementCatalog
          )
            .map(normalizeRequirement)
            .filter(Boolean)
        : buildRequirementCatalog(
            students,
            requirements
          );

    return {
      ok:
        snapshot.ok !== false,

      source:
        snapshot.source ||
        "GlobalCore",

      meta:
        snapshot.meta ||
        {},

      periods:
        periods,

      students:
        students,

      requirements:
        requirements,

      careers:
        careers,

      requirementCatalog:
        requirementCatalog,

      diagnostics:
        array(
          snapshot.diagnostics
        ),

      generatedAt:
        snapshot.generatedAt ||
        new Date()
          .toISOString()
    };
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
        typeof repo
          .listPeriods ===
          "function"
      ){
        periods =
          repo.listPeriods() ||
          [];
      }else if(
        repo &&
        typeof repo
          .getPeriods ===
          "function"
      ){
        periods =
          repo.getPeriods() ||
          [];
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
        typeof repo
          .listStudents ===
          "function"
      ){
        var result =
          repo.listStudents({
            matricula: ""
          });

        students =
          Array.isArray(result)
            ? result
            : array(
                result &&
                result.rows
              );
      }else if(
        repo &&
        typeof repo
          .getStudents ===
          "function"
      ){
        students =
          repo.getStudents({
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
        typeof repo
          .getRequirements ===
          "function"
      ){
        requirements =
          repo.getRequirements({}) ||
          [];
      }
    }catch(error3){
      addError(
        "No se pudieron leer requisitos en fallback",
        error3
      );
    }

    return {
      ok:
        true,

      source:
        "GlobalCore.fallback",

      meta:
        {},

      periods:
        periods,

      students:
        students,

      requirements:
        requirements,

      careers:
        [],

      requirementCatalog:
        [],

      diagnostics:
        [],

      generatedAt:
        new Date()
          .toISOString()
    };
  }

  function refresh(options){
    options =
      options || {};

    return ensureConnection()
      .then(function(connection){
        if(
          connection &&
          typeof connection
            .refresh ===
            "function" &&
          options.force
        ){
          return connection
            .refresh({
              source:
                "GlobalCore.refresh"
            })
            .catch(function(){
              return null;
            })
            .then(function(){
              return connection;
            });
        }

        return connection;
      })
      .then(function(connection){
        var snapshot;

        if(
          connection &&
          typeof connection
            .snapshot ===
            "function"
        ){
          snapshot =
            connection.snapshot({
              filters: {
                matricula: ""
              }
            });
        }else if(
          connection &&
          typeof connection
            .getSnapshot ===
            "function"
        ){
          snapshot =
            connection.getSnapshot({
              filters: {
                matricula: ""
              }
            });
        }else{
          snapshot =
            fallbackSnapshot();
        }

        return Promise.resolve(
          snapshot
        ).then(function(resolved){
          state.snapshot =
            normalizeSnapshot(
              resolved ||
              fallbackSnapshot()
            );

          state.ready =
            true;

          emit(
            "global:data-refreshed",
            {
              status:
                status(),

              at:
                new Date()
                  .toISOString()
            }
          );

          return state.snapshot;
        });
      });
  }

  function ready(options){
    options =
      options || {};

    if(
      state.ready &&
      !options.force
    ){
      return Promise.resolve(
        status()
      );
    }

    if(
      state.loading &&
      !options.force
    ){
      return state.loading;
    }

    state.loading =
      ensureConnection()
        .then(function(connection){
          if(
            connection &&
            typeof connection
              .ready ===
              "function"
          ){
            return connection
              .ready()
              .catch(function(){
                return null;
              });
          }

          return null;
        })
        .then(function(){
          return refresh({
            force: true
          });
        })
        .then(function(){
          state.ready =
            true;

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

          state.ready =
            true;

          return status();
        })
        .finally(function(){
          state.loading =
            null;
        });

    return state.loading;
  }

  function insidePeriodRange(
    row,
    filters
  ){
    var rowId = text(
      row._globalPeriodoId ||
      rowPeriodId(row)
    );

    var rowLabel = text(
      row._globalPeriodoLabel ||
      rowPeriodLabel(row)
    );

    var from = text(
      filters.periodoDesde ||
      filters.desde ||
      filters.periodFrom ||
      ""
    );

    var to = text(
      filters.periodoHasta ||
      filters.hasta ||
      filters.periodTo ||
      ""
    );

    var single = text(
      filters.periodo ||
      filters.periodoId ||
      filters.periodId ||
      ""
    );

    if(
      single &&
      !samePeriod(
        rowId || rowLabel,
        single
      )
    ){
      return false;
    }

    var comparable =
      rowId || rowLabel;

    if(
      from &&
      text(comparable)
        .localeCompare(
          text(from),
          "es"
        ) < 0
    ){
      return false;
    }

    if(
      to &&
      text(comparable)
        .localeCompare(
          text(to),
          "es"
        ) > 0
    ){
      return false;
    }

    return true;
  }

  function cellStatus(value){
    var normalized =
      norm(value);

    if(
      [
        "cumple",
        "aprobado",
        "aprobada",
        "si",
        "sí",
        "ok"
      ].indexOf(
        normalized
      ) >= 0
    ){
      return {
        id:
          "cumple",

        label:
          "Cumple",

        cumple:
          true,

        pendiente:
          false,

        noCumple:
          false
      };
    }

    if(
      [
        "no cumple",
        "nocumple",
        "no aprobado",
        "reprobado",
        "reprobada"
      ].indexOf(
        normalized
      ) >= 0
    ){
      return {
        id:
          "no_cumple",

        label:
          "No cumple",

        cumple:
          false,

        pendiente:
          false,

        noCumple:
          true
      };
    }

    return {
      id:
        "pendiente",

      label:
        "Pendiente",

      cumple:
        false,

      pendiente:
        true,

      noCumple:
        false
    };
  }

  function studentCompliance(
    row,
    catalog
  ){
    var result = {
      cumple:
        0,

      pendiente:
        0,

      noCumple:
        0,

      total:
        0,

      aprobado:
        false
    };

    array(
      catalog
    ).forEach(function(requirement){
      var id =
        requirement.id ||
        requirement.key;

      var value =
        requirementValue(
          row,
          id
        );

      var statusValue =
        cellStatus(value);

      if(text(value) === ""){
        return;
      }

      result.total += 1;

      if(statusValue.cumple){
        result.cumple += 1;
      }else if(statusValue.noCumple){
        result.noCumple += 1;
      }else{
        result.pendiente += 1;
      }
    });

    result.aprobado =
      result.total > 0 &&
      result.cumple ===
      result.total;

    return result;
  }

  function graduateIdentity(row){
    var period =
      row._globalPeriodoId ||
      row._globalPeriodoLabel ||
      rowPeriodId(row) ||
      rowPeriodLabel(row);

    var identity =
      row._globalCedula ||
      cedula(row) ||
      row.id;

    return (
      text(period) +
      "__" +
      text(identity)
    );
  }

  function uniqueGraduates(rows){
    var settings =
      graduationConfig();

    var seen =
      Object.create(null);

    return array(
      rows
    ).filter(function(row){
      if(!isGraduate(row)){
        return false;
      }

      if(
        !settings
          .contarUnicoPorPeriodo
      ){
        return true;
      }

      var id =
        graduateIdentity(row);

      if(seen[id]){
        return false;
      }

      seen[id] =
        true;

      return true;
    });
  }

  function groupCount(
    list,
    getter
  ){
    var map =
      Object.create(null);

    array(
      list
    ).forEach(function(item){
      var value =
        text(
          getter(item)
        ) ||
        "SIN DATO";

      if(!map[value]){
        map[value] = {
          id:
            value,

          label:
            value,

          total:
            0
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
          b.total -
          a.total ||
          a.label.localeCompare(
            b.label,
            "es",
            {
              sensitivity:
                "base"
            }
          )
        );
      });
  }

  function groupGraduatesByPeriod(rows){
    return groupCount(
      uniqueGraduates(rows),
      function(row){
        return (
          row._globalPeriodoLabel ||
          row._globalPeriodoId
        );
      }
    ).map(function(item){
      return {
        periodo:
          item.label,

        periodoId:
          item.id,

        label:
          item.label,

        total:
          item.total,

        graduados:
          item.total
      };
    });
  }

  function uniqueCount(
    list,
    getter
  ){
    var map =
      Object.create(null);

    array(
      list
    ).forEach(function(item){
      var value =
        text(
          getter(item)
        );

      if(value){
        map[value] =
          true;
      }
    });

    return Object.keys(map)
      .length;
  }

  function buildData(
    rows,
    snapshot,
    filters,
    catalog
  ){
    rows =
      array(rows);

    catalog =
      array(catalog);

    var totals =
      rows.reduce(
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
            result
              .estudiantesCumplen += 1;
          }

          return result;
        },
        {
          cumple:
            0,

          pendiente:
            0,

          noCumple:
            0,

          total:
            0,

          estudiantesCumplen:
            0
        }
      );

    var graduates =
      uniqueGraduates(rows);

    var byGraduatePeriod =
      groupGraduatesByPeriod(
        graduates
      );

    var graduateSettings =
      graduationConfig();

    return {
      ok:
        true,

      source:
        "GlobalCore",

      filters:
        clone(
          filters || {}
        ),

      snapshotMeta:
        clone(
          snapshot.meta ||
          {}
        ),

      resumen: {
        totalEstudiantes:
          rows.length,

        totalCarreras:
          uniqueCount(
            rows,
            function(row){
              return (
                row._globalCodigoCarrera ||
                row._globalCarrera
              );
            }
          ),

        totalPeriodos:
          uniqueCount(
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
          totals.total
            ? Math.round(
                (
                  totals.cumple /
                  totals.total
                ) * 100
              )
            : 0,

        estudiantesCumplen:
          totals.estudiantesCumplen,

        totalGraduados:
          graduates.length,

        activos:
          rows.filter(
            function(row){
              return (
                row._globalEstadoMatricula !==
                "RETIRADO"
              );
            }
          ).length,

        retirados:
          rows.filter(
            function(row){
              return (
                row._globalEstadoMatricula ===
                "RETIRADO"
              );
            }
          ).length
      },

      students:
        rows,

      graduates:
        graduates,

      graduados: {
        campo:
          graduateSettings.campo,

        valorEsperado:
          graduateSettings
            .valorEsperado,

        total:
          graduates.length,

        estudiantes:
          graduates,

        porPeriodo:
          byGraduatePeriod
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
          snapshot
            .requirementCatalog
      },

      groups: {
        byPeriodo:
          groupCount(
            rows,
            function(row){
              return (
                row._globalPeriodoLabel ||
                row._globalPeriodoId
              );
            }
          ),

        byCarrera:
          groupCount(
            rows,
            function(row){
              return row
                ._globalCarrera;
            }
          ),

        byTipoCarrera:
          groupCount(
            rows,
            function(row){
              return row
                ._globalTipoCarrera;
            }
          ),

        byEstadoMatricula:
          groupCount(
            rows,
            function(row){
              return row
                ._globalEstadoMatricula;
            }
          ),

        byPeriodoGraduados:
          byGraduatePeriod
      },

      generatedAt:
        new Date()
          .toISOString()
    };
  }

  function applyFilters(filters){
    filters =
      filters || {};

    var snapshot =
      state.snapshot ||
      normalizeSnapshot(
        fallbackSnapshot()
      );

    var career =
      text(
        filters.carrera
      );

    var requirement =
      text(
        filters.requisito
      );

    var type =
      text(
        filters.tipoCarrera
      ).toUpperCase();

    var division =
      text(
        filters.division
      );

    var catalog =
      requirement
        ? snapshot
            .requirementCatalog
            .filter(function(item){
              return (
                item.id === requirement ||
                item.key === requirement
              );
            })
        : snapshot
            .requirementCatalog;

    var rows =
      snapshot.students
        .filter(function(row){
          if(
            !insidePeriodRange(
              row,
              filters
            )
          ){
            return false;
          }

          if(
            career &&
            row._globalCodigoCarrera !==
              career &&
            row._globalCarrera !==
              career
          ){
            return false;
          }

          if(
            type &&
            row._globalTipoCarrera !==
              type
          ){
            return false;
          }

          if(
            division &&
            key(
              row._globalDivision
            ) !==
            key(division)
          ){
            return false;
          }

          if(
            requirement &&
            text(
              requirementValue(
                row,
                requirement
              )
            ) === ""
          ){
            return false;
          }

          return true;
        })
        .map(function(row){
          var copy =
            Object.assign(
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

    state.lastData =
      buildData(
        rows,
        snapshot,
        filters,
        catalog
      );

    return state.lastData;
  }

  function getFilterOptions(){
    var snapshot =
      state.snapshot ||
      normalizeSnapshot(
        fallbackSnapshot()
      );

    var divisions =
      Object.create(null);

    snapshot.students
      .forEach(function(row){
        var division =
          text(
            row._globalDivision ||
            divisionName(row)
          );

        if(division){
          divisions[
            key(division)
          ] = division;
        }
      });

    return {
      periods:
        snapshot.periods
          .slice(),

      careers:
        snapshot.careers
          .slice(),

      divisions:
        Object.keys(
          divisions
        )
          .map(function(id){
            return {
              id:
                id,

              value:
                divisions[id],

              label:
                divisions[id],

              nombre:
                divisions[id]
            };
          })
          .sort(function(a, b){
            return a.label
              .localeCompare(
                b.label,
                "es",
                {
                  sensitivity:
                    "base"
                }
              );
          }),

      requirements:
        snapshot
          .requirementCatalog
          .slice(),

      tiposCarrera:
        (
          config.filtros &&
          config.filtros
            .tiposCarrera
        ) || []
    };
  }

  function invalidate(){
    state.snapshot =
      null;

    state.lastFilters =
      null;

    state.lastData =
      null;

    state.ready =
      false;

    return true;
  }

  function status(){
    var snapshot =
      state.snapshot ||
      {
        periods:
          [],

        students:
          [],

        careers:
          [],

        requirementCatalog:
          []
      };

    return {
      ok:
        state.errors.length === 0,

      ready:
        state.ready,

      version:
        VERSION,

      periods:
        array(
          snapshot.periods
        ).length,

      students:
        array(
          snapshot.students
        ).length,

      careers:
        array(
          snapshot.careers
        ).length,

      requirements:
        array(
          snapshot
            .requirementCatalog
        ).length,

      errors:
        state.errors.slice(-10),

      updatedAt:
        new Date()
          .toISOString()
    };
  }

  window.GlobalCore = {
    version:
      VERSION,

    ready:
      ready,

    refresh:
      refresh,

    invalidate:
      invalidate,

    status:
      status,

    getSnapshot:
      function(){
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
        normalizeStudent,

      hydrateStudents:
        hydrateStudents
    }
  };

  ready({
    force: false
  });
})(window, document);