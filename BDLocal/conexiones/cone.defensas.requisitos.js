/* =========================================================
Nombre completo: cone.defensas.requisitos.js
Ruta o ubicación: /BDLocal/conexiones/cone.defensas.requisitos.js
Función o funciones:
- Hidratar estudiantes de Defensas con requisitos_estudiante.
- Unir requisitos mediante cédula + período canónico.
- Mantener la ruta moderna BDLServiceDefensas y el respaldo ConDefensas.
- Evitar interpretar una carga pendiente como incumplimiento real.
Con qué se conecta:
- bdl.repo.requisitos.js
- bdl.service.defensas.js
- cone.defensas.js
- defart.service-bridge.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.0-requirements-hydration";

  var state = {
    loaded: false,
    loading: null,
    loadedAt: "",
    error: "",
    requirements: [],
    byStudent: Object.create(null),
    refreshTimer: null,
    eventsBound: false
  };

  var CANONICAL_FIELDS = {
    academico: "Academico",
    documentacion: "Documentacion",
    financiero: "Financiero",
    titulacion: "Titulacion",
    practicasvinculacion: "PrácticasVinculacion",
    practicas: "PrácticasVinculacion",
    vinculacion: "Vinculacion",
    seguimientograduados: "SeguimientoGraduados",
    seguimientoagraduados: "SeguimientoGraduados",
    ingles: "Ingles",
    actualizaciondatos: "ActualizaciónDatos"
  };

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function normalizeKey(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function compactKey(value){
    return normalizeKey(value).replace(/_/g, "");
  }

  function normalizeCedula(value){
    var raw = text(value).replace(/[^0-9A-Za-z]/g, "");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function canonicalPeriodId(value){
    value = text(value);
    if(!value){ return ""; }

    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match
      ? match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4]
      : value.replace(/_+/g, "__");
  }

  function cedulaOf(row){
    row = row || {};
    return normalizeCedula(
      row.cedula ||
      row._cedula ||
      row.numeroIdentificacion ||
      row.NumeroIdentificacion ||
      row.Cedula ||
      row["Cédula"] ||
      ""
    );
  }

  function periodOf(row){
    row = row || {};
    return canonicalPeriodId(
      row.periodoId ||
      row.periodId ||
      row.periodoCanonicoId ||
      row._periodoId ||
      row._bl2PeriodoId ||
      row.ultimoPeriodoId ||
      ""
    );
  }

  function studentKey(row){
    var cedula = cedulaOf(row);
    var periodoId = periodOf(row);
    return cedula && periodoId ? cedula + "__" + periodoId : "";
  }

  function requirementKey(row){
    row = row || {};
    return text(
      row.requisitoKey ||
      row.requirementKey ||
      row.key ||
      row.campo ||
      row.field ||
      row.nombre ||
      row.requisitoLabel ||
      row.requisitoNombre ||
      ""
    );
  }

  function requirementValue(row){
    row = row || {};

    if(row.valor !== undefined && row.valor !== null){ return row.valor; }
    if(row.value !== undefined && row.value !== null){ return row.value; }
    if(row.estado !== undefined && row.estado !== null){
      if(row.estado && typeof row.estado === "object"){
        return row.estado.id || row.estado.value || row.estado.label || "";
      }
      return row.estado;
    }
    if(row.cumple !== undefined && row.cumple !== null){ return row.cumple; }
    if(row.aprobado !== undefined && row.aprobado !== null){ return row.aprobado; }
    if(row.resultado !== undefined && row.resultado !== null){ return row.resultado; }

    return "";
  }

  function requirementsRepo(){
    if(window.BDLRepoRequisitos && typeof window.BDLRepoRequisitos.list === "function"){
      return window.BDLRepoRequisitos;
    }

    if(window.BDLRepositories && typeof window.BDLRepositories.get === "function"){
      return window.BDLRepositories.get("requisitos") ||
        window.BDLRepositories.get("requisitos_estudiante") ||
        null;
    }

    return null;
  }

  function normalizeRequirement(row){
    row = Object.assign({}, row || {});

    row.cedula = cedulaOf(row);
    row.numeroIdentificacion = row.cedula;
    row.periodoId = periodOf(row);
    row.periodId = row.periodoId;
    row.requisitoKey = normalizeKey(requirementKey(row));

    return row;
  }

  function rebuildIndex(rows){
    state.requirements = (Array.isArray(rows) ? rows : [])
      .map(normalizeRequirement)
      .filter(function(row){
        return !!studentKey(row) && !!row.requisitoKey;
      });

    state.byStudent = Object.create(null);

    state.requirements.forEach(function(row){
      var key = studentKey(row);
      if(!state.byStudent[key]){ state.byStudent[key] = []; }
      state.byStudent[key].push(row);
    });
  }

  function status(){
    return {
      ok: state.loaded && !state.error,
      loaded: state.loaded,
      loading: !!state.loading,
      version: VERSION,
      source: "requisitos_estudiante",
      requirements: state.requirements.length,
      studentsIndexed: Object.keys(state.byStudent).length,
      loadedAt: state.loadedAt,
      error: state.error
    };
  }

  function notifyReady(){
    var detail = status();

    try{
      window.dispatchEvent(new CustomEvent("bdlocal:defensas-requisitos-ready", {
        detail: detail
      }));
    }catch(error){}

    try{
      if(window.DefartServiceBridge && typeof window.DefartServiceBridge.clear === "function"){
        window.DefartServiceBridge.clear({ resetPage:false });
      }
    }catch(error2){}

    try{
      if(window.DefartPerformance && typeof window.DefartPerformance.clearCache === "function"){
        window.DefartPerformance.clearCache();
      }
    }catch(error3){}

    window.setTimeout(function(){
      try{
        if(window.DefartApp && typeof window.DefartApp.render === "function"){
          window.DefartApp.render();
        }
      }catch(error){}
    }, 0);
  }

  function load(force){
    if(state.loading){ return state.loading; }
    if(state.loaded && !force){ return Promise.resolve(status()); }

    var repo = requirementsRepo();
    if(!repo || typeof repo.list !== "function"){
      state.loaded = false;
      state.error = "BDLRepoRequisitos no disponible.";
      return Promise.resolve(status());
    }

    state.error = "";

    state.loading = Promise.resolve(repo.list({}))
      .then(function(rows){
        rebuildIndex(rows || []);
        state.loaded = true;
        state.loadedAt = new Date().toISOString();
        state.error = "";
        notifyReady();
        return status();
      })
      .catch(function(error){
        state.loaded = false;
        state.error = error && error.message ? error.message : String(error);
        return status();
      })
      .finally(function(){
        state.loading = null;
      });

    return state.loading;
  }

  function attachRequirementValue(student, requirement){
    var rawKey = requirementKey(requirement);
    var normalized = normalizeKey(rawKey);
    var compact = compactKey(rawKey);
    var canonical = CANONICAL_FIELDS[compact] || "";
    var value = requirementValue(requirement);

    if(rawKey){ student[rawKey] = value; }
    if(normalized){ student[normalized] = value; }
    if(compact){ student[compact] = value; }
    if(canonical){ student[canonical] = value; }
  }

  function attachStudent(row){
    var student = Object.assign({}, row || {});

    if(!state.loaded){
      student._bdlRequirementsLoaded = false;
      student._bdlRequirementsHydrated = false;
      student._bdlRequirementsCount = 0;
      return student;
    }

    var key = studentKey(student);
    var matched = key && state.byStudent[key]
      ? state.byStudent[key]
      : [];

    matched.forEach(function(requirement){
      attachRequirementValue(student, requirement);
    });

    student.requisitos = matched.map(function(requirement){
      return Object.assign({}, requirement);
    });
    student.requirements = student.requisitos.map(function(requirement){
      return Object.assign({}, requirement);
    });
    student._bdlRequirementsLoaded = true;
    student._bdlRequirementsHydrated = true;
    student._bdlRequirementsCount = matched.length;

    return student;
  }

  function attachRows(rows){
    return (Array.isArray(rows) ? rows : []).map(attachStudent);
  }

  function hydrateResult(result){
    if(Array.isArray(result)){
      return attachRows(result);
    }

    if(result && typeof result === "object" && Array.isArray(result.rows)){
      return Object.assign({}, result, {
        rows: attachRows(result.rows),
        requirementsHydrated: state.loaded,
        requirementsLoaded: state.loaded,
        requirementsCount: state.requirements.length,
        requirementsSource: "requisitos_estudiante"
      });
    }

    return result;
  }

  function wrapAsyncMethod(target, name){
    if(!target || typeof target[name] !== "function"){ return; }
    if(target[name].__defensasRequirementsWrapped){ return; }

    var original = target[name];

    var wrapped = function(){
      var args = arguments;
      var context = this;

      return Promise.resolve(original.apply(context, args))
        .then(function(result){
          return load(false).then(function(){
            return hydrateResult(result);
          });
        });
    };

    wrapped.__defensasRequirementsWrapped = true;
    wrapped.__original = original;
    target[name] = wrapped;
  }

  function patchService(){
    var service = window.BDLServiceDefensas ||
      (window.BDLServices && typeof window.BDLServices.get === "function"
        ? window.BDLServices.get("defensas")
        : null);

    if(!service || service.__requirementsHydrationInstalled){ return false; }

    ["getPage", "page", "getFiltered", "list", "hydrateWithNotas"].forEach(function(name){
      wrapAsyncMethod(service, name);
    });

    service.requirementsStatus = status;
    service.refreshRequirements = function(){ return load(true); };
    service.__requirementsHydrationInstalled = true;

    return true;
  }

  function wrapSyncRows(target, name){
    if(!target || typeof target[name] !== "function"){ return; }
    if(target[name].__defensasRequirementsWrapped){ return; }

    var original = target[name];
    var wrapped = function(){
      return hydrateResult(original.apply(this, arguments));
    };

    wrapped.__defensasRequirementsWrapped = true;
    wrapped.__original = original;
    target[name] = wrapped;
  }

  function patchConnection(){
    var connection = window.BDLocalConeDefensas ||
      window.BDLocalDefensas ||
      window.ConDefensas ||
      null;

    if(!connection || connection.__requirementsHydrationInstalled){ return false; }

    ["listStudents", "getStudents", "filterStudents", "snapshot", "getSnapshot"].forEach(function(name){
      wrapSyncRows(connection, name);
    });

    if(typeof connection.ready === "function"){
      var originalReady = connection.ready;
      connection.ready = function(){
        var context = this;
        var args = arguments;
        return Promise.all([
          Promise.resolve(originalReady.apply(context, args)),
          load(false)
        ]).then(function(result){ return result[0]; });
      };
    }

    if(typeof connection.refresh === "function"){
      var originalRefresh = connection.refresh;
      connection.refresh = function(){
        var context = this;
        var args = arguments;
        return Promise.resolve(originalRefresh.apply(context, args))
          .then(function(result){
            return load(true).then(function(){ return result; });
          });
      };
      connection.reload = connection.refresh;
    }

    if(typeof connection.status === "function"){
      var originalStatus = connection.status;
      connection.status = function(){
        return Object.assign({}, originalStatus.apply(this, arguments) || {}, {
          requirements: state.requirements.length,
          requirementsLoaded: state.loaded,
          requirementsLoadedAt: state.loadedAt,
          requirementsError: state.error
        });
      };
    }

    connection.requirementsStatus = status;
    connection.refreshRequirements = function(){ return load(true); };
    connection.__requirementsHydrationInstalled = true;

    return true;
  }

  function scheduleReload(){
    if(state.refreshTimer){ window.clearTimeout(state.refreshTimer); }

    state.refreshTimer = window.setTimeout(function(){
      state.refreshTimer = null;
      state.loaded = false;
      load(true);
    }, 180);
  }

  function bindEvents(){
    if(state.eventsBound){ return; }
    state.eventsBound = true;

    [
      "bdlocal:screen-data-updated",
      "bdlocal:conexiones-cache-updated",
      "requisitos:bl:snapshot-changed",
      "bl2:students-saved",
      "bl2:student-updated"
    ].forEach(function(name){
      window.addEventListener(name, scheduleReload);
    });

    window.addEventListener("storage", function(event){
      if(event && [
        "REQ_BDLOCAL_CONEXIONES_CACHE_V1",
        "REQ_BDLOCAL_LEGACY_SNAPSHOT_V1",
        "REQ_EXCEL_LOCAL_V1:snapshot"
      ].indexOf(event.key) >= 0){
        scheduleReload();
      }
    });
  }

  function install(){
    patchService();
    patchConnection();
    bindEvents();
    return load(false);
  }

  window.BDLocalDefensasRequirements = {
    version: VERSION,
    install: install,
    load: load,
    refresh: function(){ return load(true); },
    attachStudent: attachStudent,
    attachRows: attachRows,
    status: status
  };

  install();
})(window);
