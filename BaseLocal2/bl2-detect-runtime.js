/* =========================================================
Nombre completo: bl2-detect-runtime.js
Ruta o ubicación: /Requisitos/BaseLocal2/bl2-detect-runtime.js
Función o funciones:
- Detectar si Requisitos corre en navegador, Live Server o Electron.
- Elegir el motor local preferido para Base Local 2.0.
- Preparar compatibilidad futura con SQLite en Electron e IndexedDB en navegador.
Con qué se conecta:
- bl2-config.js
- bl2-api.js
========================================================= */
(function(window, document){
  "use strict";

  function safe(fn, fallback){try{return fn();}catch(error){return fallback;}}
  function hasObject(value){return !!(value && typeof value === "object");}

  function detectElectron(){
    return safe(function(){
      if(hasObject(window.process) && hasObject(window.process.versions) && window.process.versions.electron){return true;}
      if(hasObject(window.electronAPI)){return true;}
      if(hasObject(window.require)){return true;}
      if(navigator.userAgent && navigator.userAgent.toLowerCase().indexOf("electron") >= 0){return true;}
      return false;
    }, false);
  }

  function detectSQLiteBridge(){
    return safe(function(){
      if(window.BL2SQLiteBridge && typeof window.BL2SQLiteBridge.query === "function"){return true;}
      if(window.electronAPI && window.electronAPI.sqlite && typeof window.electronAPI.sqlite.query === "function"){return true;}
      if(window.api && window.api.sqlite && typeof window.api.sqlite.query === "function"){return true;}
      return false;
    }, false);
  }

  function detectIndexedDB(){
    return safe(function(){return !!window.indexedDB;}, false);
  }

  function detectLiveServer(){
    return safe(function(){
      var host = window.location && window.location.host ? window.location.host : "";
      return /127\.0\.0\.1|localhost/i.test(host) && !(window.location.protocol === "file:");
    }, false);
  }

  function detectFileMode(){
    return safe(function(){return window.location && window.location.protocol === "file:";}, false);
  }

  function chooseStorage(){
    var cfg = window.BL2Config || null;
    var requested = cfg && typeof cfg.getStorageMode === "function" ? cfg.getStorageMode() : "auto";
    var runtime = snapshot(false);
    if(requested === "sqlite" && runtime.sqliteBridge){return "sqlite";}
    if(requested === "indexeddb" && runtime.indexedDB){return "indexeddb";}
    if(requested === "legacy"){return "legacy";}
    if(runtime.electron && runtime.sqliteBridge){return "sqlite";}
    if(runtime.indexedDB){return "indexeddb";}
    return "legacy";
  }

  function snapshot(includeChoice){
    var runtime = {
      electron:detectElectron(),
      sqliteBridge:detectSQLiteBridge(),
      indexedDB:detectIndexedDB(),
      liveServer:detectLiveServer(),
      fileMode:detectFileMode(),
      protocol:safe(function(){return window.location.protocol;}, ""),
      host:safe(function(){return window.location.host;}, ""),
      userAgent:safe(function(){return navigator.userAgent;}, "")
    };
    runtime.mode = runtime.electron ? "electron" : (runtime.fileMode ? "file" : (runtime.liveServer ? "live_server" : "browser"));
    if(includeChoice !== false){runtime.preferredStorage = chooseStorage();}
    return runtime;
  }

  function saveRuntime(){
    var data = snapshot(true);
    if(window.BL2Config && typeof window.BL2Config.writeJson === "function"){
      window.BL2Config.writeJson(window.BL2Config.keys.runtime, Object.assign({updatedAt:new Date().toISOString()}, data));
    }
    return data;
  }

  window.BL2Runtime = {
    detect:snapshot,
    saveRuntime:saveRuntime,
    chooseStorage:chooseStorage,
    isElectron:detectElectron,
    hasSQLiteBridge:detectSQLiteBridge,
    hasIndexedDB:detectIndexedDB
  };

  saveRuntime();
})(window, document);
