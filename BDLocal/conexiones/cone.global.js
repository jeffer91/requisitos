/* =========================================================
Nombre completo: cone.global.js
Ruta o ubicación: /Requisitos/BDLocal/conexiones/cone.global.js
Función o funciones:
- Conectar Global con la caché consolidada de BDLocal.
- Hidratar cada estudiante con sus requisitos del mismo período.
- Evitar cruces entre períodos y duplicados por estudiante-período.
- Entregar períodos, estudiantes, requisitos, carreras y catálogo.
- Ejecutar refrescos reales mediante BDLocalConexiones.
- Volver a renderizar Global cuando otra pantalla modifica la base.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.2.0-hydrated-global";
  var U = window.BDLocalConUtils;
  var hub = window.BDLocalConexiones;
  var refreshTimer = null;
  var eventsBound = false;

  if(!U){
    return;
  }

  function text(value){
    return U.text
      ? U.text(value)
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

  function compact(value){
    return norm(value)
      .replace(/[^a-z0-9]+/g, "");
  }

  function clone(value){
    if(U.clone){
      return U.clone(value);
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

  function cedulaOf(row){
    row = row || {};

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

    return U.normalizeCedula
      ? U.normalizeCedula(value)
      : value.replace(
          /[^0-9A-Za-z]/g,
          ""
        );
  }

  function periodIdOf(row){
    row = row || {};

    var value = text(
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

    return U.canonicalPeriodId
      ? U.canonicalPeriodId(value)
      : value;
  }

  function samePeriod(a, b){
    if(!text(a) || !text(b)){
      return text(a) === text(b);
    }

    return U.samePeriod
      ? U.samePeriod(a, b)
      : norm(a) === norm(b);
  }

  function identityKey(row){
    var cedula =
      cedulaOf(row);

    var periodoId =
      periodIdOf(row);

    return periodoId && cedula
      ? periodoId + "__" + cedula
      : "";
  }

  function requirementName(req){
    req = req || {};

    return text(
      req.requisitoId ||
      req.requisitoKey ||
      req.requisito ||
      req.nombreRequisito ||
      req.requisitoNombre ||
      req.campo ||
      req.field ||
      req.key ||
      req.nombre ||
      req.label
    );
  }

  function requirementValue(req){
    req = req || {};

    if(
      Object.prototype.hasOwnProperty.call(
        req,
        "estado"
      )
    ){
      return req.estado;
    }

    if(
      Object.prototype.hasOwnProperty.call(
        req,
        "estadoKey"
      )
    ){
      return req.estadoKey;
    }

    if(
      Object.prototype.hasOwnProperty.call(
        req,
        "valor"
      )
    ){
      return req.valor;
    }

    if(
      Object.prototype.hasOwnProperty.call(
        req,
        "value"
      )
    ){
      return req.value;
    }

    if(
      Object.prototype.hasOwnProperty.call(
        req,
        "cumple"
      )
    ){
      return req.cumple;
    }

    if(
      Object.prototype.hasOwnProperty.call(
        req,
        "resultado"
      )
    ){
      return req.resultado;
    }

    return "";
  }

  function putIfUseful(
    target,
    property,
    value
  ){
    if(!property){
      return;
    }

    if(
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
      text(target[property]) === ""
    ){
      target[property] = value;
    }
  }

  function applyRequirementAliases(
    target,
    name,
    value
  ){
    var id =
      compact(name);

    if(!id){
      return;
    }

    putIfUseful(
      target,
      name,
      value
    );

    if(id.indexOf("academ") >= 0){
      putIfUseful(
        target,
        "Académico",
        value
      );
    }

    if(id.indexOf("document") >= 0){
      putIfUseful(
        target,
        "Documentación",
        value
      );
    }

    if(
      id.indexOf("financier") >= 0 ||
      id.indexOf("pago") >= 0
    ){
      putIfUseful(
        target,
        "Financiero",
        value
      );
    }

    if(id.indexOf("titulacion") >= 0){
      putIfUseful(
        target,
        "Titulación",
        value
      );
    }

    if(id.indexOf("practic") >= 0){
      putIfUseful(
        target,
        "PrácticasVinculacion",
        value
      );
    }

    if(id.indexOf("vincul") >= 0){
      putIfUseful(
        target,
        "Vinculación",
        value
      );
    }

    if(id.indexOf("seguimiento") >= 0){
      putIfUseful(
        target,
        "SeguimientoGraduados",
        value
      );
    }

    if(id.indexOf("ingles") >= 0){
      putIfUseful(
        target,
        "Inglés",
        value
      );
    }

    if(
      id.indexOf("actualizacion") >= 0 &&
      id.indexOf("dato") >= 0
    ){
      putIfUseful(
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
      putIfUseful(
        target,
        "AprobacionTitulacion",
        value
      );
    }

    if(
      id === "aprobacioncomplexivoproyecto" ||
      (
        id.indexOf("aprobacion") >= 0 &&
        (
          id.indexOf("complexivo") >= 0 ||
          id.indexOf("proyecto") >= 0
        )
      )
    ){
      putIfUseful(
        target,
        "AprobacionComplexivoProyecto",
        value
      );
    }
  }

  function requirementMatchesStudent(
    req,
    student
  ){
    var reqCedula =
      cedulaOf(req);

    var studentCedula =
      cedulaOf(student);

    var reqPeriod =
      periodIdOf(req);

    var studentPeriod =
      periodIdOf(student);

    if(
      reqCedula &&
      studentCedula &&
      reqCedula !== studentCedula
    ){
      return false;
    }

    if(
      reqPeriod &&
      studentPeriod &&
      !samePeriod(
        reqPeriod,
        studentPeriod
      )
    ){
      return false;
    }

    var reqId = text(
      req.idEstudiantePeriodo ||
      req.matriculaId ||
      ""
    );

    var studentId = text(
      student.idEstudiantePeriodo ||
      student.matriculaId ||
      student.id ||
      ""
    );

    if(
      reqId &&
      studentId &&
      reqId === studentId
    ){
      return true;
    }

    return !!(
      reqCedula &&
      studentCedula &&
      reqCedula === studentCedula &&
      (
        !reqPeriod ||
        !studentPeriod ||
        samePeriod(
          reqPeriod,
          studentPeriod
        )
      )
    );
  }

  function mergeRows(base, extra){
    var result =
      Object.assign(
        {},
        base || {}
      );

    Object.keys(
      extra || {}
    ).forEach(function(property){
      putIfUseful(
        result,
        property,
        extra[property]
      );
    });

    return result;
  }

  function hydrateStudents(
    studentRows,
    requirementRows
  ){
    var requirementsByIdentity =
      Object.create(null);

    var requirementsByCedula =
      Object.create(null);

    array(
      requirementRows
    ).forEach(function(req){
      var id =
        identityKey(req);

      var cedula =
        cedulaOf(req);

      if(id){
        if(!requirementsByIdentity[id]){
          requirementsByIdentity[id] = [];
        }

        requirementsByIdentity[id]
          .push(req);
      }

      if(cedula){
        if(!requirementsByCedula[cedula]){
          requirementsByCedula[cedula] = [];
        }

        requirementsByCedula[cedula]
          .push(req);
      }
    });

    var byStudentPeriod =
      Object.create(null);

    var withoutIdentity = [];

    array(
      studentRows
    ).forEach(function(raw){
      var normalized =
        U.normalizeStudent
          ? U.normalizeStudent(raw)
          : Object.assign(
              {},
              raw || {}
            );

      var row =
        Object.assign(
          {},
          normalized || {},
          raw || {}
        );

      var id =
        identityKey(row);

      var cedula =
        cedulaOf(row);

      var linked =
        id &&
        requirementsByIdentity[id]
          ? requirementsByIdentity[id].slice()
          : array(
              requirementsByCedula[cedula]
            ).filter(function(req){
              return requirementMatchesStudent(
                req,
                row
              );
            });

      row._globalRequirements =
        linked.map(clone);

      row.requisitos =
        linked.map(clone);

      linked.forEach(function(req){
        var name =
          requirementName(req);

        var value =
          requirementValue(req);

        applyRequirementAliases(
          row,
          name,
          value
        );
      });

      if(id){
        byStudentPeriod[id] =
          byStudentPeriod[id]
            ? mergeRows(
                byStudentPeriod[id],
                row
              )
            : row;
      }else{
        withoutIdentity.push(row);
      }
    });

    return Object.keys(
      byStudentPeriod
    ).map(function(id){
      return byStudentPeriod[id];
    }).concat(
      withoutIdentity
    );
  }

  function ready(){
    return (
      hub &&
      typeof hub.ready === "function"
    )
      ? hub.ready().catch(function(){
          return status();
        })
      : Promise.resolve(
          status()
        );
  }

  function refresh(options){
    return (
      hub &&
      typeof hub.refreshCache === "function"
    )
      ? hub.refreshCache(
          Object.assign(
            {
              source:
                "ConGlobal",

              full:
                true,

              immediate:
                true
            },
            options || {}
          )
        ).catch(function(){
          return U.readCache();
        })
      : Promise.resolve(
          U.readCache()
        );
  }

  function cache(){
    try{
      return (
        U.readCache() ||
        {}
      );
    }catch(error){
      return {
        meta: {},
        periods: [],
        students: [],
        requirements: [],
        diagnostics: [
          {
            message:
              error.message
          }
        ]
      };
    }
  }

  function normalizePeriod(period){
    return U.normalizePeriod
      ? U.normalizePeriod(period)
      : period;
  }

  function periods(){
    return array(
      cache().periods
    )
      .map(normalizePeriod)
      .filter(Boolean);
  }

  function allRequirements(){
    return array(
      cache().requirements
    ).map(clone);
  }

  function allStudents(){
    var current =
      cache();

    return hydrateStudents(
      array(current.students),
      array(current.requirements)
    );
  }

  function students(filters){
    filters =
      filters || {};

    var rows =
      allStudents();

    return U.filterStudents
      ? U.filterStudents(
          rows,
          filters
        )
      : rows;
  }

  function requirements(filters){
    filters =
      filters || {};

    var periodoId = text(
      filters.periodoId ||
      filters.periodId ||
      ""
    );

    var cedula =
      cedulaOf(filters);

    return allRequirements()
      .filter(function(req){
        return (
          !periodoId ||
          samePeriod(
            periodIdOf(req),
            periodoId
          )
        ) && (
          !cedula ||
          cedulaOf(req) === cedula
        );
      });
  }

  function careers(){
    var map =
      Object.create(null);

    students({
      matricula: ""
    }).forEach(function(row){
      var nombre = text(
        row.NombreCarrera ||
        row.nombreCarrera ||
        row.carrera ||
        row.Carrera ||
        row._carrera
      );

      var codigo = text(
        row.CodigoCarrera ||
        row.codigoCarrera ||
        row.codigo ||
        nombre
      );

      if(!nombre){
        return;
      }

      var id =
        compact(
          codigo || nombre
        );

      if(!map[id]){
        map[id] = {
          id:
            codigo || nombre,

          codigo:
            codigo || nombre,

          nombre:
            nombre,

          label:
            nombre
        };
      }
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

  function requirementCatalog(){
    var map =
      Object.create(null);

    allRequirements()
      .forEach(function(req){
        var name =
          requirementName(req);

        if(!name){
          return;
        }

        var id =
          compact(name);

        if(!map[id]){
          map[id] = {
            id:
              name,

            key:
              name,

            label:
              text(
                req.label ||
                req.nombre ||
                req.nombreRequisito ||
                name
              )
          };
        }
      });

    allStudents()
      .forEach(function(row){
        Object.keys(
          row || {}
        ).forEach(function(property){
          if(
            property.indexOf(
              "_global"
            ) === 0 ||
            property === "requisitos"
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
            compact(property);

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

  function snapshot(options){
    options =
      options || {};

    var current =
      cache();

    var filterOptions =
      options.filters ||
      {
        matricula: ""
      };

    var hydratedStudents =
      students(filterOptions);

    return {
      ok:
        true,

      source:
        "ConGlobal",

      version:
        VERSION,

      meta:
        clone(
          current.meta ||
          {}
        ),

      periods:
        periods(),

      students:
        hydratedStudents,

      requirements:
        requirements(
          filterOptions
        ),

      careers:
        careers(),

      requirementCatalog:
        requirementCatalog(),

      diagnostics:
        clone(
          current.diagnostics ||
          []
        ),

      generatedAt:
        new Date().toISOString()
    };
  }

  function status(){
    var current =
      cache();

    return {
      ok:
        true,

      version:
        VERSION,

      source:
        "ConGlobal",

      periods:
        array(
          current.periods
        ).length,

      students:
        array(
          current.students
        ).length,

      hydratedStudents:
        allStudents().length,

      requirements:
        array(
          current.requirements
        ).length,

      careers:
        careers().length,

      requirementCatalog:
        requirementCatalog().length,

      updatedAt:
        new Date().toISOString()
    };
  }

  function scheduleRender(){
    if(refreshTimer){
      window.clearTimeout(
        refreshTimer
      );
    }

    refreshTimer =
      window.setTimeout(
        function(){
          refreshTimer = null;

          try{
            if(
              window.GlobalCore &&
              typeof window.GlobalCore
                .invalidate ===
                "function"
            ){
              window.GlobalCore
                .invalidate();
            }

            if(
              window.GlobalApp &&
              typeof window.GlobalApp
                .render ===
                "function"
            ){
              window.GlobalApp
                .render();
            }
          }catch(error){}
        },
        260
      );
  }

  function bindEvents(){
    if(eventsBound){
      return;
    }

    eventsBound = true;

    [
      "bdlocal:conexiones-cache-updated",
      "bdlocal:screen-data-updated",
      "bdlocal:legacy-snapshot",
      "requisitos:bl:snapshot-changed"
    ].forEach(function(name){
      window.addEventListener(
        name,
        scheduleRender
      );
    });

    window.addEventListener(
      "storage",
      function(event){
        if(
          event &&
          [
            "REQ_BDLOCAL_CONEXIONES_CACHE_V1",
            "REQ_BDLOCAL_LEGACY_SNAPSHOT_V1",
            "REQ_EXCEL_LOCAL_V1:snapshot"
          ].indexOf(
            event.key
          ) >= 0
        ){
          scheduleRender();
        }
      }
    );
  }

  var api = {
    version:
      VERSION,

    ready:
      ready,

    refresh:
      refresh,

    status:
      status,

    snapshot:
      snapshot,

    getSnapshot:
      snapshot,

    periods:
      periods,

    getPeriods:
      periods,

    students:
      students,

    getStudents:
      students,

    requirements:
      requirements,

    getRequirements:
      requirements,

    careers:
      careers,

    getCareers:
      careers,

    requirementCatalog:
      requirementCatalog,

    getRequirementCatalog:
      requirementCatalog,

    hydrateStudents:
      hydrateStudents
  };

  window.BDLocalGlobal =
    api;

  window.ConGlobal =
    api;

  if(
    hub &&
    typeof hub.register ===
      "function"
  ){
    hub.register(
      "global",
      api
    );
  }

  bindEvents();
})(window);