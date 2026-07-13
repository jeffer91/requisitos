/* =========================================================
Nombre completo: defart.service-bridge.js
Ruta o ubicación: /Requisitos/defart/defart.service-bridge.js
Función:
- Conectar DefArt con BDLServiceDefensas.getPage().
- Mantener DefartApp sin reescritura completa.
- Reemplazar DefartCore.summary() por un resumen cacheado desde servicio.
- Exponer navegación de página real para DefArtPerformance.
- Usar fallback legacy si el servicio todavía no está listo.
Con qué se conecta:
- ../BDLocal/services/bdl.service.defensas.js
- defart.core.js
- defart.performance.js
- defart.app.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.2.0-block16";
  var originalSummary = null;
  var cache = Object.create(null);
  var loading = Object.create(null);
  var lastSummary = null;
  var lastFilterKey = "";

  function text(v){ return String(v == null ? "" : v).trim(); }

  function service(){
    return window.BDLServices && typeof window.BDLServices.get === "function" ? window.BDLServices.get("defensas") : null;
  }

  function pageState(){
    window.DEFART_PAGING = window.DEFART_PAGING || { page:1, limit:25, filterKey:"", lastInfo:null };
    if(!window.DEFART_PAGING.limit){ window.DEFART_PAGING.limit = 25; }
    if(!window.DEFART_PAGING.page){ window.DEFART_PAGING.page = 1; }
    return window.DEFART_PAGING;
  }

  function filterKey(options){
    options = options || {};
    return JSON.stringify({
      periodId: options.periodId || "",
      division: options.division || "",
      career: options.career || "",
      status: options.status || "",
      sede: options.sede || "",
      search: options.search || "",
      sortKey: options.sortKey || "_nombre",
      sortDir: options.sortDir || "asc"
    });
  }

  function cacheKey(options){
    var paging = pageState();
    return filterKey(options) + "::" + (paging.page || 1) + "::" + (paging.limit || 25);
  }

  function clearCache(options){
    cache = Object.create(null);
    loading = Object.create(null);
    if(options && options.resetPage){ pageState().page = 1; }
    lastSummary = null;
  }

  function refresh(){
    clearCache({ resetPage:false });
    try{ if(window.DefartApp && typeof window.DefartApp.render === "function"){ window.DefartApp.render(); } }catch(error){}
  }

  function setPage(page){
    var paging = pageState();
    var info = paging.lastInfo || {};
    var totalPages = Number(info.totalPages || 1);
    page = Number(page || 1);
    if(!Number.isFinite(page) || page < 1){ page = 1; }
    if(totalPages && page > totalPages){ page = totalPages; }
    paging.page = page;
    clearCache({ resetPage:false });
    refresh();
  }

  function nextPage(){ setPage((pageState().lastInfo && pageState().lastInfo.page || pageState().page || 1) + 1); }
  function prevPage(){ setPage((pageState().lastInfo && pageState().lastInfo.page || pageState().page || 1) - 1); }

  function applyPagingInfo(paged){
    var paging = pageState();
    paged = paged || {};
    var info = {
      page: Number(paged.page || paging.page || 1),
      limit: Number(paged.limit || paging.limit || 25),
      total: Number(paged.total || 0),
      totalPages: Number(paged.totalPages || 1),
      start: paged.total ? ((Number(paged.page || 1) - 1) * Number(paged.limit || 25)) + 1 : 0,
      end: paged.total ? Math.min(Number(paged.total || 0), Number(paged.page || 1) * Number(paged.limit || 25)) : 0,
      hasPrev: !!paged.hasPrev,
      hasNext: !!paged.hasNext
    };
    paging.page = info.page;
    paging.limit = info.limit;
    paging.lastInfo = info;
    return info;
  }

  function sourceRow(row, index){
    row = Object.assign({}, row || {});
    var idEP = text(row.idEstudiantePeriodo || row.studentId || row.id || "");
    row._docId = row._docId || idEP || row.cedula || ("fila_" + index);
    row._bl2PeriodoId = row._bl2PeriodoId || row.periodoId || row.periodId || "";
    row._bl2Periodo = row._bl2Periodo || row.periodoLabel || row.periodo || row.periodoId || "";
    row._bl2Nombre = row._bl2Nombre || row.nombreCompleto || row.nombres || row.Nombres || row.nombre || row.Nombre || "";
    row._bl2Carrera = row._bl2Carrera || row.carrera || row.nombreCarrera || row.NombreCarrera || "";
    row._bl2Sede = row._bl2Sede || row.sede || row.Sede || "";
    row._bl2Division = row._bl2Division || row.division || row.Division || "";
    row._bl2EstadoMatricula = row._bl2EstadoMatricula || row.estadoMatricula || "ACTIVO";
    row.cedula = row.cedula || row._cedula || "";
    row.Notart = row.Notart != null ? row.Notart : row.notart;
    row.Notdef = row.Notdef != null ? row.Notdef : row.notdef;
    row.Notafinal = row.Notafinal != null ? row.Notafinal : row.notafinal;
    return row;
  }

  function decorateRows(rows){
    rows = Array.isArray(rows) ? rows : [];
    if(!window.DefartCore || typeof window.DefartCore.decorate !== "function"){
      return rows;
    }
    return rows.map(function(row, index){ return window.DefartCore.decorate(sourceRow(row, index), index); });
  }

  function unique(rows, getter, keep){
    var map = Object.create(null);
    if(text(keep)){ map[text(keep)] = true; }
    (rows || []).forEach(function(row){
      var value = text(getter(row));
      if(value){ map[value] = true; }
    });
    return Object.keys(map).sort(function(a,b){ return a.localeCompare(b, "es"); });
  }

  function kpis(rows, total){
    var result = { total: Number(total || rows.length || 0) };
    ["Sin requisitos", "Pendiente Art", "Supletorio Art", "Pendiente Def", "Supletorio Def", "Completo"].forEach(function(k){ result[k] = 0; });
    rows.forEach(function(row){ result[row._estadoDefensa] = (result[row._estadoDefensa] || 0) + 1; });
    return result;
  }

  function buildSummary(paged, options, fullRows){
    options = options || {};
    paged = paged || {};
    var rows = decorateRows(paged.rows || []);
    var exportRows = fullRows ? decorateRows(fullRows) : rows.slice();
    var info = applyPagingInfo(paged);
    var allForLists = exportRows.length ? exportRows : rows;

    return {
      rows: rows,
      exportRows: exportRows,
      kpis: kpis(rows, paged.total),
      periodList: unique(allForLists, function(row){ return row._periodoId; }, options.periodId).map(function(id){ return { id:id, label:id }; }),
      divisionList: unique(allForLists, function(row){ return row._division; }, options.division),
      careerList: unique(allForLists, function(row){ return row._carrera; }, options.career),
      sedeList: unique(allForLists, function(row){ return row._sede; }, options.sede),
      states: ["Sin requisitos", "Pendiente Art", "Supletorio Art", "Pendiente Def", "Supletorio Def", "Completo"],
      pagination: info,
      diagnostics: {
        ok: true,
        generatedAt: new Date().toISOString(),
        version: VERSION,
        source: "BDLServiceDefensas.getPage",
        total: paged.total || rows.length,
        visible: rows.length,
        page: info.page,
        limit: info.limit,
        totalPages: info.totalPages,
        queryMode: paged.source || "service",
        notesHydrated: paged.notesHydrated || rows.length,
        exportRows: exportRows.length,
        filters: options
      }
    };
  }

  function serviceOptions(options){
    var paging = pageState();
    return Object.assign({}, options || {}, {
      periodoId: options && options.periodId || "",
      periodo: options && options.periodId || "",
      division: options && options.division || "",
      carrera: options && options.career || "",
      career: options && options.career || "",
      estado: options && options.status || "",
      sede: options && options.sede || "",
      search: options && options.search || "",
      sortKey: options && options.sortKey || "_nombre",
      sortDir: options && options.sortDir || "asc",
      page: Number(paging.page || 1),
      limit: Number(paging.limit || 25)
    });
  }

  function fetchFullForExport(key, options){
    var svc = service();
    if(!svc || typeof svc.getFiltered !== "function"){ return; }
    svc.getFiltered(serviceOptions(options)).then(function(rows){
      if(cache[key]){
        cache[key].exportRows = decorateRows(rows || []);
        cache[key].diagnostics.exportRows = cache[key].exportRows.length;
      }
    }).catch(function(){});
  }

  function fetchPage(key, options){
    var svc = service();
    if(!svc || typeof svc.getPage !== "function" || loading[key]){ return; }
    loading[key] = true;
    svc.getPage(serviceOptions(options)).then(function(paged){
      cache[key] = buildSummary(paged || {}, options || null);
      lastSummary = cache[key];
      fetchFullForExport(key, options || {});
      setTimeout(function(){
        try{ if(window.DefartApp && typeof window.DefartApp.render === "function"){ window.DefartApp.render(); } }catch(error){}
      }, 0);
    }).catch(function(error){
      console.warn("[DefartServiceBridge] Fallback legacy:", error);
    }).finally(function(){ loading[key] = false; });
  }

  function serviceSummary(options){
    options = options || {};
    var fKey = filterKey(options);
    var paging = pageState();
    if(lastFilterKey && lastFilterKey !== fKey){
      paging.page = 1;
      clearCache({ resetPage:false });
    }
    lastFilterKey = fKey;
    paging.filterKey = fKey;
    var key = cacheKey(options);
    if(cache[key]){ return cache[key]; }
    fetchPage(key, options);
    if(lastSummary){
      return Object.assign({}, lastSummary, { rows: [], diagnostics: Object.assign({}, lastSummary.diagnostics || {}, { loading:true, requested:true }) });
    }
    return originalSummary ? originalSummary(options) : { rows:[], periodList:[], divisionList:[], careerList:[], sedeList:[], kpis:{ total:0 }, diagnostics:{ loading:true, source:"service_pending" } };
  }

  function install(){
    if(!window.DefartCore || typeof window.DefartCore.summary !== "function" || window.DefartCore.__serviceBridge){ return false; }
    originalSummary = window.DefartCore.summary;
    window.DefartCore.summary = serviceSummary;
    window.DefartCore.__serviceBridge = true;
    return true;
  }

  window.DefartServiceBridge = {
    version: VERSION,
    install: install,
    clear: clearCache,
    refresh: refresh,
    setPage: setPage,
    nextPage: nextPage,
    prevPage: prevPage,
    pageState: pageState
  };
  install();
})(window);
