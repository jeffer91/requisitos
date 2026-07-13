/* =========================================================
Nombre completo: cone.defensas.js
Ruta o ubicación: /BDLocal/conexiones/cone.defensas.js
Función o funciones:
- Conectar Defensas directamente con los servicios de BDLocal.
- Precargar estudiantes y períodos desde IndexedDB.
- Exponer adaptadores síncronos compatibles con DefartCore.
- Registrar Defensas en BDLocalConexiones.
- Recargar datos cuando Carga, Ficha u otra pantalla modifica BDLocal.
- Forzar un solo render después de cada recarga confirmada.
========================================================= */
(function(window){
  "use strict";

  var VERSION =
    "0.3.0-canonical-student-id";

  var HUB =
    window.BDLocalConexiones ||
    null;

  var state = {
    ready: false,
    loading: false,
    promise: null,
    loadedAt: "",
    source: "BDLocal/services",
    error: "",
    students: [],
    periods: [],
    refreshTimer: null,
    eventsBound: false
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

  function canonicalPeriodId(value){
    value = text(value);

    var match = value.match(
      /^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/
    );

    return match
      ? match[1] +
        "-" +
        match[2] +
        "__" +
        match[3] +
        "-" +
        match[4]

      : value.replace(
        /_+/g,
        "__"
      );
  }

  function normalizeCedula(value){
    var raw =
      text(value).replace(
        /[^0-9A-Za-z]/g,
        ""
      );

    return /^\d{9}$/.test(raw)
      ? "0" + raw
      : raw;
  }

  function studentPeriodId(
    periodoId,
    cedula
  ){
    periodoId =
      canonicalPeriodId(
        periodoId
      );

    cedula =
      normalizeCedula(
        cedula
      );

    return (
      cedula &&
      periodoId
    )
      ? cedula +
        "__" +
        periodoId
      : "";
  }

  function samePeriod(a, b){
    a = canonicalPeriodId(a);
    b = canonicalPeriodId(b);

    return (
      !b ||
      (
        !!a &&
        (
          a === b ||
          norm(a).replace(
            /[^a-z0-9]+/g,
            ""
          ) ===
          norm(b).replace(
            /[^a-z0-9]+/g,
            ""
          )
        )
      )
    );
  }

  function normalizePeriod(period){
    period = period || {};

    var id =
      canonicalPeriodId(
        period.id ||
        period.periodoId ||
        period.periodId ||
        period.value ||
        period.key ||
        ""
      );

    if (!id){
      return null;
    }

    var label = text(
      period.label ||
      period.periodoLabel ||
      period.nombre ||
      period.name ||
      id
    );

    return Object.assign(
      {},
      period,
      {
        id: id,
        value: id,
        key: id,
        label: label,
        nombre: label,
        periodoId: id,
        periodoLabel: label
      }
    );
  }

  function normalizeStudent(row){
    row = Object.assign(
      {},
      row || {}
    );

    var cedula =
      normalizeCedula(
        row.cedula ||
        row.numeroIdentificacion ||
        row.NumeroIdentificacion ||
        row.Cedula ||
        row["Cédula"] ||
        ""
      );

    var periodoId =
      canonicalPeriodId(
        row.periodoId ||
        row.periodId ||
        row.ultimoPeriodoId ||
        row._periodoId ||
        row._bl2PeriodoId ||
        ""
      );

    var periodoLabel = text(
      row.periodoLabel ||
      row.periodo ||
      row.Periodo ||
      row._periodo ||
      row._bl2Periodo ||
      periodoId
    );

    var carrera = text(
      row.NombreCarrera ||
      row.nombreCarrera ||
      row.Carrera ||
      row.carrera ||
      row._carrera ||
      ""
    );

    var sede = text(
      row.Sede ||
      row.sede ||
      row.campus ||
      row._sede ||
      ""
    );

    var division = text(
      row.division ||
      row.Division ||
      row["División"] ||
      row._division ||
      ""
    );

    try{
      if (
        !division &&
        window.BLDivisionesService &&
        typeof window.BLDivisionesService
          .studentDivision ===
          "function"
      ){
        division =
          window.BLDivisionesService
            .studentDivision(row);
      }
    }catch(error){}

    var previousId = text(
      row.idEstudiantePeriodo ||
      row.studentId ||
      row.id ||
      row._id ||
      ""
    );

    var canonicalId =
      studentPeriodId(
        periodoId,
        cedula
      );

    var resolvedId =
      canonicalId ||
      previousId ||
      cedula;

    if (
      canonicalId &&
      previousId &&
      previousId !== canonicalId
    ){
      row._legacyStudentId =
        row._legacyStudentId ||
        previousId;
    }

    row.id = resolvedId;
    row._id = resolvedId;
    row.studentId = resolvedId;
    row.idEstudiantePeriodo =
      resolvedId;

    row.cedula = cedula;
    row._cedula =
      row._cedula ||
      cedula;

    row.numeroIdentificacion =
      row.numeroIdentificacion ||
      cedula;

    row.NumeroIdentificacion =
      row.NumeroIdentificacion ||
      cedula;

    row.periodoId = periodoId;
    row.periodId = periodoId;

    row.ultimoPeriodoId =
      row.ultimoPeriodoId ||
      periodoId;

    row.periodoLabel =
      periodoLabel;

    row.Periodo =
      row.Periodo ||
      periodoLabel;

    row._periodoId =
      row._periodoId ||
      periodoId;

    row._periodo =
      row._periodo ||
      periodoLabel;

    row.Nombres =
      row.Nombres ||
      row.nombres ||
      row.Nombre ||
      row.nombre ||
      row.Estudiante ||
      row.estudiante ||
      "";

    row.nombres =
      row.nombres ||
      row.Nombres ||
      "";

    row.NombreCarrera =
      row.NombreCarrera ||
      carrera;

    row.Carrera =
      row.Carrera ||
      carrera;

    row.carrera =
      row.carrera ||
      carrera;

    row._carrera =
      row._carrera ||
      carrera ||
      "SIN CARRERA";

    row.Sede =
      row.Sede ||
      sede;

    row.sede =
      row.sede ||
      sede;

    row._sede =
      row._sede ||
      sede ||
      "SIN SEDE";

    row.division =
      division ||
      "Sin división";

    row._division =
      row._division ||
      row.division;

    row.divisiones =
      (
        Array.isArray(
          row.divisiones
        ) &&
        row.divisiones.length
      )
        ? row.divisiones
        : (
          row.division
            ? [row.division]
            : []
        );

    row.estadoMatricula =
      text(
        row.estadoMatricula ||
        row.EstadoMatricula ||
        row.estado ||
        row.Estado ||
        "ACTIVO"
      ).toUpperCase() ===
      "RETIRADO"
        ? "RETIRADO"
        : "ACTIVO";

    row._estadoMatricula =
      row._estadoMatricula ||
      row.estadoMatricula;

    return row;
  }

  function mergeNonEmpty(
    existing,
    incoming
  ){
    existing = existing || {};
    incoming = incoming || {};

    var merged =
      Object.assign(
        {},
        existing
      );

    Object.keys(
      incoming
    ).forEach(function(key){
      var value =
        incoming[key];

      if (
        value !== undefined &&
        value !== null &&
        text(value) !== ""
      ){
        merged[key] = value;
      }else if (
        merged[key] === undefined
      ){
        merged[key] = value;
      }
    });

    return normalizeStudent(
      merged
    );
  }

  function dedupeStudents(rows){
    var map =
      Object.create(null);

    var order = [];

    (
      Array.isArray(rows)
        ? rows
        : []
    ).forEach(function(input){
      var row =
        normalizeStudent(input);

      var id = text(
        row.idEstudiantePeriodo ||
        row.studentId ||
        row.id ||
        row.cedula
      );

      if (!id){
        return;
      }

      if (!map[id]){
        order.push(id);
      }

      map[id] =
        mergeNonEmpty(
          map[id],
          row
        );
    });

    return order.map(
      function(id){
        return map[id];
      }
    );
  }

  function service(name){
    return (
      window.BDLServices &&
      typeof window.BDLServices.get ===
        "function"
    )
      ? window.BDLServices.get(
        name
      )
      : null;
  }

  function filterStudents(
    rows,
    options
  ){
    options = options || {};

    rows =
      Array.isArray(rows)
        ? rows.map(
          normalizeStudent
        )
        : [];

    var periodoId =
      canonicalPeriodId(
        options.periodoId ||
        options.periodId ||
        options.period ||
        ""
      );

    var matricula = text(
      options.matricula ||
      options.estadoMatricula ||
      ""
    );

    var division = norm(
      options.division ||
      ""
    );

    var search = norm(
      options.search ||
      options.busqueda ||
      options.query ||
      ""
    );

    var limit =
      Number(
        options.limit ||
        0
      );

    rows = rows.filter(
      function(row){
        if (
          periodoId &&
          !samePeriod(
            row.periodoId ||
            row._periodoId ||
            row.ultimoPeriodoId,
            periodoId
          )
        ){
          return false;
        }

        if (
          matricula &&
          text(
            row.estadoMatricula ||
            row._estadoMatricula
          ).toUpperCase() !==
          matricula.toUpperCase()
        ){
          return false;
        }

        if (
          division &&
          norm(
            row.division ||
            row._division
          ) !== division
        ){
          return false;
        }

        if (search){
          var hay = norm(
            [
              row.cedula,
              row.numeroIdentificacion,
              row.Nombres,
              row.nombres,
              row.NombreCarrera,
              row.CodigoCarrera,
              row.division,
              row.Sede,
              row.CorreoPersonal,
              row.CorreoInstitucional,
              row.Celular
            ].join(" ")
          );

          if (
            hay.indexOf(
              search
            ) < 0
          ){
            return false;
          }
        }

        return true;
      }
    );

    return limit > 0
      ? rows.slice(
        0,
        limit
      )
      : rows;
  }

  function listPeriodsSync(){
    return state.periods.slice();
  }

  function getStudentsSync(options){
    return filterStudents(
      state.students,
      options || {}
    );
  }

  function listStudentsSync(options){
    var rows =
      getStudentsSync(
        options || {}
      );

    return {
      ok: true,
      rows: rows,
      total: rows.length,
      periodList:
        listPeriodsSync(),
      source: state.source,
      ready: state.ready,
      loadedAt:
        state.loadedAt
    };
  }

  function getStudentByCedulaSync(
    cedula,
    periodoId
  ){
    cedula =
      normalizeCedula(
        cedula
      );

    return getStudentsSync({
      periodoId:
        periodoId || "",
      matricula: ""
    }).filter(function(row){
      return normalizeCedula(
        row.cedula ||
        row.numeroIdentificacion
      ) === cedula;
    })[0] || null;
  }

  function getStudentByIdSync(
    id,
    options
  ){
    id = text(id);

    return getStudentsSync(
      Object.assign(
        {},
        options || {},
        {
          matricula: ""
        }
      )
    ).filter(function(row){
      return (
        text(row.id) === id ||
        text(row._id) === id ||
        text(row.studentId) === id ||
        text(row.idEstudiantePeriodo) === id ||
        text(row.cedula) === id ||
        text(row.numeroIdentificacion) === id
      );
    })[0] || null;
  }

  function snapshot(){
    return {
      meta: {
        source:
          state.source,

        updatedAt:
          state.loadedAt,

        totalStudents:
          state.students.length,

        totalPeriods:
          state.periods.length
      },

      periods:
        state.periods.slice(),

      students:
        state.students.slice(),

      history: [],

      diagnostics:
        state.error
          ? [
            {
              message:
                state.error
            }
          ]
          : []
    };
  }

  function patchAdapters(){
    var adapter = {
      ready:
        ready,

      refresh:
        reload,

      source:
        state.source,

      getSnapshot:
        snapshot,

      listPeriods:
        listPeriodsSync,

      getPeriods:
        listPeriodsSync,

      periods:
        listPeriodsSync,

      listStudents:
        listStudentsSync,

      getStudents:
        getStudentsSync,

      getRows:
        getStudentsSync,

      rows:
        getStudentsSync,

      all:
        getStudentsSync,

      listar:
        getStudentsSync,

      listAllStudents:
        function(){
          return getStudentsSync({
            matricula: ""
          });
        },

      filterStudents:
        getStudentsSync,

      listStudentsByStatus:
        function(
          statusValue,
          periodoId
        ){
          return getStudentsSync({
            matricula:
              statusValue ||
              "",

            periodoId:
              periodoId ||
              ""
          });
        },

      byCedula:
        getStudentByCedulaSync,

      getStudentByCedula:
        getStudentByCedulaSync,

      getStudentById:
        getStudentByIdSync,

      search:
        function(query, options){
          return listStudentsSync(
            Object.assign(
              {},
              options || {},
              {
                search:
                  query || ""
              }
            )
          );
        }
    };

    window.ExcelLocalRepo =
      Object.assign(
        {},
        window.ExcelLocalRepo ||
        {},
        adapter
      );

    window.BL2DataEngine =
      Object.assign(
        {},
        window.BL2DataEngine ||
        {},
        adapter,
        {
          search:
            function(options){
              return listStudentsSync(
                options || {}
              );
            },

          stats:
            function(periodoId){
              var students =
                getStudentsSync({
                  periodoId:
                    periodoId,

                  matricula: ""
                });

              return {
                periodoId:
                  periodoId,

                estudiantes:
                  students,

                requisitos: [],

                resumen: {
                  totalEstudiantes:
                    students.length
                },

                source:
                  state.source
              };
            }
        }
      );
  }

  function renderDefensas(){
    try{
      if (
        window.DefartCore &&
        typeof window.DefartCore
          .clearSummaryCache ===
          "function"
      ){
        window.DefartCore
          .clearSummaryCache();
      }

      if (
        window.DefartApp &&
        typeof window.DefartApp
          .render ===
          "function"
      ){
        window.DefartApp.render();
      }
    }catch(error){}
  }

  function reload(){
    if (state.loading){
      return (
        state.promise ||
        Promise.resolve(
          status()
        )
      );
    }

    state.loading = true;
    state.error = "";

    patchAdapters();

    var estudiantes =
      service("estudiantes");

    var periodos =
      service("periodos");

    if (
      !estudiantes ||
      typeof estudiantes.list !==
        "function"
    ){
      state.loading = false;
      state.ready = false;

      state.error =
        "BDLServiceEstudiantes no disponible.";

      return Promise.resolve(
        status()
      );
    }

    state.promise =
      Promise.all([
        estudiantes.list({
          matricula: ""
        }),

        (
          periodos &&
          typeof periodos.list ===
            "function"
        )
          ? periodos.list()
          : Promise.resolve([])
      ])
      .then(function(result){
        state.students =
          dedupeStudents(
            result[0] || []
          );

        state.periods =
          (result[1] || [])
            .map(
              normalizePeriod
            )
            .filter(Boolean);

        state.loadedAt =
          new Date()
            .toISOString();

        state.ready = true;
        state.error = "";

        patchAdapters();

        try{
          window.dispatchEvent(
            new CustomEvent(
              "bdlocal:defensas-ready",
              {
                detail:
                  status()
              }
            )
          );
        }catch(error){}

        window.setTimeout(
          renderDefensas,
          0
        );

        return status();
      })
      .catch(function(error){
        state.ready = false;

        state.error =
          error &&
          error.message
            ? error.message
            : String(error);

        patchAdapters();

        return status();
      })
      .finally(function(){
        state.loading = false;
        state.promise = null;
      });

    return state.promise;
  }

  function scheduleReload(){
    if (state.refreshTimer){
      window.clearTimeout(
        state.refreshTimer
      );
    }

    state.refreshTimer =
      window.setTimeout(
        function(){
          state.refreshTimer =
            null;

          reload();
        },
        180
      );
  }

  function bindEvents(){
    if (state.eventsBound){
      return;
    }

    state.eventsBound = true;

    [
      "bdlocal:screen-data-updated",
      "bdlocal:legacy-snapshot",
      "requisitos:bl:snapshot-changed",
      "bl2:students-saved",
      "bl2:student-updated"
    ].forEach(function(name){
      window.addEventListener(
        name,
        scheduleReload
      );
    });

    window.addEventListener(
      "storage",
      function(event){
        if (
          event &&
          [
            "REQ_BDLOCAL_CONEXIONES_CACHE_V1",
            "REQ_BDLOCAL_LEGACY_SNAPSHOT_V1",
            "REQ_EXCEL_LOCAL_V1:snapshot"
          ].indexOf(
            event.key
          ) >= 0
        ){
          scheduleReload();
        }
      }
    );
  }

  function ready(){
    return state.ready
      ? Promise.resolve(
        status()
      )
      : reload();
  }

  function status(){
    return {
      ok:
        state.ready &&
        !state.error,

      ready:
        state.ready,

      loading:
        state.loading,

      version:
        VERSION,

      source:
        state.source,

      students:
        state.students.length,

      periods:
        state.periods.length,

      loadedAt:
        state.loadedAt,

      error:
        state.error
    };
  }

  var api = {
    version:
      VERSION,

    source:
      "BDLocal/conexiones/cone.defensas.js",

    ready:
      ready,

    refresh:
      reload,

    reload:
      reload,

    status:
      status,

    snapshot:
      snapshot,

    getSnapshot:
      snapshot,

    listStudents:
      listStudentsSync,

    getStudents:
      getStudentsSync,

    listPeriods:
      listPeriodsSync,

    getPeriods:
      listPeriodsSync,

    filterStudents:
      getStudentsSync,

    patchAdapters:
      patchAdapters
  };

  window.BDLocalConeDefensas =
    api;

  window.BDLocalDefensas =
    api;

  window.ConDefensas =
    api;

  if (
    HUB &&
    typeof HUB.register ===
      "function"
  ){
    HUB.register(
      "defensas",
      api
    );
  }

  patchAdapters();
  bindEvents();

  if (
    document.readyState ===
    "loading"
  ){
    document.addEventListener(
      "DOMContentLoaded",
      function(){
        reload();
      }
    );
  }else{
    reload();
  }
})(window);