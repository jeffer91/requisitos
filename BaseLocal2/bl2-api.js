/* =========================================================
Nombre completo: bl2-api.js
Ruta o ubicación: /Requisitos/BaseLocal2/bl2-api.js
Función o funciones:
- Exponer una API única BL2 para Requisitos.
- Usar BL2Storage/IndexedDB como motor principal.
- Mantener legacy solo como respaldo de compatibilidad.
- Evitar BL2DataEngine para consultas normales de Base Local porque reconstruye índices completos.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "2.0.1-storage-primary";
  var bootedAt = new Date().toISOString();
  var state = {ready:false, mode:"initializing", storage:"indexeddb", runtime:null, lastError:"", adapterName:"storage", coreReady:false};
  var CORE_SCRIPTS = ["core/bl2-student-normalizer.js","core/bl2-requirements-engine.js","core/bl2-memory-index.js","core/bl2-data-engine.js","core/bl2-screen-adapter.js"];

  function now(){return new Date().toISOString();}
  function safe(label, fn, fallback){try{return typeof fn === "function" ? fn() : fallback;}catch(error){state.lastError = error && error.message ? error.message : String(error);console.warn("[BL2 " + label + "]", error);return fallback;}}
  function emit(kind, payload){var detail = Object.assign({kind:kind, at:now(), version:VERSION}, payload || {});try{window.dispatchEvent(new CustomEvent("bl2:" + kind, {detail:detail}));}catch(error){}try{if(window.parent && window.parent !== window){window.parent.postMessage({type:"bl2:" + kind, payload:detail}, "*");}}catch(error){}}
  function currentDir(){try{return new URL(".", document.currentScript ? document.currentScript.src : window.location.href).href;}catch(error){return "";}}
  function hasScript(url){var list = document.getElementsByTagName("script");for(var i=0;i<list.length;i++){if((list[i].src || "").indexOf(url) >= 0){return true;}}return false;}

  function ensureCoreScripts(){
    if(window.BL2DataEngine && window.BL2ScreenAdapter){return;}
    var base = currentDir();
    if(document.readyState === "loading" && document.currentScript){CORE_SCRIPTS.forEach(function(rel){var src = base + rel;if(!hasScript(rel)){document.write('<script src="' + src + '"><\/script>');}});return;}
    CORE_SCRIPTS.forEach(function(rel){var src = base + rel;if(hasScript(rel)){return;}var s = document.createElement("script");s.src = src;s.async = false;s.dataset.bl2Core = "true";document.head.appendChild(s);});
  }

  function config(){return window.BL2Config || null;}
  function runtime(){return window.BL2Runtime || null;}
  function legacy(){return window.BL2LegacyAdapter || null;}
  function storage(){return window.BL2Storage || null;}
  function dataEngine(){return window.BL2DataEngine || null;}
  function screenAdapter(){return window.BL2ScreenAdapter || null;}
  function migrator(){return window.BL2Migrator || null;}
  function migrationReport(){return window.BL2MigrationReport || null;}

  ensureCoreScripts();

  function resolveAdapter(){
    var rt = runtime() && typeof runtime().detect === "function" ? runtime().detect(true) : {preferredStorage:"indexeddb"};
    state.runtime = rt;
    if(storage()){state.mode = storage().chooseMode ? storage().chooseMode() : "storage";state.storage = state.mode;state.adapterName = "BL2Storage";return storage();}
    if(legacy()){state.mode="legacy_bridge";state.storage="legacy";state.adapterName="BL2LegacyAdapter";return legacy();}
    state.mode="unavailable";state.adapterName="none";return null;
  }
  function adapter(){var ad = resolveAdapter();if(!ad){throw new Error("BL2 no tiene adaptador disponible.");}return ad;}
  function lightStatus(extra){var data = Object.assign({ok:!state.lastError, version:VERSION, ready:state.ready, coreReady:!!dataEngine(), mode:state.mode, storage:state.storage, adapter:state.adapterName, bootedAt:bootedAt, runtime:state.runtime, lastError:state.lastError, lightweight:true, updatedAt:now()}, extra || {});if(config() && typeof config().saveStatus === "function"){config().saveStatus(data);}return data;}

  function listPeriods(){var ad = adapter();if(ad.listPeriods){return ad.listPeriods({}).catch ? [] : ad.listPeriods({});}return [];}
  function listStudents(options){options = options || {};var ad = adapter();if(ad.listStudents && !ad.listStudents({}).catch){return ad.listStudents(options);}if(legacy() && legacy().listStudents){return legacy().listStudents(options);}return {rows:[], total:0};}
  function searchStudents(query, options){options = Object.assign({}, options || {}, {search:query || (options && (options.search || options.q)) || ""});return listStudents(options);}
  function getStudentById(cedula, options){if(legacy() && legacy().getStudentById){return legacy().getStudentById(cedula, options || {});}return null;}
  function statsResumen(options){options = options || {};if(screenAdapter() && typeof screenAdapter().forStats === "function"){return screenAdapter().forStats(options);}if(dataEngine() && typeof dataEngine().statsSummary === "function"){return dataEngine().statsSummary(options);}return legacy() && legacy().resumen ? legacy().resumen(options) : {total:0, activos:0, retirados:0, carreras:{}, periodos:{}};}

  function listPeriodsAsync(options){var ad = adapter();if(ad.listPeriods){return Promise.resolve(ad.listPeriods(options || {}));}return Promise.resolve([]);}
  function listStudentsAsync(options){var ad = adapter();if(ad.listStudents){return Promise.resolve(ad.listStudents(options || {}));}return Promise.resolve({rows:[], total:0});}
  function getStudentByIdAsync(cedula, options){var ad = adapter();if(ad.getStudentById){return Promise.resolve(ad.getStudentById(cedula, options || {}));}return Promise.resolve(getStudentById(cedula, options || {}));}

  function status(options){
    options = options || {};resolveAdapter();
    if(options.deep !== true && options.force !== true){return lightStatus();}
    var storageStatus = safe("storage.status", function(){return storage() && typeof storage().status === "function" ? storage().status({deep:options.deep === true}) : {ok:false, mode:"sin_storage"};}, {ok:false, mode:"sin_storage"});
    var engineStatus = safe("engine.status", function(){return dataEngine() && typeof dataEngine().status === "function" ? dataEngine().status({force:false}) : {ok:false, mode:"sin_motor_central"};}, {ok:false, mode:"sin_motor_central"});
    var screenStatus = safe("screen.status", function(){return screenAdapter() && typeof screenAdapter().status === "function" ? screenAdapter().status() : {ok:false, mode:"sin_screen_adapter"};}, {ok:false, mode:"sin_screen_adapter"});
    var migrationStatus = safe("migration.status", function(){return migrator() && typeof migrator().status === "function" ? migrator().status() : {ok:true, mode:"sin_migrador"};}, {ok:false, mode:"sin_migrador"});
    var data = {ok:storageStatus.ok !== false && !state.lastError, version:VERSION, ready:state.ready, coreReady:!!dataEngine(), mode:state.mode, storage:state.storage, adapter:state.adapterName, bootedAt:bootedAt, runtime:state.runtime, lastError:state.lastError, storageStatus:storageStatus, engineStatus:engineStatus, screenStatus:screenStatus, migrationStatus:migrationStatus, lightweight:false, updatedAt:now()};
    if(config() && typeof config().saveStatus === "function"){config().saveStatus(data);}return data;
  }

  function invalidate(options){options = options || {};safe("engine.invalidate", function(){if(dataEngine() && dataEngine().invalidate){dataEngine().invalidate();}}, null);safe("storage.invalidate", function(){var ad=adapter();if(ad && ad.invalidate){ad.invalidate();}}, null);var current = status({deep:false});if(options.emit === true){emit("invalidated", current);}return current;}
  function boot(){try{resolveAdapter();state.ready = true;state.lastError = "";var current = lightStatus({boot:true});if(storage() && typeof storage().initialize === "function"){storage().initialize({force:false});}emit("ready", current);return current;}catch(error){state.ready = false;state.lastError = error && error.message ? error.message : String(error);var failed = lightStatus({boot:true});emit("error", failed);return failed;}}

  window.BL2 = {version:VERSION, boot:boot, status:status, invalidate:invalidate,runtime:function(){return state.runtime || (runtime() && runtime().detect ? runtime().detect(true) : null);},core:{listo:function(){return !!dataEngine();},estado:function(options){return status(Object.assign({}, options || {}, {deep:true}));},motor:function(){return dataEngine();},pantallas:function(){return screenAdapter();},reconstruir:function(){invalidate({emit:false});return dataEngine() && dataEngine().build ? dataEngine().build({force:true}) : null;}},periodos:{listar:function(){return safe("periodos.listar", listPeriods, []);},listarAsync:listPeriodsAsync},estudiantes:{buscar:function(options){return safe("estudiantes.buscar", function(){return searchStudents((options && (options.search || options.q)) || "", options || {});}, {rows:[], total:0});},listarPagina:function(options){return safe("estudiantes.listarPagina", function(){return listStudents(options || {});}, {rows:[], total:0});},listarPaginaAsync:listStudentsAsync,buscarAsync:function(options){return listStudentsAsync(options || {});},obtenerPorCedula:function(cedula, options){return safe("estudiantes.obtenerPorCedula", function(){return getStudentById(cedula, options || {});}, null);},obtenerPorCedulaAsync:getStudentByIdAsync},stats:{resumen:function(options){return safe("stats.resumen", function(){return statsResumen(options || {});}, {total:0, activos:0, retirados:0, carreras:{}, periodos:{}});}},storage:{estado:function(){return safe("storage.estado", function(){return storage() && typeof storage().status === "function" ? storage().status() : {ok:false, mode:"sin_storage"};}, {ok:false, mode:"sin_storage"});},inicializar:function(options){return storage() && typeof storage().initialize === "function" ? storage().initialize(options || {}) : Promise.resolve({ok:false, mode:"sin_storage"});},copiarDesdeLegacy:function(options){return storage() && typeof storage().copyFromLegacy === "function" ? storage().copyFromLegacy(options || {}) : Promise.resolve({ok:false, mode:"sin_storage"});}},migracion:{estado:function(){return safe("migracion.estado", function(){return migrator() && typeof migrator().status === "function" ? migrator().status() : {ok:false, mode:"sin_migrador"};}, {ok:false, mode:"sin_migrador"});},previsualizar:function(options){return safe("migracion.previsualizar", function(){return migrator() && typeof migrator().preview === "function" ? migrator().preview(options || {}) : {ok:false, errors:[{message:"Migrador no disponible"}]};}, {ok:false, errors:[{message:"Migrador no disponible"}]});},ejecutar:function(options){return migrator() && typeof migrator().run === "function" ? migrator().run(options || {}) : Promise.resolve({ok:false, mode:"sin_migrador"});},reporte:function(){return safe("migracion.reporte", function(){return migrationReport() && typeof migrationReport().read === "function" ? migrationReport().read() : null;}, null);}},sync:{estado:function(){return {ok:true, mode:"indexeddb_first", message:"Firebase se maneja por cola incremental y BaseLocalFirebase.", updatedAt:now()};}},compat:{snapshot:function(options){return safe("compat.snapshot", function(){return dataEngine() && dataEngine().snapshot ? dataEngine().snapshot(options || {}) : (legacy() && legacy().readSnapshot ? legacy().readSnapshot(options || {}) : null);}, null);},legacyAdapter:function(){return legacy();}}};
  boot();
})(window, document);
