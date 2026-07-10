/* =========================================================
Nombre completo: bdl.divisiones.fast-cache.js
Ruta o ubicación: /Requisitos/BDLocal/adapters/bdl.divisiones.fast-cache.js
Función o funciones:
- Mantener compatibilidad con pantallas que todavía cargan este archivo.
- Delegar todas las operaciones al servicio oficial BLDivisionesService.
- Evitar una segunda lectura de localStorage y una segunda caché de divisiones.
- Eliminar el temporizador que reinstalaba el servicio cuarenta veces.
- Exponer estado y métodos de puente sin sobrescribir la implementación oficial.
Con qué se conecta:
- adapters/bdl.divisiones.service.js.
- adapters/bdl.screen-deps.js.
- Pantallas antiguas que escuchan bdl:divisiones-fast-cache-ready.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-compat-bridge";

  function service(){
    return window.BLDivisionesService || null;
  }

  function requireService(){
    var current = service();

    if(!current){
      throw new Error(
        "BLDivisionesService no está cargado. " +
        "Incluya bdl.divisiones.service.js antes de " +
        "bdl.divisiones.fast-cache.js."
      );
    }

    return current;
  }

  function call(method, args, fallback){
    var current = service();

    if(
      !current ||
      typeof current[method] !== "function"
    ){
      return fallback;
    }

    return current[method].apply(
      current,
      Array.prototype.slice.call(
        args || []
      )
    );
  }

  var api = {
    version: VERSION,
    source: "BDLocal/adapters/bdl.divisiones.fast-cache.js",
    mode: "compatibility-bridge",

    ready: function(){
      return Promise.resolve(
        requireService()
      );
    },

    install: function(){
      return requireService();
    },

    invalidate: function(){
      return call(
        "invalidate",
        arguments,
        true
      );
    },

    readState: function(){
      return call(
        "readState",
        arguments,
        {
          periodMap: {},
          divisionsByPeriod: {},
          careersByPeriod: {},
          careerDivisionByPeriod: {},
          store: {}
        }
      );
    },

    divisionsForPeriod: function(){
      return call(
        "divisionsForPeriod",
        arguments,
        []
      );
    },

    careersForPeriod: function(){
      return call(
        "careersForPeriod",
        arguments,
        []
      );
    },

    studentDivision: function(){
      return call(
        "studentDivision",
        arguments,
        "Sin división"
      );
    },

    hasDivision: function(){
      return call(
        "hasDivision",
        arguments,
        false
      );
    },

    listDivisions: function(){
      return call(
        "listDivisions",
        arguments,
        []
      );
    },

    listDivisionsWithEmpty: function(){
      return call(
        "listDivisionsWithEmpty",
        arguments,
        []
      );
    },

    status: function(){
      var current = service();

      var serviceStatus =
        current &&
        typeof current.status === "function"
          ? current.status()
          : null;

      return {
        ok: !!current,
        version: VERSION,
        mode: "compatibility-bridge",

        serviceVersion:
          current &&
          current.version ||
          "",

        serviceStatus: serviceStatus
      };
    }
  };

  window.BLDivisionesFastCache = api;

  try{
    window.dispatchEvent(
      new CustomEvent(
        "bdlocal:divisiones-fast-cache-ready",
        {
          detail: {
            ok: !!service(),
            version: VERSION,
            bridge: true,
            final: true,

            serviceVersion:
              service() &&
              service().version ||
              "",

            at: new Date().toISOString()
          }
        }
      )
    );
  }catch(error){}
})(window);