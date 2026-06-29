/* =========================================================
Nombre completo: bl2-api.js
Ruta o ubicación: /Requisitos/BaseLocal2/bl2-api.js
Función o funciones:
- Exponer una API única BL2 para Requisitos.
- Usar BL2Storage/IndexedDB como motor principal asíncrono.
- Mantener métodos síncronos solo como compatibilidad liviana.
- Evitar que BL2DataEngine reconstruya índices completos para consultas normales.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "2.0.2-storage-primary-safe";
  var bootedAt = new Date().toISOString();
  var state = {ready:false, mode:"initializing", storage:"indexeddb", runtime:null, lastError:"", adapterName:"storage", coreReady:false};
  var CORE_SCRIPTS = ["core/bl2-student-normalizer.js","core/bl2-requirements-engine.js","core/bl2-memory-index.js","core/bl2-data-engine.js","core/bl2-screen-adapter.js"];

  function now(){return new Date().toISOString();}
  function isPromise(value){return !!(value && typeof value.then === "function");}
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
  function estudiantesRepo(){return window.BL2EstudiantesRepo || null;}
  function periodosRepo(){return window.BL2PeriodosRepo || null;}
  function dataEngine(){return window.BL2DataEngine || null;}
  function screenAdapter(){return window.BL2ScreenAdapter || null;}
  function migrator(){return window.BL2Migrator || null;}
  function migrationReport(){return window.BL2MigrationReport || null;}

  ensureCoreScripts();

  function resolveAdapter(){
    var rt = runtime() && typeof runtime().detect === "function" ? runtime().detect(true) : {preferredStorage:"indexeddb"};
    state.runtime = rt;
    if(storage()){state.mode = storage().chooseMode ? storage().chooseMode() : "storage";state.storage = state.mode;state.adapterName = "BL2Storage";return storage();}
    if(legacy()){state.mode = "legacy_bridge";state.storage = "legacy";state.adapterName = "BL2LegacyAdapter";return legacy();}
    state.mode = "unavailable";state.adapterName = "none";return null;
  }

  function adapter(){var ad = resolveAdapter();if(!ad){throw new Error("BL2 no tiene adaptador disponible.");}return ad;}
  function lightStatus(extra){var data = Object.assign({ok:!state.lastError,version:VERSION,ready:state.ready,coreReady:!!dataEngine(),mode:state.mode,storage:state.storage,adapter:state.adapterName,bootedAt:bootedAt,runtime:state.runtime,lastError:state.lastError,lightweight:true,updatedAt:now()}, extra || {});if(config() && typeof config().saveStatus === "function"){config().saveStatus(data);}return data;}

  function listPeriodsSync(){
    if(periodosRepo() && typeof periodosRepo().listar === "function"){return periodosRepo().listar() || [];}
    if(legacy() && typeof legacy().listPeriods === "function"){return legacy().listPeriods() || [];}
    return [];
  }

  function listStudentsSync(options){
    options = options || {};
    if(estudiantesRepo() && typeof estudiantesRepo().listarPagina === "function"){return estudiantesRepo().listarPagina(options) || {rows:[], total:0};}
    if(legacy() && typeof legacy().listStudents === "function"){return legacy().listStudents(options) || {rows:[], total:0};}
    return {rows:[], total:0, source:"sync_unavailable"};
  }

  function getStudentByIdSync(cedula, options){
    if(estudiantesRepo() && typeof estudiantesRepo().obtenerPorCedula === "function"){return estudiantesRepo().obtenerPorCedula(cedula, options || {});}
    if(legacy() && typeof legacy().getStudentById === "function"){return legacy().getStudentById(cedula, options || {});}
    return null;
  }

  function statsResumen(options){options = options || {};if(screenAdapter() && typeof screenAdapter().forStats === "function"){return screenAdapter().forStats(options);}if(options.deep === true && dataEngine() && typeof dataEngine().statsSummary === "function"){return dataEngine().statsSummary(options);}return legacy() && legacy().resumen ? legacy().resumen(options) : {total:0, activos:0, retirados:0, carreras:{}, periodos:{}};}

  function listPeriodsAsync(options){
    options = options || {};
    if(periodosRepo() && typeof periodosRepo().listarAsync === "function"){return periodosRepo().listarAsync(options);}
    if(storage() && typeof storage().listPeriods === "function"){return Promise.resolve(storage().listPeriods(options)).then(function(rows){return Array.isArray(rows) ? rows : [];});}
    return Promise.resolve(listPeriodsSync(options));
  }

  function listStudentsAsync(options){
    options = options || {};
    if(estudiantesRepo() && typeof estudiantesRepo().listarPaginaAsync === "function"){return estudiantesRepo().listarPaginaAsync(options);}
    if(storage() && typeof storage().listStudents === "function"){return Promise.resolve(storage().listStudents(options)).then(function(result){return result || {rows:[], total:0};});}
    return Promise.resolve(listStudentsSync(options));
  }

  function getStudentByIdAsync(cedula, options){
    if(estudiantesRepo() && typeof estudiantesRepo().obtenerPorCedulaAsync === "function"){return estudiantesRepo().obtenerPorCedulaAsync(cedula, options || {});}
    if(storage() && typeof storage().getStudentById === "function"){return Promise.resolve(storage().getStudentById(cedula, options || {}));}
    return Promise.resolve(getStudentByIdSync(cedula, options || {}));
  }

  function status(options){
    options = options || {};resolveAdapter();
    if(options.deep !== true && options.force !== true){return lightStatus();}
    var storageStatus = safe("storage.status", function(){return storage() && typeof storage().status === "function" ? storage().status({deep:options.deep === true}) : {ok:false, mode:"sin_storage"};}, {ok:false, mode:"sin_storage"});
    var repoStudentsStatus = safe("repo.estudiantes.status", function(){return estudiantesRepo() && typeof estudiantesRepo().status === "function" ? estudiantesRepo().status() : {ok:false, mode:"sin_repo_estudiantes"};}, {ok:false, mode:"sin_repo_estudiantes"});
    var repoPeriodsStatus = safe("repo.periodos.status", function(){return periodosRepo() && typeof periodosRepo().status === "function" ? periodosRepo().status() : {ok:false, mode:"sin_repo_periodos"};}, {ok:false, mode:"sin_repo_periodos"});
    var engineStatus = safe("engine.status", function(){return options.deepEngine === true && dataEngine() && typeof dataEngine().status === "function" ? dataEngine().status({force:false}) : {ok:true, mode:"engine_no_consultado"};}, {ok:false, mode:"sin_motor_central"});
    var screenStatus = safe("screen.status", function(){return screenAdapter() && typeof screenAdapter().status === "function" ? screenAdapter().status() : {ok:false, mode:"sin_screen_adapter"};}, {ok:false, mode:"sin_screen_adapter"});
    var migrationStatus = safe("migration.status", function(){return migrator() && typeof migrator().status === "function" ? migrator().status() : {ok:true, mode:"sin_migrador"};}, {ok:false, mode:"sin_migrador"});
    var data = {ok:storageStatus.ok !== false && !state.lastError,version:VERSION,ready:state.ready,coreReady:!!dataEngine(),mode:state.mode,storage:state.storage,adapter:state.adapterName,bootedAt:bootedAt,runtime:state.runtime,lastError:state.lastError,storageStatus:storageStatus,repoStudentsStatus:repoStudentsStatus,repoPeriodsStatus:repoPeriodsStatus,engineStatus:engineStatus,screenStatus:screenStatus,migrationStatus:migrationStatus,lightweight:false,updatedAt:now()};
    if(config() && typeof config().saveStatus === "function"){config().saveStatus(data);}return data;
  }

  function invalidate(options){options = options || {};safe("repo.estudiantes.invalidate", function(){if(estudiantesRepo() && estudiantesRepo().invalidate){estudiantesRepo().invalidate();}}, null);safe("repo.periodos.invalidate", function(){if(periodosRepo() && periodosRepo().invalidate){periodosRepo().invalidate();}}, null);safe("engine.invalidate", function(){if(dataEngine() && dataEngine().invalidate){dataEngine().invalidate();}}, null);var current = status({deep:false});if(options.emit === true){emit("invalidated", current);}return current;}
  function boot(){try{resolveAdapter();state.ready = true;state.lastError = "";var current = lightStatus({boot:true});if(storage() && typeof storage().initialize === "function"){storage().initialize({force:false});}emit("ready", current);return current;}catch(error){state.ready = false;state.lastError = error && error.message ? error.message : String(error);var failed = lightStatus({boot:true});emit("error", failed);return failed;}}

  window.BL2 = {
    version:VERSION, boot:boot, status:status, invalidate:invalidate,
    runtime:function(){return state.runtime || (runtime() && runtime().detect ? runtime().detect(true) : null);},
    core:{listo:function(){return !!dataEngine();},estado:function(options){return status(Object.assign({}, options || {}, {deep:true}));},motor:function(){return dataEngine();},pantallas:function(){return screenAdapter();},reconstruir:function(){invalidate({emit:false});return dataEngine() && dataEngine().build ? dataEngine().build({force:true}) : null;}},
    periodos:{listar:function(){return safe("periodos.listar", listPeriodsSync, []);},listarAsync:listPeriodsAsync},
    estudiantes:{buscar:function(options){return safe("estudiantes.buscar", function(){return listStudentsSync(Object.assign({}, options || {}, {search:(options && (options.search || options.q)) || ""}));}, {rows:[], total:0});},listarPagina:function(options){return safe("estudiantes.listarPagina", function(){return listStudentsSync(options || {});}, {rows:[], total:0});},listarPaginaAsync:listStudentsAsync,buscarAsync:function(options){return listStudentsAsync(Object.assign({}, options || {}, {search:(options && (options.search || options.q)) || ""}));},obtenerPorCedula:function(cedula, options){return safe("estudiantes.obtenerPorCedula", function(){return getStudentByIdSync(cedula, options || {});}, null);},obtenerPorCedulaAsync:getStudentByIdAsync},
    stats:{resumen:function(options){return safe("stats.resumen", function(){return statsResumen(options || {});}, {total:0, activos:0, retirados:0, carreras:{}, periodos:{}});}},
    storage:{estado:function(){return safe("storage.estado", function(){return storage() && typeof storage().status === "function" ? storage().status() : {ok:false, mode:"sin_storage"};}, {ok:false, mode:"sin_storage"});},inicializar:function(options){return storage() && typeof storage().initialize === "function" ? storage().initialize(options || {}) : Promise.resolve({ok:false, mode:"sin_storage"});},copiarDesdeLegacy:function(options){return storage() && typeof storage().copyFromLegacy === "function" ? storage().copyFromLegacy(options || {}) : Promise.resolve({ok:false, mode:"sin_storage"});}},
    migracion:{estado:function(){return safe("migracion.estado", function(){return migrator() && typeof migrator().status === "function" ? migrator().status() : {ok:false, mode:"sin_migrador"};}, {ok:false, mode:"sin_migrador"});},previsualizar:function(options){return safe("migracion.previsualizar", function(){return migrator() && typeof migrator().preview === "function" ? migrator().preview(options || {}) : {ok:false, errors:[{message:"Migrador no disponible"}]};}, {ok:false, errors:[{message:"Migrador no disponible"}]});},ejecutar:function(options){return migrator() && typeof migrator().run === "function" ? migrator().run(options || {}) : Promise.resolve({ok:false, mode:"sin_migrador"});},reporte:function(){return safe("migracion.reporte", function(){return migrationReport() && typeof migrationReport().read === "function" ? migrationReport().read() : null;}, null);}},
    sync:{estado:function(){return {ok:true, mode:"indexeddb_first", message:"Firebase se maneja por cola incremental y BaseLocalFirebase.", updatedAt:now()};}},
    compat:{snapshot:function(options){return safe("compat.snapshot", function(){return dataEngine() && dataEngine().snapshot ? dataEngine().snapshot(options || {}) : (legacy() && legacy().readSnapshot ? legacy().readSnapshot(options || {}) : null);}, null);},legacyAdapter:function(){return legacy();}}
  };
  boot();
})(window, document);
