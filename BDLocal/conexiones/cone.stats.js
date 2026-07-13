/* =========================================================
Nombre completo: cone.stats.js
Ruta o ubicación: /Requisitos/BDLocal/conexiones/cone.stats.js
Función o funciones:
- Conectar Stats directamente con la caché central ya normalizada.
- Filtrar estudiantes y requisitos sin solicitar una reconstrucción completa.
- Memorizar resúmenes por revisión de caché y período.
- Ejecutar refresco ligero por defecto y refresco completo solo cuando se solicita.
- Mantener el adaptador legacy usado por pantallas y botones antiguos.
Con qué se conecta:
- conexiones/cone.index.js.
- conexiones/cone.utils.js.
- Stats y adaptadores legacy de la aplicación.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.2.0-cache-first";
  var HUB = window.BDLocalConexiones;
  var U = window.BDLocalConUtils;

  if(!HUB || !U){
    return;
  }

  var memo = {
    token: "",
    summaries: Object.create(null),
    calculations: 0
  };

  function text(value){
    return typeof U.text === "function"
      ? U.text(value)
      : String(value == null ? "" : value).trim();
  }

  function cache(){
    return U.readCache();
  }

  function cacheToken(current){
    current = current || cache();

    var meta = current.meta || {};

    return [
      Number(meta.revision || 0),
      text(meta.updatedAt || ""),

      Array.isArray(current.students)
        ? current.students.length
        : 0,

      Array.isArray(current.requirements)
        ? current.requirements.length
        : 0
    ].join("|");
  }

  function ensureMemo(current){
    var token = cacheToken(current);

    if(memo.token !== token){
      memo.token = token;
      memo.summaries = Object.create(null);
    }

    return token;
  }

  function periods(){
    var rows = cache().periods || [];
    return rows.slice();
  }

  function students(options){
    var current = cache();

    return U.filterStudents(
      current.students || [],
      options || {}
    );
  }

  function requirements(options){
    options = options || {};

    var current = cache();

    var periodoId = U.canonicalPeriodId(
      options.periodoId ||
      options.periodId ||
      ""
    );

    var cedula =
      typeof U.normalizeCedula === "function"
        ? U.normalizeCedula(
          options.cedula ||
          options.numeroIdentificacion ||
          ""
        )
        : text(
          options.cedula ||
          options.numeroIdentificacion ||
          ""
        );

    return (current.requirements || []).filter(function(row){
      row = row || {};

      var rowPeriod = U.canonicalPeriodId(
        row.periodoId ||
        row.periodId ||
        row.periodoCanonicoId ||
        ""
      );

      var rowCedula =
        typeof U.normalizeCedula === "function"
          ? U.normalizeCedula(
            row.cedula ||
            row.numeroIdentificacion ||
            ""
          )
          : text(
            row.cedula ||
            row.numeroIdentificacion ||
            ""
          );

      if(
        periodoId &&
        !U.samePeriod(
          rowPeriod,
          periodoId
        )
      ){
        return false;
      }

      if(
        cedula &&
        rowCedula !== cedula
      ){
        return false;
      }

      return true;
    });
  }

  function summary(periodoId){
    periodoId = U.canonicalPeriodId(
      periodoId || ""
    );

    var current = cache();
    ensureMemo(current);

    var memoKey =
      periodoId ||
      "__todos__";

    if(memo.summaries[memoKey]){
      return Object.assign(
        {},
        memo.summaries[memoKey]
      );
    }

    var rows = U.filterStudents(
      current.students || [],
      {
        periodoId: periodoId,
        matricula: ""
      }
    );

    var requirementRows = requirements({
      periodoId: periodoId
    });

    var activos = 0;
    var retirados = 0;

    var careerMap = Object.create(null);
    var divisionMap = Object.create(null);

    rows.forEach(function(row){
      var estado = text(
        row.estadoMatricula ||
        row._estadoMatricula ||
        "ACTIVO"
      ).toUpperCase();

      if(estado === "RETIRADO"){
        retirados += 1;
      }else{
        activos += 1;
      }

      var carrera = text(
        row.NombreCarrera ||
        row.nombreCarrera ||
        row.Carrera ||
        row.carrera ||
        row.CodigoCarrera ||
        row.codigoCarrera ||
        ""
      );

      var division = text(
        row.division ||
        row._division ||
        "Sin división"
      ) || "Sin división";

      if(carrera){
        var carreraKey =
          typeof U.normalizeKey === "function"
            ? U.normalizeKey(carrera)
            : carrera.toLowerCase();

        careerMap[carreraKey] = carrera;
      }

      var divisionKey =
        typeof U.normalizeKey === "function"
          ? U.normalizeKey(division)
          : division.toLowerCase();

      divisionMap[divisionKey] = division;
    });

    var result = {
      periodoId: periodoId,
      totalEstudiantes: rows.length,
      totalActivos: activos,
      totalRetirados: retirados,
      totalRequisitos: requirementRows.length,
      totalCarreras: Object.keys(careerMap).length,
      totalDivisiones: Object.keys(divisionMap).length,
      source: "BDLocalConStats",

      cacheRevision: Number(
        current.meta &&
        current.meta.revision ||
        0
      ),

      generatedAt:
        new Date().toISOString()
    };

    memo.summaries[memoKey] = result;
    memo.calculations += 1;

    return Object.assign(
      {},
      result
    );
  }

  function refresh(options){
    options = Object.assign(
      {},
      options || {}
    );

    var explicitFull =
      options.full === true ||
      options.force === true ||
      options.mode === "full";

    var request;

    if(explicitFull){
      request = Object.assign(
        {
          source: "cone.stats.refresh.full",
          mode: "full",
          full: true,
          immediate: true,

          force:
            options.force === true,

          cooldown: 0
        },
        options
      );
    }else{
      request = Object.assign(
        {
          source: "cone.stats.refresh.light",
          mode: "light",
          light: true,
          immediate: false
        },
        options,
        {
          full: false,
          mode: "light",
          light: true
        }
      );
    }

    return HUB.refreshCache(request)
      .then(function(result){
        memo.token = "";
        memo.summaries = Object.create(null);

        return result;
      });
  }

  function refreshFull(options){
    options = options || {};

    return refresh(
      Object.assign(
        {},
        options,
        {
          source:
            options.source ||
            "cone.stats.refreshFull",

          mode: "full",
          full: true,
          immediate: true,
          force: true
        }
      )
    );
  }

  function stats(periodoId){
    periodoId = U.canonicalPeriodId(
      periodoId || ""
    );

    var studentRows = students({
      periodoId: periodoId,
      matricula: ""
    });

    var requirementRows = requirements({
      periodoId: periodoId
    });

    return {
      periodoId: periodoId,
      estudiantes: studentRows,
      requisitos: requirementRows,
      resumen: summary(periodoId),
      source: "BDLocalConStats"
    };
  }

  var api = {
    version: VERSION,
    source: "BDLocal/conexiones/cone.stats.js",
    ready: HUB.ready,

    refresh: refresh,
    refreshFull: refreshFull,

    periods: periods,
    listPeriods: periods,
    getPeriods: periods,
    periodos: periods,

    students: students,
    getStudents: students,

    listStudents: function(options){
      var rows = students(
        options || {}
      );

      return {
        ok: true,
        rows: rows,
        total: rows.length,
        periodList: periods(),
        source: "BDLocalConStats"
      };
    },

    rows: students,
    getRows: students,

    requirements: requirements,
    getRequirements: requirements,

    summary: summary,
    getSummary: summary,
    resumen: summary,

    stats: stats,

    status: function(){
      var current = cache();

      return {
        ok: true,
        version: VERSION,

        cacheRevision: Number(
          current.meta &&
          current.meta.revision ||
          0
        ),

        students:
          Array.isArray(current.students)
            ? current.students.length
            : 0,

        requirements:
          Array.isArray(current.requirements)
            ? current.requirements.length
            : 0,

        cachedSummaries:
          Object.keys(memo.summaries).length,

        calculations:
          memo.calculations
      };
    }
  };

  HUB.register(
    "stats",
    api
  );

  window.BDLocalStats = api;
  window.ConStats = api;

  window.BDLLegacyAdapter = Object.assign(
    {},
    window.BDLLegacyAdapter || {},
    {
      version: VERSION,
      source: "BDLocalConStats",
      refresh: refresh,
      refreshFull: refreshFull,

      getSnapshot: function(){
        return cache();
      }
    }
  );

  window.addEventListener(
    "bdlocal:conexiones-cache-updated",
    function(){
      memo.token = "";
      memo.summaries = Object.create(null);
    }
  );
})(window);