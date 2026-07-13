/* =========================================================
Nombre completo: cr-def.cache.js
Ruta o ubicación: /Requisitos/Cr-def/cr-def.cache.js
Función o funciones:
- Manejar cache propia de Cr-def en almacenamiento local del navegador.
- Guardar estudiantes aptos por período.
- Guardar firma de BDLocal para detectar cambios.
- Permitir carga rápida antes de consultar nuevamente BDLocal.
Con qué se conecta:
- cr-def.config.js
- cr-def.data.js
- cr-def.js
Nota:
- En modo web no se puede escribir físicamente dentro de la carpeta Cr-def.
- Por eso la cache queda aislada con claves propias de Cr-def en localStorage.
========================================================= */
(function(window){
  "use strict";

  var config = window.CR_DEF_CONFIG || {};
  var keys = config.storageKeys || {};
  var CACHE_KEY = keys.cache || "cr_def_cache_v1";
  var FIRMA_KEY = keys.firmaBDLocal || "cr_def_firma_bdl_v1";
  var LAST_PERIOD_KEY = keys.ultimoPeriodo || "cr_def_ultimo_periodo_v1";

  function text(value){
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function nowISO(){
    return new Date().toISOString();
  }

  function clone(value){
    if(value === undefined){ return undefined; }
    try{ return JSON.parse(JSON.stringify(value)); }
    catch(error){ return value; }
  }

  function storageAvailable(){
    try{
      var testKey = "__cr_def_test__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return true;
    }catch(error){
      return false;
    }
  }

  function readJSON(key, fallback){
    if(!storageAvailable()){ return clone(fallback); }
    try{
      var raw = window.localStorage.getItem(key);
      if(!raw){ return clone(fallback); }
      return JSON.parse(raw);
    }catch(error){
      return clone(fallback);
    }
  }

  function writeJSON(key, value){
    if(!storageAvailable()){ return false; }
    try{
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    }catch(error){
      return false;
    }
  }

  function readCacheRoot(){
    return readJSON(CACHE_KEY, { version: 1, periodos: {} });
  }

  function writeCacheRoot(root){
    root = root || {};
    root.version = root.version || 1;
    root.updatedAt = nowISO();
    root.periodos = root.periodos || {};
    return writeJSON(CACHE_KEY, root);
  }

  function getPeriodCache(periodoId){
    periodoId = text(periodoId);
    if(!periodoId){ return null; }
    var root = readCacheRoot();
    var item = root.periodos && root.periodos[periodoId] ? root.periodos[periodoId] : null;
    return item ? clone(item) : null;
  }

  function savePeriodCache(periodoId, payload){
    periodoId = text(periodoId);
    if(!periodoId){ return false; }

    var root = readCacheRoot();
    root.periodos = root.periodos || {};
    root.periodos[periodoId] = Object.assign({}, clone(payload || {}), {
      periodoId: periodoId,
      savedAt: nowISO()
    });

    setLastPeriod(periodoId);
    return writeCacheRoot(root);
  }

  function clearPeriodCache(periodoId){
    periodoId = text(periodoId);
    if(!periodoId){ return false; }

    var root = readCacheRoot();
    root.periodos = root.periodos || {};
    delete root.periodos[periodoId];
    return writeCacheRoot(root);
  }

  function getFirma(periodoId){
    periodoId = text(periodoId);
    if(!periodoId){ return null; }
    var root = readJSON(FIRMA_KEY, {});
    return root[periodoId] || null;
  }

  function saveFirma(periodoId, firma){
    periodoId = text(periodoId);
    if(!periodoId){ return false; }
    var root = readJSON(FIRMA_KEY, {});
    root[periodoId] = Object.assign({}, clone(firma || {}), {
      periodoId: periodoId,
      savedAt: nowISO()
    });
    return writeJSON(FIRMA_KEY, root);
  }

  function setLastPeriod(periodoId){
    periodoId = text(periodoId);
    if(!periodoId || !storageAvailable()){ return false; }
    try{
      window.localStorage.setItem(LAST_PERIOD_KEY, periodoId);
      return true;
    }catch(error){
      return false;
    }
  }

  function getLastPeriod(){
    if(!storageAvailable()){ return ""; }
    try{ return text(window.localStorage.getItem(LAST_PERIOD_KEY)); }
    catch(error){ return ""; }
  }

  function status(periodoId, currentFirma){
    var cache = getPeriodCache(periodoId);
    var savedFirma = cache && cache.firma ? cache.firma : getFirma(periodoId);
    var hasCache = !!(cache && Array.isArray(cache.rows));
    var stale = false;

    if(currentFirma && savedFirma){
      stale = text(currentFirma.hash) !== text(savedFirma.hash);
    }

    return {
      available: storageAvailable(),
      hasCache: hasCache,
      stale: stale,
      savedAt: cache ? cache.savedAt : "",
      totalRows: cache && Array.isArray(cache.rows) ? cache.rows.length : 0,
      firma: savedFirma || null
    };
  }

  window.CR_DEF_CACHE = Object.freeze({
    isAvailable: storageAvailable,
    getPeriodCache: getPeriodCache,
    savePeriodCache: savePeriodCache,
    clearPeriodCache: clearPeriodCache,
    getFirma: getFirma,
    saveFirma: saveFirma,
    getLastPeriod: getLastPeriod,
    setLastPeriod: setLastPeriod,
    status: status
  });
})(window);
