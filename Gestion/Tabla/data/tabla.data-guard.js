/* =========================================================
Nombre completo: tabla.data-guard.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/data/tabla.data-guard.js
Función o funciones:
- Conservar la última caché válida ante vacíos temporales de BDLocal.
- Aceptar vacíos únicamente cuando un borrado fue confirmado.
- Instalar adaptadores de emergencia sin reemplazar conectores oficiales.
- Agrupar eventos de Base Local y solicitar una sola actualización de Tabla.
Con qué se conecta:
- tabla.constants.js, tabla.utils.js y tabla.events.js.
- tabla.data-source.js y tabla.data-normalizer.js.
- BDLocalConUtils, BDLocalScreenDeps, ConTabla y BDLocalTabla.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0";

  var FALLBACK_SOURCE =
    "TablaDataGuardFallback";

  var EMPTY_CONFIRM_TTL =
    10000;

  var C =
    window.TablaConstants ||
    {};

  var U =
    window.TablaUtils ||
    {};

  var E =
    window.TablaEvents ||
    null;

  var N =
    window.TablaDataNormalizer ||
    {};

  var S =
    window.TablaDataSource ||
    null;

  function text(value){
    return U.text
      ? U.text(value)
      : String(
          value == null
            ? ""
            : value
        ).trim();
  }

  function normalizeKey(value){
    return U.normalizeKey
      ? U.normalizeKey(value)
      : text(value)
          .toLowerCase()
          .replace(
            /[^a-z0-9]+/g,
            ""
          );
  }

  function emptyEnvelope(){
    return {
      meta: {
        source:
          "tabla-data-guard",

        updatedAt:
          ""
      },

      periods:
        [],

      students:
        [],

      requirements:
        [],

      summaries:
        {},

      diagnostics:
        []
    };
  }

  function normalizeEnvelope(value){
    if(
      N &&
      typeof N.normalizeEnvelope ===
        "function"
    ){
      return N.normalizeEnvelope(
        value || {}
      );
    }

    value =
      value &&
      typeof value === "object"
        ? value
        : {};

    return {
      meta:
        value.meta &&
        typeof value.meta ===
          "object"
          ? Object.assign(
              {},
              value.meta
            )
          : {},

      periods:
        Array.isArray(
          value.periods
        )
          ? value
              .periods
              .slice()
          : [],

      students:
        Array.isArray(
          value.students
        )
          ? value
              .students
              .slice()
          : [],

      requirements:
        Array.isArray(
          value.requirements
        )
          ? value
              .requirements
              .slice()
          : [],

      summaries:
        value.summaries &&
        typeof value.summaries ===
          "object"
          ? Object.assign(
              {},
              value.summaries
            )
          : {},

      diagnostics:
        Array.isArray(
          value.diagnostics
        )
          ? value
              .diagnostics
              .slice()
          : []
    };
  }

  function hasData(envelope){
    envelope =
      envelope ||
      {};

    return !!(
      (
        Array.isArray(
          envelope.periods
        ) &&
        envelope.periods.length
      ) ||
      (
        Array.isArray(
          envelope.students
        ) &&
        envelope.students.length
      ) ||
      (
        Array.isArray(
          envelope.requirements
        ) &&
        envelope.requirements.length
      )
    );
  }

  function permissionTemplate(){
    return {
      periods:
        false,

      students:
        false,

      requirements:
        false,

      summaries:
        false,

      diagnostics:
        false
    };
  }

  function permissions(value){
    var output =
      permissionTemplate();

    function enableAll(){
      Object.keys(output)
        .forEach(function(key){
          output[key] = true;
        });
    }

    function enable(raw){
      var clean =
        normalizeKey(raw);

      if(!clean){
        return;
      }

      if(
        [
          "all",
          "todo",
          "todos",
          "true"
        ].indexOf(clean) >= 0
      ){
        enableAll();
      }

      if(
        clean.indexOf(
          "period"
        ) >= 0
      ){
        output.periods = true;
      }

      if(
        /student|estudiante|alumno/
          .test(clean)
      ){
        output.students = true;
      }

      if(
        /require|requisito/
          .test(clean)
      ){
        output.requirements = true;
      }

      if(
        /summar|resumen/
          .test(clean)
      ){
        output.summaries = true;
      }

      if(
        /diagnostic/
          .test(clean)
      ){
        output.diagnostics = true;
      }
    }

    if(value === true){
      enableAll();
    }else if(
      typeof value === "string"
    ){
      value
        .split(/[|,;\s]+/)
        .forEach(enable);
    }else if(
      Array.isArray(value)
    ){
      value.forEach(enable);
    }else if(
      value &&
      typeof value === "object"
    ){
      Object.keys(output)
        .forEach(function(key){
          output[key] =
            value[key] ===
            true;
        });

      if(value.all === true){
        enableAll();
      }
    }

    return output;
  }

  function mergePermissions(){
    var output =
      permissionTemplate();

    Array.prototype.slice
      .call(arguments)
      .forEach(function(value){
        var current =
          permissions(value);

        Object.keys(output)
          .forEach(function(key){
            output[key] =
              output[key] ||
              current[key];
          });
      });

    return output;
  }

  function anyPermission(value){
    return Object.keys(
      value || {}
    ).some(function(key){
      return (
        value[key] === true
      );
    });
  }

  function permissionsFromOperation(
    detail,
    eventName
  ){
    detail =
      detail &&
      typeof detail === "object"
        ? detail
        : {};

    var output =
      mergePermissions(
        detail.allowEmpty,
        detail.emptyAllowed,
        detail.confirmedEmpty,
        detail.emptyConfirmed,
        detail.deletedScopes,
        detail.scopes
      );

    var operation =
      normalizeKey(
        [
          eventName,
          detail.action,
          detail.operation,
          detail.type,
          detail.reason,
          detail.source,
          detail.entity,
          detail.collection,
          detail.table
        ].join(" ")
      );

    var deletion =
      detail.deletionConfirmed ===
        true ||
      detail.deleted ===
        true ||
      detail.cleared ===
        true ||
      detail.successfulDeletion ===
        true ||
      /delete|remove|clear|empty|truncate|borrar|eliminar|vaciar/
        .test(operation);

    if(
      detail.success === false ||
      detail.ok === false ||
      !deletion
    ){
      return output;
    }

    if(
      /period/
        .test(operation)
    ){
      output.periods = true;
      output.students = true;
      output.requirements = true;
      output.summaries = true;
    }

    if(
      /student|estudiante|alumno/
        .test(operation)
    ){
      output.students = true;
      output.summaries = true;
    }

    if(
      /require|requisito/
        .test(operation)
    ){
      output.requirements = true;
      output.summaries = true;
    }

    return anyPermission(output)
      ? output
      : permissions(true);
  }

  var lastGood =
    emptyEnvelope();

  var state = {
    installed:
      false,

    revision:
      0,

    captures:
      0,

    refreshes:
      0,

    preserved:
      0,

    lastEvent:
      "",

    lastError:
      "",

    lastPreserved:
      false,

    pendingEmpty:
      null,

    captureTimer:
      null,

    requestTimer:
      null,

    stopBase:
      null
  };

  function pendingPermissions(){
    if(!state.pendingEmpty){
      return permissionTemplate();
    }

    if(
      Date.now() >
      state.pendingEmpty.expiresAt
    ){
      state.pendingEmpty = null;
      return permissionTemplate();
    }

    return state
      .pendingEmpty
      .value;
  }

  function confirmEmpty(
    scopes,
    ttl
  ){
    var value =
      permissions(
        scopes == null
          ? true
          : scopes
      );

    state.pendingEmpty = {
      value: value,
      createdAt: Date.now(),

      expiresAt:
        Date.now() +
        Math.max(
          1000,
          Number(ttl) ||
          EMPTY_CONFIRM_TTL
        )
    };

    return Object.assign(
      {},
      value
    );
  }

  function mergeEnvelope(
    fresh,
    allowed
  ){
    fresh =
      normalizeEnvelope(
        fresh
      );

    allowed =
      mergePermissions(
        allowed,
        pendingPermissions()
      );

    var output = {
      meta:
        Object.assign(
          {},
          lastGood.meta ||
          {},
          fresh.meta ||
          {}
        ),

      periods:
        fresh.periods.length ||
        allowed.periods
          ? fresh.periods.slice()
          : lastGood
              .periods
              .slice(),

      students:
        fresh.students.length ||
        allowed.students
          ? fresh.students.slice()
          : lastGood
              .students
              .slice(),

      requirements:
        fresh.requirements.length ||
        allowed.requirements
          ? fresh
              .requirements
              .slice()
          : lastGood
              .requirements
              .slice(),

      summaries:
        Object.keys(
          fresh.summaries ||
          {}
        ).length ||
        allowed.summaries
          ? Object.assign(
              {},
              fresh.summaries ||
              {}
            )
          : Object.assign(
              {},
              lastGood.summaries ||
              {}
            ),

      diagnostics:
        fresh.diagnostics.length ||
        allowed.diagnostics
          ? fresh
              .diagnostics
              .slice()
          : lastGood
              .diagnostics
              .slice()
    };

    var preserved = (
      (
        !fresh.periods.length &&
        !allowed.periods &&
        lastGood.periods.length
      ) ||
      (
        !fresh.students.length &&
        !allowed.students &&
        lastGood.students.length
      ) ||
      (
        !fresh.requirements.length &&
        !allowed.requirements &&
        lastGood.requirements.length
      )
    );

    state.lastPreserved =
      !!preserved;

    if(preserved){
      state.preserved += 1;
    }

    if(
      anyPermission(allowed)
    ){
      state.pendingEmpty = null;
    }

    return output;
  }

  function readFresh(force){
    try{
      if(
        S &&
        typeof S.readEnvelope ===
          "function"
      ){
        return normalizeEnvelope(
          S.readEnvelope({
            force:
              force === true
          })
        );
      }
    }catch(error){
      state.lastError =
        error &&
        error.message
          ? error.message
          : text(error);
    }

    try{
      if(
        window.BDLocalConUtils &&
        typeof window.BDLocalConUtils
          .readCache ===
          "function"
      ){
        return normalizeEnvelope(
          window.BDLocalConUtils
            .readCache(
              force === true
            )
        );
      }
    }catch(error){}

    try{
      if(
        window.BDLocalScreenDeps &&
        typeof window.BDLocalScreenDeps
          .readCache ===
          "function"
      ){
        return normalizeEnvelope(
          window.BDLocalScreenDeps
            .readCache(
              force === true
            )
        );
      }
    }catch(error){}

    return emptyEnvelope();
  }

  function stableCache(options){
    options =
      options ||
      {};

    var allowed =
      mergePermissions(
        options.allowEmpty,
        pendingPermissions()
      );

    var fresh =
      readFresh(
        options.force === true
      );

    if(hasData(fresh)){
      lastGood =
        mergeEnvelope(
          fresh,
          allowed
        );

      state.revision += 1;

      return lastGood;
    }

    if(
      !hasData(lastGood) ||
      anyPermission(allowed)
    ){
      lastGood =
        mergeEnvelope(
          fresh,
          allowed
        );

      state.revision += 1;

      return lastGood;
    }

    state.lastPreserved = true;
    state.preserved += 1;

    return lastGood;
  }

  function filterRows(
    rows,
    options
  ){
    rows =
      Array.isArray(rows)
        ? rows
        : [];

    options =
      options ||
      {};

    var periodId = text(
      options.periodId ||
      options.periodoId
    );

    var matricula = text(
      options.matricula
    );

    var search = text(
      options.search ||
      options.query
    ).toLowerCase();

    var limit =
      Number(
        options.limit ||
        0
      );

    var output =
      rows.filter(
        function(row){
          if(
            periodId &&
            U.samePeriod &&
            !U.samePeriod(
              row._periodoId ||
              row.periodoId,

              periodId
            )
          ){
            return false;
          }

          if(
            matricula &&
            text(
              row._matricula ||
              row.matricula
            ).toUpperCase() !==
              matricula.toUpperCase()
          ){
            return false;
          }

          if(
            search &&
            text(
              row._search ||
              [
                row._cedula,
                row._nombres,
                row._carrera,
                row._correo,
                row._telegramUser
              ].join(" ")
            )
              .toLowerCase()
              .indexOf(search) < 0
          ){
            return false;
          }

          return true;
        }
      );

    return limit > 0
      ? output.slice(
          0,
          limit
        )
      : output;
  }

  function fallbackApi(){
    return {
      __tablaFallback:
        true,

      version:
        VERSION,

      source:
        FALLBACK_SOURCE,

      ready:
        function(){
          return Promise.resolve(
            window.TablaDataGuard
          );
        },

      refresh:
        function(options){
          return refresh(
            options
          );
        },

      listPeriods:
        function(){
          return stableCache()
            .periods
            .slice();
        },

      getPeriods:
        function(){
          return stableCache()
            .periods
            .slice();
        },

      periods:
        function(){
          return stableCache()
            .periods
            .slice();
        },

      listStudents:
        function(options){
          var cache =
            stableCache();

          var rows =
            filterRows(
              cache.students,
              options || {}
            );

          return {
            ok:
              true,

            rows:
              rows,

            total:
              rows.length,

            periodList:
              cache
                .periods
                .slice(),

            source:
              FALLBACK_SOURCE
          };
        },

      getStudents:
        function(options){
          return filterRows(
            stableCache().students,
            options || {}
          );
        },

      rows:
        function(options){
          return filterRows(
            stableCache().students,
            options || {}
          );
        },

      getRows:
        function(options){
          return filterRows(
            stableCache().students,
            options || {}
          );
        },

      listarEstudiantes:
        function(options){
          return filterRows(
            stableCache().students,
            options || {}
          );
        },

      getSnapshot:
        function(){
          return stableCache();
        },

      all:
        function(options){
          return filterRows(
            stableCache().students,
            options || {}
          );
        },

      listar:
        function(options){
          return filterRows(
            stableCache().students,
            options || {}
          );
        },

      buscar:
        function(options){
          var rows =
            filterRows(
              stableCache().students,
              options || {}
            );

          return {
            ok:
              true,

            rows:
              rows,

            total:
              rows.length,

            source:
              FALLBACK_SOURCE
          };
        },

      getStudentByCedula:
        function(
          cedula,
          periodId
        ){
          cedula =
            U.normalizeCedula
              ? U.normalizeCedula(
                  cedula
                )
              : text(cedula);

          return filterRows(
            stableCache().students,
            {
              periodId:
                periodId ||
                "",

              matricula:
                ""
            }
          ).filter(
            function(row){
              var current =
                U.normalizeCedula
                  ? U.normalizeCedula(
                      row._cedula ||
                      row.cedula
                    )
                  : text(
                      row._cedula ||
                      row.cedula
                    );

              return (
                current === cedula
              );
            }
          )[0] || null;
        }
    };
  }

  function fillMissing(
    target,
    fallback
  ){
    target =
      target &&
      typeof target === "object"
        ? target
        : {};

    var existingKeys =
      Object.keys(target);

    var protectedMetadata = [
      "__tablaFallback",
      "source",
      "version"
    ];

    Object.keys(fallback)
      .forEach(function(key){
        if(
          existingKeys.length &&
          protectedMetadata
            .indexOf(key) >= 0
        ){
          return;
        }

        if(target[key] == null){
          target[key] =
            fallback[key];
        }
      });

    return target;
  }

  function installFallbackAdapters(){
    var fallback =
      fallbackApi();

    window.BL2DataEngine =
      fillMissing(
        window.BL2DataEngine ||
        {},
        fallback
      );

    window.ExcelLocalRepo =
      fillMissing(
        window.ExcelLocalRepo ||
        {},
        fallback
      );

    window.BL2EstudiantesRepo =
      fillMissing(
        window.BL2EstudiantesRepo ||
        {},
        fallback
      );

    state.installed = true;

    return fallback;
  }

  function requestTabla(
    reason,
    delay
  ){
    if(state.requestTimer){
      window.clearTimeout(
        state.requestTimer
      );
    }

    state.requestTimer =
      window.setTimeout(
        function(){
          state.requestTimer = null;

          if(
            E &&
            typeof E.dataUpdated ===
              "function"
          ){
            E.dataUpdated({
              reason:
                reason ||
                "data-guard",

              revision:
                state.revision
            });
          }

          if(
            window.TablaApp &&
            typeof window.TablaApp
              .request === "function"
          ){
            window.TablaApp.request(
              false,
              30
            );
          }
        },

        Math.max(
          0,
          Number(delay) || 0
        )
      );
  }

  function capture(
    reason,
    force,
    allowed
  ){
    state.lastEvent =
      text(
        reason ||
        "capture"
      );

    state.captures += 1;

    if(
      S &&
      typeof S.invalidate ===
        "function" &&
      force === true
    ){
      S.invalidate();
    }

    var cache =
      stableCache({
        force:
          force === true,

        allowEmpty:
          allowed
      });

    installFallbackAdapters();

    requestTabla(
      reason,
      (
        C.delays &&
        C.delays.guardRequest
      ) ||
      40
    );

    return cache;
  }

  function scheduleCapture(
    reason,
    force,
    allowed
  ){
    if(state.captureTimer){
      window.clearTimeout(
        state.captureTimer
      );
    }

    state.captureTimer =
      window.setTimeout(
        function(){
          state.captureTimer = null;

          capture(
            reason,
            force,
            allowed
          );
        },

        (
          C.delays &&
          C.delays.guardCapture
        ) ||
        120
      );
  }

  function refresh(options){
    options =
      options ||
      {};

    state.refreshes += 1;

    var allowed =
      mergePermissions(
        options.allowEmpty,

        permissionsFromOperation(
          options,
          "refresh-options"
        )
      );

    var task =
      S &&
      typeof S.refresh ===
        "function"
        ? S.refresh(
            Object.assign(
              {},
              options,
              {
                source:
                  options.source ||
                  "TablaDataGuard.refresh",

                full:
                  options.full !==
                  false,

                immediate:
                  options.immediate !==
                  false,

                allowEmpty:
                  anyPermission(
                    allowed
                  )
              }
            )
          )
        : Promise.resolve(
            null
          );

    return Promise.resolve(task)
      .catch(function(error){
        state.lastError =
          error &&
          error.message
            ? error.message
            : text(error);

        return {
          ok: false,
          error: error
        };
      })
      .then(function(result){
        var resultAllowed =
          mergePermissions(
            allowed,

            permissionsFromOperation(
              result || {},
              "refresh-result"
            ),

            permissionsFromOperation(
              result &&
              result.result ||
              {},

              "refresh-inner-result"
            )
          );

        return capture(
          "manual-refresh",
          true,
          resultAllowed
        );
      });
  }

  function handleBaseEvent(info){
    info =
      info ||
      {};

    var detail =
      info.detail ||
      {};

    var allowed =
      mergePermissions(
        permissionsFromOperation(
          detail,
          info.name
        ),

        permissionsFromOperation(
          detail.meta ||
          {},

          info.name +
          ":meta"
        )
      );

    scheduleCapture(
      info.name ||
      "base-event",
      true,
      allowed
    );
  }

  function boot(){
    capture(
      "initial",
      false,
      false
    );

    if(
      E &&
      typeof E.listenBase ===
        "function"
    ){
      state.stopBase =
        E.listenBase(
          handleBaseEvent
        );

      return;
    }

    (
      C.baseEvents ||
      []
    ).forEach(
      function(name){
        window.addEventListener(
          name,

          function(event){
            handleBaseEvent({
              name:
                name,

              detail:
                event &&
                event.detail ||
                {},

              event:
                event
            });
          }
        );
      }
    );
  }

  window.TablaDataGuard = {
    version:
      VERSION,

    source:
      FALLBACK_SOURCE,

    install:
      installFallbackAdapters,

    refresh:
      refresh,

    readCache:
      stableCache,

    capture:
      capture,

    confirmEmpty:
      confirmEmpty,

    confirmDeletion:
      confirmEmpty,

    allowEmptyOnce:
      confirmEmpty,

    clear:
      function(){
        lastGood =
          emptyEnvelope();

        state.pendingEmpty =
          null;

        state.revision += 1;

        state.lastPreserved =
          false;

        if(
          S &&
          typeof S.invalidate ===
            "function"
        ){
          S.invalidate();
        }
      },

    status:
      function(){
        return {
          ok:
            true,

          version:
            VERSION,

          installed:
            state.installed,

          periods:
            lastGood
              .periods
              .length,

          students:
            lastGood
              .students
              .length,

          requirements:
            lastGood
              .requirements
              .length,

          source:
            text(
              lastGood.meta &&
              lastGood.meta.source
            ) ||
            FALLBACK_SOURCE,

          revision:
            state.revision,

          captures:
            state.captures,

          refreshes:
            state.refreshes,

          preserved:
            state.preserved,

          lastEvent:
            state.lastEvent,

          lastError:
            state.lastError,

          lastPreserved:
            state.lastPreserved,

          pendingEmpty:
            state.pendingEmpty
              ? Object.assign(
                  {},
                  state
                    .pendingEmpty
                    .value
                )
              : null
        };
      }
  };

  boot();
})(window);