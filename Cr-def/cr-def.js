/* =========================================================
Nombre completo: cr-def.js
Ruta o ubicación: /Requisitos/Cr-def/cr-def.js
Función o funciones:
- Inicializar la pantalla base Cr-def.
- Preparar referencias DOM.
- Preparar estado mínimo de interfaz.
- Dejar listo el buscador inteligente y filtros internos para los siguientes bloques.
Con qué se conecta:
- cr-def.html
- cr-def.css
Pendiente para siguientes bloques:
- Conexión real con BDLocal.
- Cache propia de Cr-def.
- Reglas de aptitud para defensa.
- Plantillas quemadas y generación automática.
========================================================= */
(function(window, document){
  "use strict";

  var APP_NAME = "Cr-def";
  var VERSION = "bloque-1";

  var state = {
    periodo: "",
    busqueda: "",
    filtros: {
      carrera: "",
      sede: "",
      estado: ""
    },
    rows: []
  };

  var els = {};

  function $(selector){
    return document.querySelector(selector);
  }

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
  }

  function setAlert(kind, title, message){
    if(!els.alertaPrincipal){ return; }
    els.alertaPrincipal.className = "cr-alert cr-alert--" + (kind || "info");
    els.alertaPrincipal.innerHTML = "<strong>" + escapeHtml(title || "Aviso") + "</strong> " + escapeHtml(message || "");
  }

  function escapeHtml(value){
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function createOption(value, label){
    var option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }

  function loadTemporaryPeriods(){
    if(!els.periodo){ return; }

    var currentValue = els.periodo.value;
    var periods = [
      "Febrero 2025 - Agosto 2026",
      "Abril 2026 - Septiembre 2026",
      "Noviembre 2025 - Mayo 2026"
    ];

    periods.forEach(function(periodo){
      els.periodo.appendChild(createOption(periodo, periodo));
    });

    els.periodo.value = currentValue;

    safeSetText(
      els.periodoHelp,
      "Temporal: estos períodos son de apoyo visual. En el bloque de BDLocal se cargarán automáticamente."
    );
  }

  function loadInternalFilterSeeds(){
    fillSelect(els.filtroCarrera, [
      "UNIVERSITARIA EN ADMINISTRACIÓN DE EMPRESAS",
      "UNIVERSITARIA EN ADMINISTRACIÓN DE TALENTO HUMANO",
      "UNIVERSITARIA EN CONTABILIDAD Y TRIBUTARIA",
      "UNIVERSITARIA EN REDES Y TELECOMUNICACIONES",
      "UNIVERSITARIA EN MARKETING DIGITAL",
      "UNIVERSITARIA EN PEDAGOGÍA",
      "UNIVERSITARIA EN EDUCACIÓN INICIAL",
      "MECÁNICA AUTOMOTRIZ",
      "PROCESAMIENTO EN ALIMENTOS"
    ]);

    fillSelect(els.filtroSede, ["Matriz", "Sur", "Virtual"]);
  }

  function fillSelect(select, values){
    if(!select){ return; }
    values.forEach(function(value){
      select.appendChild(createOption(value, value));
    });
  }

  function bindEvents(){
    if(els.periodo){
      els.periodo.addEventListener("change", function(){
        state.periodo = text(els.periodo.value);
        renderEmptyState();
      });
    }

    if(els.busqueda){
      els.busqueda.addEventListener("input", function(){
        state.busqueda = text(els.busqueda.value);
        renderTable();
      });
    }

    if(els.filtroCarrera){
      els.filtroCarrera.addEventListener("change", function(){
        state.filtros.carrera = text(els.filtroCarrera.value);
        renderTable();
      });
    }

    if(els.filtroSede){
      els.filtroSede.addEventListener("change", function(){
        state.filtros.sede = text(els.filtroSede.value);
        renderTable();
      });
    }

    if(els.filtroEstado){
      els.filtroEstado.addEventListener("change", function(){
        state.filtros.estado = text(els.filtroEstado.value);
        renderTable();
      });
    }
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
      row.estado
    ].join(" "));

    if(state.busqueda && haystack.indexOf(norm(state.busqueda)) === -1){
      return false;
    }

    if(state.filtros.carrera && norm(row.carrera) !== norm(state.filtros.carrera)){
      return false;
    }

    if(state.filtros.sede && norm(row.sede) !== norm(state.filtros.sede)){
      return false;
    }

    if(state.filtros.estado && norm(row.estadoClave) !== norm(state.filtros.estado)){
      return false;
    }

    return true;
  }

  function renderEmptyState(){
    state.rows = [];
    renderTable();

    if(state.periodo){
      setAlert(
        "warn",
        "Período seleccionado.",
        "Aún falta conectar BDLocal. En el siguiente bloque se cargarán estudiantes aptos del período seleccionado."
      );
    }else{
      setAlert(
        "info",
        "Bloque 1 activo.",
        "La pantalla base ya está preparada. En los siguientes bloques se conectará BDLocal, cache, reglas, plantillas y generación automática."
      );
    }
  }

  function renderTable(){
    if(!els.tablaBody){ return; }

    var filteredRows = state.rows.filter(rowMatches);
    els.tablaBody.innerHTML = "";

    if(!state.periodo){
      els.tablaBody.appendChild(emptyRow("Selecciona un período. En los siguientes bloques se cargarán estudiantes desde BDLocal."));
      updateSummary(filteredRows);
      return;
    }

    if(!filteredRows.length){
      els.tablaBody.appendChild(emptyRow("No hay registros para mostrar todavía. Falta conectar BDLocal y reglas de aptitud."));
      updateSummary(filteredRows);
      return;
    }

    filteredRows.forEach(function(row){
      els.tablaBody.appendChild(renderRow(row));
    });

    updateSummary(filteredRows);
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
    }else if(row.estadoClave === "sin-cupo"){
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

    return tr;
  }

  function updateSummary(rows){
    var aptos = rows.filter(function(row){ return row.estadoClave === "apto"; }).length;
    var programados = rows.filter(function(row){ return row.estadoClave === "programado"; }).length;
    var sinDefensa = rows.filter(function(row){ return row.estadoClave === "sin-cupo"; }).length;
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
      setRows: function(rows){
        state.rows = Array.isArray(rows) ? rows : [];
        renderTable();
      }
    };
  }

  function init(){
    bindDom();
    loadTemporaryPeriods();
    loadInternalFilterSeeds();
    bindEvents();
    renderEmptyState();
    exposeDebugApi();

    if(els.cacheStatus){
      els.cacheStatus.textContent = "Cache pendiente";
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  }else{
    init();
  }
})(window, document);
