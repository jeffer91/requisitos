/* =========================================================
Nombre completo: carga.index.js
Ruta o ubicación: /Requisitos/Carga/carga.index.js
Función:
- Finalizar el arranque de la pantalla Carga.
- Inicializar la conexión BDLocal desde el inicio de la pantalla.
- Mantener Carga comunicada con BDLocal aunque BL2 no esté abierto.
- Cargar cache rápido de divisiones por período.
- Cargar el popup conectado de divisiones por período.
- Refrescar períodos visibles desde BDLocal después de inicializar el adaptador.
- Evitar escaneos masivos de estudiantes para mantener la pantalla rápida.
========================================================= */
(function(window, document){
  "use strict";

  var ADAPTER_PATH = "../BDLocal/adapters/bdl.screen-deps.js";
  var DIVISION_CACHE_PATH = "../BDLocal/adapters/bdl.divisiones.fast-cache.js";
  var DIVISION_POPUP_PATH = "./carga.divisiones.popup.js";
  var LS_PERIODOS = "carga.periodos.local";
  var LS_PERIODO = "carga.periodoSeleccionado";
  var LS_PERIODO_LABEL = "carga.periodoSeleccionadoLabel";

  function text(value){ return String(value == null ? "" : value).trim(); }

  function emit(name, detail){
    try{ window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(error){}
  }

  function escapeHtml(value){
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function resolve(relative){
    try{ return new URL(relative, window.location.href).href; }
    catch(error){ return relative; }
  }

  function loaded(src){
    return Array.prototype.slice.call(document.scripts || []).some(function(script){
      return script.src === src || script.getAttribute("data-carga-index-src") === src;
    });
  }

  function loadScript(relative){
    var src = resolve(relative);
    if(loaded(src)){ return Promise.resolve(src); }

    return new Promise(function(resolvePromise, reject){
      var script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.defer = false;
      script.setAttribute("data-carga-index-src", src);
      script.onload = function(){ resolvePromise(src); };
      script.onerror = function(){ reject(new Error("No se pudo cargar " + src)); };
      document.head.appendChild(script);
    });
  }

  function ensureBDLocal(){
    if(window.BDLocalScreenDeps && typeof window.BDLocalScreenDeps.ready === "function"){
      return window.BDLocalScreenDeps.ready();
    }

    if(window.BDLScreenDepsReady && typeof window.BDLScreenDepsReady.then === "function"){
      return window.BDLScreenDepsReady;
    }

    return loadScript(ADAPTER_PATH).then(function(){
      if(window.BDLocalScreenDeps && typeof window.BDLocalScreenDeps.ready === "function"){
        return window.BDLocalScreenDeps.ready();
      }
      return { ok:false, message:"BDLocalScreenDeps no disponible." };
    });
  }

  function ensureDivisionsCache(){
    if(window.BLDivisionesService && window.BLDivisionesService.version === "1.1.1-fast-cache"){
      return Promise.resolve({ ok:true, loaded:true, source:"existing" });
    }

    return loadScript(DIVISION_CACHE_PATH).then(function(){
      return {
        ok:!!window.BLDivisionesService,
        loaded:!!window.BLDivisionesService,
        source:DIVISION_CACHE_PATH,
        version:window.BLDivisionesService && window.BLDivisionesService.version
      };
    });
  }

  function ensureDivisionsPopup(){
    if(window.CargaDivisionesPopup){
      return Promise.resolve({ ok:true, loaded:true, source:"existing" });
    }

    return loadScript(DIVISION_POPUP_PATH).then(function(){
      return {
        ok:!!window.CargaDivisionesPopup,
        loaded:!!window.CargaDivisionesPopup,
        source:DIVISION_POPUP_PATH
      };
    });
  }

  function normalizePeriod(period){
    period = period || {};
    var id = text(period.periodoCanonicoId || period.periodoId || period.id || period.value || "").replace(/_+/g, "__");
    if(!id){ return null; }
    var label = text(period.periodoCanonicoLabel || period.periodoLabel || period.label || period.nombre || id);
    return Object.assign({}, period, {
      id:id,
      periodoId:id,
      periodoCanonicoId:id,
      label:label,
      periodoLabel:label,
      periodoCanonicoLabel:label,
      carrerasDetectadas:Array.isArray(period.carrerasDetectadas) ? period.carrerasDetectadas : [],
      divisiones:Array.isArray(period.divisiones) ? period.divisiones : []
    });
  }

  function mergePeriods(periods){
    var map = {};
    (Array.isArray(periods) ? periods : []).forEach(function(period){
      period = normalizePeriod(period);
      if(!period){ return; }
      map[period.id] = Object.assign({}, map[period.id] || {}, period);
    });
    return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){
      return text(b.id).localeCompare(text(a.id));
    });
  }

  function readPeriodsFromBDLocal(){
    if(window.BL2Core && typeof window.BL2Core.getPeriods === "function"){
      return window.BL2Core.getPeriods().catch(function(){ return []; });
    }

    if(window.BDLocalConexiones && window.BDLocalConexiones.utils && typeof window.BDLocalConexiones.utils.readCache === "function"){
      return Promise.resolve((window.BDLocalConexiones.utils.readCache().periods || []));
    }

    return Promise.resolve([]);
  }

  function renderCargaPeriodDom(periods){
    periods = mergePeriods(periods);
    if(!periods.length){ return; }

    try{ localStorage.setItem(LS_PERIODOS, JSON.stringify(periods)); }catch(error){}

    var selectedId = "";
    try{ selectedId = text(localStorage.getItem(LS_PERIODO)); }catch(error2){}

    var select = document.getElementById("cargaPeriodoSelect");
    if(select){
      var current = text(select.value || selectedId);
      select.innerHTML = '<option value="">Selecciona un período</option>' + periods.map(function(period){
        return '<option value="' + escapeHtml(period.id) + '">' + escapeHtml(period.periodoCanonicoLabel) + '</option>';
      }).join("");

      if(current && periods.some(function(period){ return period.id === current; })){
        select.value = current;
      }
    }

    var count = document.getElementById("cargaPeriodosCount");
    if(count){ count.textContent = periods.length + " período" + (periods.length === 1 ? "" : "s"); }

    var cards = document.getElementById("cargaPeriodosCards");
    if(cards){
      cards.innerHTML = periods.map(function(period){
        var active = period.id === selectedId;
        var careers = Array.isArray(period.carrerasDetectadas) ? period.carrerasDetectadas.length : 0;
        var divisions = Array.isArray(period.divisiones) ? period.divisiones.length : 0;
        var students = Number(period.estudiantes || period.totalEstudiantes || 0) || 0;
        return ''
          + '<article class="carga-period-card ' + (active ? 'is-active ' : '') + '" data-period-id="' + escapeHtml(period.id) + '">'
            + '<div><h3>' + escapeHtml(period.periodoCanonicoLabel) + '</h3><small>' + escapeHtml(period.id) + '</small></div>'
            + '<div class="carga-period-meta">'
              + '<span class="carga-mini-pill">OK</span>'
              + '<span class="carga-mini-pill">' + students + ' est.</span>'
              + '<span class="carga-mini-pill">' + careers + ' carreras</span>'
              + '<span class="carga-mini-pill">' + divisions + ' divisiones</span>'
            + '</div>'
            + '<div class="carga-period-actions">'
              + '<button type="button" class="carga-btn carga-btn-secondary" data-action="use">Usar</button>'
              + '<button type="button" class="carga-btn carga-btn-light" data-action="edit">Editar</button>'
              + '<button type="button" class="carga-btn carga-btn-light" data-action="delete">Borrar</button>'
              + '<button type="button" class="carga-btn carga-btn-light" data-action="divisions">Divisiones</button>'
            + '</div>'
          + '</article>';
      }).join("");
    }

    if(select && select.value){
      try{ select.dispatchEvent(new Event("change", { bubbles:true })); }catch(error3){}
    }
  }

  function refreshCargaPeriodsFromBDLocal(){
    return readPeriodsFromBDLocal().then(function(periods){
      periods = mergePeriods(periods);
      if(periods.length){
        renderCargaPeriodDom(periods);
      }
      emit("carga:periods-refreshed", {
        ok:true,
        total:periods.length,
        source:"BDLocal",
        at:new Date().toISOString()
      });
      return periods;
    }).catch(function(error){
      emit("carga:periods-refresh-error", {
        ok:false,
        error:error && error.message ? error.message : String(error),
        at:new Date().toISOString()
      });
      return [];
    });
  }

  function boot(){
    emit("carga:ready", { ready:!!window.CargaApp, at:new Date().toISOString() });

    ensureBDLocal().then(function(status){
      emit("carga:bdlocal-ready", {
        ok:status && status.ok !== false,
        status:status || {},
        at:new Date().toISOString()
      });
      return refreshCargaPeriodsFromBDLocal();
    }).then(function(){
      return ensureDivisionsCache();
    }).then(function(status){
      emit("carga:divisiones-cache-ready", {
        ok:status && status.ok !== false,
        status:status || {},
        at:new Date().toISOString()
      });
      return ensureDivisionsPopup();
    }).then(function(status){
      emit("carga:divisiones-popup-ready", {
        ok:status && status.ok !== false,
        status:status || {},
        at:new Date().toISOString()
      });
      return status;
    }).catch(function(error){
      emit("carga:bdlocal-error", {
        ok:false,
        error:error && error.message ? error.message : String(error),
        at:new Date().toISOString()
      });
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})(window, document);
