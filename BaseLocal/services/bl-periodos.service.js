/* =========================================================
Nombre completo: bl-periodos.service.js
Ruta o ubicación: /Requisitos/BaseLocal/services/bl-periodos.service.js
Función o funciones:
- Leer la colección periodos desde Firestore con caché breve.
- Evitar consultas repetidas de períodos durante renders y sincronizaciones.
- Normalizar períodos sin inventar períodos desde cédulas.
- Reconstruir períodos desde estudiantes cuando Firestore periodos está vacío.
- Unir duplicados por nombre, ID técnico o rango de meses.
Con qué se conecta:
- bl-normalizador.js
- bl-periodos-canon.service.js
- baselocal.firebase.js
- baselocal.core.js
========================================================= */
(function(window){
  "use strict";

  var COLLECTION = "periodos";
  var CACHE_MS = 30000;
  var cache = {key:"", rows:null, at:0};

  function normalizador(){if(!window.BLNormalizador){throw new Error("BLNormalizador no disponible.");}return window.BLNormalizador;}
  function text(value){return window.BLCampos ? window.BLCampos.text(value) : String(value == null ? "" : value).trim();}
  function clone(value){try{return JSON.parse(JSON.stringify(value == null ? null : value));}catch(error){return value;}}
  function now(){return new Date().toISOString();}
  function key(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();}

  function safeDate(value){try{if(value && typeof value.toDate === "function"){return value.toDate().toISOString();}if(value instanceof Date){return value.toISOString();}}catch(error){return text(value);}return value;}
  function cleanValue(value){var dated = safeDate(value);if(dated !== value){return dated;}if(Array.isArray(value)){return value.map(cleanValue);}if(value && typeof value === "object"){var out = {};Object.keys(value).forEach(function(k){out[k] = cleanValue(value[k]);});return out;}return value;}

  function normalizePeriod(period){
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.normalizePeriod === "function"){return window.BLPeriodosCanon.normalizePeriod(period);}
    return normalizador().normalizePeriod(period);
  }

  function docToPeriod(doc){var data = cleanValue(typeof doc.data === "function" ? doc.data() : {});var raw = Object.assign({}, data || {}, {_firebaseId:text(doc.id || data.id), _firebaseCollection:COLLECTION});if(!raw.id){raw.id = text(doc.id || raw.periodoId || raw.value || raw.label);}if(!raw.label){raw.label = text(raw.periodoLabel || raw.id);}return normalizePeriod(raw);}
  function rowsFromSnapshot(snap){var rows = [];if(snap && typeof snap.forEach === "function"){snap.forEach(function(doc){rows.push(docToPeriod(doc));});}else if(snap && Array.isArray(snap.docs)){rows = snap.docs.map(docToPeriod);}return rows;}
  function cacheKey(options){options = options || {};return JSON.stringify({limit:Number(options.limit || 0) || 0, activeOnly:options.activeOnly === true});}
  function fromCache(k){if(cache.rows && cache.key === k && Date.now() - cache.at < CACHE_MS){return clone(cache.rows);}return null;}
  function saveCache(k, rows){cache = {key:k, rows:clone(rows || []), at:Date.now()};return rows;}
  function clearCache(){cache = {key:"", rows:null, at:0};}

  function studentPeriodValue(row){row = row || {};return text(row.periodoId || row.periodoLabel || row.periodo || row.Periodo || row.ultimoPeriodoId || row._bl2PeriodoId || row._bl2Periodo);}
  function studentPeriodLabel(row){row = row || {};return text(row.periodoLabel || row.periodo || row.Periodo || row._bl2Periodo || row.periodoId || row.ultimoPeriodoId);}

  function inferFromStudents(students){
    var map = {}, out = [];
    (Array.isArray(students) ? students : []).forEach(function(row){
      var value = studentPeriodValue(row);
      var label = studentPeriodLabel(row) || value;
      var id = text(row && (row.periodoId || row.ultimoPeriodoId)) || key(label || value);
      if(!value && !label){return;}
      if(/^\d{7,13}$/.test(value)){return;}
      var unique = key(id || label || value);
      if(!unique || map[unique]){return;}
      map[unique] = true;
      out.push(normalizePeriod({id:id || unique, periodoId:id || unique, label:label || value, periodoLabel:label || value, activo:true, source:"inferido_desde_estudiantes", inferred:true, updatedAt:now()}));
    });
    return dedupe(out);
  }

  async function read(db, options){
    options = options || {};
    if(!db || typeof db.collection !== "function"){throw new Error("Firestore no disponible para leer periodos.");}
    var k = cacheKey(options);
    if(options.cache !== false){var cached = fromCache(k);if(cached){return cached;}}
    var query = db.collection(COLLECTION);
    var limit = Math.max(0, Number(options.limit || 0) || 0);
    if(limit && typeof query.limit === "function"){query = query.limit(limit);}
    var rows = rowsFromSnapshot(await query.get());
    rows = dedupe(rows).map(function(period){return Object.assign({updatedAt:now()}, period || {});});
    return saveCache(k, rows);
  }

  function dedupe(periods){
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.dedupe === "function"){return window.BLPeriodosCanon.dedupe(periods || []);}
    var map = {}, result = [];
    (periods || []).forEach(function(period){var normalized = normalizePeriod(period);var id = text(normalized.id || normalized.periodoId || normalized.label || normalized.periodoLabel);if(!id || map[id]){return;}map[id] = true;result.push(normalized);});
    return result;
  }

  function canonicalizeSnapshot(snapshot){
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.canonicalizeSnapshot === "function"){snapshot = window.BLPeriodosCanon.canonicalizeSnapshot(snapshot);}
    var snap = snapshot || {};
    snap.students = Array.isArray(snap.students) ? snap.students : [];
    snap.periods = dedupe(snap.periods || []);
    if(!snap.periods.length && snap.students.length){snap.periods = inferFromStudents(snap.students);}
    snap.meta = Object.assign({}, snap.meta || {}, {totalPeriods:snap.periods.length, periodsInferred:snap.periods.length > 0 && !(snapshot && snapshot.periods && snapshot.periods.length)});
    return snap;
  }

  window.BLPeriodosService = {collection:COLLECTION,read:read,dedupe:dedupe,normalizePeriod:normalizePeriod,inferFromStudents:inferFromStudents,canonicalizeSnapshot:canonicalizeSnapshot,clearCache:clearCache,status:function(){return {ok:true, mode:"periodos_service_cached_infer", cached:!!cache.rows, cachedAt:cache.at, updatedAt:now()};}};
})(window);
