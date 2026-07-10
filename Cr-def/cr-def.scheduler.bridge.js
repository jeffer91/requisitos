/* =========================================================
Nombre completo: cr-def.scheduler.bridge.js
Ruta o ubicación: /Requisitos/Cr-def/cr-def.scheduler.bridge.js
Función o funciones:
- Conectar el botón Generar cronograma con CR_DEF_SCHEDULER.
- Tomar días generales y días por carrera desde la pantalla.
- Generar solo sobre los estudiantes visibles por filtros actuales.
- Guardar el resultado en la cache propia de Cr-def.
Con qué se conecta:
- cr-def.scheduler.js
- cr-def.cache.js
- cr-def.js
========================================================= */
(function(window, document){
  "use strict";

  function $(selector){ return document.querySelector(selector); }
  function txt(value){ return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); }
  function norm(value){ return txt(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }

  function setAlert(kind, title, message){
    var box = $("[data-cr-alerta-principal]");
    if(!box){ return; }
    box.className = "cr-alert cr-alert--" + (kind || "info");
    box.innerHTML = "<strong>" + escapeHtml(title || "Aviso") + "</strong> " + escapeHtml(message || "");
  }

  function escapeHtml(value){
    return txt(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function app(){ return window.CR_DEF_APP || null; }
  function state(){ return app() && app().state ? app().state : null; }

  function rowMatches(row, st){
    st = st || {};
    var filtros = st.filtros || {};
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

    if(st.busqueda && haystack.indexOf(norm(st.busqueda)) === -1){ return false; }
    if(filtros.carrera && norm(row.carrera) !== norm(filtros.carrera)){ return false; }
    if(filtros.sede && norm(row.sede) !== norm(filtros.sede)){ return false; }
    if(filtros.estado){
      if(filtros.estado === "sin-cupo"){ return !txt(row.dia) || !txt(row.hora); }
      return norm(row.estadoClave) === norm(filtros.estado);
    }
    return true;
  }

  function isGenerable(row){
    return row && ["apto", "supletorio", "sin-cupo", "programado"].indexOf(row.estadoClave) >= 0;
  }

  function rowKey(row){
    return txt(row.id) || [row.periodoId, row.cedula, row.nombre].map(txt).join("__");
  }

  function visibleRows(){
    var st = state();
    if(!st || !Array.isArray(st.rows)){ return []; }
    return st.rows.filter(function(row){ return isGenerable(row) && rowMatches(row, st); });
  }

  function setButtonState(){
    var btn = $("[data-cr-generar]");
    if(!btn){ return; }
    var st = state();
    var ready = !!(st && st.periodo && visibleRows().length && window.CR_DEF_SCHEDULER && typeof window.CR_DEF_SCHEDULER.generar === "function");
    btn.disabled = !ready;
  }

  function mergeRows(original, generated){
    var map = Object.create(null);
    generated.forEach(function(row){ map[rowKey(row)] = row; });
    return original.map(function(row){ return map[rowKey(row)] || row; });
  }

  function saveCache(rows){
    var st = state();
    if(!st || !st.periodo || !window.CR_DEF_CACHE || typeof window.CR_DEF_CACHE.savePeriodCache !== "function"){
      return;
    }
    window.CR_DEF_CACHE.savePeriodCache(st.periodo, {
      rows: rows,
      firma: st.firmaActual || null,
      source: "scheduler",
      resumen: {
        total: rows.length,
        programados: rows.filter(function(row){ return row.estadoClave === "programado"; }).length,
        sinCupo: rows.filter(function(row){ return row.estadoClave === "sin-cupo"; }).length,
        conflictos: rows.filter(function(row){ return row.estadoClave === "conflicto"; }).length
      }
    });
  }

  function generar(){
    var st = state();
    if(!st || !Array.isArray(st.rows) || !window.CR_DEF_SCHEDULER){ return; }

    var target = visibleRows();
    if(!target.length){
      setAlert("warn", "Sin estudiantes visibles.", "No hay estudiantes aptos dentro de los filtros actuales.");
      return;
    }

    var diasGlobal = txt($("[data-cr-dias-globales]") && $("[data-cr-dias-globales]").value);
    var diasCarrera = txt($("[data-cr-dias-carrera]") && $("[data-cr-dias-carrera]").value);

    var result = window.CR_DEF_SCHEDULER.generar(target, {
      diasGlobal: diasGlobal,
      diasCarrera: diasCarrera
    });

    var merged = mergeRows(st.rows, result.rows || []);
    st.rows = merged;

    if(app() && typeof app().setRows === "function"){
      app().setRows(merged);
    }

    saveCache(merged);
    setButtonState();

    var r = result.resumen || {};
    if(r.sinDias){
      setAlert("warn", "Faltan días.", "Debes escribir al menos un día general o por carrera. No se inventaron fechas.");
      return;
    }
    if(r.sinCupo){
      setAlert("warn", "Cronograma generado con pendientes.", "Programados: " + (r.programados || 0) + ". Faltan " + r.sinCupo + " estudiantes aptos sin defensa.");
      return;
    }
    if(r.conflictos){
      setAlert("warn", "Cronograma generado con conflictos.", "Programados: " + (r.programados || 0) + ". Conflictos detectados: " + r.conflictos + ".");
      return;
    }
    setAlert("info", "Cronograma generado.", "Se programaron " + (r.programados || 0) + " defensas según los filtros activos.");
  }

  function bind(){
    var btn = $("[data-cr-generar]");
    if(btn){ btn.addEventListener("click", generar); }
    ["[data-cr-dias-globales]", "[data-cr-dias-carrera]", "[data-cr-periodo]", "[data-cr-busqueda]", "[data-cr-filtro-carrera]", "[data-cr-filtro-sede]", "[data-cr-filtro-estado]"].forEach(function(selector){
      var el = $(selector);
      if(el){ el.addEventListener("input", setButtonState); el.addEventListener("change", setButtonState); }
    });
    window.setInterval(setButtonState, 900);
    setButtonState();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bind);
  }else{
    bind();
  }
})(window, document);
