/* =========================================================
Nombre completo: cone.stats.js
Ruta o ubicación: /Requisitos/BDLocal/conexiones/cone.stats.js

Función o funciones:
- Conectar Stats directamente con la caché central ya normalizada.
- Filtrar estudiantes y requisitos sin solicitar una reconstrucción completa.
- Relacionar en memoria los requisitos con cada estudiante por cédula y período.
- Memorizar índices y resúmenes por revisión de caché.
- Ejecutar refresco ligero por defecto y refresco completo solo cuando se solicita.
- Mantener el adaptador legacy usado por pantallas y botones antiguos.

Corrección:
- Antes, students() devolvía estudiantes sin integrar current.requirements.
- Stats calculaba requisitos sobre campos vacíos y marcaba a todos como no aprobados.
- Ahora cada estudiante se entrega con sus requisitos integrados temporalmente.
- No se escribe ni se modifica información en la base de datos.

Con qué se conecta:
- conexiones/cone.index.js.
- conexiones/cone.utils.js.
- Stats y adaptadores legacy de la aplicación.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.4.0-fast-authoritative";
  var HUB = window.BDLocalConexiones;
  var U = window.BDLocalConUtils;

  if(!HUB || !U){
    return;
  }

var memo = {
  token: "",
  summaries: Object.create(null),
  requirementsByCedula: Object.create(null),
  requirementsIndexed: false,
  hydratedStudents: [],
  hydratedStudentsToken: "",
  hydratedByPeriod: Object.create(null),
  calculations: 0
};

function text(value){
    return typeof U.text === "function"
      ? U.text(value)
      : String(value == null ? "" : value).trim();
  }

  function normalizeKey(value){
    if(typeof U.normalizeKey === "function"){
      return U.normalizeKey(value);
    }

    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function normalizeCedula(value){
    if(typeof U.normalizeCedula === "function"){
      return U.normalizeCedula(value);
    }

    var result = text(value)
      .replace(/[^0-9A-Za-z]/g, "");

    return /^\d{9}$/.test(result)
      ? "0" + result
      : result;
  }

  function canonicalPeriodId(value){
    if(typeof U.canonicalPeriodId === "function"){
      return U.canonicalPeriodId(value);
    }

    return text(value);
  }

  function samePeriod(a, b){
    if(typeof U.samePeriod === "function"){
      return U.samePeriod(a, b);
    }

    a = canonicalPeriodId(a);
    b = canonicalPeriodId(b);

    return (
      !b ||
      a === b ||
      normalizeKey(a) === normalizeKey(b)
    );
  }

  function cache(){
    return U.readCache();
  }

function resetMemo(){
  memo.token = "";
  memo.summaries = Object.create(null);
  memo.requirementsByCedula = Object.create(null);
  memo.requirementsIndexed = false;
  memo.hydratedStudents = [];
  memo.hydratedStudentsToken = "";
  memo.hydratedByPeriod = Object.create(null);
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
    memo.requirementsByCedula = Object.create(null);
    memo.requirementsIndexed = false;
    memo.hydratedStudents = [];
    memo.hydratedStudentsToken = "";
    memo.hydratedByPeriod = Object.create(null);
  }

  return token;
}

function periods(){
    var rows = cache().periods || [];

    return rows.slice();
  }

  function cedulaOf(row){
    row = row || {};

    return normalizeCedula(
      row.cedula ||
      row.numeroIdentificacion ||
      row.NumeroIdentificacion ||
      row.identificacion ||
      row.Identificacion ||
      row.Cedula ||
      row["Cédula"] ||
      row._cedula ||
      row._bl2Id ||
      ""
    );
  }

  function periodOf(row){
    row = row || {};

    return canonicalPeriodId(
      row.periodoId ||
      row.periodId ||
      row.periodoCanonicoId ||
      row.ultimoPeriodoId ||
      row.idPeriodo ||
      row._periodoId ||
      row._bl2PeriodoId ||
      ""
    );
  }

  function requirementKey(row){
    row = row || {};

    var nested =
      row.requisito &&
      typeof row.requisito === "object"
        ? row.requisito
        : null;

    return text(
      row.requisitoKey ||
      row.requirementKey ||
      row.key ||
      row.campo ||
      row.field ||
      row.nombre ||
      row.codigo ||
      (
        nested &&
        (
          nested.requisitoKey ||
          nested.key ||
          nested.nombre ||
          nested.codigo ||
          nested.id
        )
      ) ||
      (
        typeof row.requisito === "string"
          ? row.requisito
          : ""
      )
    );
  }

  function requirementValue(row){
    row = row || {};

    if(
      row.valor !== undefined &&
      row.valor !== null
    ){
      return row.valor;
    }

    if(
      row.value !== undefined &&
      row.value !== null
    ){
      return row.value;
    }

    if(
      row.estado !== undefined &&
      row.estado !== null
    ){
      if(
        row.estado &&
        typeof row.estado === "object"
      ){
        return (
          row.estado.id ||
          row.estado.value ||
          row.estado.label ||
          ""
        );
      }

      return row.estado;
    }

    if(
      row.cumple !== undefined &&
      row.cumple !== null
    ){
      return row.cumple;
    }

    if(
      row.aprobado !== undefined &&
      row.aprobado !== null
    ){
      return row.aprobado;
    }

    if(
      row.resultado !== undefined &&
      row.resultado !== null
    ){
      return row.resultado;
    }

    return "";
  }

  function buildRequirementsIndex(current){
    ensureMemo(current);

    if(memo.requirementsIndexed){
      return memo.requirementsByCedula;
    }

    memo.requirementsByCedula =
      Object.create(null);

    (current.requirements || []).forEach(function(row){
      row = row || {};

      var cedula = cedulaOf(row);

      if(!cedula){
        return;
      }

      if(!memo.requirementsByCedula[cedula]){
        memo.requirementsByCedula[cedula] = [];
      }

      memo.requirementsByCedula[cedula].push(row);
    });

    memo.requirementsIndexed = true;

    return memo.requirementsByCedula;
  }

  function requirementMatchesStudent(
    requirement,
    studentPeriodId
  ){
    var requirementPeriod =
      periodOf(requirement);

    if(
      !studentPeriodId ||
      !requirementPeriod
    ){
      return true;
    }

    return samePeriod(
      requirementPeriod,
      studentPeriodId
    );
  }

  function attachRequirementValue(
    student,
    requirement
  ){
    var key = requirementKey(requirement);
    var normalizedKey = normalizeKey(key);
    var value = requirementValue(requirement);

    if(key){
      student[key] = value;
    }

    if(normalizedKey){
      student[normalizedKey] = value;
    }

    if(
      requirement.requisitoKey &&
      text(requirement.requisitoKey)
    ){
      student[
        text(requirement.requisitoKey)
      ] = value;
    }

    if(
      requirement.requirementKey &&
      text(requirement.requirementKey)
    ){
      student[
        text(requirement.requirementKey)
      ] = value;
    }
  }

  function hydrateStudent(
    row,
    requirementsIndex
  ){
    row = row || {};

    var student =
      Object.assign({}, row);

    var cedula =
      cedulaOf(row);

    var periodoId =
      periodOf(row);

    var rows =
      cedula &&
      requirementsIndex[cedula]
        ? requirementsIndex[cedula]
        : [];

    var matched =
      rows.filter(function(requirement){
        return requirementMatchesStudent(
          requirement,
          periodoId
        );
      });

    matched.forEach(function(requirement){
      attachRequirementValue(
        student,
        requirement
      );
    });

    student.requisitos =
      matched.map(function(requirement){
        return Object.assign(
          {},
          requirement
        );
      });

    student._bdlRequirementsHydrated = true;
    student._bdlRequirementsCount =
      matched.length;

    return student;
  }

function copyHydratedStudent(row){
  var copy = Object.assign({}, row || {});

  copy.requisitos = Array.isArray(row && row.requisitos)
    ? row.requisitos.map(function(requirement){
        return Object.assign({}, requirement || {});
      })
    : [];

  return copy;
}

function hydrationScope(options){
  options = options || {};

  var periodoId = canonicalPeriodId(
    options.periodoId ||
    options.periodId ||
    ""
  );

  var matricula =
    options.matricula !== undefined
      ? options.matricula
      : options.estadoMatricula;

  var matriculaKey =
    matricula === undefined || matricula === null
      ? "__default__"
      : text(matricula) || "__todas__";

  return {
    key:
      (periodoId || "__todos__") +
      "|" +
      normalizeKey(matriculaKey),
    periodoId: periodoId,
    matricula: matricula
  };
}

function hydratedStudentsForOptions(current, options){
  current = current || cache();
  options = options || {};
  ensureMemo(current);

  var scope = hydrationScope(options);

  if(
    Object.prototype.hasOwnProperty.call(
      memo.hydratedByPeriod,
      scope.key
    )
  ){
    return memo.hydratedByPeriod[scope.key];
  }

  var baseOptions = {
    periodoId: scope.periodoId,
    periodId: scope.periodoId
  };

  if(
    scope.matricula !== undefined &&
    scope.matricula !== null
  ){
    baseOptions.matricula = scope.matricula;
    baseOptions.estadoMatricula = scope.matricula;
  }

  var rawRows = U.filterStudents(
    current.students || [],
    baseOptions
  );

  var requirementsIndex =
    buildRequirementsIndex(current);

  var hydrated = rawRows.map(function(row){
    return hydrateStudent(row, requirementsIndex);
  });

  memo.hydratedByPeriod[scope.key] = hydrated;
  memo.hydratedStudents = hydrated;
  memo.hydratedStudentsToken = memo.token;

  return hydrated;
}

function students(options){
  options = options || {};

  var current = cache();
  var hydrated = hydratedStudentsForOptions(
    current,
    options
  );

  var filtered = U.filterStudents(
    hydrated,
    options
  );

  return filtered.map(copyHydratedStudent);
}

function requirements(options){
    options = options || {};

    var current = cache();

    var periodoId = canonicalPeriodId(
      options.periodoId ||
      options.periodId ||
      ""
    );

    var cedula = normalizeCedula(
      options.cedula ||
      options.numeroIdentificacion ||
      ""
    );

    return (current.requirements || []).filter(function(row){
      row = row || {};

      var rowPeriod =
        periodOf(row);

      var rowCedula =
        cedulaOf(row);

      if(
        periodoId &&
        !samePeriod(
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
    periodoId = canonicalPeriodId(
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

    var requirementRows =
      requirements({
        periodoId: periodoId
      });

    var activos = 0;
    var retirados = 0;

    var careerMap =
      Object.create(null);

    var divisionMap =
      Object.create(null);

    rows.forEach(function(row){
      row = row || {};

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
          normalizeKey(carrera);

        careerMap[carreraKey] =
          carrera;
      }

      var divisionKey =
        normalizeKey(division);

      divisionMap[divisionKey] =
        division;
    });

    var result = {
      periodoId: periodoId,
      totalEstudiantes: rows.length,
      totalActivos: activos,
      totalRetirados: retirados,
      totalRequisitos: requirementRows.length,
      totalCarreras:
        Object.keys(careerMap).length,
      totalDivisiones:
        Object.keys(divisionMap).length,
      source: "BDLocalConStats",

      cacheRevision: Number(
        current.meta &&
        current.meta.revision ||
        0
      ),

      generatedAt:
        new Date().toISOString()
    };

    memo.summaries[memoKey] =
      result;

    memo.calculations += 1;

    return Object.assign(
      {},
      result
    );
  }

function refresh(options){
  options = Object.assign({}, options || {});

  var current = cache();
  var studentCount = Array.isArray(current.students)
    ? current.students.length
    : 0;
  var requirementCount = Array.isArray(current.requirements)
    ? current.requirements.length
    : 0;

  var explicitFull =
    options.full === true ||
    options.force === true ||
    options.mode === "full";

  var cacheIncomplete =
    studentCount === 0 ||
    (studentCount > 0 && requirementCount === 0);

  var needsFull = explicitFull || cacheIncomplete;
  var request;

  if(needsFull){
    request = Object.assign(
      {
        source: explicitFull
          ? "cone.stats.refresh.full"
          : "cone.stats.refresh.recover",
        mode: "full",
        full: true,
        immediate: true,
        force: explicitFull || cacheIncomplete,
        cooldown: 0
      },
      options,
      {
        mode: "full",
        full: true,
        immediate: true
      }
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

  return HUB.refreshCache(request).then(function(result){
    resetMemo();
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
    periodoId = canonicalPeriodId(
      periodoId || ""
    );

    var studentRows = students({
      periodoId: periodoId,
      matricula: ""
    });

    var requirementRows =
      requirements({
        periodoId: periodoId
      });

    return {
      periodoId: periodoId,
      estudiantes: studentRows,
      rows: studentRows,
      requisitos: requirementRows,
      resumen: summary(periodoId),
      source: "BDLocalConStats"
    };
  }

  var api = {
    version: VERSION,
    source:
      "BDLocal/conexiones/cone.stats.js",

    ready: HUB.ready,

    refresh: refresh,
    refreshFull: refreshFull,
    invalidate: resetMemo,

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
        estudiantes: rows,
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
    ensureMemo(current);
    var hydratedCount = Array.isArray(memo.hydratedStudents)
      ? memo.hydratedStudents.length
      : 0;

    return {
      ok: true,
      ready: true,
      version: VERSION,
      source: "BDLocalConStats",
      cacheRevision: Number(
        current.meta && current.meta.revision || 0
      ),
      cacheUpdatedAt: text(
        current.meta && current.meta.updatedAt || ""
      ),
      periods: Array.isArray(current.periods)
        ? current.periods.length
        : 0,
      students: Array.isArray(current.students)
        ? current.students.length
        : 0,
      requirements: Array.isArray(current.requirements)
        ? current.requirements.length
        : 0,
      hydratedStudents: hydratedCount,
      indexedStudents: Object.keys(
        memo.requirementsByCedula
      ).length,
      requirementsIndexed: memo.requirementsIndexed,
      cachedSummaries: Object.keys(memo.summaries).length,
      cachedPeriods: Object.keys(memo.hydratedByPeriod).length,
      calculations: memo.calculations,
      token: memo.token
    };
  }
};

  HUB.register(
    "stats",
    api
  );

  window.BDLocalStats = api;
  window.ConStats = api;

  window.BDLLegacyAdapter =
    Object.assign(
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
      resetMemo();
    }
  );
})(window);