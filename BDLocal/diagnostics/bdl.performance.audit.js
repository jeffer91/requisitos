/* =========================================================
Nombre completo: bdl.performance.audit.js
Ruta o ubicación: /Requisitos/BDLocal/diagnostics/bdl.performance.audit.js
Función o funciones:
- Auditar rendimiento sin modificar información de la base.
- Medir conteos, índices, servicios, caché, filtros y serialización.
- Informar refrescos solicitados, ejecutados, agrupados y descartados.
- Detectar escrituras repetidas, análisis JSON, eventos y tamaño de caché.
- Entregar recomendaciones priorizadas y una puntuación de rendimiento.
Con qué se conecta:
- BL2DB y BL2Config.
- BDLServices.
- BDLocalConUtils y BDLocalConexiones.
- Centro de Control y diagnóstico general.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.3.0-full-performance-audit";

  var observedEvents = {
    total: 0,
    byName: Object.create(null),
    startedAt: new Date().toISOString()
  };

  var EVENT_NAMES = [
    "bdlocal:conexiones-cache-updated",
    "bdlocal:screen-data-updated",
    "bdlocal:legacy-ready",
    "bdlocal:legacy-snapshot",
    "requisitos:bl:snapshot-changed",
    "requisitos:bdlocal-cambio-disponible",
    "bl2:students-saved",
    "bl2:student-updated"
  ];

  function text(value){
    return String(
      value == null
        ? ""
        : value
    ).trim();
  }

  function nowMs(){
    return (
      window.performance &&
      typeof window.performance.now === "function"
    )
      ? window.performance.now()
      : Date.now();
  }

  function round(value){
    return Math.round(
      Number(value || 0) * 100
    ) / 100;
  }

  function db(){
    return window.BL2DB || null;
  }

  function config(){
    return window.BL2Config || {};
  }

  function utils(){
    return window.BDLocalConUtils || null;
  }

  function hub(){
    return window.BDLocalConexiones || null;
  }

  function measure(label, fn){
    var started = nowMs();

    return Promise.resolve()
      .then(fn)
      .then(function(value){
        return {
          label: label,
          ok: true,
          ms: round(nowMs() - started),
          value: value
        };
      })
      .catch(function(error){
        return {
          label: label,
          ok: false,
          ms: round(nowMs() - started),

          error:
            error &&
            error.message
              ? error.message
              : String(error)
        };
      });
  }

  function physicalTables(){
    var current = db();

    var meta =
      current &&
      typeof current.meta === "function"
        ? current.meta()
        : {};

    return Array.isArray(meta.stores)
      ? meta.stores.slice()
      : [];
  }

  function expectedIndexes(){
    var stores =
      config().stores ||
      {};

    var source =
      config().dbV2 &&
      config().dbV2.indexes ||
      {};

    var output = {};

    Object.keys(source).forEach(function(key){
      var table = text(
        stores[key] ||
        key
      );

      if(table){
        output[table] =
          Array.isArray(source[key])
            ? source[key].slice()
            : [];
      }
    });

    return output;
  }

  function countTable(name){
    var current = db();

    if(
      !current ||
      typeof current.count !== "function"
    ){
      return Promise.resolve({
        table: name,
        ok: false,
        count: 0,
        ms: 0,
        error: "BL2DB.count no disponible."
      });
    }

    return measure(
      "count " + name,
      function(){
        return current.count(name);
      }
    ).then(function(result){
      return {
        table: name,
        ok: result.ok,
        count: Number(result.value || 0),
        ms: result.ms,
        error: result.error || ""
      };
    });
  }

  function inspectIndexes(){
    var current = db();

    if(
      !current ||
      typeof current.open !== "function"
    ){
      return Promise.resolve([]);
    }

    return current.open()
      .then(function(nativeDb){
        var expected = expectedIndexes();
        var rows = [];

        Object.keys(expected).forEach(function(table){
          if(
            !nativeDb.objectStoreNames.contains(table)
          ){
            expected[table].forEach(function(index){
              rows.push({
                table: table,
                index: index,
                ok: false,
                ms: 0,
                error: "Tabla no disponible."
              });
            });

            return;
          }

          var transaction = nativeDb.transaction(
            [table],
            "readonly"
          );

          var store = transaction.objectStore(table);

          var actual = Array.prototype.slice.call(
            store.indexNames || []
          );

          expected[table].forEach(function(index){
            var exists =
              actual.indexOf(index) >= 0;

            rows.push({
              table: table,
              index: index,
              ok: exists,
              ms: 0,

              error:
                exists
                  ? ""
                  : "Índice no creado."
            });
          });
        });

        return rows;
      })
      .catch(function(error){
        return [{
          table: "IndexedDB",
          index: "open",
          ok: false,
          ms: 0,

          error:
            error &&
            error.message
              ? error.message
              : String(error)
        }];
      });
  }

  function activePeriod(){
    if(
      window.BL2App &&
      typeof window.BL2App.getSelectedPeriod === "function"
    ){
      var period =
        window.BL2App.getSelectedPeriod();

      if(
        period &&
        text(
          period.id ||
          period.periodoId
        )
      ){
        return Promise.resolve(period);
      }
    }

    if(
      window.BL2Core &&
      typeof window.BL2Core.getActivePeriod === "function"
    ){
      return window.BL2Core.getActivePeriod();
    }

    var U = utils();

    if(
      U &&
      typeof U.readCache === "function"
    ){
      var periods =
        U.readCache().periods ||
        [];

      return Promise.resolve(
        periods[0] ||
        null
      );
    }

    return Promise.resolve(null);
  }

  function service(name, method, args){
    args = args || [];

    var registry =
      window.BDLServices;

    var api = null;

    try{
      api =
        registry &&
        typeof registry.get === "function"
          ? registry.get(name)
          : null;
    }catch(error){}

    if(
      !api &&
      name === "estudiantes"
    ){
      api =
        window.BDLServiceEstudiantes ||
        null;
    }

    if(
      !api &&
      name === "defensas"
    ){
      api =
        window.BDLServiceDefensas ||
        null;
    }

    if(
      !api ||
      typeof api[method] !== "function"
    ){
      return Promise.resolve({
        service: name,
        method: method,
        ok: false,
        optional: true,
        ms: 0,
        error: "Servicio no disponible."
      });
    }

    return measure(
      name + "." + method,
      function(){
        return api[method].apply(
          api,
          args
        );
      }
    ).then(function(result){
      var value = result.value;
      var total = 0;
      var rows = 0;

      if(Array.isArray(value)){
        total = value.length;
        rows = value.length;
      }else{
        value = value || {};

        total = Number(
          value.total ||
          value.filteredTotal ||
          0
        );

        rows =
          Array.isArray(value.rows)
            ? value.rows.length
            : Array.isArray(value.items)
              ? value.items.length
              : 0;
      }

      return {
        service: name,
        method: method,
        ok: result.ok,
        optional: false,
        ms: result.ms,
        total: total,
        rows: rows,
        error: result.error || ""
      };
    });
  }

  function serviceChecks(){
    return activePeriod()
      .then(function(period){
        var periodoId = text(
          period &&
          (
            period.id ||
            period.periodoId ||
            period.periodoCanonicoId
          )
        );

        if(!periodoId){
          return {
            periodoId: "",
            results: [],

            warning:
              "No hay período activo para medir servicios."
          };
        }

        var options = {
          periodoId: periodoId,
          page: 1,
          limit: 25,
          filtros: {}
        };

        return Promise.all([
          service(
            "estudiantes",
            "page",
            [options]
          ),

          service(
            "defensas",
            "getPage",
            [options]
          )
        ]).then(function(results){
          return {
            periodoId: periodoId,
            results: results
          };
        });
      });
  }

  function stringBytes(value){
    value = String(value || "");

    try{
      if(typeof TextEncoder !== "undefined"){
        return new TextEncoder()
          .encode(value)
          .length;
      }
    }catch(error){}

    return value.length * 2;
  }

  function cacheChecks(){
    var U = utils();

    if(
      !U ||
      typeof U.readCache !== "function"
    ){
      return Promise.resolve({
        ok: false,

        warning:
          "BDLocalConUtils no está disponible.",

        readMs: 0,
        stringifyMs: 0,
        filterMs: 0,
        bytes: 0,
        megabytes: 0,
        periods: 0,
        students: 0,
        requirements: 0,
        utilsStatus: null
      });
    }

    var current = null;
    var raw = "";

    return measure(
      "cache.read",
      function(){
        current = U.readCache();
        return current;
      }
    ).then(function(readResult){
      return measure(
        "cache.stringify",
        function(){
          raw = JSON.stringify(
            current || {}
          );

          return raw.length;
        }
      ).then(function(stringifyResult){
        return measure(
          "cache.filter",
          function(){
            var rows =
              current &&
              Array.isArray(current.students)
                ? current.students
                : [];

            if(
              typeof U.filterStudents !== "function"
            ){
              return [];
            }

            var period =
              current &&
              Array.isArray(current.periods)
                ? current.periods[0]
                : null;

            var periodoId = text(
              period &&
              (
                period.periodoId ||
                period.id ||
                period.periodoCanonicoId
              )
            );

            return U.filterStudents(
              rows,
              {
                periodoId: periodoId,
                matricula: "",
                limit: 50
              }
            );
          }
        ).then(function(filterResult){
          var bytes = stringBytes(raw);

          return {
            ok:
              readResult.ok &&
              stringifyResult.ok &&
              filterResult.ok,

            readMs:
              readResult.ms,

            stringifyMs:
              stringifyResult.ms,

            filterMs:
              filterResult.ms,

            bytes:
              bytes,

            megabytes:
              round(bytes / 1024 / 1024),

            periods:
              current &&
              Array.isArray(current.periods)
                ? current.periods.length
                : 0,

            students:
              current &&
              Array.isArray(current.students)
                ? current.students.length
                : 0,

            requirements:
              current &&
              Array.isArray(current.requirements)
                ? current.requirements.length
                : 0,

            utilsStatus:
              typeof U.status === "function"
                ? U.status()
                : null,

            errors: [
              readResult.error || "",
              stringifyResult.error || "",
              filterResult.error || ""
            ].filter(Boolean)
          };
        });
      });
    });
  }

  function refreshChecks(){
    var H = hub();

    var status =
      H &&
      typeof H.status === "function"
        ? H.status()
        : null;

    var metrics =
      status &&
      status.metrics
        ? status.metrics
        : H &&
          typeof H.metrics === "function"
            ? H.metrics()
            : {};

    metrics = metrics || {};

    var requested = Number(
      metrics.requested || 0
    );

    var executed = Number(
      metrics.executed || 0
    );

    var coalesced = Number(
      metrics.coalesced || 0
    );

    var skipped = Number(
      metrics.cooldownSkipped || 0
    );

    var full = Number(
      metrics.fullExecuted || 0
    );

    var light = Number(
      metrics.lightExecuted || 0
    );

    var incremental = Number(
      metrics.incrementalExecuted || 0
    );

    return {
      available: !!H,
      status: status,
      metrics: Object.assign({}, metrics),
      requested: requested,
      executed: executed,
      coalesced: coalesced,
      cooldownSkipped: skipped,
      fullExecuted: full,
      lightExecuted: light,
      incrementalExecuted: incremental,
      avoided: coalesced + skipped,

      duplicateRatio:
        requested > 0
          ? round(
            (
              coalesced +
              skipped
            ) /
            requested *
            100
          )
          : 0
    };
  }

  function navigationChecks(){
    var result = {
      supported: false,
      domContentLoadedMs: 0,
      loadMs: 0,
      durationMs: 0,
      interactiveMs: 0
    };

    try{
      if(
        window.performance &&
        typeof window.performance.getEntriesByType === "function"
      ){
        var entry =
          window.performance
            .getEntriesByType("navigation")[0];

        if(entry){
          result.supported = true;

          result.domContentLoadedMs = round(
            entry.domContentLoadedEventEnd ||
            0
          );

          result.loadMs = round(
            entry.loadEventEnd ||
            0
          );

          result.durationMs = round(
            entry.duration ||
            0
          );

          result.interactiveMs = round(
            entry.domInteractive ||
            0
          );
        }
      }
    }catch(error){}

    return result;
  }

  function eventsSnapshot(){
    return {
      total: observedEvents.total,
      byName: Object.assign(
        {},
        observedEvents.byName
      ),

      startedAt:
        observedEvents.startedAt,

      capturedAt:
        new Date().toISOString()
    };
  }

  function recommendations(report){
    var list = [];

    var badIndexes = report.indexes.filter(function(item){
      return !item.ok;
    });

    var slowCounts = report.counts.filter(function(item){
      return item.ms > 500;
    });

    var slowServices =
      (report.services.results || [])
        .filter(function(item){
          return (
            !item.optional &&
            item.ms > 800
          );
        });

    if(badIndexes.length){
      list.push(
        "Crear o reparar los índices faltantes: " +
        badIndexes.map(function(item){
          return (
            item.table +
            "." +
            item.index
          );
        }).join(", ") +
        "."
      );
    }

    if(slowCounts.length){
      list.push(
        "Revisar conteos lentos: " +
        slowCounts.map(function(item){
          return (
            item.table +
            " (" +
            item.ms +
            " ms)"
          );
        }).join(", ") +
        "."
      );
    }

    if(slowServices.length){
      list.push(
        "Optimizar servicios lentos: " +
        slowServices.map(function(item){
          return (
            item.service +
            "." +
            item.method +
            " (" +
            item.ms +
            " ms)"
          );
        }).join(", ") +
        "."
      );
    }

    if(report.cache.megabytes > 4.5){
      list.push(
        "La caché ocupa " +
        report.cache.megabytes +
        " MB; conviene reducir snapshots de compatibilidad " +
        "o separar datos por período."
      );
    }

    if(report.cache.stringifyMs > 100){
      list.push(
        "JSON.stringify de la caché tarda " +
        report.cache.stringifyMs +
        " ms; evitar serializarla durante renderizados."
      );
    }

    if(report.cache.filterMs > 80){
      list.push(
        "El filtro de caché tarda " +
        report.cache.filterMs +
        " ms; revisar búsquedas por tecla y aplicar debounce."
      );
    }

    var utilsStatus =
      report.cache.utilsStatus ||
      {};

    if(
      Number(utilsStatus.storageWrites || 0) > 0 &&
      Number(utilsStatus.skippedWrites || 0) === 0
    ){
      list.push(
        "No se registran escrituras omitidas; comprobar que " +
        "la deduplicación de localStorage esté activa."
      );
    }

    if(
      report.refresh.fullExecuted > 3 &&
      report.refresh.incrementalExecuted === 0
    ){
      list.push(
        "Se ejecutaron varios refrescos completos sin refrescos " +
        "incrementales; revisar qué pantalla los solicita."
      );
    }

    if(
      report.refresh.requested > 0 &&
      report.refresh.executed >
      report.refresh.requested
    ){
      list.push(
        "El número de refrescos ejecutados supera las solicitudes " +
        "registradas; revisar llamadas externas al orquestador."
      );
    }

    if(report.events.total > 40){
      list.push(
        "Se capturaron " +
        report.events.total +
        " eventos de datos; revisar listeners que renderizan " +
        "más de una vez."
      );
    }

    if(
      report.navigation.supported &&
      report.navigation.loadMs > 3000
    ){
      list.push(
        "La carga de la ventana supera 3 segundos; revisar scripts " +
        "del arranque y diagnósticos automáticos."
      );
    }

    if(report.services.warning){
      list.push(
        report.services.warning
      );
    }

    if(!list.length){
      list.push(
        "Los conteos, índices, servicios, caché y refrescos " +
        "revisados responden correctamente."
      );
    }

    return list;
  }

  function score(report){
    var value = 100;

    value -= report.indexes
      .filter(function(item){
        return !item.ok;
      })
      .length * 8;

    value -= report.counts
      .filter(function(item){
        return !item.ok;
      })
      .length * 5;

    value -= report.counts
      .filter(function(item){
        return item.ms > 500;
      })
      .length * 3;

    value -= (report.services.results || [])
      .filter(function(item){
        return (
          !item.optional &&
          !item.ok
        );
      })
      .length * 5;

    value -= (report.services.results || [])
      .filter(function(item){
        return (
          !item.optional &&
          item.ms > 800
        );
      })
      .length * 3;

    if(report.cache.megabytes > 4.5){
      value -= 8;
    }

    if(report.cache.stringifyMs > 100){
      value -= 6;
    }

    if(report.cache.filterMs > 80){
      value -= 5;
    }

    if(
      report.refresh.fullExecuted > 3 &&
      report.refresh.incrementalExecuted === 0
    ){
      value -= 8;
    }

    if(report.events.total > 40){
      value -= 5;
    }

    if(
      report.navigation.supported &&
      report.navigation.loadMs > 3000
    ){
      value -= 5;
    }

    return Math.max(
      0,
      Math.min(
        100,
        value
      )
    );
  }

  function run(){
    var started = nowMs();
    var tables = physicalTables();

    var report = {
      version: VERSION,
      checkedAt: new Date().toISOString(),
      durationMs: 0,
      score: 0,
      ok: false,
      counts: [],
      indexes: [],
      services: {
        results: []
      },
      cache: {},
      refresh: {},
      navigation: navigationChecks(),
      events: eventsSnapshot(),
      recommendations: []
    };

    return Promise.all([
      Promise.all(
        tables.map(countTable)
      ),

      inspectIndexes(),
      serviceChecks(),
      cacheChecks()
    ]).then(function(values){
      report.counts = values[0];
      report.indexes = values[1];
      report.services = values[2];
      report.cache = values[3];
      report.refresh = refreshChecks();
      report.events = eventsSnapshot();

      var mandatoryServices =
        (report.services.results || [])
          .filter(function(item){
            return !item.optional;
          });

      report.ok =
        report.counts.every(function(item){
          return item.ok;
        }) &&
        report.indexes.every(function(item){
          return item.ok;
        }) &&
        mandatoryServices.every(function(item){
          return item.ok;
        }) &&
        report.cache.ok !== false;

      report.recommendations =
        recommendations(report);

      report.score =
        score(report);

      report.durationMs =
        round(nowMs() - started);

      return report;
    });
  }

  function resetCounters(){
    observedEvents.total = 0;
    observedEvents.byName = Object.create(null);

    observedEvents.startedAt =
      new Date().toISOString();

    return true;
  }

  EVENT_NAMES.forEach(function(name){
    window.addEventListener(
      name,
      function(){
        observedEvents.total += 1;

        observedEvents.byName[name] =
          Number(
            observedEvents.byName[name] ||
            0
          ) + 1;
      }
    );
  });

  window.BDLPerformanceAudit = {
    version: VERSION,
    run: run,
    runAndPaint: run,

    bind: function(){
      return true;
    },

    expectedIndexes: expectedIndexes,
    events: eventsSnapshot,
    resetCounters: resetCounters
  };

  try{
    window.dispatchEvent(
      new CustomEvent(
        "bdlocal:performance-audit-ready",
        {
          detail: {
            version: VERSION,
            at: new Date().toISOString()
          }
        }
      )
    );
  }catch(error){}
})(window);