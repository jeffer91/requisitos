/* =========================================================
Nombre completo: bl2-storage.js
Ruta o ubicación: /Requisitos/BaseLocal2/db/bl2-storage.js
Función o funciones:
- Orquestar el motor local BL2: SQLite si existe en Electron, IndexedDB en navegador, legado como respaldo.
- Inicializar el almacenamiento real sin bloquear el arranque de Requisitos.
- Copiar snapshots hacia el motor seleccionado cuando se solicite migración.
- Exponer estado de salud del almacenamiento BL2.
Con qué se conecta:
- bl2-config.js
- bl2-detect-runtime.js
- bl2-schema.js
- bl2-indexeddb-adapter.js
- bl2-sqlite-adapter.js
- bl2-legacy-adapter.js
========================================================= */
(function(window){
  "use strict";

  var state = {started:false, ready:false, mode:"legacy", lastError:"", initializedAt:"", lastCopy:null};

  function now(){return new Date().toISOString();}
  function cfg(){return window.BL2Config || null;}
  function rt(){return window.BL2Runtime || null;}
  function legacy(){return window.BL2LegacyAdapter || null;}
  function indexed(){return window.BL2IndexedDBAdapter || null;}
  function sqlite(){return window.BL2SQLiteAdapter || null;}

  function saveStatus(extra){
    var status = Object.assign({ok:!state.lastError, started:state.started, ready:state.ready, mode:state.mode, lastError:state.lastError, initializedAt:state.initializedAt, lastCopy:state.lastCopy, updatedAt:now()}, extra || {});
    if(cfg() && typeof cfg().writeJson === "function"){cfg().writeJson(cfg().keys.cacheStatus, status);}
    return status;
  }

  function chooseMode(){
    var runtime = rt() && typeof rt().detect === "function" ? rt().detect(true) : {preferredStorage:"legacy"};
    if(runtime.preferredStorage === "sqlite" && sqlite() && sqlite().isAvailable && sqlite().isAvailable()){return "sqlite";}
    if(runtime.preferredStorage === "indexeddb" && indexed() && indexed().isAvailable && indexed().isAvailable()){return "indexeddb";}
    if(sqlite() && sqlite().isAvailable && sqlite().isAvailable()){return "sqlite";}
    if(indexed() && indexed().isAvailable && indexed().isAvailable()){return "indexeddb";}
    return "legacy";
  }

  function adapterForMode(mode){
    if(mode === "sqlite"){return sqlite();}
    if(mode === "indexeddb"){return indexed();}
    return legacy();
  }

  function initialize(options){
    options = options || {};
    if(state.started && options.force !== true){return Promise.resolve(saveStatus({skipped:true}));}
    state.started = true;
    state.mode = chooseMode();
    var adapter = adapterForMode(state.mode);
    if(!adapter){state.lastError = "No hay adaptador BL2 disponible.";return Promise.resolve(saveStatus({ok:false}));}
    var action;
    if(state.mode === "sqlite" && adapter.initialize){action = adapter.initialize();}
    else if(state.mode === "indexeddb" && adapter.open){action = adapter.open().then(function(){return {ok:true, mode:"indexeddb"};});}
    else{action = Promise.resolve({ok:true, mode:"legacy", skipped:true});}
    return action.then(function(result){
      state.ready = !!(result && result.ok);
      state.initializedAt = now();
      state.lastError = result && result.ok === false ? (result.message || result.errorMessage || "Inicialización BL2 incompleta") : "";
      return saveStatus({result:result});
    }).catch(function(error){
      state.ready = false;
      state.lastError = error && error.message ? error.message : String(error);
      return saveStatus({ok:false});
    });
  }

  function copySnapshot(snapshot, options){
    options = options || {};
    state.mode = chooseMode();
    var adapter = adapterForMode(state.mode);
    if(!adapter || typeof adapter.bulkFromSnapshot !== "function"){
      state.lastError = "El adaptador BL2 seleccionado no puede recibir snapshots todavía.";
      return Promise.resolve(saveStatus({ok:false, copySkipped:true}));
    }
    return initialize().then(function(){return adapter.bulkFromSnapshot(snapshot || {});}).then(function(result){
      state.lastCopy = Object.assign({at:now(), mode:state.mode}, result || {});
      state.lastError = result && result.ok === false ? (result.message || result.errorMessage || "Copia BL2 incompleta") : "";
      return saveStatus({lastCopy:state.lastCopy});
    }).catch(function(error){
      state.lastError = error && error.message ? error.message : String(error);
      return saveStatus({ok:false});
    });
  }

  function copyFromLegacy(options){
    options = options || {};
    if(!legacy() || typeof legacy().readSnapshot !== "function"){
      return Promise.resolve(saveStatus({ok:false, message:"Adaptador legado no disponible."}));
    }
    var snapshot = legacy().readSnapshot({clone:false, force:options.force === true});
    return copySnapshot(snapshot, options);
  }

  function status(){
    var mode = chooseMode();
    var adapter = adapterForMode(mode);
    var adapterStatus = adapter && typeof adapter.status === "function" ? adapter.status({deep:false}) : {ok:false, mode:"sin_adapter"};
    return saveStatus({mode:mode, adapterStatus:adapterStatus});
  }

  window.BL2Storage = {
    version:"2.0.0-alpha.1",
    initialize:initialize,
    copySnapshot:copySnapshot,
    copyFromLegacy:copyFromLegacy,
    status:status,
    chooseMode:chooseMode
  };

  if(cfg() && cfg().isEnabled && cfg().isEnabled()){
    setTimeout(function(){initialize();}, 250);
  }
})(window);
