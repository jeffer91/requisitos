/* =========================================================
Nombre completo: bl2-periodos.repo.js
Ruta o ubicación: /Requisitos/BaseLocal2/repositories/bl2-periodos.repo.js
Función o funciones:
- Entregar períodos visibles desde BL2 sin depender directamente de Firebase.
- Usar BL2DataEngine, BL2Storage o BL2.periodos.listar cuando estén disponibles.
- Mantener fallback seguro hacia Base Local V1.
- Normalizar, deduplicar y cachear períodos para que la pantalla cargue rápido.
Con qué se conecta:
- bl2-api.js
- bl2-storage.js
- bl2-legacy-adapter.js
- BaseLocal/baselocal.app.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-periodos-fast.1";
  var CACHE_MS = 5000;
  var cache = {rows:null, at:0, source:""};

  function parentValue(name){try{return window.parent && window.parent !== window ? window.parent[name] : null;}catch(error){return null;}}
  function api(){return window.BL2 || parentValue("BL2") || null;}
  function engine(){return window.BL2DataEngine || parentValue("BL2DataEngine") || null;}
  function storage(){return window.BL2Storage || parentValue("BL2Storage") || null;}
  function legacy(){return window.BL2LegacyAdapter || parentValue("BL2LegacyAdapter") || null;}
  function schema(){return window.BL2Schema || parentValue("BL2Schema") || null;}

  function text(value){if(schema() && schema().helpers && schema().helpers.text){return schema().helpers.text(value);}return String(value == null ? "" : value).trim();}
  function normalizeText(value){if(schema() && schema().helpers && schema().helpers.searchKey){return schema().helpers.searchKey(value);}return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();}
  function key(value){if(schema() && schema().helpers && schema().helpers.key){return schema().helpers.key(value);}return normalizeText(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");}
  function isCedulaLike(value){return /^\d{7,13}$/.test(text(value));}

  function normalizePeriod(period){
    if(schema() && schema().helpers && schema().helpers.normalizePeriod){return schema().helpers.normalizePeriod(period);}
    var row = Object.assign({}, period || {});
    var label = text(row.label || row.periodoLabel || row.periodo || row.Periodo || row.nombrePeriodo || row.id || "SIN PERIODO");
    row.id = text(row.id || row.periodoId || key(label));
    row.periodoId = text(row.periodoId || row.id);
    row.label = label;
    row.periodoLabel = text(row.periodoLabel || label);
    row.labelKey = key(label);
    row.activo = row.activo === false ? false : true;
    row.updatedAt = text(row.updatedAt || row.actualizadoEn || row.creadoEn || "");
    return row;
  }

  function valid(period){
    var label = text(period && (period.label || period.periodoLabel || period.id));
    if(!label || isCedulaLike(label)){return false;}
    var clean = normalizeText(label);
    if(clean === "sin periodo" || clean === "sin_periodo"){return true;}
    if(/20\d{2}/.test(clean)){return true;}
    if(clean.indexOf("periodo") >= 0 || clean.indexOf("cohorte") >= 0 || clean.indexOf("abril") >= 0 || clean.indexOf("septiembre") >= 0){return true;}
    return false;
  }

  function sortPeriods(a,b){
    var au = Date.parse(a.updatedAt || "") || 0;
    var bu = Date.parse(b.updatedAt || "") || 0;
    if(au !== bu){return bu - au;}
    return text(b.label || b.periodoLabel).localeCompare(text(a.label || a.periodoLabel), "es", {numeric:true});
  }

  function fromEngine(){if(engine() && typeof engine().listPeriods === "function"){return {rows:engine().listPeriods() || [], source:"BL2DataEngine"};}return null;}
  function fromApi(){
    var bl2 = api();
    if(bl2 && bl2.periodos && typeof bl2.periodos.listar === "function"){return {rows:bl2.periodos.listar() || [], source:"BL2.periodos"};}
    if(bl2 && bl2.compat && typeof bl2.compat.snapshot === "function"){
      var snap = bl2.compat.snapshot({clone:false}) || {};
      return {rows:Array.isArray(snap.periods) ? snap.periods : [], source:"BL2.compat.snapshot"};
    }
    return null;
  }
  function fromLegacy(){
    if(legacy() && typeof legacy().listPeriods === "function"){return {rows:legacy().listPeriods() || [], source:"BL2LegacyAdapter.listPeriods"};}
    if(legacy() && typeof legacy().readSnapshot === "function"){
      var snap = legacy().readSnapshot({clone:false}) || {};
      return {rows:Array.isArray(snap.periods) ? snap.periods : [], source:"BL2LegacyAdapter.snapshot"};
    }
    return null;
  }

  function normalizeList(rows){
    var map = Object.create(null);
    return (Array.isArray(rows) ? rows : []).map(normalizePeriod).filter(function(period){
      var uniqueKey = key(period.id || period.periodoId || period.label);
      if(!valid(period) || !uniqueKey || map[uniqueKey]){return false;}
      map[uniqueKey] = true;
      return true;
    }).sort(sortPeriods);
  }

  function listar(options){
    options = options || {};
    if(options.force !== true && cache.rows && Date.now() - cache.at < CACHE_MS){return cache.rows.slice();}
    var source = fromEngine() || fromApi() || fromLegacy() || {rows:[], source:"sin_fuente"};
    var rows = normalizeList(source.rows);
    cache.rows = rows;
    cache.at = Date.now();
    cache.source = source.source;
    return rows.slice();
  }

  function listarAsync(options){
    options = options || {};
    if(storage() && typeof storage().listPeriods === "function"){
      return storage().listPeriods(options).then(function(rows){
        rows = normalizeList(rows || []);
        if(rows.length){cache.rows = rows;cache.at = Date.now();cache.source = "BL2Storage";}
        return rows.slice();
      }).catch(function(){return listar(options);});
    }
    return Promise.resolve(listar(options));
  }

  function obtenerActual(options){var rows = listar(options || {});return rows[0] || null;}
  function obtenerPorId(id, options){var wanted = key(id);if(!wanted){return null;}return listar(options || {}).filter(function(period){return key(period.id) === wanted || key(period.periodoId) === wanted || key(period.label) === wanted;})[0] || null;}
  function invalidate(){cache = {rows:null, at:0, source:""};return true;}
  function status(){var rows = listar();return {ok:true, mode:"bl2_periodos_repo", version:VERSION, total:rows.length, source:cache.source, cacheAgeMs:cache.at ? Date.now() - cache.at : null, updatedAt:new Date().toISOString()};}

  window.BL2PeriodosRepo = {version:VERSION, listar:listar, listarAsync:listarAsync, obtenerActual:obtenerActual, obtenerPorId:obtenerPorId, invalidate:invalidate, normalizePeriod:normalizePeriod, status:status};
})(window);
