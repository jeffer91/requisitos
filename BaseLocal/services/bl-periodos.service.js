/* =========================================================
Nombre completo: bl-periodos.service.js
Ruta o ubicación: /Requisitos/BaseLocal/services/bl-periodos.service.js
Función o funciones:
- Leer la colección periodos desde Firestore.
- Normalizar períodos sin inventar períodos desde cédulas.
- Unir duplicados por nombre, ID técnico o rango de meses.
- Mantener campos originales como id, label y creadoEn.
Con qué se conecta:
- bl-normalizador.js
- bl-periodos-canon.service.js
- baselocal.firebase.js
========================================================= */
(function(window){
  "use strict";

  var COLLECTION = "periodos";

  function normalizador(){if(!window.BLNormalizador){throw new Error("BLNormalizador no disponible.");}return window.BLNormalizador;}
  function text(value){return window.BLCampos ? window.BLCampos.text(value) : String(value == null ? "" : value).trim();}

  function safeDate(value){
    try{
      if(value && typeof value.toDate === "function"){return value.toDate().toISOString();}
      if(value instanceof Date){return value.toISOString();}
    }catch(error){return text(value);}
    return value;
  }

  function cleanValue(value){
    var dated = safeDate(value);
    if(dated !== value){return dated;}
    if(Array.isArray(value)){return value.map(cleanValue);}
    if(value && typeof value === "object"){
      var out = {};
      Object.keys(value).forEach(function(key){out[key] = cleanValue(value[key]);});
      return out;
    }
    return value;
  }

  function normalizePeriod(period){
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.normalizePeriod === "function"){
      return window.BLPeriodosCanon.normalizePeriod(period);
    }
    return normalizador().normalizePeriod(period);
  }

  function docToPeriod(doc){
    var data = cleanValue(typeof doc.data === "function" ? doc.data() : {});
    var raw = Object.assign({}, data || {}, {_firebaseId:text(doc.id || data.id), _firebaseCollection:COLLECTION});
    if(!raw.id){raw.id = text(doc.id || raw.periodoId || raw.value || raw.label);}
    if(!raw.label){raw.label = text(raw.periodoLabel || raw.id);}
    return normalizePeriod(raw);
  }

  async function read(db){
    if(!db || typeof db.collection !== "function"){throw new Error("Firestore no disponible para leer periodos.");}
    var snap = await db.collection(COLLECTION).get();
    var rows = [];
    if(snap && typeof snap.forEach === "function"){
      snap.forEach(function(doc){rows.push(docToPeriod(doc));});
    }else if(snap && Array.isArray(snap.docs)){
      rows = snap.docs.map(docToPeriod);
    }
    return dedupe(rows);
  }

  function dedupe(periods){
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.dedupe === "function"){
      return window.BLPeriodosCanon.dedupe(periods || []);
    }
    var map = {};
    var result = [];
    (periods || []).forEach(function(period){
      var normalized = normalizePeriod(period);
      var id = text(normalized.id || normalized.periodoId);
      if(!id || map[id]){return;}
      map[id] = true;
      result.push(normalized);
    });
    return result;
  }

  function canonicalizeSnapshot(snapshot){
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.canonicalizeSnapshot === "function"){
      return window.BLPeriodosCanon.canonicalizeSnapshot(snapshot);
    }
    var snap = snapshot || {};
    snap.periods = dedupe(snap.periods || []);
    return snap;
  }

  window.BLPeriodosService = {
    collection:COLLECTION,
    read:read,
    dedupe:dedupe,
    normalizePeriod:normalizePeriod,
    canonicalizeSnapshot:canonicalizeSnapshot
  };
})(window);
