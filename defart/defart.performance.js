/* =========================================================
Nombre completo: defart.performance.js
Ruta o ubicación: /Requisitos/defart/defart.performance.js
Función o funciones:
- Agregar paginación fija de 25 filas a Defensas sin romper DefartCore.
- Cachear el resumen filtrado para evitar recalcular en cambios de página.
- Mantener exportación con todos los filtros aplicados, no solo la página visible.
- Resetear página cuando cambian filtros, se guardan notas o cambia BDLocal.
Con qué se conecta:
- defart.core.js
- defart.table.js
- defart.app.js
- defart.export.js
========================================================= */
(function(window, document){
  "use strict";

  var DEFAULT_LIMIT = 25;
  var cache = Object.create(null);
  var originalSummary = null;
  var originalSaveNotes = null;
  var originalRender = null;

  window.DEFART_PAGING = window.DEFART_PAGING || {
    page: 1,
    limit: DEFAULT_LIMIT,
    filterKey: "",
    lastInfo: null
  };

  function text(value){ return String(value == null ? "" : value).trim(); }

  function pageState(){ return window.DEFART_PAGING; }

  function cleanOptions(options){
    var out = Object.assign({}, options || {});
    delete out.page;
    delete out.limit;
    delete out.offset;
    return out;
  }

  function filterKey(options){
    var clean = cleanOptions(options || {});
    return JSON.stringify({
      periodId: clean.periodId || "",
      division: clean.division || "",
      career: clean.career || "",
      status: clean.status || "",
      sede: clean.sede || "",
      search: clean.search || "",
      sortKey: clean.sortKey || "_nombre",
      sortDir: clean.sortDir || "asc"
    });
  }

  function clearCache(){
    cache = Object.create(null);
  }

  function resetCacheAndPage(){
    clearCache();
    pageState().page = 1;
  }

  function getFullSummary(options){
    var key = filterKey(options || {});
    var paging = pageState();

    if(paging.filterKey && paging.filterKey !== key){
      paging.page = 1;
    }
    paging.filterKey = key;

    if(!cache[key]){
      cache[key] = originalSummary(cleanOptions(options || {}));
    }

    return cache[key];
  }

  function pagedSummary(options){
    options = options || {};
    var paging = pageState();
    var base = getFullSummary(options) || {};
    var allRows = Array.isArray(base.rows) ? base.rows : [];
    var limit = DEFAULT_LIMIT;
    var total = allRows.length;
    var totalPages = Math.max(1, Math.ceil(total / limit));
    var page = Number(options.page || paging.page || 1);

    if(!Number.isFinite(page) || page < 1){ page = 1; }
    if(page > totalPages){ page = totalPages; }

    paging.page = page;
    paging.limit = limit;

    var start = (page - 1) * limit;
    var visibleRows = allRows.slice(start, start + limit);
    var info = {
      page: page,
      limit: limit,
      total: total,
      totalPages: totalPages,
      start: total ? start + 1 : 0,
      end: Math.min(start + limit, total),
      hasPrev: page > 1,
      hasNext: page < totalPages
    };

    paging.lastInfo = info;

    var out = Object.assign({}, base, {
      rows: visibleRows,
      exportRows: allRows.slice(),
      pagination: info
    });

    out.diagnostics = Object.assign({}, base.diagnostics || {}, {
      page: page,
      limit: limit,
      totalFiltered: total,
      pageVisible: visibleRows.length,
      paginationEnabled: true
    });

    return out;
  }

  function ensurePager(){
    var wrap = document.getElementById("def-table-wrap");
    if(!wrap || document.getElementById("def-pagination")){ return; }

    var pager = document.createElement("div");
    pager.id = "def-pagination";
    pager.className = "def-pagination";
    pager.innerHTML = [
      '<button type="button" data-def-page="prev">Anterior</button>',
      '<span id="def-pagination-info">Página 1 de 1</span>',
      '<button type="button" data-def-page="next">Siguiente</button>'
    ].join("");

    wrap.parentNode.insertBefore(pager, wrap.nextSibling);
  }

  function updatePager(){
    ensurePager();
    var info = pageState().lastInfo || { page:1, totalPages:1, total:0, start:0, end:0, hasPrev:false, hasNext:false };
    var pager = document.getElementById("def-pagination");
    var label = document.getElementById("def-pagination-info");
    var visible = document.getElementById("def-visible-count");

    if(label){
      label.textContent = "Página " + info.page + " de " + info.totalPages + " · " + info.start + "-" + info.end + " de " + info.total;
    }
    if(visible){
      visible.textContent = info.total ? (info.start + "-" + info.end + " de " + info.total + " filtrados") : "0 visibles";
    }
    if(pager){
      var prev = pager.querySelector('[data-def-page="prev"]');
      var next = pager.querySelector('[data-def-page="next"]');
      if(prev){ prev.disabled = !info.hasPrev; }
      if(next){ next.disabled = !info.hasNext; }
    }
  }

  function goPage(direction){
    var info = pageState().lastInfo || { page:1, totalPages:1 };
    if(direction === "prev"){ pageState().page = Math.max(1, info.page - 1); }
    if(direction === "next"){ pageState().page = Math.min(info.totalPages || 1, info.page + 1); }
    if(window.DefartApp && typeof window.DefartApp.render === "function"){
      window.DefartApp.render();
    }
  }

  function bindPager(){
    document.addEventListener("click", function(event){
      var btn = event.target && event.target.closest ? event.target.closest("[data-def-page]") : null;
      if(!btn){ return; }
      event.preventDefault();
      goPage(btn.getAttribute("data-def-page"));
    });
  }

  function showStatus(message, kind){
    var box = document.getElementById("def-status");
    if(!box){ return; }
    box.textContent = message || "";
    box.className = "def-status " + (kind || "ok");
    box.style.display = message ? "block" : "none";
  }

  function exportAllFiltered(event){
    var btn = event.target && event.target.closest ? event.target.closest("#def-btn-export") : null;
    if(!btn){ return; }
    event.preventDefault();
    event.stopImmediatePropagation();

    try{
      if(!window.DefartExport || typeof window.DefartExport.exportExcel !== "function"){
        throw new Error("DefartExport no está disponible.");
      }
      if(!window.DefartApp || typeof window.DefartApp.getState !== "function"){
        throw new Error("DefartApp no está disponible.");
      }

      var state = window.DefartApp.getState() || {};
      var data = state.data || {};
      var rows = Array.isArray(data.exportRows) ? data.exportRows : (data.rows || []);
      var tableOptions = { changes: state.changes || {}, rowFeedback: state.rowFeedback || {} };

      if(window.DefartTable && typeof window.DefartTable.withPending === "function"){
        rows = rows.map(function(row){ return window.DefartTable.withPending(row, tableOptions); });
      }

      var result = window.DefartExport.exportExcel(rows, {
        periodId: state.periodId || "TODOS",
        periodLabel: state.periodId || "TODOS",
        division: state.division || "TODAS"
      });

      showStatus("Excel descargado con todos los filtros: " + (result.fileName || "archivo generado"), "ok");
    }catch(error){
      console.error("[Defensas Export All]", error);
      showStatus(error.message || String(error), "warn");
    }
  }

  function bindExportInterceptor(){
    document.addEventListener("click", exportAllFiltered, true);
  }

  function bindCacheInvalidators(){
    window.addEventListener("storage", function(event){
      if(event.key === "REQ_BL_SIGNAL_V1" || event.key === "REQ_EXCEL_LOCAL_V1:snapshot"){
        resetCacheAndPage();
      }
    });

    window.addEventListener("bdlocal:changes-created", resetCacheAndPage);
    window.addEventListener("bl2:students-saved", resetCacheAndPage);
  }

  function installCorePatch(){
    if(!window.DefartCore || typeof window.DefartCore.summary !== "function"){ return false; }
    if(window.DefartCore.__performancePatch){ return true; }

    originalSummary = window.DefartCore.summary;
    originalSaveNotes = window.DefartCore.saveNotes;

    window.DefartCore.summary = pagedSummary;
    window.DefartCore.summaryAllFiltered = function(options){
      var base = getFullSummary(options || {});
      return Array.isArray(base.rows) ? base.rows.slice() : [];
    };
    window.DefartCore.clearSummaryCache = clearCache;

    if(typeof originalSaveNotes === "function"){
      window.DefartCore.saveNotes = function(changes){
        var result = originalSaveNotes.call(window.DefartCore, changes);
        resetCacheAndPage();
        return result;
      };
    }

    window.DefartCore.__performancePatch = true;
    return true;
  }

  function installTablePatch(){
    if(!window.DefartTable || typeof window.DefartTable.render !== "function"){ return false; }
    if(window.DefartTable.__performancePatch){ return true; }

    originalRender = window.DefartTable.render;
    window.DefartTable.render = function(target, options){
      originalRender.call(window.DefartTable, target, options || {});
      setTimeout(updatePager, 0);
    };
    window.DefartTable.__performancePatch = true;
    return true;
  }

  function install(){
    installCorePatch();
    installTablePatch();
    bindPager();
    bindExportInterceptor();
    bindCacheInvalidators();
  }

  install();
})(window, document);
