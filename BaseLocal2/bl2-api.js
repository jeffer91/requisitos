/* =========================================================
Nombre completo: bl2-api.js
Ruta o ubicación: /Requisitos/BaseLocal2/bl2-api.js
Función o funciones:
- Exponer una API única BL2 para las pantallas de Requisitos.
- Cargar los archivos core de BL2 cuando la página todavía está parseando.
- Usar BL2DataEngine cuando el motor central esté cargado.
- Mantener BL2LegacyAdapter como respaldo para no romper pantallas existentes.
- Entregar consultas rápidas de estudiantes, períodos, resumen y diagnóstico.
- Evitar construir el índice completo solo por consultar estado o arrancar pantalla.
- Invalidar caché sin disparar render reentrante por defecto.
Con qué se conecta:
- bl2-config.js
- bl2-detect-runtime.js
- bl2-legacy-adapter.js
- core/bl2-student-normalizer.js
- core/bl2-requirements-engine.js
- core/bl2-memory-index.js
- core/bl2-data-engine.js
- core/bl2-screen-adapter.js
- db/bl2-storage.js
- migration/bl2-migrate-from-v1.js
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "2.0.0-alpha.4-light-status";
  var bootedAt = new Date().toISOString();
  var state = {ready:false, mode:"initializing", storage:"legacy", runtime:null, lastError:"", adapterName:"legacy", coreReady:false};
  var CORE_SCRIPTS = [
    "core/bl2-student-normalizer.js",
    "core/bl2-requirements-engine.js",
    "core/bl2-memory-index.js",
    "core/bl2-data-engine.js",
    "core/bl2-screen-adapter.js"
  ];

  function now(){return new Date().toISOString();}
  function safe(label, fn, fallback){try{return typeof fn === "function" ? fn() : fallback;}catch(error){state.lastError = error && error.message ? error.message : String(error);console.warn("[BL2 " + label + "]", error);return fallback;}}
  function emit(kind, payload){var detail = Object.assign({kind:kind, at:now(), version:VERSION}, payload || {});try{window.dispatchEvent(new CustomEvent("bl2:" + kind, {detail:detail}));}catch(error){}try{if(window.parent && window.parent !== window){window.parent.postMessage({type:"bl2:" + kind, payload:detail}, "*");}}catch(error){}}

  function currentDir(){try{return new URL(".", document.currentScript ? document.currentScript.src : window.location.href).href;}catch(error){return "";}}
  function hasScript(url){var list = document.getElementsByTagName("script");for(var i=0;i<list.length;i++){if((list[i].src || "").indexOf(url) >= 0){return true;}}return false;}
  function ensureCoreScripts(){
    if(window.BL2DataEngine && window.BL2ScreenAdapter){return;}
    var base = currentDir();
    if(document.readyState === "loading" && document.currentScript){
      CORE_SCRIPTS.forEach(function(rel){var src = base + rel;if(!hasScript(rel)){document.write('<script src="' + src + '"><\\/script>');}});
      return;
    }
    CORE_SCRIPTS.forEach(function(rel){
      var src = base + rel;
      if(hasScript(rel)){return;}
      var s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.dataset.bl2Core = "true";
      document.head.appendChild(s);
    });
  }

  function config(){return window.BL2Config || null;}
  function runtime(){return window.BL2Runtime || null;}
  function legacy(){return window.BL2LegacyAdapter || null;}
  function storage(){return window.BL2Storage || null;}
  function migrator(){return window.BL2Migrator || null;}
  function migrationReport(){return window.BL2MigrationReport || null;}
  function dataEngine(){return window.BL2DataEngine || null;}
  function screenAdapter(){return window.BL2ScreenAdapter || null;}
  function canServeSync(ad){return !!(ad && typeof ad.canServeSync === "function" && ad.canServeSync());}

  ensureCoreScripts();

  function resolveAdapter(){
    var rt = runtime() && typeof runtime().detect === "function" ? runtime().detect(true) : {preferredStorage:"legacy"};
    var preferred = rt.preferredStorage || "legacy";
    state.runtime = rt;
    state.storage = preferred;

    if(dataEngine()){state.mode="core_engine";state.adapterName="BL2DataEngine";state.coreReady=true;return dataEngine();}
    if(preferred === "sqlite" && canServeSync(window.BL2SQLiteAdapter)){state.mode="sqlite";state.adapterName="sqlite";return window.BL2SQLiteAdapter;}
    if(preferred === "indexeddb" && canServeSync(window.BL2IndexedDBAdapter)){state.mode="indexeddb";state.adapterName="indexeddb";return window.BL2IndexedDBAdapter;}
    if(legacy()){state.mode="legacy_bridge";state.adapterName="legacy";return legacy();}
    state.mode="unavailable";state.adapterName="none";
    return null;
  }

  function adapter(){var ad = resolveAdapter();if(!ad){throw new Error("BL2 no tiene adaptador disponible.");}return ad;}
  function lightStatus(extra){
    var data = Object.assign({ok:!state.lastError, version:VERSION, ready:state.ready, coreReady:!!dataEngine(), mode:state.mode, storage:state.storage, adapter:state.adapterName, bootedAt:bootedAt, runtime:state.runtime, lastError:state.lastError, lightweight:true, updatedAt:now()}, extra || {});
    if(config() && typeof config().saveStatus === "function"){config().saveStatus(data);}
    return data;
  }

  function listPeriods(){if(dataEngine() && typeof dataEngine().listPeriods === "function"){return dataEngine().listPeriods();}return adapter().listPeriods ? adapter().listPeriods() : [];}
  function listStudents(options){options = options || {};if(dataEngine() && typeof dataEngine().listStudents === "function"){return dataEngine().listStudents(options);}return adapter().listStudents ? adapter().listStudents(options) : {rows:[], total:0};}
  function searchStudents(query, options){options = Object.assign({}, options || {}, {search:query || (options && (options.search || options.q)) || ""});return listStudents(options);}
  function getStudentById(cedula, options){if(dataEngine() && typeof dataEngine().getStudentById === "function"){return dataEngine().getStudentById(cedula, options || {});}return adapter().getStudentById ? adapter().getStudentById(cedula, options || {}) : null;}
  function statsResumen(options){options = options || {};if(screenAdapter() && typeof screenAdapter().forStats === "function"){return screenAdapter().forStats(options);}if(dataEngine() && typeof dataEngine().statsSummary === "function"){return dataEngine().statsSummary(options);}return adapter().resumen ? adapter().resumen(options) : {total:0, activos:0, retirados:0, carreras:{}, periodos:{}};}

  function status(options){
    options = options || {};
    resolveAdapter();
    if(options.deep !== true && options.force !== true){return lightStatus();}
    var adStatus = safe("adapter.status", function(){return adapter().status ? adapter().status({deep:options.deep === true}) : {ok:true};}, {ok:false, mode:"sin_adapter"});
    var engineStatus = safe("engine.status", function(){return dataEngine() && typeof dataEngine().status === "function" ? dataEngine().status({force:options.force === true}) : {ok:false, mode:"sin_motor_central"};}, {ok:false, mode:"sin_motor_central"});
    var screenStatus = safe("screen.status", function(){return screenAdapter() && typeof screenAdapter().status === "function" ? screenAdapter().status() : {ok:false, mode:"sin_screen_adapter"};}, {ok:false, mode:"sin_screen_adapter"});
    var storageStatus = safe("storage.status", function(){return storage() && typeof storage().status === "function" ? storage().status() : {ok:false, mode:"sin_storage"};}, {ok:false, mode:"sin_storage"});
    var migrationStatus = safe("migration.status", function(){return migrator() && typeof migrator().status === "function" ? migrator().status() : {ok:true, mode:"sin_migrador"};}, {ok:false, mode:"sin_migrador"});
    var data = {ok:adStatus.ok !== false && !state.lastError, version:VERSION, ready:state.ready, coreReady:!!dataEngine(), mode:state.mode, storage:state.storage, adapter:state.adapterName, bootedAt:bootedAt, runtime:state.runtime, lastError:state.lastError, adapterStatus:adStatus, engineStatus:engineStatus, screenStatus:screenStatus, storageStatus:storageStatus, migrationStatus:migrationStatus, lightweight:false, updatedAt:now()};
    if(config() && typeof config().saveStatus === "function"){config().saveStatus(data);}
    return data;
  }

  function invalidate(options){
    options = options || {};
    safe("engine.invalidate", function(){if(dataEngine() && dataEngine().invalidate){dataEngine().invalidate();}}, null);
    safe("adapter.invalidate", function(){var ad=adapter();if(ad && ad !== dataEngine() && ad.invalidate){ad.invalidate();}}, null);
    var current = status({deep:false});
    if(options.emit === true){emit("invalidated", current);}
    return current;
  }

  function boot(){
    try{resolveAdapter();state.ready = true;state.lastError = "";var current = lightStatus({boot:true});emit("ready", current);return current;}
    catch(error){state.ready = false;state.lastError = error && error.message ? error.message : String(error);var failed = lightStatus({boot:true});emit("error", failed);return failed;}
  }

  var api = {
    version:VERSION, boot:boot, status:status, invalidate:invalidate,
    runtime:function(){return state.runtime || (runtime() && runtime().detect ? runtime().detect(true) : null);},
    core:{listo:function(){return !!dataEngine();},estado:function(options){return status(Object.assign({}, options || {}, {deep:true}));},motor:function(){return dataEngine();},pantallas:function(){return screenAdapter();},reconstruir:function(){invalidate({emit:false});return dataEngine() && dataEngine().build ? dataEngine().build({force:true}) : null;}},
    periodos:{listar:function(){return safe("periodos.listar", listPeriods, []);}},
    estudiantes:{buscar:function(options){return safe("estudiantes.buscar", function(){return searchStudents((options && (options.search || options.q)) || "", options || {});}, {rows:[], total:0});},listarPagina:function(options){return safe("estudiantes.listarPagina", function(){return listStudents(options || {});}, {rows:[], total:0});},obtenerPorCedula:function(cedula, options){return safe("estudiantes.obtenerPorCedula", function(){return getStudentById(cedula, options || {});}, null);}},
    stats:{resumen:function(options){return safe("stats.resumen", function(){return statsResumen(options || {});}, {total:0, activos:0, retirados:0, carreras:{}, periodos:{}});}},
    storage:{estado:function(){return safe("storage.estado", function(){return storage() && typeof storage().status === "function" ? storage().status() : {ok:false, mode:"sin_storage"};}, {ok:false, mode:"sin_storage"});},inicializar:function(options){return storage() && typeof storage().initialize === "function" ? storage().initialize(options || {}) : Promise.resolve({ok:false, mode:"sin_storage"});},copiarDesdeLegacy:function(options){return storage() && typeof storage().copyFromLegacy === "function" ? storage().copyFromLegacy(options || {}) : Promise.resolve({ok:false, mode:"sin_storage"});}},
    migracion:{estado:function(){return safe("migracion.estado", function(){return migrator() && typeof migrator().status === "function" ? migrator().status() : {ok:false, mode:"sin_migrador"};}, {ok:false, mode:"sin_migrador"});},previsualizar:function(options){return safe("migracion.previsualizar", function(){return migrator() && typeof migrator().preview === "function" ? migrator().preview(options || {}) : {ok:false, errors:[{message:"Migrador no disponible"}]};}, {ok:false, errors:[{message:"Migrador no disponible"}]});},ejecutar:function(options){return migrator() && typeof migrator().run === "function" ? migrator().run(options || {}) : Promise.resolve({ok:false, mode:"sin_migrador"});},reporte:function(){return safe("migracion.reporte", function(){return migrationReport() && typeof migrationReport().read === "function" ? migrationReport().read() : null;}, null);}},
    sync:{estado:function(){return {ok:true, mode:"pendiente_bloque_10", message:"Firebase incremental se implementará después de estabilizar Requisitos.", updatedAt:now()};}},
    compat:{snapshot:function(options){return safe("compat.snapshot", function(){return dataEngine() && dataEngine().snapshot ? dataEngine().snapshot(options || {}) : (adapter().readSnapshot ? adapter().readSnapshot(options || {}) : null);}, null);},legacyAdapter:function(){return legacy();}}
  };

  window.BL2 = api;
  boot();
})(window, document);
