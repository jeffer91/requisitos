/* =========================================================
Nombre completo: cone.index.js
Ruta o ubicación: /Requisitos/BDLocal/conexiones/cone.index.js
Función o funciones:
- Ser el único orquestador de carga y refresco de la caché compartida.
- Evitar refrescos completos duplicados o simultáneos.
- Agrupar refrescos ligeros solicitados en un intervalo corto.
- Actualizar únicamente un período cuando la modificación lo permite.
- Cargar el núcleo BL2 y los componentes mínimos del modelo V2.
- Leer estudiantes primero desde matriculas_periodo y personas.
- Leer requisitos primero desde requisitos_estudiante.
- Mantener BL2Core como respaldo de compatibilidad.
- Exponer métricas básicas para diagnóstico de reprocesos.
Con qué se conecta:
- conexiones/cone.utils.js.
- BL2Core, BDLocal y adaptadores de compatibilidad.
- repositories/bdl.repo.*.js.
- services/bdl.service.estudiantes.js.
- conexiones/cone.carga.js, cone.tabla.js, cone.ficha.js,
  cone.stats.js, cone.coordi.js, cone.reportes.js,
  cone.defensas.js y cone.global.js.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION =
    "1.5.0-v2-source-first";

  var U =
    window.BDLocalConUtils;

  if(!U){
    return;
  }

  var base =
    document.currentScript &&
    document.currentScript.src
      ? document.currentScript.src
      : window.location.href;

  var state = {
    connectors:
      Object.create(null),

    errors: [],

    ready: false,
    loading: null,

    refreshTimer: null,
    refreshPromise: null,
    refreshResolver: null,

    pendingLightOptions: null,

    refreshSerial:
      Promise.resolve(),

    inFlight:
      Object.create(null),

    lastCompleted:
      Object.create(null),

    lastRefreshMode: "",
    lastRefreshKey: "",

    metrics: {
      requested: 0,
      executed: 0,
      coalesced: 0,
      cooldownSkipped: 0,
      lightExecuted: 0,
      fullExecuted: 0,
      incrementalExecuted: 0,
      failures: 0
    }
  };

  function src(file){
    try{
      return new URL(
        file,
        base
      ).href;
    }catch(error){
      return file;
    }
  }

  function add(file){
    return new Promise(function(resolve){
      var url =
        src(file);

      var exists =
        Array.prototype
          .slice.call(
            document.scripts || []
          )
          .some(function(script){
            return (
              script.src === url ||
              script.getAttribute(
                "data-bdl-con-src"
              ) === url
            );
          });

      if(exists){
        resolve(url);
        return;
      }

      var script =
        document.createElement(
          "script"
        );

      script.src = url;
      script.async = false;
      script.defer = false;

      script.setAttribute(
        "data-bdl-con-src",
        url
      );

      script.onload = function(){
        resolve(url);
      };

      script.onerror = function(){
        state.errors.push({
          file: file,
          message:
            "No se pudo cargar el script.",
          at:
            U.nowISO()
        });

        resolve(url);
      };

      document.head.appendChild(
        script
      );
    });
  }

  function seq(files){
    var chain =
      Promise.resolve();

    files.forEach(function(file){
      chain = chain.then(function(){
        return add(file);
      });
    });

    return chain;
  }

  function register(name,api){
    name =
      U.text(name);

    if(
      !name ||
      !api
    ){
      return false;
    }

    state.connectors[name] =
      api;

    window.BDLocalConexiones[name] =
      api;

    return true;
  }

  function get(name){
    return (
      state.connectors[
        U.text(name)
      ] ||
      null
    );
  }

  function needsConfigV2(){
    var cfg =
      window.BL2Config || {};

    var stores =
      cfg.stores || {};

    return (
      !window.BL2Config ||
      Number(
        cfg.dbVersion || 1
      ) < 2 ||
      !stores.matriculasPeriodo ||
      !stores.requisitosEstudiante ||
      !stores.cambiosPendientes
    );
  }

  function ensureCoreScripts(){
    var files = [];

    /*
     * Configuración y base.
     * bl2.config.v2.js debe cargarse antes de abrir BL2DB.
     */
    if(!window.BL2Config){
      files.push(
        "../bl2.config.js"
      );
    }

    if(
      !window.BL2DB &&
      needsConfigV2()
    ){
      files.push(
        "../bl2.config.v2.js"
      );
    }

    if(!window.BL2DB){
      files.push(
        "../bl2.db.js"
      );
    }

    /*
     * Repositorios mínimos requeridos para que el refresco
     * consulte las tablas V2 incluso cuando cone.index.js
     * se carga desde una pantalla o iframe.
     */
    if(!window.BDLRepositories){
      files.push(
        "../repositories/bdl.repo.index.js"
      );
    }

    if(!window.BDLRepoEstudiantesV2){
      files.push(
        "../repositories/bdl.repo.estudiantes.js"
      );
    }

    if(!window.BDLRepoPersonas){
      files.push(
        "../repositories/bdl.repo.personas.js"
      );
    }

    /*
     * Contactos de estudiantes.
     * Debe cargarse antes de bdl.service.estudiantes.js para que
     * el servicio pueda hidratar celular, correo y Telegram.
     */
    if(!window.BDLRepoContactos){
      files.push(
        "../repositories/bdl.repo.contactos.js"
      );
    }

    if(!window.BDLRepoMatriculas){
      files.push(
        "../repositories/bdl.repo.matriculas.js"
      );
    }

    if(!window.BDLRepoRequisitos){
      files.push(
        "../repositories/bdl.repo.requisitos.js"
      );
    }
    /*
     * Puentes de escritura.
     */
    if(!window.BDLOutboxBridge){
      files.push(
        "../patches/bdl.changes.outbox-bridge.js"
      );
    }

    if(!window.BDLV2Mirror){
      files.push(
        "../patches/bdl.v2.mirror.js"
      );
    }

    /*
     * Núcleo legacy compatible.
     */
    if(!window.BL2Backup){
      files.push(
        "../bl2.backup.js"
      );
    }

    if(!window.BL2Import){
      files.push(
        "../bl2.import.js"
      );
    }

    if(!window.BL2Sync){
      files.push(
        "../bl2.sync.js"
      );
    }

    if(!window.BL2Core){
      files.push(
        "../bl2.core.js"
      );
    }

    if(
      !window.BDLocal ||
      !window.BL2DataEngine ||
      !window.ExcelLocalRepo
    ){
      files.push(
        "../bl2.compat.js"
      );
    }

    /*
     * Servicio V2 de estudiantes.
     * Se carga después de repositorios y núcleo.
     */
    if(!window.BDLServices){
      files.push(
        "../services/bdl.service.index.js"
      );
    }

    if(!window.BDLServiceEstudiantes){
      files.push(
        "../services/bdl.service.estudiantes.js"
      );
    }

    return seq(files);
  }

  function ensureCoreReady(){
    return ensureCoreScripts()
      .then(function(){
        var core =
          window.BL2Core || null;

        var bdlocal =
          window.BDLocal || null;

        if(
          window.BL2DB &&
          window.BL2Config &&
          Number(
            window.BL2Config.dbVersion || 1
          ) < 2
        ){
          state.errors.push({
            file:
              "../bl2.config.v2.js",

            message:
              "BL2DB ya estaba cargado antes de aplicar configuración V2.",

            at:
              U.nowISO()
          });
        }

        if(
          window.BDLOutboxBridge &&
          typeof window.BDLOutboxBridge
            .install === "function"
        ){
          try{
            window.BDLOutboxBridge
              .install();
          }catch(error){}
        }

        if(
          window.BDLV2Mirror &&
          typeof window.BDLV2Mirror
            .install === "function"
        ){
          try{
            window.BDLV2Mirror
              .install();
          }catch(error2){}
        }

        if(
          bdlocal &&
          typeof bdlocal.ready ===
            "function"
        ){
          return bdlocal.ready()
            .then(function(){
              return core || bdlocal;
            })
            .catch(function(error3){
              state.errors.push({
                file:
                  "bl2.compat.js",

                message:
                  error3 &&
                  error3.message
                    ? error3.message
                    : String(error3),

                at:
                  U.nowISO()
              });

              return core || bdlocal;
            });
        }

        if(
          core &&
          typeof core.getState ===
            "function"
        ){
          try{
            var coreState =
              core.getState() || {};

            if(coreState.initialized){
              return core;
            }
          }catch(error4){}
        }

        if(
          core &&
          typeof core.init ===
            "function"
        ){
          return core.init()
            .then(function(){
              return core;
            })
            .catch(function(error5){
              state.errors.push({
                file:
                  "bl2.core.js",

                message:
                  error5 &&
                  error5.message
                    ? error5.message
                    : String(error5),

                at:
                  U.nowISO()
              });

              return core;
            });
        }

        return (
          core ||
          bdlocal ||
          null
        );
      });
  }

  function hasRows(value){
    return (
      Array.isArray(value) &&
      value.length > 0
    );
  }

  function periodIdOf(row){
    row = row || {};

    return U.canonicalPeriodId(
      row.periodoCanonicoId ||
      row.periodoId ||
      row.periodId ||
      row.ultimoPeriodoId ||
      row._periodoId ||
      ""
    );
  }

  function refreshMode(
    options,
    existing
  ){
    options = options || {};
    existing =
      existing || U.readCache();

    if(
      options.full === true ||
      options.mode === "full"
    ){
      return "full";
    }

    if(
      options.periodsOnly === true ||
      options.light === true ||
      options.mode === "light"
    ){
      return "light";
    }

    if(
      hasRows(
        existing.students
      )
    ){
      return "light";
    }

    return "full";
  }

  function refreshKey(
    mode,
    options
  ){
    options = options || {};

    var periodoId =
      U.canonicalPeriodId(
        options.periodoId ||
        options.periodId ||
        ""
      );

    if(mode === "light"){
      return "light:periods";
    }

    return (
      periodoId &&
      options.incremental !== false
    )
      ? "full:period:" + periodoId
      : "full:all";
  }

  function preferFresh(
    fresh,
    existing,
    allowEmpty
  ){
    fresh =
      Array.isArray(fresh)
        ? fresh
        : [];

    existing =
      Array.isArray(existing)
        ? existing
        : [];

    if(
      fresh.length ||
      allowEmpty === true ||
      !existing.length
    ){
      return fresh;
    }

    return existing;
  }

  function replacePeriodRows(
    existing,
    fresh,
    periodoId
  ){
    existing =
      Array.isArray(existing)
        ? existing
        : [];

    fresh =
      Array.isArray(fresh)
        ? fresh
        : [];

    periodoId =
      U.canonicalPeriodId(
        periodoId || ""
      );

    if(!periodoId){
      return fresh;
    }

    return existing
      .filter(function(row){
        return !U.samePeriod(
          periodIdOf(row),
          periodoId
        );
      })
      .concat(fresh);
  }

  function writeCachePayload(
    mode,
    existing,
    periods,
    students,
    requirements,
    source,
    options
  ){
    existing =
      existing || U.emptyCache();

    options = options || {};

    var allowEmpty =
      options.allowEmpty === true ||
      options.changed === true;

    var payload = {
      meta: {
        app:
          "Requisitos",

        module:
          "BDLocalConexiones",

        version:
          VERSION,

        source:
          source || "cone.index",

        refreshMode:
          mode,

        refreshKey:
          refreshKey(
            mode,
            options
          ),

        updatedAt:
          U.nowISO(),

        schemaVersion:
          window.BL2Config &&
          window.BL2Config.schemaVersion ||
          "",

        storageMode:
          "shared-frame-cache",

        incremental:
          options.incrementalApplied ===
          true,

        periodoId:
          U.canonicalPeriodId(
            options.periodoId ||
            options.periodId ||
            ""
          ),

        studentSource:
          options.studentSource ||
          "",

        requirementSource:
          options.requirementSource ||
          ""
      },

      periods:
        preferFresh(
          periods,
          existing.periods,
          allowEmpty
        ),

      students:
        preferFresh(
          students,
          existing.students,
          allowEmpty
        ),

      requirements:
        preferFresh(
          requirements,
          existing.requirements,
          allowEmpty
        ),

      summaries:
        existing.summaries || {},

      diagnostics:
        state.errors.slice()
    };

    state.lastRefreshMode =
      mode;

    state.lastRefreshKey =
      payload.meta.refreshKey;

    return U.writeCache(
      payload,
      {
        source:
          source || "cone.index",

        allowEmpty:
          allowEmpty
      }
    );
  }

  function performLightRefresh(
    core,
    existing,
    options
  ){
    var periodPromise =
      typeof core.getPeriods ===
        "function"
        ? core.getPeriods()
          .catch(function(error){
            state.errors.push({
              file:
                "BL2Core.getPeriods",

              message:
                error &&
                error.message
                  ? error.message
                  : String(error),

              at:
                U.nowISO()
            });

            return (
              existing.periods || []
            );
          })

        : Promise.resolve(
          existing.periods || []
        );

    return periodPromise
      .then(function(periods){
        state.metrics
          .lightExecuted += 1;

        return writeCachePayload(
          "light",
          existing,
          periods,
          existing.students || [],
          existing.requirements || [],
          options.source ||
            "cone.index.light",
          options
        );
      });
  }

  function currentStudentService(){
    if(
      window.BDLServiceEstudiantes &&
      typeof window.BDLServiceEstudiantes
        .list === "function"
    ){
      return (
        window.BDLServiceEstudiantes
      );
    }

    if(
      window.BDLServices &&
      typeof window.BDLServices
        .get === "function"
    ){
      var registered =
        window.BDLServices.get(
          "estudiantes"
        );

      if(
        registered &&
        typeof registered.list ===
          "function"
      ){
        return registered;
      }
    }

    return null;
  }

  function currentRequirementRepo(){
    if(
      window.BDLRepoRequisitos &&
      typeof window.BDLRepoRequisitos
        .list === "function"
    ){
      return (
        window.BDLRepoRequisitos
      );
    }

    if(
      window.BDLRepositories &&
      typeof window.BDLRepositories
        .get === "function"
    ){
      var registered =
        window.BDLRepositories.get(
          "requisitos"
        );

      if(
        registered &&
        typeof registered.list ===
          "function"
      ){
        return registered;
      }
    }

    return null;
  }

  function readStudents(
    core,
    options
  ){
    options = options || {};

    var service =
      currentStudentService();

    if(service){
      return Promise.resolve()
        .then(function(){
          return service.list(
            options
          );
        })
        .then(function(rows){
          return {
            rows:
              Array.isArray(rows)
                ? rows
                : [],

            source:
              "BDLServiceEstudiantes"
          };
        });
    }

    if(
      core &&
      typeof core.getStudents ===
        "function"
    ){
      return Promise.resolve()
        .then(function(){
          return core.getStudents(
            options
          );
        })
        .then(function(rows){
          return {
            rows:
              Array.isArray(rows)
                ? rows
                : [],

            source:
              "BL2Core.getStudents"
          };
        });
    }

    return Promise.resolve({
      rows: [],
      source:
        "sin-lector-estudiantes"
    });
  }

  function readRequirements(
    core,
    options
  ){
    options = options || {};

    var repository =
      currentRequirementRepo();

    if(repository){
      return Promise.resolve()
        .then(function(){
          return repository.list(
            options
          );
        })
        .then(function(rows){
          return {
            rows:
              Array.isArray(rows)
                ? rows
                : [],

            source:
              "BDLRepoRequisitos"
          };
        });
    }

    if(
      core &&
      typeof core.getRequirements ===
        "function"
    ){
      return Promise.resolve()
        .then(function(){
          return core.getRequirements(
            options
          );
        })
        .then(function(rows){
          return {
            rows:
              Array.isArray(rows)
                ? rows
                : [],

            source:
              "BL2Core.getRequirements"
          };
        });
    }

    return Promise.resolve({
      rows: [],
      source:
        "sin-lector-requisitos"
    });
  }

  function performFullRefresh(
    core,
    existing,
    options
  ){
    var periodoId =
      U.canonicalPeriodId(
        options.periodoId ||
        options.periodId ||
        ""
      );

    var incremental =
      !!periodoId &&
      options.incremental !== false &&
      hasRows(
        existing.students
      );

    var periodPromise =
      typeof core.getPeriods ===
        "function"
        ? core.getPeriods()
          .catch(function(error){
            state.errors.push({
              file:
                "BL2Core.getPeriods",

              message:
                error &&
                error.message
                  ? error.message
                  : String(error),

              at:
                U.nowISO()
            });

            return (
              existing.periods || []
            );
          })

        : Promise.resolve(
          existing.periods || []
        );

    var studentOptions = {
      matricula: ""
    };

    var requirementOptions = {};

    if(incremental){
      studentOptions.periodoId =
        periodoId;

      requirementOptions.periodoId =
        periodoId;
    }

    var studentPromise =
      readStudents(
        core,
        studentOptions
      )
        .catch(function(error){
          state.errors.push({
            file:
              currentStudentService()
                ? "BDLServiceEstudiantes.list"
                : "BL2Core.getStudents",

            message:
              error &&
              error.message
                ? error.message
                : String(error),

            at:
              U.nowISO()
          });

          return {
            rows:
              incremental
                ? []
                : existing.students || [],

            source:
              "error-estudiantes"
          };
        });

    var requirementPromise =
      readRequirements(
        core,
        requirementOptions
      )
        .catch(function(error2){
          state.errors.push({
            file:
              currentRequirementRepo()
                ? "BDLRepoRequisitos.list"
                : "BL2Core.getRequirements",

            message:
              error2 &&
              error2.message
                ? error2.message
                : String(error2),

            at:
              U.nowISO()
          });

          return {
            rows:
              incremental
                ? []
                : existing.requirements || [],

            source:
              "error-requisitos"
          };
        });

    return Promise.all([
      periodPromise,
      studentPromise,
      requirementPromise
    ]).then(function(result){
      var studentResult =
        result[1] || {};

      var requirementResult =
        result[2] || {};

      var students =
        Array.isArray(
          studentResult.rows
        )
          ? studentResult.rows
          : [];

      var requirements =
        Array.isArray(
          requirementResult.rows
        )
          ? requirementResult.rows
          : [];

      if(incremental){
        students =
          replacePeriodRows(
            existing.students,
            students,
            periodoId
          );

        requirements =
          replacePeriodRows(
            existing.requirements,
            requirements,
            periodoId
          );

        state.metrics
          .incrementalExecuted += 1;
      }

      state.metrics
        .fullExecuted += 1;

      return writeCachePayload(
        "full",
        existing,
        result[0] || [],
        students,
        requirements,
        options.source ||
          "cone.index.full",
        Object.assign(
          {},
          options,
          {
            incrementalApplied:
              incremental,

            allowEmpty:
              options.allowEmpty === true ||
              options.changed === true,

            studentSource:
              studentResult.source || "",

            requirementSource:
              requirementResult.source || ""
          }
        )
      );
    });
  }

  function performRefresh(options){
    options =
      Object.assign(
        {},
        options || {}
      );

    var existing =
      U.readCache();

    return ensureCoreReady()
      .then(function(core){
        core =
          window.BL2Core || core;

        if(!core){
          return existing;
        }

        var mode =
          refreshMode(
            options,
            existing
          );

        state.metrics
          .executed += 1;

        if(mode === "light"){
          return performLightRefresh(
            core,
            existing,
            options
          );
        }

        return performFullRefresh(
          core,
          existing,
          options
        );
      })
      .catch(function(error){
        state.metrics
          .failures += 1;

        state.errors.push({
          file:
            "cone.index.js",

          message:
            error &&
            error.message
              ? error.message
              : String(error),

          at:
            U.nowISO()
        });

        return existing;
      });
  }

  function firstActiveFull(){
    var keys =
      Object.keys(
        state.inFlight
      );

    for(
      var i = 0;
      i < keys.length;
      i += 1
    ){
      if(
        keys[i].indexOf(
          "full:"
        ) === 0 &&
        state.inFlight[
          keys[i]
        ]
      ){
        return state.inFlight[
          keys[i]
        ];
      }
    }

    return null;
  }

  function resolvePendingLightWith(
    promise
  ){
    if(state.refreshTimer){
      window.clearTimeout(
        state.refreshTimer
      );

      state.refreshTimer = null;
    }

    if(!state.refreshPromise){
      return;
    }

    var resolver =
      state.refreshResolver;

    state.refreshResolver = null;
    state.pendingLightOptions = null;

    promise
      .then(function(result){
        state.refreshPromise = null;

        if(
          typeof resolver ===
          "function"
        ){
          resolver(
            result ||
            U.readCache()
          );
        }
      })
      .catch(function(){
        state.refreshPromise = null;

        if(
          typeof resolver ===
          "function"
        ){
          resolver(
            U.readCache()
          );
        }
      });
  }

  function enqueueRefresh(options){
    options =
      Object.assign(
        {},
        options || {}
      );

    var existing =
      U.readCache();

    var mode =
      refreshMode(
        options,
        existing
      );

    var key =
      refreshKey(
        mode,
        options
      );

    var activeFull =
      firstActiveFull();

    state.metrics
      .requested += 1;

    if(state.inFlight[key]){
      state.metrics
        .coalesced += 1;

      return state.inFlight[key];
    }

    if(
      mode === "light" &&
      activeFull
    ){
      state.metrics
        .coalesced += 1;

      return activeFull;
    }

    if(
      mode === "full" &&
      key !== "full:all" &&
      state.inFlight["full:all"]
    ){
      state.metrics
        .coalesced += 1;

      return state.inFlight[
        "full:all"
      ];
    }

    var cooldown =
      Math.max(
        0,
        Number(
          options.cooldown || 700
        )
      );

    var lastAt =
      Number(
        state.lastCompleted[key] ||
        0
      );

    var canSkip =
      options.force !== true &&
      options.changed !== true &&
      Date.now() - lastAt <
        cooldown;

    if(canSkip){
      state.metrics
        .cooldownSkipped += 1;

      return Promise.resolve(
        U.readCache()
      );
    }

    var operation =
      state.refreshSerial
        .catch(function(){
          return null;
        })
        .then(function(){
          return performRefresh(
            options
          );
        });

    state.refreshSerial =
      operation.catch(function(){
        return null;
      });

    state.inFlight[key] =
      operation;

    operation
      .then(function(){
        delete state.inFlight[key];

        state.lastCompleted[key] =
          Date.now();
      })
      .catch(function(){
        delete state.inFlight[key];

        state.lastCompleted[key] =
          Date.now();
      });

    if(mode === "full"){
      resolvePendingLightWith(
        operation
      );
    }

    return operation;
  }

  function mergeLightOptions(
    current,
    next
  ){
    current =
      Object.assign(
        {},
        current || {}
      );

    next =
      Object.assign(
        {},
        next || {}
      );

    return Object.assign(
      {},
      current,
      next,
      {
        light: true,
        full: false,
        mode: "light",

        source:
          next.source ||
          current.source ||
          "cone.index.light-grouped"
      }
    );
  }

  function refreshCache(options){
    options =
      Object.assign(
        {},
        options || {}
      );

    var existing =
      U.readCache();

    var mode =
      refreshMode(
        options,
        existing
      );

    if(mode === "full"){
      return enqueueRefresh(
        Object.assign(
          {},
          options,
          {
            mode: "full",
            full: true
          }
        )
      );
    }

    if(
      options.immediate === true ||
      options.force === true
    ){
      return enqueueRefresh(
        Object.assign(
          {},
          options,
          {
            mode: "light",
            light: true
          }
        )
      );
    }

    state.pendingLightOptions =
      mergeLightOptions(
        state.pendingLightOptions,
        options
      );

    if(state.refreshTimer){
      window.clearTimeout(
        state.refreshTimer
      );

      state.refreshTimer = null;
    }

    if(!state.refreshPromise){
      state.refreshPromise =
        new Promise(function(resolve){
          state.refreshResolver =
            resolve;
        });
    }

    state.refreshTimer =
      window.setTimeout(
        function(){
          var grouped =
            state.pendingLightOptions ||
            {
              light: true,
              mode: "light"
            };

          var resolver =
            state.refreshResolver;

          state.refreshTimer = null;
          state.refreshResolver = null;
          state.pendingLightOptions = null;

          enqueueRefresh(grouped)
            .then(function(result){
              var output =
                result ||
                U.readCache();

              state.refreshPromise = null;

              if(
                typeof resolver ===
                "function"
              ){
                resolver(output);
              }
            })
            .catch(function(){
              state.refreshPromise = null;

              if(
                typeof resolver ===
                "function"
              ){
                resolver(
                  U.readCache()
                );
              }
            });
        },

        Math.max(
          20,
          Number(
            options.delay || 90
          )
        )
      );

    return state.refreshPromise;
  }

  function loadConnectors(){
    return seq([
      "cone.carga.js",
      "cone.tabla.js",
      "cone.ficha.js",
      "cone.stats.js",
      "cone.coordi.js",
      "cone.reportes.js",
      "cone.defensas.js",
      "cone.global.js",
      "cone.inpvc.js"
    ]);
  }

  function status(){
    var cache =
      U.readCache();

    return {
      ok:
        state.errors.length === 0,

      ready:
        state.ready,

      version:
        VERSION,

      connectors:
        Object.keys(
          state.connectors
        ),

      periods:
        cache.periods.length,

      students:
        cache.students.length,

      requirements:
        cache.requirements.length,

      refreshMode:
        state.lastRefreshMode ||
        (
          cache.meta &&
          cache.meta.refreshMode
        ) ||
        "",

      refreshKey:
        state.lastRefreshKey ||
        (
          cache.meta &&
          cache.meta.refreshKey
        ) ||
        "",

      studentSource:
        cache.meta &&
        cache.meta.studentSource ||
        "",

      requirementSource:
        cache.meta &&
        cache.meta.requirementSource ||
        "",

      refreshing:
        Object.keys(
          state.inFlight
        ),

      metrics:
        Object.assign(
          {},
          state.metrics
        ),

      outboxBridge:
        !!window.BDLOutboxBridge,

      v2Mirror:
        !!window.BDLV2Mirror,

      repositories:
        !!window.BDLRepositories,

      services:
        !!window.BDLServices,

      studentService:
        !!currentStudentService(),

      requirementRepo:
        !!currentRequirementRepo(),

      sharedCache:
        true,

      errors:
        state.errors.slice()
    };
  }

  function ready(options){
    options = options || {};

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

    var shared =
      typeof U.requestSharedCache ===
        "function"

        ? U.requestSharedCache({
          timeout:
            Number(
              options.sharedTimeout ||
              1800
            )
        }).catch(function(){
          return U.readCache();
        })

        : Promise.resolve(
          U.readCache()
        );

    state.loading =
      shared
        .then(function(cache){
          cache =
            cache || U.readCache();

          return refreshCache({
            source:
              "BDLocalConexiones.ready",

            mode:
              U.hasData(cache)
                ? "light"
                : "full",

            light:
              U.hasData(cache),

            full:
              !U.hasData(cache),

            immediate:
              true,

            cooldown:
              0
          });
        })
        .then(function(){
          return loadConnectors();
        })
        .then(function(){
          state.ready = true;

          return status();
        })
        .catch(function(error){
          state.errors.push({
            file:
              "cone.index.js",

            message:
              error &&
              error.message
                ? error.message
                : String(error),

            at:
              U.nowISO()
          });

          return status();
        })
        .then(function(result){
          state.loading = null;

          return result;
        });

    return state.loading;
  }

  window.BDLocalConexiones =
    window.BDLocalConexiones || {};

  Object.assign(
    window.BDLocalConexiones,
    {
      version:
        VERSION,

      ready:
        ready,

      ensureCoreReady:
        ensureCoreReady,

      refreshCache:
        refreshCache,

      register:
        register,

      get:
        get,

      status:
        status,

      metrics:
        function(){
          return Object.assign(
            {},
            state.metrics
          );
        },

      utils:
        U
    }
  );

  ready({
    force: false
  });
})(window,document);
