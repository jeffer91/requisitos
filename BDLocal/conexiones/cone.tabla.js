/* =========================================================
Nombre completo: cone.tabla.js
Ruta: /BDLocal/conexiones/cone.tabla.js
Función:
- Ser el conector oficial entre Tabla y Base Local.
- Entregar períodos, estudiantes y requisitos en un solo envelope.
- Forzar una actualización completa cuando la caché no sea confiable.
- Relacionar requisitos por cédula normalizada y período canónico.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-official-envelope";
  var SOURCE = "ConTabla";
  var HUB = window.BDLocalConexiones;
  var U = window.BDLocalConUtils;

  if(!HUB || !U){ return; }

  var state = {
    readyPromise: null,
    refreshPromise: null,
    reads: 0,
    refreshes: 0,
    failures: 0,
    lastError: "",
    lastRevision: 0,
    lastReadAt: ""
  };

  function text(value){
    return U.text ? U.text(value) : String(value == null ? "" : value).trim();
  }

  function array(value){
    return Array.isArray(value) ? value : [];
  }

  function object(value){
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function now(){
    return U.nowISO ? U.nowISO() : new Date().toISOString();
  }

  function currentCache(){
    var value = object(U.readCache ? U.readCache() : null);

    return {
      meta: object(value.meta),
      periods: array(value.periods || value.periodos).slice(),
      students: array(value.students || value.estudiantes || value.rows).slice(),
      requirements: array(value.requirements || value.requisitos).slice(),
      summaries: object(value.summaries || value.resumenes),
      diagnostics: array(value.diagnostics || value.diagnosticos).slice()
    };
  }

  function normalizeCedula(value){
    return U.normalizeCedula
      ? U.normalizeCedula(value)
      : text(value).replace(/[^0-9A-Za-z]/g, "");
  }

  function canonicalPeriod(value){
    return U.canonicalPeriodId
      ? U.canonicalPeriodId(value)
      : text(value).replace(/_+/g, "__");
  }

  function samePeriod(a, b){
    if(U.samePeriod){ return U.samePeriod(a, b); }
    a = canonicalPeriod(a);
    b = canonicalPeriod(b);
    return !b || (!!a && a === b);
  }

  function rowCedula(row){
    row = object(row);
    return normalizeCedula(
      row._cedula || row.cedula || row.numeroIdentificacion ||
      row.NumeroIdentificacion || row.Cedula || row["Cédula"] || ""
    );
  }

  function rowPeriod(row){
    row = object(row);
    return canonicalPeriod(
      row._periodoId || row.periodoId || row.periodId ||
      row.periodoCanonicoId || row.ultimoPeriodoId || row.idPeriodo || ""
    );
  }

  function identity(row){
    var cedula = rowCedula(row);
    var periodoId = rowPeriod(row);
    return cedula && periodoId ? cedula + "::" + periodoId : "";
  }

  function revisionOf(cache){
    cache = cache || currentCache();
    return Number(cache.meta && (cache.meta.revision || cache.meta.cacheRevision) || 0);
  }

  function requirementKey(item){
    item = object(item);
    return text(
      item.requisitoKey || item.requirementKey || item.key ||
      item.field || item.nombre || item.label || ""
    ).toLowerCase();
  }

  function analyze(cache){
    cache = cache || currentCache();

    var students = array(cache.students);
    var requirements = array(cache.requirements);
    var periods = array(cache.periods);
    var meta = object(cache.meta);
    var studentIds = Object.create(null);
    var requirementsByStudent = Object.create(null);
    var invalidStudents = 0;
    var orphanRequirements = 0;

    students.forEach(function(row){
      var id = identity(row);
      var names = text(row && (
        row._nombres || row.nombreCompleto || row.Nombres || row.nombres || row.nombre
      ));

      if(!id || !names){
        invalidStudents += 1;
        return;
      }
      studentIds[id] = true;
    });

    requirements.forEach(function(item){
      var id = identity(item);
      if(!id || !studentIds[id]){
        orphanRequirements += 1;
        return;
      }
      requirementsByStudent[id] = (requirementsByStudent[id] || 0) + 1;
    });

    var studentsWithoutRequirements = students.reduce(function(total, row){
      var id = identity(row);
      return total + (id && requirementsByStudent[id] ? 0 : 1);
    }, 0);

    var studentSource = text(meta.studentSource);
    var requirementSource = text(meta.requirementSource);
    var trustedStudents = studentSource === "BDLServiceEstudiantes";
    var trustedRequirements = requirementSource === "BDLRepoRequisitos";

    return {
      revision: revisionOf(cache),
      periods: periods.length,
      students: students.length,
      requirements: requirements.length,
      invalidStudents: invalidStudents,
      orphanRequirements: orphanRequirements,
      studentsWithoutRequirements: studentsWithoutRequirements,
      studentSource: studentSource,
      requirementSource: requirementSource,
      contactsHydrated: trustedStudents,
      requirementsLoaded: trustedRequirements,
      requirementsLinked: requirements.length > 0 && orphanRequirements === 0,
      complete:
        periods.length > 0 && students.length > 0 && requirements.length > 0 &&
        invalidStudents === 0 && trustedStudents && trustedRequirements
    };
  }

  function fullRefresh(options){
    options = object(options);
    if(state.refreshPromise){ return state.refreshPromise; }

    state.refreshes += 1;
    state.refreshPromise = Promise.resolve()
      .then(function(){
        if(typeof HUB.refreshCache !== "function"){
          throw new Error("BDLocalConexiones.refreshCache no está disponible.");
        }
        return HUB.refreshCache({
          source: options.source || "cone.tabla.full-refresh",
          sourceScreen: "tabla",
          mode: "full",
          full: true,
          light: false,
          immediate: true,
          force: true,
          changed: options.changed === true,
          incremental: false,
          cooldown: 0
        });
      })
      .then(currentCache)
      .finally(function(){ state.refreshPromise = null; });

    return state.refreshPromise;
  }

  function ensureComplete(options){
    options = object(options);

    return Promise.resolve()
      .then(function(){
        return typeof HUB.ready === "function" ? HUB.ready() : HUB;
      })
      .then(function(){
        var cache = currentCache();
        return options.force === true || !analyze(cache).complete
          ? fullRefresh({source: options.source || "cone.tabla.ensure-complete"})
          : cache;
      })
      .then(function(cache){
        var analysis = analyze(cache);
        if(!analysis.complete){
          throw new Error(
            "Base Local no entregó un paquete completo para Tabla. " +
            "Estudiantes: " + analysis.students +
            ", requisitos: " + analysis.requirements +
            ", origen estudiantes: " + (analysis.studentSource || "sin origen") +
            ", origen requisitos: " + (analysis.requirementSource || "sin origen") + "."
          );
        }
        state.lastRevision = analysis.revision;
        state.lastError = "";
        return cache;
      })
      .catch(function(error){
        state.failures += 1;
        state.lastError = text(error && error.message || error);
        throw error;
      });
  }

  function normalizePeriods(periods){
    return array(periods).map(function(item){
      return U.normalizePeriod ? U.normalizePeriod(item) : item;
    }).filter(Boolean);
  }

  function filterStudents(rows, options){
    rows = array(rows);
    options = object(options);

    var filtered = U.filterStudents
      ? U.filterStudents(rows, options)
      : rows.filter(function(row){
          var periodoId = canonicalPeriod(options.periodoId || options.periodId || "");
          var matricula = text(options.matricula).toUpperCase();
          var search = text(options.search || options.query).toLowerCase();

          if(periodoId && !samePeriod(rowPeriod(row), periodoId)){ return false; }
          if(matricula && text(
            row.estadoMatricula || row._estadoMatricula || row.matricula
          ).toUpperCase() !== matricula){ return false; }

          if(search){
            var haystack = [
              rowCedula(row), row._nombres, row.Nombres, row.nombres,
              row._carrera, row.NombreCarrera, row.correoPersonal,
              row.correoInstitucional, row.celular, row.telegramUser,
              row.telegramChatId
            ].map(text).join(" ").toLowerCase();
            if(haystack.indexOf(search) < 0){ return false; }
          }
          return true;
        });

    var limit = Math.max(0, Number(options.limit || 0));
    return limit > 0 ? filtered.slice(0, limit) : filtered.slice();
  }

  function requirementsForRows(rows, requirements){
    var allowed = Object.create(null);
    array(rows).forEach(function(row){
      var id = identity(row);
      if(id){ allowed[id] = true; }
    });
    return array(requirements).filter(function(item){
      var id = identity(item);
      return !!(id && allowed[id]);
    });
  }

  function attachRequirements(rows, requirements){
    var grouped = Object.create(null);
    array(requirements).forEach(function(item){
      var id = identity(item);
      if(!id){ return; }
      if(!grouped[id]){ grouped[id] = []; }
      grouped[id].push(item);
    });

    return array(rows).map(function(row){
      var id = identity(row);
      var linked = id ? grouped[id] || [] : [];
      return Object.assign({}, row, {
        requisitos: linked.slice(),
        requirements: linked.slice(),
        _tablaRequirementsLinked: linked.length > 0
      });
    });
  }

  function buildEnvelope(cache, options){
    cache = cache || currentCache();
    options = object(options);

    var analysis = analyze(cache);
    var filteredStudents = filterStudents(cache.students, options);
    var relevantRequirements = requirementsForRows(filteredStudents, cache.requirements);
    var students = attachRequirements(filteredStudents, relevantRequirements);
    var periods = normalizePeriods(cache.periods);

    state.reads += 1;
    state.lastReadAt = now();
    state.lastRevision = analysis.revision;

    return {
      ok: true,
      screen: "tabla",
      operation: "read",
      revision: analysis.revision,
      periodoId: canonicalPeriod(options.periodoId || options.periodId || ""),
      source: SOURCE,
      data: {
        periods: periods,
        periodList: periods,
        students: students,
        rows: students,
        requirements: relevantRequirements,
        requisitos: relevantRequirements,
        summaries: Object.assign({}, cache.summaries),
        diagnostics: cache.diagnostics.slice()
      },
      meta: {
        source: SOURCE,
        generatedAt: now(),
        revision: analysis.revision,
        studentSource: analysis.studentSource,
        requirementSource: analysis.requirementSource,
        contactsHydrated: analysis.contactsHydrated,
        requirementsLoaded: analysis.requirementsLoaded,
        requirementsLinked: analysis.requirementsLinked,
        studentsWithoutRequirements: analysis.studentsWithoutRequirements,
        orphanRequirements: analysis.orphanRequirements,
        invalidStudents: analysis.invalidStudents,
        fallbackUsed: false,
        stale: false,
        counts: {
          periods: periods.length,
          students: students.length,
          requirements: relevantRequirements.length
        },
        tablesRead: [
          "periodos", "personas", "matriculas_periodo",
          "contactos_estudiante", "requisitos_estudiante"
        ]
      }
    };
  }

  function read(options){
    options = object(options);
    return ensureComplete({
      force: options.force === true,
      source: options.source || "cone.tabla.read"
    }).then(function(cache){ return buildEnvelope(cache, options); });
  }

  function refresh(options){
    options = object(options);
    return ensureComplete({
      force: true,
      source: options.source || "cone.tabla.refresh"
    }).then(function(cache){ return buildEnvelope(cache, options); });
  }

  function ready(){
    if(state.readyPromise){ return state.readyPromise; }
    state.readyPromise = ensureComplete({source: "cone.tabla.ready"})
      .then(status)
      .catch(function(error){
        state.readyPromise = null;
        throw error;
      });
    return state.readyPromise;
  }

  function snapshot(options){
    return buildEnvelope(currentCache(), options || {});
  }

  function listPeriods(){
    return snapshot().data.periods;
  }

  function listStudents(options){
    var envelope = snapshot(options || {});
    return {
      ok: true,
      rows: envelope.data.students,
      students: envelope.data.students,
      requirements: envelope.data.requirements,
      requisitos: envelope.data.requirements,
      periodList: envelope.data.periods,
      total: envelope.data.students.length,
      returned: envelope.data.students.length,
      revision: envelope.revision,
      source: SOURCE,
      meta: envelope.meta
    };
  }

  function getStudents(options){
    return listStudents(options || {}).rows;
  }

  function listRequirements(options){
    options = object(options);
    var cache = currentCache();
    var periodoId = canonicalPeriod(options.periodoId || options.periodId || "");
    var cedula = normalizeCedula(options.cedula || options.numeroIdentificacion || "");
    var wantedKey = requirementKey(options);

    return cache.requirements.filter(function(item){
      if(periodoId && !samePeriod(rowPeriod(item), periodoId)){ return false; }
      if(cedula && rowCedula(item) !== cedula){ return false; }
      if(wantedKey && requirementKey(item) !== wantedKey){ return false; }
      return true;
    });
  }

  function getStudentById(id, options){
    id = text(id);
    if(!id){ return null; }
    return getStudents(Object.assign({matricula: ""}, options || {}))
      .filter(function(row){
        return text(row.id) === id || text(row._id) === id ||
          text(row.idEstudiantePeriodo) === id ||
          rowCedula(row) === normalizeCedula(id);
      })[0] || null;
  }

  function getStudentByCedula(cedula, periodoId){
    cedula = normalizeCedula(cedula);
    if(!cedula){ return null; }
    return getStudents({periodoId: periodoId || "", matricula: ""})
      .filter(function(row){ return rowCedula(row) === cedula; })[0] || null;
  }

  function status(){
    var analysis = analyze(currentCache());
    return {
      ok: analysis.complete && !state.lastError,
      version: VERSION,
      source: SOURCE,
      ready: analysis.complete,
      revision: analysis.revision,
      periods: analysis.periods,
      students: analysis.students,
      requirements: analysis.requirements,
      studentSource: analysis.studentSource,
      requirementSource: analysis.requirementSource,
      contactsHydrated: analysis.contactsHydrated,
      requirementsLinked: analysis.requirementsLinked,
      orphanRequirements: analysis.orphanRequirements,
      studentsWithoutRequirements: analysis.studentsWithoutRequirements,
      reads: state.reads,
      refreshes: state.refreshes,
      failures: state.failures,
      lastError: state.lastError,
      lastReadAt: state.lastReadAt
    };
  }

  var api = {
    version: VERSION,
    source: SOURCE,
    ready: ready,
    read: read,
    refresh: refresh,
    status: status,
    snapshot: snapshot,
    getSnapshot: snapshot,
    readCache: snapshot,
    listPeriods: listPeriods,
    getPeriods: listPeriods,
    periods: listPeriods,
    periodos: listPeriods,
    listStudents: listStudents,
    getStudents: getStudents,
    rows: getStudents,
    getRows: getStudents,
    listarEstudiantes: getStudents,
    filterStudents: getStudents,
    listAllStudents: function(){ return getStudents({matricula: ""}); },
    listStudentsByStatus: function(statusValue, periodoId){
      return getStudents({matricula: statusValue || "", periodoId: periodoId || ""});
    },
    listRequirements: listRequirements,
    getRequirements: listRequirements,
    requirements: listRequirements,
    requisitos: listRequirements,
    getStudentById: getStudentById,
    getStudentByCedula: getStudentByCedula,
    buscarPorCedula: getStudentByCedula,
    search: function(query, options){
      return listStudents(Object.assign({}, options || {}, {search: query || ""}));
    }
  };

  HUB.register("tabla", api);
  window.BDLocalTabla = api;
  window.ConTabla = api;
})(window);
