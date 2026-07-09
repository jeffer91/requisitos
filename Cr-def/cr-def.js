/* =========================================================
Nombre completo: cr-def.js
Ruta o ubicación: /Requisitos/Cr-def/cr-def.js
Función o funciones:
- Inicializar la pantalla Cr-def.
- Cargar períodos desde BDLocal.
- Cargar estudiantes aptos desde cache rápida o BDLocal.
- Actualizar cache propia de Cr-def.
- Manejar buscador inteligente, filtros internos, resumen y botones principales.
Con qué se conecta:
- ../BDLocal/bl2.config.js
- ../BDLocal/bl2.config.v2.js
- ../BDLocal/bl2.db.js
- cr-def.config.js
- cr-def.rules.js
- cr-def.templates.js
- cr-def.cache.js
- cr-def.data.js
- cr-def.scheduler.js
- cr-def.scheduler.bridge.js
- cr-def.render.js
- cr-def.export.js
========================================================= */
(function(window, document){
  "use strict";

  var APP_NAME = "Cr-def";
  var VERSION = "bloque-6-audit-1";

  var state = {
    periodo: "",
    periodos: [],
    busqueda: "",
    filtros: {
      carrera: "",
      sede: "",
      estado: ""
    },
    rows: [],
    loading: false,
    cacheStatus: null,
    firmaActual: null
  };

  var els = {};

  function $(selector){ return document.querySelector(selector); }

  function text(value){
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function norm(value){
    return text(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function safeSetText(el, value){
    if(el){ el.textContent = value; }
  }

  function escapeHtml(value){
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function bindDom(){
    els.app = $("[data-cr-def-app]");
    els.periodo = $("[data-cr-periodo]");
    els.periodoHelp = $("[data-cr-periodo-help]");
    els.alertaPrincipal = $("[data-cr-alerta-principal]");
    els.busqueda = $("[data-cr-busqueda]");
    els.filtroCarrera = $("[data-cr-filtro-carrera]");
    els.filtroSede = $("[data-cr-filtro-sede]");
    els.filtroEstado = $("[data-cr-filtro-estado]");
    els.tablaBody = $("[data-cr-tabla-body]");
    els.cacheStatus = $("[data-cr-cache-status]");
    els.totalAptos = $("[data-cr-total-aptos]");
    els.totalProgramados = $("[data-cr-total-programados]");
    els.totalSinDefensa = $("[data-cr-total-sin-defensa]");
    els.totalConflictos = $("[data-cr-total-conflictos]");
    els.btnActualizar = $("[data-cr-actualizar]");
    els.btnGenerar = $("[data-cr-generar]");
    els.btnExportar = $("[data-cr-exportar]");
    els.actionsHint = $("[data-cr-actions-hint]");
  }

  function setAlert(kind, title, message){
    if(!els.alertaPrincipal){ return; }
    els.alertaPrincipal.className = "cr-alert cr-alert--" + (kind || "info");
    els.alertaPrincipal.innerHTML = "<strong>" + escapeHtml(title || "Aviso") + "</strong> " + escapeHtml(message || "");
  }

  function createOption(value, label){
    var option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }

  function setSelectOptions(select, values, firstLabel){
    if(!select){ return; }
    var current = select.value;
    select.innerHTML = "";
    select.appendChild(createOption("", firstLabel || "Todas"));

    (Array.isArray(values) ? values : []).forEach(function(item){
      var value = typeof item === "string" ? item : item.value;
      var label = typeof item === "string" ? item : item.label;
      if(text(value)){ select.appendChild(createOption(value, label || value)); }
    });

    select.value = current;
    if(select.value !== current){ select.value = ""; }
  }

  function setLoading(loading, message){
    state.loading = !!loading;
    updateButtons();
    safeSetText(els.actionsHint, message || (loading ? "Cargando..." : "Listo."));
  }

  function hasRowsForAction(){
    return Array.isArray(state.rows) && state.rows.length > 0;
  }

  function updateButtons(){
    var hasPeriodo = !!state.periodo;
    var hasData = !!(window.CR_DEF_DATA && window.CR_DEF_DATA.dbAvailable && window.CR_DEF_DATA.dbAvailable());
    var hasScheduler = !!(window.CR_DEF_SCHEDULER && typeof window.CR_DEF_SCHEDULER.generar === "function");

    if(els.btnActualizar){ els.btnActualizar.disabled = state.loading || !hasPeriodo || !hasData; }
    if(els.btnGenerar){ els.btnGenerar.disabled = state.loading || !hasPeriodo || !hasRowsForAction() || !hasScheduler; }
    if(els.btnExportar){ els.btnExportar.disabled = state.loading || !hasRowsForAction(); }

    if(!hasData){
      safeSetText(els.actionsHint, "BDLocal no disponible en esta pantalla.");
    }else if(!hasPeriodo){
      safeSetText(els.actionsHint, "Selecciona un período.");
    }else if(!hasRowsForAction() && !state.loading){
      safeSetText(els.actionsHint, "Actualiza estudiantes aptos desde BDLocal.");
    }else if(!state.loading){
      safeSetText(els.actionsHint, "Listo para generar cronograma o exportar según filtros activos.");
    }
  }

  function loadPeriods(){
    if(!window.CR_DEF_DATA || typeof window.CR_DEF_DATA.listarPeriodos !== "function"){
      setAlert("danger", "BDLocal no disponible.", "No se encontró el lector de datos Cr-def.");
      updateButtons();
      return Promise.resolve([]);
    }

    return window.CR_DEF_DATA.listarPeriodos().then(function(periodos){
      state.periodos = Array.isArray(periodos) ? periodos : [];

      if(els.periodo){
        els.periodo.innerHTML = "";
        els.periodo.appendChild(createOption("", "Seleccione período"));
        state.periodos.forEach(function(periodo){
          els.periodo.appendChild(createOption(periodo.id, periodo.label || periodo.id));
        });
      }

      var last = window.CR_DEF_CACHE && typeof window.CR_DEF_CACHE.getLastPeriod === "function"
        ? window.CR_DEF_CACHE.getLastPeriod()
        : "";

      if(last && state.periodos.some(function(periodo){ return periodo.id === last; })){
        state.periodo = last;
        if(els.periodo){ els.periodo.value = last; }
        loadCacheForPeriod(last);
        checkCacheFreshness(last);
      }

      safeSetText(els.periodoHelp, state.periodos.length ? "Períodos cargados desde BDLocal." : "No hay períodos registrados en BDLocal.");
      updateButtons();
      return state.periodos;
    }).catch(function(error){
      setAlert("danger", "Error al cargar períodos.", error && error.message ? error.message : String(error));
      updateButtons();
      return [];
    });
  }

  function bindEvents(){
    if(els.periodo){
      els.periodo.addEventListener("change", function(){
        state.periodo = text(els.periodo.value);
        state.rows = [];
        state.firmaActual = null;
        if(window.CR_DEF_CACHE && typeof window.CR_DEF_CACHE.setLastPeriod === "function"){
          window.CR_DEF_CACHE.setLastPeriod(state.periodo);
        }
        loadCacheForPeriod(state.periodo);
        checkCacheFreshness(state.periodo);
        updateButtons();
      });
    }

    if(els.busqueda){
      els.busqueda.addEventListener("input", function(){
        state.busqueda = text(els.busqueda.value);
        renderTable();
        updateButtons();
      });
    }

    if(els.filtroCarrera){
      els.filtroCarrera.addEventListener("change", function(){
        state.filtros.carrera = text(els.filtroCarrera.value);
        renderTable();
        updateButtons();
      });
    }

    if(els.filtroSede){
      els.filtroSede.addEventListener("change", function(){
        state.filtros.sede = text(els.filtroSede.value);
        renderTable();
        updateButtons();
      });
    }

    if(els.filtroEstado){
      els.filtroEstado.addEventListener("change", function(){
        state.filtros.estado = text(els.filtroEstado.value);
        renderTable();
        updateButtons();
      });
    }

    if(els.btnActualizar){
      els.btnActualizar.addEventListener("click", function(){
        actualizarAptos();
      });
    }
  }

  function loadCacheForPeriod(periodoId){
    periodoId = text(periodoId);
    if(!periodoId){
      state.rows = [];
      setCacheStatus("Cache pendiente");
      renderTable();
      updateButtons();
      setAlert("info", "Seleccione período.", "Elige un período para cargar estudiantes aptos desde cache o BDLocal.");
      return;
    }

    var cache = window.CR_DEF_CACHE && typeof window.CR_DEF_CACHE.getPeriodCache === "function"
      ? window.CR_DEF_CACHE.getPeriodCache(periodoId)
      : null;

    if(cache && Array.isArray(cache.rows)){
      state.rows = cache.rows;
      state.cacheStatus = cache;
      setCacheStatus("Cache cargada");
      updateFiltersFromRows(state.rows);
      renderTable();
      updateButtons();
      setAlert("info", "Cache cargada.", "Se muestran datos guardados localmente. Presiona Actualizar aptos para refrescar desde BDLocal.");
      return;
    }

    state.rows = [];
    setCacheStatus("Sin cache");
    updateFiltersFromRows([]);
    renderTable();
    updateButtons();
    setAlert("warn", "Sin cache para este período.", "Presiona Actualizar aptos para leer BDLocal y crear la cache rápida de Cr-def.");
  }

  function setCacheStatus(message){
    safeSetText(els.cacheStatus, message || "Cache pendiente");
  }

  function checkCacheFreshness(periodoId){
    periodoId = text(periodoId);
    if(!periodoId || !window.CR_DEF_DATA || typeof window.CR_DEF_DATA.calcularFirma !== "function"){
      return Promise.resolve(null);
    }

    return window.CR_DEF_DATA.calcularFirma(periodoId).then(function(firma){
      state.firmaActual = firma;
      var status = window.CR_DEF_CACHE && typeof window.CR_DEF_CACHE.status === "function"
        ? window.CR_DEF_CACHE.status(periodoId, firma)
        : null;

      if(status && status.hasCache && status.stale){
        setCacheStatus("Cache desactualizada");
        setAlert("warn", "BDLocal cambió.", "La cache de Cr-def puede estar desactualizada. Presiona Actualizar aptos antes de generar cronograma.");
      }else if(status && status.hasCache){
        setCacheStatus("Cache actualizada");
      }

      updateButtons();
      return firma;
    }).catch(function(){
      updateButtons();
      return null;
    });
  }

  function actualizarAptos(){
    if(!state.periodo){ return; }
    if(!window.CR_DEF_DATA || typeof window.CR_DEF_DATA.cargarAptos !== "function"){
      setAlert("danger", "No se puede actualizar.", "El lector de BDLocal para Cr-def no está disponible.");
      return;
    }

    setLoading(true, "Leyendo BDLocal y aplicando reglas...");
    setAlert("info", "Actualizando aptos.", "Se están revisando requisitos, nota de artículo y nota de defensa.");

    window.CR_DEF_DATA.cargarAptos(state.periodo).then(function(result){
      result = result || {};
      state.rows = Array.isArray(result.rows) ? result.rows : [];
      state.firmaActual = result.firma || null;

      var saved = false;
      if(window.CR_DEF_CACHE && typeof window.CR_DEF_CACHE.savePeriodCache === "function"){
        saved = window.CR_DEF_CACHE.savePeriodCache(state.periodo, {
          rows: state.rows,
          firma: result.firma,
          resumen: result.resumen || {},
          source: "BDLocal"
        });
        if(result.firma && typeof window.CR_DEF_CACHE.saveFirma === "function"){
          window.CR_DEF_CACHE.saveFirma(state.periodo, result.firma);
        }
      }

      updateFiltersFromRows(state.rows);
      renderTable();
      updateButtons();
      setCacheStatus(saved ? "Cache actualizada" : "Cache no disponible");

      var resumen = result.resumen || {};
      setAlert(
        "info",
        "Aptos actualizados.",
        "Aptos: " + state.rows.length + ". Bloqueados por requisitos/notas: " + (resumen.bloqueados || 0) + ". Defensa aprobada: " + (resumen.defensaAprobada || 0) + "."
      );
    }).catch(function(error){
      setAlert("danger", "Error al actualizar aptos.", error && error.message ? error.message : String(error));
    }).finally(function(){
      setLoading(false, "Listo para generar cronograma o exportar según filtros activos.");
    });
  }

  function updateFiltersFromRows(rows){
    rows = Array.isArray(rows) ? rows : [];
    var carreras = unique(rows.map(function(row){ return row.carrera; })).sort(function(a, b){ return a.localeCompare(b, "es"); });
    var sedes = unique(rows.map(function(row){ return row.sede; })).sort(function(a, b){ return a.localeCompare(b, "es"); });

    setSelectOptions(els.filtroCarrera, carreras, "Todas");
    setSelectOptions(els.filtroSede, sedes, "Todas");
  }

  function unique(values){
    var map = Object.create(null);
    var out = [];
    (Array.isArray(values) ? values : []).forEach(function(value){
      value = text(value);
      if(value && !map[value]){
        map[value] = true;
        out.push(value);
      }
    });
    return out;
  }

  function rowMatches(row){
    var haystack = norm([
      row.aula,
      row.dia,
      row.hora,
      row.sede,
      row.cedula,
      row.nombre,
      row.carrera,
      row.notaArticulo,
      row.tribunal1,
      row.tribunal2,
      row.tribunal3,
      row.estado,
      (row.alertas || []).join(" ")
    ].join(" "));

    if(state.busqueda && haystack.indexOf(norm(state.busqueda)) === -1){ return false; }
    if(state.filtros.carrera && norm(row.carrera) !== norm(state.filtros.carrera)){ return false; }
    if(state.filtros.sede && norm(row.sede) !== norm(state.filtros.sede)){ return false; }
    if(state.filtros.estado){
      if(state.filtros.estado === "sin-cupo"){
        return !text(row.dia) || !text(row.hora);
      }
      return norm(row.estadoClave) === norm(state.filtros.estado);
    }
    return true;
  }

  function renderTable(){
    if(!els.tablaBody){ return; }
    var filteredRows = state.rows.filter(rowMatches);
    els.tablaBody.innerHTML = "";

    if(!state.periodo){
      els.tablaBody.appendChild(emptyRow("Selecciona un período y presiona Actualizar aptos."));
      updateSummary(filteredRows);
      updateButtons();
      return;
    }

    if(!filteredRows.length){
      els.tablaBody.appendChild(emptyRow(state.rows.length ? "No hay resultados con los filtros actuales." : "No hay estudiantes aptos cargados. Presiona Actualizar aptos."));
      updateSummary(filteredRows);
      updateButtons();
      return;
    }

    filteredRows.forEach(function(row){ els.tablaBody.appendChild(renderRow(row)); });
    updateSummary(filteredRows);
    updateButtons();
  }

  function emptyRow(message){
    var tr = document.createElement("tr");
    tr.className = "cr-empty-row";
    var td = document.createElement("td");
    td.colSpan = 12;
    td.textContent = message;
    tr.appendChild(td);
    return tr;
  }

  function renderRow(row){
    var tr = document.createElement("tr");
    if(row.estadoClave === "conflicto"){
      tr.className = "cr-row--danger";
    }else if(!text(row.dia) || !text(row.hora)){
      tr.className = "cr-row--warn";
    }

    [
      row.aula,
      row.dia,
      row.hora,
      row.sede,
      row.cedula,
      row.nombre,
      row.carrera,
      row.notaArticulo,
      row.tribunal1,
      row.tribunal2,
      row.tribunal3,
      row.estado
    ].forEach(function(value){
      var td = document.createElement("td");
      td.textContent = text(value) || "—";
      tr.appendChild(td);
    });

    if(row.alertas && row.alertas.length){
      tr.title = row.alertas.join("\n");
    }

    return tr;
  }

  function updateSummary(rows){
    rows = Array.isArray(rows) ? rows : [];
    var aptos = rows.filter(function(row){ return row.estadoClave === "apto" || row.estadoClave === "supletorio"; }).length;
    var programados = rows.filter(function(row){ return row.estadoClave === "programado"; }).length;
    var sinDefensa = rows.filter(function(row){ return !text(row.dia) || !text(row.hora); }).length;
    var conflictos = rows.filter(function(row){ return row.estadoClave === "conflicto"; }).length;

    safeSetText(els.totalAptos, aptos);
    safeSetText(els.totalProgramados, programados);
    safeSetText(els.totalSinDefensa, sinDefensa);
    safeSetText(els.totalConflictos, conflictos);
  }

  function exposeDebugApi(){
    window.CR_DEF_APP = {
      name: APP_NAME,
      version: VERSION,
      state: state,
      render: renderTable,
      actualizarAptos: actualizarAptos,
      updateButtons: updateButtons,
      setRows: function(rows){
        state.rows = Array.isArray(rows) ? rows : [];
        updateFiltersFromRows(state.rows);
        renderTable();
        updateButtons();
      }
    };
  }

  function init(){
    bindDom();
    bindEvents();
    exposeDebugApi();

    if(!window.BL2DB){
      setAlert("danger", "BDLocal no cargó.", "No se encontró BL2DB. Revisa las rutas de scripts de BDLocal.");
      setCacheStatus("BDLocal no disponible");
      updateButtons();
      renderTable();
      return;
    }

    setCacheStatus(window.CR_DEF_CACHE && window.CR_DEF_CACHE.isAvailable && window.CR_DEF_CACHE.isAvailable() ? "Cache lista" : "Cache no disponible");
    loadPeriods().then(function(){
      if(!state.periodo){
        renderTable();
        setAlert("info", "Cr-def listo.", "Selecciona un período y presiona Actualizar aptos para leer BDLocal.");
      }
      updateButtons();
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  }else{
    init();
  }
})(window, document);
