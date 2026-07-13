/* =========================================================
Nombre completo: cone.tabla.js
Ruta o ubicación: /Requisitos/BDLocal/conexiones/cone.tabla.js
Función o funciones:
- Conectar Tabla con la caché central de Base Local.
- Entregar estudiantes junto con sus requisitos actuales.
- Relacionar datos por cédula y período.
- Mantener compatibilidad con conectores y adaptadores antiguos.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.1.0-requirements-envelope";
  var HUB = window.BDLocalConexiones;
  var U = window.BDLocalConUtils;

  if(!HUB || !U){ return; }

  function text(value){
    return U.text
      ? U.text(value)
      : String(value == null ? "" : value).trim();
  }

  function array(value){
    return Array.isArray(value)
      ? value
      : [];
  }

  function cache(){
    var current =
      U.readCache
        ? U.readCache()
        : null;

    return current &&
      typeof current === "object"
        ? current
        : {
            meta: {},
            periods: [],
            students: [],
            requirements: [],
            summaries: {},
            diagnostics: []
          };
  }

  function normalizeCedula(value){
    return U.normalizeCedula
      ? U.normalizeCedula(value)
      : text(value).replace(
          /[^0-9A-Za-z]/g,
          ""
        );
  }

  function canonicalPeriod(value){
    return U.canonicalPeriodId
      ? U.canonicalPeriodId(value)
      : text(value);
  }

  function samePeriod(a, b){
    if(U.samePeriod){
      return U.samePeriod(a, b);
    }

    a = canonicalPeriod(a);
    b = canonicalPeriod(b);

    return !b || (
      !!a &&
      a === b
    );
  }

  function rowCedula(row){
    row = row || {};

    return normalizeCedula(
      row._cedula ||
      row.cedula ||
      row.numeroIdentificacion ||
      row.NumeroIdentificacion ||
      ""
    );
  }

  function rowPeriod(row){
    row = row || {};

    return canonicalPeriod(
      row._periodoId ||
      row.periodoId ||
      row.periodId ||
      row.periodoCanonicoId ||
      row.ultimoPeriodoId ||
      ""
    );
  }

  function identity(row){
    var cedula =
      rowCedula(row);

    var periodoId =
      rowPeriod(row);

    return cedula && periodoId
      ? cedula + "::" + periodoId
      : "";
  }

  function listPeriods(){
    return array(
      cache().periods
    )
      .map(function(item){
        return U.normalizePeriod
          ? U.normalizePeriod(item)
          : item;
      })
      .filter(Boolean);
  }

  function listRequirements(options){
    options = options || {};

    var current =
      cache();

    var periodoId =
      canonicalPeriod(
        options.periodoId ||
        options.periodId ||
        options.period ||
        ""
      );

    var cedula =
      normalizeCedula(
        options.cedula ||
        options.numeroIdentificacion ||
        ""
      );

    var requisitoKey =
      text(
        options.requisitoKey ||
        options.requirementKey ||
        options.key ||
        ""
      ).toLowerCase();

    return array(
      current.requirements ||
      current.requisitos
    ).filter(function(item){
      item = item || {};

      if(
        periodoId &&
        !samePeriod(
          rowPeriod(item),
          periodoId
        )
      ){
        return false;
      }

      if(
        cedula &&
        rowCedula(item) !== cedula
      ){
        return false;
      }

      if(requisitoKey){
        var currentKey =
          text(
            item.requisitoKey ||
            item.key ||
            item.nombre ||
            item.field ||
            ""
          ).toLowerCase();

        if(currentKey !== requisitoKey){
          return false;
        }
      }

      return true;
    });
  }

  function requirementsForStudents(
    rows,
    requirements
  ){
    var allowed =
      Object.create(null);

    array(rows).forEach(function(row){
      var id =
        identity(row);

      if(id){
        allowed[id] = true;
      }
    });

    return array(
      requirements
    ).filter(function(item){
      var id =
        identity(item);

      return !!(
        id &&
        allowed[id]
      );
    });
  }

  function attachRequirements(
    rows,
    requirements
  ){
    var grouped =
      Object.create(null);

    array(requirements).forEach(function(item){
      var id =
        identity(item);

      if(!id){
        return;
      }

      if(!grouped[id]){
        grouped[id] = [];
      }

      grouped[id].push(item);
    });

    return array(rows).map(function(row){
      var id =
        identity(row);

      var linked =
        id
          ? grouped[id] || []
          : [];

      return linked.length
        ? Object.assign(
            {},
            row,
            {
              requisitos:
                linked.slice(),

              requirements:
                linked.slice()
            }
          )
        : row;
    });
  }

  function listStudents(options){
    options =
      Object.assign(
        {},
        options || {}
      );

    var current =
      cache();

    var filtered =
      U.filterStudents
        ? U.filterStudents(
            array(current.students),
            options
          )
        : array(
            current.students
          ).slice();

    var total =
      filtered.length;

    var limit =
      Math.max(
        0,
        Number(
          options.limit ||
          0
        )
      );

    if(limit > 0){
      filtered =
        filtered.slice(
          0,
          limit
        );
    }

    var relevantRequirements =
      requirementsForStudents(
        filtered,
        listRequirements(options)
      );

    var rows =
      attachRequirements(
        filtered,
        relevantRequirements
      );

    return {
      ok: true,

      rows:
        rows,

      students:
        rows,

      requirements:
        relevantRequirements,

      requisitos:
        relevantRequirements,

      total:
        total,

      returned:
        rows.length,

      periodList:
        listPeriods(),

      source:
        "BDLocalConTabla"
    };
  }

  function getStudents(options){
    return listStudents(
      options || {}
    ).rows;
  }

  function getRequirements(options){
    return listRequirements(
      options || {}
    );
  }

  function getSnapshot(options){
    options =
      Object.assign(
        {
          matricula: ""
        },
        options || {}
      );

    var current =
      cache();

    var result =
      listStudents(options);

    var periods =
      listPeriods();

    return {
      ok: true,

      meta:
        Object.assign(
          {},
          current.meta || {}
        ),

      periods:
        periods,

      periodList:
        periods,

      students:
        result.rows,

      rows:
        result.rows,

      requirements:
        result.requirements,

      requisitos:
        result.requirements,

      summaries:
        Object.assign(
          {},
          current.summaries || {}
        ),

      diagnostics:
        array(
          current.diagnostics
        ).slice(),

      history:
        [],

      total:
        result.total,

      source:
        "BDLocalConTabla"
    };
  }

  function listAllStudents(){
    return getStudents({
      matricula: ""
    });
  }

  function listStudentsByStatus(
    status,
    periodoId
  ){
    return getStudents({
      matricula:
        status || "",

      periodoId:
        periodoId || ""
    });
  }

  function getStudentById(
    id,
    options
  ){
    id = text(id);

    if(!id){
      return null;
    }

    options =
      Object.assign(
        {},
        options || {},
        {
          matricula:
            options &&
            options.matricula != null
              ? options.matricula
              : ""
        }
      );

    return getStudents(options)
      .filter(function(row){
        return (
          text(row.id) === id ||
          text(row._id) === id ||
          rowCedula(row) ===
            normalizeCedula(id)
        );
      })[0] || null;
  }

  function getStudentByCedula(
    cedula,
    periodoId
  ){
    cedula =
      normalizeCedula(cedula);

    if(!cedula){
      return null;
    }

    return getStudents({
      periodoId:
        periodoId || "",

      matricula:
        ""
    }).filter(function(row){
      return (
        rowCedula(row) ===
        cedula
      );
    })[0] || null;
  }

  function refresh(options){
    return HUB.refreshCache(
      Object.assign(
        {
          source:
            "cone.tabla.refresh",

          full:
            true,

          immediate:
            true
        },
        options || {}
      )
    );
  }

  var api = {
    version:
      VERSION,

    source:
      "BDLocal/conexiones/cone.tabla.js",

    ready:
      HUB.ready,

    refresh:
      refresh,

    listPeriods:
      listPeriods,

    getPeriods:
      listPeriods,

    periods:
      listPeriods,

    periodos:
      listPeriods,

    listStudents:
      listStudents,

    getStudents:
      getStudents,

    rows:
      getStudents,

    getRows:
      getStudents,

    listarEstudiantes:
      getStudents,

    listAllStudents:
      listAllStudents,

    filterStudents:
      function(options){
        return getStudents(
          options || {}
        );
      },

    listStudentsByStatus:
      listStudentsByStatus,

    listRequirements:
      listRequirements,

    getRequirements:
      getRequirements,

    requirements:
      getRequirements,

    requisitos:
      getRequirements,

    getSnapshot:
      getSnapshot,

    snapshot:
      getSnapshot,

    readCache:
      getSnapshot,

    getStudentById:
      getStudentById,

    getStudentByCedula:
      getStudentByCedula,

    buscarPorCedula:
      getStudentByCedula,

    search:
      function(query, options){
        return listStudents(
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

  HUB.register(
    "tabla",
    api
  );

  window.BDLocalTabla =
    api;

  window.ConTabla =
    api;

  window.ExcelLocalRepo =
    Object.assign(
      {},
      window.ExcelLocalRepo || {},
      api,
      {
        getSnapshot:
          getSnapshot,

        all:
          getStudents,

        listar:
          getStudents,

        byCedula:
          getStudentByCedula
      }
    );

  window.BL2DataEngine =
    Object.assign(
      {},
      window.BL2DataEngine || {},
      {
        source:
          "BDLocalConTabla",

        listPeriods:
          listPeriods,

        getPeriods:
          listPeriods,

        periods:
          listPeriods,

        listStudents:
          listStudents,

        getStudents:
          getStudents,

        getRequirements:
          getRequirements,

        getSnapshot:
          getSnapshot,

        getStudentById:
          getStudentById,

        getStudentByCedula:
          getStudentByCedula,

        search:
          function(options){
            return listStudents(
              options || {}
            );
          }
      }
    );

  window.BL2EstudiantesRepo =
    Object.assign(
      {},
      window.BL2EstudiantesRepo || {},
      {
        buscar:
          function(options){
            return listStudents(
              options || {}
            );
          },

        listPeriods:
          listPeriods,

        getRequirements:
          getRequirements,

        getSnapshot:
          getSnapshot,

        obtenerPorCedula:
          getStudentByCedula,

        getStudentById:
          getStudentById
      }
    );
})(window);