/* =========================================================
Nombre completo: ncomplex.app.js
Ruta o ubicación: /Ncomplex/ncomplex.app.js
Función o funciones:
- Iniciar la pantalla Ncomplex y comprobar la conexión con BDLocal.
- Cargar períodos y todos los estudiantes del período seleccionado.
- Coordinar filtros, resumen, tabla, paginación, importación, popup y guardado.
- Aplicar datos pegados únicamente después del análisis y cruce por cédula.
Con qué se conecta:
- BDLocal/conexiones/cone.ncomplex.js
- Todos los archivos de /Ncomplex/
========================================================= */
(function(window,document){
  "use strict";

  var Config = window.NcomplexConfig || {};
  var State = window.NcomplexState || {};
  var Parser = window.NcomplexParser || {};
  var Matcher = window.NcomplexMatcher || {};
  var Filters = window.NcomplexFilters || {};
  var Pagination = window.NcomplexPagination || {};
  var Summary = window.NcomplexSummary || {};
  var Table = window.NcomplexTable || {};
  var Modal = window.NcomplexModal || {};
  var Save = window.NcomplexSave || {};

  var initialized = false;
  var filterTimer = null;

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function element(id){
    return document.getElementById(id);
  }

  function connector(){
    return window.ConNcomplex || window.BDLocalConeNcomplex || null;
  }

  function status(message, type){
    if(Save.setStatus){
      Save.setStatus(message, type);
      return;
    }
    var box = element("ncomplex-status");
    if(box){
      box.textContent = message || "";
      box.className = "ncomplex-statusbar " + (type ? "is-" + type : "");
    }
  }

  function periodId(period){
    period = period || {};
    return text(period.id || period.periodoId || period.periodId || period.value || period.key);
  }

  function periodLabel(period){
    period = period || {};
    return text(period.label || period.periodoLabel || period.nombre || period.name || periodId(period));
  }

  function renderPeriods(periods){
    var select = element(Config.selectors && Config.selectors.periodo || "ncomplex-filter-periodo");
    if(!select){ return; }

    var currentState = State.get ? State.get() : {};
    var current = currentState.selectedPeriodId || select.value;
    select.innerHTML = "<option value=\"\">Seleccione un período</option>";

    (Array.isArray(periods) ? periods : []).forEach(function(period){
      var id = periodId(period);
      if(!id){ return; }
      var option = document.createElement("option");
      option.value = id;
      option.textContent = periodLabel(period);
      select.appendChild(option);
    });

    if(current && Array.prototype.some.call(select.options, function(option){ return option.value === current; })){
      select.value = current;
    }
  }

  function loadPeriods(){
    var con = connector();
    if(!con || typeof con.listPeriods !== "function"){
      return Promise.reject(new Error("ConNcomplex no permite consultar períodos."));
    }

    return con.listPeriods().then(function(periods){
      periods = Array.isArray(periods) ? periods : [];
      if(State.patch){ State.patch({ periods: periods }, "periods-loaded"); }
      renderPeriods(periods);
      return periods;
    });
  }

  function loadPeriod(periodoId){
    periodoId = text(periodoId);
    var con = connector();

    if(!periodoId){
      if(State.patch){
        State.patch({
          selectedPeriodId: "",
          records: [],
          filteredRecords: [],
          page: 1,
          loading: false,
          lastLoadedAt: ""
        }, "period-cleared");
      }
      if(Filters.renderCareers){ Filters.renderCareers([]); }
      render();
      status("Seleccione un período para cargar los estudiantes.", "info");
      return Promise.resolve([]);
    }

    if(!con || typeof con.listStudents !== "function"){
      return Promise.reject(new Error("ConNcomplex no permite consultar estudiantes."));
    }

    if(State.patch){
      State.patch({
        selectedPeriodId: periodoId,
        loading: true,
        error: "",
        page: 1
      }, "period-loading");
    }
    if(State.clearDirty){ State.clearDirty(); }
    if(State.resetImport){ State.resetImport(); }
    status("Cargando todos los estudiantes del período...", "info");

    return con.listStudents({
      periodoId: periodoId,
      estadoMatricula: "ACTIVO"
    }).then(function(rows){
      rows = Array.isArray(rows) ? rows : [];
      if(State.setRecords){ State.setRecords(rows, "period-loaded"); }
      if(State.patch){
        State.patch({
          selectedPeriodId: periodoId,
          loading: false,
          lastLoadedAt: new Date().toISOString(),
          page: 1
        }, "period-ready");
      }
      if(Filters.renderCareers){ Filters.renderCareers(rows); }
      if(Summary.renderImport){ Summary.renderImport(null); }
      render();
      status(rows.length + " estudiante(s) cargado(s) desde BDLocal.", "success");
      return rows;
    }).catch(function(error){
      if(State.patch){ State.patch({ loading: false, error: error.message || String(error) }, "period-error"); }
      status(error.message || String(error), "error");
      render();
      throw error;
    });
  }

  function render(){
    var current = State.get ? State.get() : {};
    var filtered = Filters.apply
      ? Filters.apply(current.records || [], current.filters || {})
      : (current.records || []);

    current.filteredRecords = filtered;
    var paged = Pagination.paginate
      ? Pagination.paginate(filtered, current.page, current.pageSize)
      : { rows: filtered, page: 1, pageSize: filtered.length || 25, total: filtered.length, totalPages: 1, start: filtered.length ? 1 : 0, end: filtered.length, hasPrev: false, hasNext: false };

    current.page = paged.page;
    current.totalPages = paged.totalPages;

    if(Summary.render){ Summary.render(filtered); }
    if(Table.render){
      Table.render(paged.rows, {
        modalidad: current.filters && current.filters.modalidad || "",
        offset: Math.max(0, (paged.page - 1) * paged.pageSize)
      });
    }
    if(Pagination.render){
      Pagination.render(paged, function(){ render(); });
    }
    if(Save.updateButton){ Save.updateButton(); }

    var visible = element("ncomplex-visible-count");
    if(visible){ visible.textContent = filtered.length + " visible(s)"; }
  }

  function updateFilters(){
    if(!Filters.readControls || !State.setFilters){ return; }
    State.setFilters(Filters.readControls(), "filters-changed");
    render();
  }

  function scheduleFilters(){
    window.clearTimeout(filterTimer);
    filterTimer = window.setTimeout(updateFilters, 120);
  }

  function analyzeImport(){
    var current = State.get ? State.get() : {};
    var textarea = element(Config.selectors && Config.selectors.textarea || "ncomplex-paste-data");
    var raw = textarea ? textarea.value : "";

    if(!current.selectedPeriodId){
      status("Seleccione el período antes de analizar los datos.", "error");
      return;
    }
    if(!Parser.parse || !Matcher.match){
      status("El lector o el cruce de Ncomplex no están disponibles.", "error");
      return;
    }

    var parsed = Parser.parse(raw);
    if(!parsed.ok){
      if(State.patch){ State.patch({ parsedImport: parsed, matchedImport: null }, "import-invalid"); }
      if(Summary.renderImport){ Summary.renderImport(null); }
      status((parsed.errors || []).join(" ") || "No se pudo analizar el texto.", "error");
      return;
    }

    var matched = Matcher.match(parsed.rows, current.records || [], {
      periodoId: current.selectedPeriodId
    });

    if(State.patch){
      State.patch({
        parsedImport: parsed,
        matchedImport: matched,
        importApplied: false
      }, "import-analyzed");
    }

    if(Summary.renderImport){ Summary.renderImport(matched); }
    var applyButton = element("ncomplex-btn-apply-import");
    if(applyButton){ applyButton.disabled = !matched.totalMatched; }

    status(
      matched.totalMatched + " estudiante(s) encontrado(s); " +
      matched.totalUnmatched + " no encontrado(s); " +
      matched.totalConflicts + " conflicto(s).",
      matched.totalUnmatched || matched.totalConflicts ? "warning" : "success"
    );
  }

  function applyImport(){
    var current = State.get ? State.get() : {};
    var matched = current.matchedImport;
    if(!matched || !Matcher.apply){
      status("Primero analice los datos pegados.", "error");
      return;
    }

    var applied = Matcher.apply(matched.matches || [], current.records || [], {
      includeConflicts: false
    });

    var conflictIds = Object.create(null);
    (matched.conflicts || []).forEach(function(item){ conflictIds[item.id] = true; });
    applied.records = applied.records.map(function(row){
      var id = State.recordId ? State.recordId(row) : text(row.idEstudiantePeriodo || row.id);
      return Object.assign({}, row, {
        _ncomplexConflict: !!conflictIds[id]
      });
    });

    if(State.setRecords){ State.setRecords(applied.records, "import-applied"); }
    applied.changed.forEach(function(row){
      if(State.markDirty){ State.markDirty(State.recordId(row), row, false); }
    });
    if(State.patch){ State.patch({ importApplied: true }, "import-ready-to-save"); }

    render();
    status(
      applied.changed.length + " estudiante(s) incorporado(s). Los conflictos no fueron sobrescritos.",
      matched.totalConflicts ? "warning" : "success"
    );
  }

  function clearImport(){
    var textarea = element(Config.selectors && Config.selectors.textarea || "ncomplex-paste-data");
    if(textarea){ textarea.value = ""; }
    if(State.resetImport){ State.resetImport(); }
    if(Summary.renderImport){ Summary.renderImport(null); }
    var applyButton = element("ncomplex-btn-apply-import");
    if(applyButton){ applyButton.disabled = true; }
    status("Área de pegado limpia.", "info");
  }

  function bindFilters(){
    var ids = [
      Config.selectors && Config.selectors.carrera || "ncomplex-filter-carrera",
      Config.selectors && Config.selectors.modalidad || "ncomplex-filter-modalidad",
      Config.selectors && Config.selectors.estado || "ncomplex-filter-estado",
      Config.selectors && Config.selectors.soloFaltantes || "ncomplex-filter-faltantes"
    ];
    ids.forEach(function(id){
      var control = element(id);
      if(control){ control.addEventListener("change", updateFilters); }
    });

    var search = element(Config.selectors && Config.selectors.busqueda || "ncomplex-filter-search");
    if(search){ search.addEventListener("input", scheduleFilters); }
  }

  function bind(){
    var period = element(Config.selectors && Config.selectors.periodo || "ncomplex-filter-periodo");
    if(period){
      period.addEventListener("change", function(){ loadPeriod(period.value); });
    }

    bindFilters();

    var clearFilters = element("ncomplex-btn-clear-filters");
    if(clearFilters){
      clearFilters.addEventListener("click", function(){
        if(Filters.resetControls){ Filters.resetControls(); }
        render();
      });
    }

    var refresh = element("ncomplex-btn-refresh");
    if(refresh){
      refresh.addEventListener("click", function(){
        var current = State.get ? State.get() : {};
        loadPeriod(current.selectedPeriodId);
      });
    }

    var analyze = element("ncomplex-btn-analyze");
    if(analyze){ analyze.addEventListener("click", analyzeImport); }

    var apply = element("ncomplex-btn-apply-import");
    if(apply){ apply.addEventListener("click", applyImport); }

    var clear = element("ncomplex-btn-clear-import");
    if(clear){ clear.addEventListener("click", clearImport); }

    var save = element("ncomplex-btn-save");
    if(save){
      save.addEventListener("click", function(){
        if(Save.save){ Save.save().then(function(){
          var current = State.get ? State.get() : {};
          return loadPeriod(current.selectedPeriodId);
        }).catch(function(){}); }
      });
    }

    var careers = element(Config.selectors && Config.selectors.resumenCarreras || "ncomplex-career-summary");
    if(careers){
      careers.addEventListener("click", function(event){
        var button = event.target.closest("[data-ncomplex-career]");
        if(!button){ return; }
        var career = text(button.getAttribute("data-ncomplex-career"));
        var mode = text(button.getAttribute("data-ncomplex-mode"));
        var careerSelect = element(Config.selectors && Config.selectors.carrera || "ncomplex-filter-carrera");
        var modeSelect = element(Config.selectors && Config.selectors.modalidad || "ncomplex-filter-modalidad");
        if(careerSelect){ careerSelect.value = career; }
        if(modeSelect){ modeSelect.value = mode; }
        updateFilters();
      });
    }

    if(Table.bind){ Table.bind(); }
    if(Modal.bind){ Modal.bind(); }
  }

  function init(){
    if(initialized){ return Promise.resolve(State.get ? State.get() : {}); }
    initialized = true;
    bind();
    render();
    status("Conectando Ncomplex con BDLocal...", "info");

    var con = connector();
    if(!con || typeof con.ready !== "function"){
      var missing = new Error("ConNcomplex no está cargado.");
      status(missing.message, "error");
      return Promise.reject(missing);
    }

    if(State.patch){ State.patch({ loading: true }, "boot"); }
    return con.ready().then(function(connectionStatus){
      if(!connectionStatus || connectionStatus.ok === false){
        throw new Error(connectionStatus && connectionStatus.error || "Ncomplex no pudo preparar BDLocal.");
      }
      return loadPeriods();
    }).then(function(periods){
      if(State.patch){ State.patch({ ready: true, loading: false }, "ready"); }
      status("Ncomplex listo. Seleccione un período.", "success");
      return periods;
    }).catch(function(error){
      if(State.patch){ State.patch({ ready: false, loading: false, error: error.message || String(error) }, "boot-error"); }
      status(error.message || String(error), "error");
      throw error;
    });
  }

  window.NcomplexApp = {
    version: "1.0.0-bloque-2",
    init: init,
    render: render,
    loadPeriods: loadPeriods,
    loadPeriod: loadPeriod,
    analyzeImport: analyzeImport,
    applyImport: applyImport,
    clearImport: clearImport,
    updateFilters: updateFilters
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", function(){ init().catch(function(){}); });
  }else{
    init().catch(function(){});
  }
})(window,document);