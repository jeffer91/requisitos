/* =========================================================
Nombre completo: defart.performance.js
Ruta o ubicación: /Requisitos/defart/defart.performance.js
Función o funciones:
- Agregar paginación fija de 25 filas a Defensas.
- Mantener compatibilidad con resumen legacy.
- Delegar navegación real a DefartServiceBridge cuando esté disponible.
- Mantener un único contador visible sin titileo.
- Consultar la exportación completa únicamente cuando el usuario la solicita.
Con qué se conecta:
- defart.core.js
- defart.table.js
- defart.service-bridge.js
- defart.app.js
- defart.export.js
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.1.0-stable-counter-lazy-export";
  var DEFAULT_LIMIT = 25;
  var cache = Object.create(null);
  var originalSummary = null;
  var originalSaveNotes = null;
  var originalRender = null;
  var originalAppRender = null;

  window.DEFART_PAGING = window.DEFART_PAGING || { page:1, limit:DEFAULT_LIMIT, filterKey:"", lastInfo:null };

  function pageState(){ return window.DEFART_PAGING; }
  function bridge(){ return window.DefartServiceBridge || null; }
  function appState(){
    try{
      return window.DefartApp && typeof window.DefartApp.getState === "function"
        ? window.DefartApp.getState() || {}
        : {};
    }catch(error){
      return {};
    }
  }

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
    if(bridge() && typeof bridge().clear === "function"){
      bridge().clear({ resetPage:false });
    }
  }

  function resetCacheAndPage(){
    cache = Object.create(null);
    pageState().page = 1;
    if(bridge() && typeof bridge().clear === "function"){
      bridge().clear({ resetPage:true });
    }else if(bridge() && typeof bridge().setPage === "function"){
      bridge().setPage(1);
    }
  }

  function getFullSummary(options){
    var key = filterKey(options || {});
    var paging = pageState();
    if(paging.filterKey && paging.filterKey !== key){ paging.page = 1; }
    paging.filterKey = key;
    if(!cache[key]){ cache[key] = originalSummary(cleanOptions(options || {})); }
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
      page:page,
      limit:limit,
      total:total,
      totalPages:totalPages,
      start:total ? start + 1 : 0,
      end:Math.min(start + limit, total),
      hasPrev:page > 1,
      hasNext:page < totalPages
    };
    paging.lastInfo = info;
    var out = Object.assign({}, base, {
      rows:visibleRows,
      exportRows:allRows.slice(),
      pagination:info
    });
    out.diagnostics = Object.assign({}, base.diagnostics || {}, {
      page:page,
      limit:limit,
      totalFiltered:total,
      pageVisible:visibleRows.length,
      paginationEnabled:true,
      paginationMode:"legacy"
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
    var state = appState();
    var data = state.data || {};
    var diagnostics = data.diagnostics || {};
    var loadingNow = diagnostics.loading === true;
    var info = data.pagination || pageState().lastInfo || {
      page:1,totalPages:1,total:0,start:0,end:0,hasPrev:false,hasNext:false
    };
    var pager = document.getElementById("def-pagination");
    var label = document.getElementById("def-pagination-info");
    var visible = document.getElementById("def-visible-count");

    if(label){
      label.textContent = loadingNow
        ? "Cargando resultados..."
        : "Página " + info.page + " de " + info.totalPages + " · " + info.start + "-" + info.end + " de " + info.total;
    }
    if(visible){
      visible.textContent = loadingNow
        ? "Cargando..."
        : (info.total ? (info.start + "-" + info.end + " de " + info.total + " filtrados") : "0 visibles");
    }
    if(pager){
      var prev = pager.querySelector('[data-def-page="prev"]');
      var next = pager.querySelector('[data-def-page="next"]');
      if(prev){ prev.disabled = loadingNow || !info.hasPrev; }
      if(next){ next.disabled = loadingNow || !info.hasNext; }
    }
  }

  function goPage(direction){
    var info = pageState().lastInfo || { page:1, totalPages:1 };
    if(bridge()){
      if(direction === "prev" && typeof bridge().prevPage === "function"){
        bridge().prevPage();
        return;
      }
      if(direction === "next" && typeof bridge().nextPage === "function"){
        bridge().nextPage();
        return;
      }
    }
    if(direction === "prev"){ pageState().page = Math.max(1, info.page - 1); }
    if(direction === "next"){ pageState().page = Math.min(info.totalPages || 1, info.page + 1); }
    if(window.DefartApp && typeof window.DefartApp.render === "function"){
      window.DefartApp.render();
    }
  }

  function bindPager(){
    if(document.__defartPagerBound){ return; }
    document.__defartPagerBound = true;
    document.addEventListener("click", function(event){
      var btn = event.target && event.target.closest
        ? event.target.closest("[data-def-page]")
        : null;
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

  function exportOptionsFromState(state){
    return {
      periodId:state.periodId || "",
      division:state.division || "",
      career:state.career || "",
      status:state.status || "",
      sede:state.sede || "",
      search:state.search || "",
      sortKey:state.sortKey || "_nombre",
      sortDir:state.sortDir || "asc"
    };
  }

  function rowsForExport(state){
    var currentBridge = bridge();
    if(currentBridge && typeof currentBridge.getExportRows === "function"){
      return currentBridge.getExportRows(exportOptionsFromState(state));
    }
    var data = state.data || {};
    var rows = Array.isArray(data.exportRows) && data.exportRows.length
      ? data.exportRows
      : (data.rows || []);
    return Promise.resolve(rows);
  }

  function exportAllFiltered(event){
    var btn = event.target && event.target.closest
      ? event.target.closest("#def-btn-export")
      : null;
    if(!btn){ return; }
    event.preventDefault();
    event.stopImmediatePropagation();
    if(btn.disabled){ return; }

    var originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Preparando...";
    showStatus("Preparando Excel con todos los filtros...", "ok");

    Promise.resolve().then(function(){
      if(!window.DefartExport || typeof window.DefartExport.exportExcel !== "function"){
        throw new Error("DefartExport no está disponible.");
      }
      if(!window.DefartApp || typeof window.DefartApp.getState !== "function"){
        throw new Error("DefartApp no está disponible.");
      }
      var state = window.DefartApp.getState() || {};
      return rowsForExport(state).then(function(rows){
        rows = Array.isArray(rows) ? rows : [];
        var tableOptions = {
          changes:state.changes || {},
          rowFeedback:state.rowFeedback || {}
        };
        if(window.DefartTable && typeof window.DefartTable.withPending === "function"){
          rows = rows.map(function(row){
            return window.DefartTable.withPending(row, tableOptions);
          });
        }
        var result = window.DefartExport.exportExcel(rows, {
          periodId:state.periodId || "TODOS",
          periodLabel:state.periodId || "TODOS",
          division:state.division || "TODAS"
        });
        showStatus("Excel descargado con todos los filtros: " + (result.fileName || "archivo generado"), "ok");
      });
    }).catch(function(error){
      console.error("[Defensas Export All]", error);
      showStatus(error.message || String(error), "warn");
    }).finally(function(){
      btn.disabled = false;
      btn.textContent = originalText;
    });
  }

  function bindExportInterceptor(){
    if(document.__defartExportBound){ return; }
    document.__defartExportBound = true;
    document.addEventListener("click", exportAllFiltered, true);
  }

  function bindCacheInvalidators(){
    if(window.__defartCacheInvalidatorsBound){ return; }
    window.__defartCacheInvalidatorsBound = true;
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
      window.setTimeout(updatePager, 0);
    };
    window.DefartTable.__performancePatch = true;
    return true;
  }

  function installAppPatch(){
    if(!window.DefartApp || typeof window.DefartApp.render !== "function"){ return false; }
    if(window.DefartApp.__performanceRenderPatch){ return true; }
    originalAppRender = window.DefartApp.render;
    window.DefartApp.render = function(){
      var result = originalAppRender.apply(window.DefartApp, arguments);
      updatePager();
      return result;
    };
    window.DefartApp.__performanceRenderPatch = true;
    updatePager();
    return true;
  }

  function waitForAppPatch(){
    if(installAppPatch()){ return; }
    var attempts = 0;
    var timer = window.setInterval(function(){
      attempts += 1;
      if(installAppPatch() || attempts >= 100){
        window.clearInterval(timer);
      }
    }, 50);
  }

  function install(){
    installCorePatch();
    installTablePatch();
    bindPager();
    bindExportInterceptor();
    bindCacheInvalidators();
    waitForAppPatch();
  }

  window.DefartPerformance = {
    version:VERSION,
    updatePager:updatePager,
    resetCacheAndPage:resetCacheAndPage,
    clearCache:clearCache,
    goPage:goPage,
    installAppPatch:installAppPatch
  };
  install();
})(window, document);