/* =========================================================
Nombre completo: bdl.divisiones.service.js
Ruta o ubicación: /Requisitos/BDLocal/adapters/bdl.divisiones.service.js
Función o funciones:
- Ser el único servicio oficial para resolver divisiones y carreras.
- Consumir primero la caché central de BDLocalConUtils cuando está disponible.
- Mantener compatibilidad con carga.periodos.divisiones, carga.periodos.local
  y el snapshot antiguo sin volver a analizar todo por cada estudiante.
- Construir índices por período y por carrera para consultas de tiempo constante.
- Exponer BLDivisionesService para Ficha, Stats, Tabla, Defensas y Reportes.
Con qué se conecta:
- conexiones/cone.utils.js.
- adapters/bdl.screen-deps.js.
- adapters/bdl.divisiones.fast-cache.js como puente de compatibilidad.
- localStorage de Carga únicamente como respaldo.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.2.0-central-index";
  var LS_DIVISIONES = "carga.periodos.divisiones";
  var LS_PERIODOS = "carga.periodos.local";
  var CACHE_KEY = "REQ_BDLOCAL_CONEXIONES_CACHE_V1";
  var OLD_SNAPSHOT_KEY = "REQ_EXCEL_LOCAL_V1:snapshot";

  var memo = {
    token: "",
    state: null,
    builds: 0,
    invalidations: 0,
    fallbackParses: 0
  };

  function U(){
    return window.BDLocalConUtils || null;
  }

  function text(value){
    var utils = U();

    return utils && typeof utils.text === "function"
      ? utils.text(value)
      : String(value == null ? "" : value).trim();
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
    var utils = U();

    if(utils && typeof utils.normalizeKey === "function"){
      return utils.normalizeKey(value);
    }

    return norm(value).replace(/[^a-z0-9]+/g, "");
  }

  function safeParse(raw, fallback){
    var utils = U();

    if(utils && typeof utils.safeParse === "function"){
      return utils.safeParse(raw, fallback);
    }

    try{
      var parsed = JSON.parse(raw || "");
      memo.fallbackParses += 1;

      return parsed == null
        ? fallback
        : parsed;
    }catch(error){
      memo.fallbackParses += 1;
      return fallback;
    }
  }

  function raw(name){
    try{
      return window.localStorage.getItem(name) || "";
    }catch(error){
      return "";
    }
  }

  function canonicalPeriodId(value){
    var utils = U();

    if(utils && typeof utils.canonicalPeriodId === "function"){
      return utils.canonicalPeriodId(value);
    }

    value = text(value);

    if(!value){
      return "";
    }

    var match = value.match(
      /^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/
    );

    return match
      ? match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4]
      : value.replace(/_+/g, "__");
  }

  function samePeriod(a, b){
    var utils = U();

    if(utils && typeof utils.samePeriod === "function"){
      return utils.samePeriod(a, b);
    }

    a = canonicalPeriodId(a);
    b = canonicalPeriodId(b);

    return !b || (
      !!a &&
      (
        a === b ||
        key(a) === key(b)
      )
    );
  }

  function periodIdOf(rowOrPeriod){
    rowOrPeriod = rowOrPeriod || {};

    var explicit = canonicalPeriodId(
      rowOrPeriod.periodoCanonicoId ||
      rowOrPeriod.periodoId ||
      rowOrPeriod.periodId ||
      rowOrPeriod.ultimoPeriodoId ||
      rowOrPeriod._periodoId ||
      rowOrPeriod._bl2PeriodoId ||
      rowOrPeriod.idPeriodo ||
      ""
    );

    if(explicit){
      return explicit;
    }

    var looksLikeStudent = !!text(
      rowOrPeriod.cedula ||
      rowOrPeriod.numeroIdentificacion ||
      rowOrPeriod.NumeroIdentificacion ||
      ""
    );

    if(looksLikeStudent){
      return "";
    }

    return canonicalPeriodId(
      rowOrPeriod.id ||
      rowOrPeriod.value ||
      rowOrPeriod.key ||
      ""
    );
  }

  function careerId(item){
    item = item || {};

    if(typeof item === "string"){
      return key(item);
    }

    return text(
      item.id ||
      item.codigo ||
      item.CodigoCarrera ||
      item.codigoCarrera ||
      item.codCarrera ||
      ""
    ) || key(
      item.nombre ||
      item.NombreCarrera ||
      item.nombreCarrera ||
      item.Carrera ||
      item.carrera ||
      item._carrera ||
      item.label ||
      ""
    );
  }

  function careerName(item){
    item = item || {};

    if(typeof item === "string"){
      return text(item);
    }

    return text(
      item.nombre ||
      item.NombreCarrera ||
      item.nombreCarrera ||
      item.Carrera ||
      item.carrera ||
      item._carrera ||
      item.label ||
      item.codigo ||
      item.CodigoCarrera ||
      item.id ||
      ""
    );
  }

  function normalizeCareer(item){
    var id = careerId(item);
    var nombre = careerName(item);

    if(!id && !nombre){
      return null;
    }

    return {
      id: id || key(nombre),

      codigo: text(
        item &&
        typeof item === "object" &&
        (
          item.codigo ||
          item.CodigoCarrera ||
          item.codigoCarrera ||
          item.codCarrera ||
          ""
        )
      ),

      nombre: nombre || id
    };
  }

  function uniqueCareers(list){
    var map = Object.create(null);

    (Array.isArray(list) ? list : []).forEach(function(item){
      var career = normalizeCareer(item);

      if(career && career.id){
        map[career.id] = Object.assign(
          {},
          map[career.id] || {},
          career
        );
      }
    });

    return Object.keys(map)
      .map(function(id){
        return map[id];
      })
      .sort(function(a, b){
        return text(a.nombre).localeCompare(
          text(b.nombre),
          "es",
          {
            sensitivity: "base"
          }
        );
      });
  }

  function normalizeDivision(item){
    if(!item){
      return null;
    }

    if(typeof item === "string"){
      var label = text(item);

      return label
        ? {
          id: key(label),
          nombre: label,
          carreras: []
        }
        : null;
    }

    var nombre = text(
      item.nombre ||
      item.label ||
      item.name ||
      item.id ||
      ""
    );

    var id = text(
      item.id ||
      key(nombre)
    );

    if(!id && !nombre){
      return null;
    }

    return {
      id: id || key(nombre),
      nombre: nombre || id,

      carreras: uniqueCareers(
        item.carreras ||
        item.careers ||
        []
      ),

      updatedAt:
        item.updatedAt ||
        item.actualizadoEn ||
        ""
    };
  }

  function mergeDivisions(){
    var map = Object.create(null);

    Array.prototype.slice.call(arguments).forEach(function(list){
      (Array.isArray(list) ? list : []).forEach(function(item){
        var division = normalizeDivision(item);

        if(!division){
          return;
        }

        if(!map[division.id]){
          map[division.id] = division;
          return;
        }

        map[division.id] = Object.assign(
          {},
          map[division.id],
          division,
          {
            carreras: uniqueCareers(
              [].concat(
                map[division.id].carreras || [],
                division.carreras || []
              )
            )
          }
        );
      });
    });

    return Object.keys(map)
      .map(function(id){
        return map[id];
      })
      .sort(function(a, b){
        return text(a.nombre).localeCompare(
          text(b.nombre),
          "es",
          {
            sensitivity: "base"
          }
        );
      });
  }

  function normalizeStoreMap(input){
    var output = Object.create(null);

    if(
      !input ||
      typeof input !== "object" ||
      Array.isArray(input)
    ){
      return output;
    }

    Object.keys(input).forEach(function(rawPeriodId){
      var periodId = canonicalPeriodId(rawPeriodId);
      var value = input[rawPeriodId];

      var list = Array.isArray(value)
        ? value
        : value && Array.isArray(value.divisiones)
          ? value.divisiones
          : value && Array.isArray(value.items)
            ? value.items
            : [];

      if(periodId){
        output[periodId] = mergeDivisions(
          output[periodId] || [],
          list
        );
      }
    });

    return output;
  }

  function centralCache(){
    var utils = U();

    if(
      utils &&
      typeof utils.readCache === "function"
    ){
      return utils.readCache() || {};
    }

    return null;
  }

  function fallbackSources(){
    var rawDivisions = raw(LS_DIVISIONES);
    var rawPeriods = raw(LS_PERIODOS);
    var rawCache = raw(CACHE_KEY);
    var rawOld = "";

    var periods = safeParse(
      rawPeriods,
      []
    );

    periods = Array.isArray(periods)
      ? periods
      : [];

    var cache = safeParse(
      rawCache,
      null
    );

    var cachePeriods =
      cache &&
      Array.isArray(cache.periods)
        ? cache.periods
        : [];

    if(
      !periods.length &&
      !cachePeriods.length
    ){
      rawOld = raw(OLD_SNAPSHOT_KEY);

      var old = safeParse(
        rawOld,
        null
      );

      cachePeriods =
        old &&
        Array.isArray(old.periods)
          ? old.periods
          : [];
    }

    return {
      token: [
        rawDivisions,
        rawPeriods,
        rawCache,
        rawOld
      ].join("|#|"),

      store: normalizeStoreMap(
        safeParse(
          rawDivisions,
          {}
        )
      ),

      periods: [].concat(
        cachePeriods,
        periods
      ).filter(Boolean),

      source: "localStorage"
    };
  }

  function sourceSnapshot(){
    var cache = centralCache();

    if(cache){
      var meta = cache.meta || {};
      var rawDivisions = raw(LS_DIVISIONES);
      var rawPeriods = raw(LS_PERIODOS);

      var localPeriods = safeParse(
        rawPeriods,
        []
      );

      localPeriods = Array.isArray(localPeriods)
        ? localPeriods
        : [];

      return {
        token: [
          "central",
          Number(meta.revision || 0),
          text(meta.updatedAt || ""),
          Array.isArray(cache.periods)
            ? cache.periods.length
            : 0,
          rawDivisions,
          rawPeriods
        ].join("|"),

        store: normalizeStoreMap(
          safeParse(
            rawDivisions,
            {}
          )
        ),

        periods: [].concat(
          Array.isArray(cache.periods)
            ? cache.periods
            : [],
          localPeriods
        ).filter(Boolean),

        source: "BDLocalConUtils"
      };
    }

    return fallbackSources();
  }

  function buildState(){
    var source = sourceSnapshot();

    if(
      memo.state &&
      memo.token === source.token
    ){
      return memo.state;
    }

    var periodMap = Object.create(null);
    var divisionsByPeriod = Object.create(null);
    var careersByPeriod = Object.create(null);
    var careerDivisionByPeriod = Object.create(null);

    source.periods.forEach(function(period){
      var periodId = periodIdOf(period);

      if(!periodId){
        return;
      }

      periodMap[periodId] = Object.assign(
        {},
        periodMap[periodId] || {},
        period,
        {
          id: periodId,
          periodoId: periodId,
          periodId: periodId,
          periodoCanonicoId: periodId
        }
      );
    });

    Object.keys(source.store).forEach(function(periodId){
      if(!periodMap[periodId]){
        periodMap[periodId] = {
          id: periodId,
          periodoId: periodId,
          periodId: periodId,
          periodoCanonicoId: periodId,
          divisiones: []
        };
      }
    });

    Object.keys(periodMap).forEach(function(periodId){
      var period = periodMap[periodId] || {};

      var divisions = mergeDivisions(
        source.store[periodId] || [],
        period.divisiones || []
      );

      var careerMap = Object.create(null);

      divisions.forEach(function(division){
        (division.carreras || []).forEach(function(career){
          var id = careerId(career);

          if(
            id &&
            !careerMap[id]
          ){
            careerMap[id] = text(
              division.nombre ||
              division.id
            );
          }
        });
      });

      divisionsByPeriod[periodId] = divisions;
      careerDivisionByPeriod[periodId] = careerMap;

      careersByPeriod[periodId] = uniqueCareers(
        [].concat(
          period.carrerasDetectadas || [],

          divisions.reduce(function(output, division){
            return output.concat(
              division.carreras || []
            );
          }, [])
        )
      );
    });

    memo.token = source.token;
    memo.builds += 1;

    memo.state = {
      source: source.source,
      periodMap: periodMap,
      divisionsByPeriod: divisionsByPeriod,
      careersByPeriod: careersByPeriod,
      careerDivisionByPeriod: careerDivisionByPeriod,
      store: source.store,
      builtAt: new Date().toISOString()
    };

    return memo.state;
  }

  function invalidate(){
    memo.token = "";
    memo.state = null;
    memo.invalidations += 1;

    return true;
  }

  function findPeriod(periodId){
    periodId = canonicalPeriodId(periodId);

    if(!periodId){
      return null;
    }

    var state = buildState();

    if(state.periodMap[periodId]){
      return state.periodMap[periodId];
    }

    var ids = Object.keys(
      state.periodMap
    );

    for(var i = 0; i < ids.length; i += 1){
      if(samePeriod(ids[i], periodId)){
        return state.periodMap[ids[i]];
      }
    }

    return null;
  }

  function divisionsForPeriod(periodOrId){
    var periodId =
      typeof periodOrId === "string"
        ? canonicalPeriodId(periodOrId)
        : periodIdOf(periodOrId);

    if(
      !periodId &&
      periodOrId &&
      typeof periodOrId === "object"
    ){
      return mergeDivisions(
        periodOrId.divisiones || []
      );
    }

    return (
      buildState().divisionsByPeriod[periodId] ||
      []
    ).slice();
  }

  function careersForPeriod(periodOrId){
    var periodId =
      typeof periodOrId === "string"
        ? canonicalPeriodId(periodOrId)
        : periodIdOf(periodOrId);

    if(periodId){
      return (
        buildState().careersByPeriod[periodId] ||
        []
      ).slice();
    }

    if(
      periodOrId &&
      typeof periodOrId === "object"
    ){
      return uniqueCareers(
        [].concat(
          periodOrId.carrerasDetectadas || [],

          divisionsForPeriod(periodOrId).reduce(
            function(output, division){
              return output.concat(
                division.carreras || []
              );
            },
            []
          )
        )
      );
    }

    return [];
  }

  function directDivision(row){
    row = row || {};

    var value = text(
      row._division ||
      row._bl2Division ||
      row.division ||
      row.Division ||
      row["División"] ||
      row.divisionActual ||
      ""
    );

    if(
      value &&
      key(value) !== "sindivision"
    ){
      return value;
    }

    if(
      Array.isArray(row.divisiones) &&
      row.divisiones.length
    ){
      value = text(
        row.divisiones[0]
      );

      if(
        value &&
        key(value) !== "sindivision"
      ){
        return value;
      }
    }

    return "";
  }

  function divisionByCareer(row){
    row = row || {};

    var periodId = periodIdOf(row);
    var id = careerId(row);

    if(!periodId || !id){
      return "";
    }

    var state = buildState();

    var map =
      state.careerDivisionByPeriod[periodId];

    if(
      map &&
      map[id]
    ){
      return map[id];
    }

    var ids = Object.keys(
      state.careerDivisionByPeriod
    );

    for(var i = 0; i < ids.length; i += 1){
      if(samePeriod(ids[i], periodId)){
        return (
          state.careerDivisionByPeriod[ids[i]][id] ||
          ""
        );
      }
    }

    return "";
  }

  function studentDivision(row){
    return (
      divisionByCareer(row) ||
      directDivision(row) ||
      "Sin división"
    );
  }

  function hasDivision(row, division){
    if(!text(division)){
      return true;
    }

    return (
      key(studentDivision(row)) ===
      key(division)
    );
  }

  function listDivisions(rows, options){
    rows = Array.isArray(rows)
      ? rows
      : [];

    options = options || {};

    var periodId = canonicalPeriodId(
      options.periodoId ||
      options.periodId ||
      ""
    );

    var map = Object.create(null);

    if(periodId){
      divisionsForPeriod(periodId).forEach(function(division){
        if(
          division &&
          division.nombre
        ){
          map[key(division.nombre)] = division.nombre;
        }
      });
    }

    rows.forEach(function(row){
      if(!periodId){
        periodId = periodIdOf(row);
      }

      var division = studentDivision(row);

      if(division){
        map[key(division)] = division;
      }
    });

    return Object.keys(map)
      .map(function(id){
        return map[id];
      })
      .filter(Boolean)
      .sort(function(a, b){
        return text(a).localeCompare(
          text(b),
          "es",
          {
            sensitivity: "base"
          }
        );
      });
  }

  function listDivisionsWithEmpty(
    rows,
    emptyLabel,
    options
  ){
    var list = listDivisions(
      rows,
      options
    );

    emptyLabel = text(emptyLabel);

    return emptyLabel
      ? [emptyLabel].concat(
        list.filter(function(item){
          return key(item) !== key(emptyLabel);
        })
      )
      : list;
  }

  function status(){
    var state = buildState();

    return {
      ok: true,
      version: VERSION,
      source: state.source,
      periods: Object.keys(state.periodMap).length,
      builds: memo.builds,
      invalidations: memo.invalidations,
      fallbackParses: memo.fallbackParses,
      builtAt: state.builtAt
    };
  }

  var api = {
    version: VERSION,
    source: "BDLocal/adapters/bdl.divisiones.service.js",

    key: key,
    canonicalPeriodId: canonicalPeriodId,
    samePeriod: samePeriod,
    periodIdOf: periodIdOf,
    findPeriod: findPeriod,
    normalizeCareer: normalizeCareer,
    normalizeDivision: normalizeDivision,
    divisionsForPeriod: divisionsForPeriod,
    careersForPeriod: careersForPeriod,
    directDivision: directDivision,
    divisionByCareer: divisionByCareer,
    studentDivision: studentDivision,
    hasDivision: hasDivision,
    listDivisions: listDivisions,
    listDivisionsWithEmpty: listDivisionsWithEmpty,
    readState: buildState,

    readStore: function(){
      return buildState().store;
    },

    readRawCache: centralCache,
    invalidate: invalidate,
    status: status
  };

  window.BLDivisionesService = api;

  window.addEventListener("storage", function(event){
    if(
      !event ||
      [
        LS_DIVISIONES,
        LS_PERIODOS,
        CACHE_KEY,
        OLD_SNAPSHOT_KEY
      ].indexOf(event.key) >= 0
    ){
      invalidate();
    }
  });

  window.addEventListener(
    "bdlocal:conexiones-cache-updated",
    invalidate
  );

  window.addEventListener(
    "bdlocal:screen-data-updated",
    invalidate
  );

  try{
    window.dispatchEvent(
      new CustomEvent(
        "bdlocal:divisiones-service-ready",
        {
          detail: {
            ok: true,
            version: VERSION,
            source: api.source,
            at: new Date().toISOString()
          }
        }
      )
    );
  }catch(error){}
})(window);