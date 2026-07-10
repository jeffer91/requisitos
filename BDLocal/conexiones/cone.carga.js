/* =========================================================
Nombre completo: cone.carga.js
Ruta o ubicación: /Requisitos/BDLocal/conexiones/cone.carga.js
Función o funciones:
- Conectar la pantalla Carga con BDLocal/BL2.
- Guardar estudiantes exclusivamente en IndexedDB mediante BL2Core.
- Reconstruir la caché compartida después de cargas y escrituras del núcleo.
- Mantener snapshots de compatibilidad para pantallas antiguas.
- Avisar a las pantallas abiertas y evitar refrescos consecutivos.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.2.0-core-write-flow";
  var HUB = window.BDLocalConexiones;
  var U = window.BDLocalConUtils;
  var LEGACY_KEYS = ["REQ_BDLOCAL_LEGACY_SNAPSHOT_V1","REQ_EXCEL_LOCAL_V1:snapshot"];
  var EVENT_NAMES = [
    "bdlocal:legacy-ready",
    "bdlocal:legacy-snapshot",
    "requisitos:bl:snapshot-changed",
    "requisitos:bdlocal-cambio-disponible",
    "bdlocal:screen-data-updated"
  ];
  var lastRefreshAt = 0;
  var coreWriteTimer = null;

  if(!HUB || !U){ return; }

  function core(){ return window.BL2Core || null; }
  function ready(){ return HUB.ensureCoreReady(); }

  function compatibilityPayload(cache,options){
    cache = cache || U.readCache();
    options = options || {};
    return {
      meta:Object.assign({},cache.meta || {},{
        source:options.source || "cone.carga",
        screenFlowVersion:VERSION,
        updatedAt:U.nowISO()
      }),
      periods:Array.isArray(cache.periods) ? cache.periods : [],
      periodList:Array.isArray(cache.periods) ? cache.periods : [],
      students:Array.isArray(cache.students) ? cache.students : [],
      rows:Array.isArray(cache.students) ? cache.students : [],
      requirements:Array.isArray(cache.requirements) ? cache.requirements : [],
      diagnostics:Array.isArray(cache.diagnostics) ? cache.diagnostics : []
    };
  }

  function dispatchTo(target,name,detail){
    try{
      if(target && typeof target.dispatchEvent === "function"){
        var EventCtor = target.CustomEvent || window.CustomEvent;
        target.dispatchEvent(new EventCtor(name,{ detail:detail || {} }));
      }
    }catch(error){}
  }

  function broadcast(name,detail){
    dispatchTo(window,name,detail);
    try{
      if(window.parent && window.parent !== window){
        dispatchTo(window.parent,name,detail);
        var frames = window.parent.document && window.parent.document.querySelectorAll
          ? window.parent.document.querySelectorAll("iframe")
          : [];
        Array.prototype.forEach.call(frames || [],function(frame){ dispatchTo(frame.contentWindow,name,detail); });
      }
    }catch(error){}
    try{
      if(window.top && window.top !== window && window.top !== window.parent){ dispatchTo(window.top,name,detail); }
    }catch(error2){}
  }

  function notifyScreens(cache,options){
    cache = cache || U.readCache();
    options = options || {};
    var legacy = compatibilityPayload(cache,options);
    var raw = "";
    try{ raw = JSON.stringify(legacy); }catch(error){ raw = ""; }
    if(raw){
      LEGACY_KEYS.forEach(function(key){
        try{ window.localStorage.setItem(key,raw); }catch(error){}
      });
    }

    var detail = {
      ok:true,
      source:options.source || "cone.carga",
      periodoId:U.canonicalPeriodId(options.periodoId || ""),
      refreshMode:cache.meta && cache.meta.refreshMode || options.mode || "full",
      periods:legacy.periods.length,
      students:legacy.students.length,
      requirements:legacy.requirements.length,
      updatedAt:legacy.meta.updatedAt
    };
    EVENT_NAMES.forEach(function(name){ broadcast(name,detail); });
    return cache;
  }

  function installRefreshGuard(){
    if(HUB.__screenFlowRefreshInstalled || typeof HUB.refreshCache !== "function"){ return; }
    var original = HUB.refreshCache.bind(HUB);
    HUB.refreshCache = function(options){
      options = Object.assign({},options || {});
      var explicitMode = options.full === true || options.light === true || options.periodsOnly === true || !!options.mode;
      if(!explicitMode){ options.full = true; }
      if(options.periodoId && options.light !== true && options.mode !== "light"){ options.full = true; }
      return original(options).then(function(cache){
        lastRefreshAt = Date.now();
        return notifyScreens(cache || U.readCache(),options);
      });
    };
    HUB.__screenFlowRefreshInstalled = true;
    HUB.__screenFlowRefreshVersion = VERSION;
  }

  installRefreshGuard();

  function safeRefreshCache(options){
    options = Object.assign({ source:"cone.carga" },options || {});
    if(!HUB || typeof HUB.refreshCache !== "function"){ return Promise.resolve(null); }
    return HUB.refreshCache(options).catch(function(error){
      U.emit("bdlocal:con-carga-cache-warning",{
        ok:false,
        message:error && error.message ? error.message : String(error),
        source:options.source || "cone.carga"
      });
      return null;
    });
  }

  function scheduleCoreWriteRefresh(event){
    if(Date.now() - lastRefreshAt < 700){ return; }
    if(coreWriteTimer){ window.clearTimeout(coreWriteTimer); }
    coreWriteTimer = window.setTimeout(function(){
      coreWriteTimer = null;
      if(Date.now() - lastRefreshAt < 700){ return; }
      var detail = event && event.detail || {};
      safeRefreshCache({
        source:"cone.carga.core-write",
        periodoId:detail.periodoId || "",
        full:true,
        immediate:true
      });
    },420);
  }

  window.addEventListener("bl2:students-saved",scheduleCoreWriteRefresh);
  window.addEventListener("bl2:student-updated",scheduleCoreWriteRefresh);

  function getPeriods(){
    return ready().then(function(){
      if(core() && typeof core().getPeriods === "function"){ return core().getPeriods(); }
      return U.readCache().periods;
    });
  }

  function savePeriod(period){
    period = U.normalizePeriod(period);
    if(!period){ return Promise.reject(new Error("Período inválido.")); }
    return ready().then(function(){
      if(core() && typeof core().savePeriod === "function"){
        return core().savePeriod(period).then(function(saved){
          return safeRefreshCache({ source:"cone.carga.savePeriod",light:true,immediate:true }).then(function(){ return saved || period; });
        });
      }
      return period;
    });
  }

  function setActivePeriod(periodoId,periodoLabel){
    periodoId = U.canonicalPeriodId(periodoId);
    periodoLabel = U.text(periodoLabel || periodoId);
    if(!periodoId){ return Promise.reject(new Error("Seleccione un período válido.")); }
    try{ window.localStorage.setItem("carga.periodoSeleccionado",periodoId); }catch(error){}
    try{ window.localStorage.setItem("carga.periodoSeleccionadoLabel",periodoLabel); }catch(error2){}
    return ready().then(function(){
      if(core() && typeof core().setActivePeriod === "function"){ return core().setActivePeriod(periodoId,periodoLabel); }
      return {
        id:periodoId,label:periodoLabel,periodoId:periodoId,periodoLabel:periodoLabel,
        periodoCanonicoId:periodoId,periodoCanonicoLabel:periodoLabel
      };
    });
  }

  function normalizeOptions(options){
    options = Object.assign({},options || {});
    options.periodoId = U.canonicalPeriodId(options.periodoCanonicoId || options.periodoId || options.id || "");
    options.periodoLabel = U.text(options.periodoCanonicoLabel || options.periodoLabel || options.label || options.periodoId);
    options.periodoCanonicoId = options.periodoId;
    options.periodoCanonicoLabel = options.periodoLabel;
    options.normalized = options.normalized !== false;
    options.source = options.source || "carga_excel";
    options.sync = false;
    options.localOnly = true;
    options.cloudSync = false;
    options.manualCloudSync = true;
    return options;
  }

  function saveStudents(rows,options){
    rows = Array.isArray(rows) ? rows : [];
    options = normalizeOptions(options || {});
    if(!options.periodoId){ return Promise.reject(new Error("No hay período seleccionado para guardar.")); }
    return ready().then(function(){
      if(!core() || typeof core().saveStudents !== "function"){ throw new Error("BL2Core.saveStudents no está disponible para Carga."); }
      U.emit("bdlocal:con-carga-saving",{ ok:true,periodoId:options.periodoId,total:rows.length,source:options.source });
      return core().saveStudents(rows,options).then(function(result){
        return safeRefreshCache({ source:"cone.carga.saveStudents",periodoId:options.periodoId,full:true,immediate:true }).then(function(){
          U.emit("bdlocal:con-carga-saved",{
            ok:result && result.ok !== false,
            periodoId:options.periodoId,
            periodoLabel:options.periodoLabel,
            total:rows.length,
            saved:result && typeof result.total === "number" ? result.total : rows.length,
            source:options.source
          });
          return result;
        });
      });
    });
  }

  function guardarEstudiantes(rows,periodoInfo,options){
    return saveStudents(rows,Object.assign({},options || {},periodoInfo || {}));
  }

  function getSummary(periodoId){
    periodoId = U.canonicalPeriodId(periodoId || "");
    return ready().then(function(){
      if(core() && typeof core().getSummary === "function"){ return core().getSummary(periodoId); }
      return { periodoId:periodoId,totalEstudiantes:0 };
    });
  }

  var api = {
    version:VERSION,
    source:"BDLocal/conexiones/cone.carga.js",
    ready:ready,
    refresh:function(options){ return safeRefreshCache(Object.assign({ source:"cone.carga.refresh",full:true,immediate:true },options || {})); },
    notifyScreens:notifyScreens,
    getPeriods:getPeriods,
    listarPeriodos:getPeriods,
    savePeriod:savePeriod,
    guardarPeriodo:savePeriod,
    setActivePeriod:setActivePeriod,
    saveStudents:saveStudents,
    guardarEstudiantes:guardarEstudiantes,
    getSummary:getSummary,
    resumen:getSummary
  };

  HUB.register("carga",api);
  window.BDLocalCarga = api;
  window.ConCarga = api;
  if(!window.BDLRepoEstudiantes){
    window.BDLRepoEstudiantes = { guardarMuchos:function(rows,periodoInfo,options){ return guardarEstudiantes(rows,periodoInfo,options); } };
  }

  safeRefreshCache({ source:"cone.carga.bootstrap",full:true,immediate:true });
})(window);
