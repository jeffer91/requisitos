/* =========================================================
Nombre completo: bl-limpiar-base.service.js
Ruta o ubicación: /Requisitos/BaseLocal/services/bl-limpiar-base.service.js
Función o funciones:
- Limpiar Firebase primero y luego reconstruir Base Local.
- Fusionar documentos Estudiantes con ID cedula_periodo dentro del documento cedula.
- Eliminar documentos antiguos con ID incorrecto.
- Unir periodos duplicados en la colección periodos.
- Guardar un registro interno de la limpieza.
Con qué se conecta:
- firebase-config.js
- bl-periodos-canon.service.js
- bl-normalizador.js
- bl-divisiones.service.js
- baselocal.firebase.js
- baselocal.connector.js
========================================================= */
(function(window){
  "use strict";

  var LOG_KEY = "REQ_BL_LIMPIEZA_LOG_V1";
  var STUDENTS = "Estudiantes";
  var PERIODS = "periodos";

  function text(value){return String(value == null ? "" : value).trim();}
  function now(){return new Date().toISOString();}
  function clone(value){try{return JSON.parse(JSON.stringify(value == null ? null : value));}catch(error){return value;}}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();}

  function getFirebaseConfigIfAvailable(){try{if(typeof firebaseConfig !== "undefined" && firebaseConfig){return firebaseConfig;}}catch(error){}return null;}

  function ensureFirebase(){
    if(!window.firebase || typeof window.firebase.firestore !== "function"){
      throw new Error("Firebase no está cargado. Revisa internet o firebase-config.js.");
    }
    try{
      if(!window.firebase.apps.length){
        var cfg = getFirebaseConfigIfAvailable();
        if(!cfg){throw new Error("No existe configuración Firebase para inicializar.");}
        window.firebase.initializeApp(cfg);
      }
    }catch(error){
      if(!window.firebase.apps || !window.firebase.apps.length){throw error;}
    }
    if(window.db && typeof window.db.collection === "function"){return window.db;}
    try{if(typeof db !== "undefined" && db && typeof db.collection === "function"){return db;}}catch(error){}
    return window.firebase.firestore();
  }

  function cleanValue(value){
    try{if(value && typeof value.toDate === "function"){return value.toDate().toISOString();}}catch(error){}
    if(Array.isArray(value)){return value.map(cleanValue);}
    if(value && typeof value === "object"){
      var out = {};
      Object.keys(value).forEach(function(key){out[key] = cleanValue(value[key]);});
      return out;
    }
    return value;
  }

  async function readDocs(db, collection){
    var snap = await db.collection(collection).get();
    var rows = [];
    snap.forEach(function(doc){rows.push({id:text(doc.id), data:cleanValue(doc.data() || {})});});
    return rows;
  }

  function cedulaFromDocId(value){
    var raw = text(value);
    var match = raw.match(/^(\d{7,13})(?:\D|$)/);
    return match ? match[1] : "";
  }

  function cedulaOf(doc){
    var data = doc && doc.data ? doc.data : doc || {};
    return text(data.cedula || data.Cedula || data.CEDULA || data.numeroIdentificacion || data.numeroidentificacion || data.NumeroIdentificacion || data.identificacion || data.Identificacion) || cedulaFromDocId(doc && doc.id);
  }

  function parseTime(row){
    row = row || {};
    var raw = text(row.updatedAt || row.ultimaSincronizacion || row.actualizadoEn || row.createdAt || row.creadoEn || "");
    var time = Date.parse(raw);
    return Number.isFinite(time) ? time : 0;
  }

  function hasData(value){
    if(value === undefined || value === null){return false;}
    if(Array.isArray(value)){return value.length > 0;}
    if(typeof value === "object"){return Object.keys(value).length > 0;}
    return text(value) !== "";
  }

  function mergeArray(a, b){
    var seen = {};
    var out = [];
    (Array.isArray(a) ? a : hasData(a) ? [a] : []).concat(Array.isArray(b) ? b : hasData(b) ? [b] : []).forEach(function(item){
      var key = typeof item === "object" ? JSON.stringify(item) : text(item);
      if(!key || seen[key]){return;}
      seen[key] = true;
      out.push(item);
    });
    return out;
  }

  function mergeValue(current, incoming, incomingNewer){
    if(!hasData(incoming)){return current;}
    if(!hasData(current)){return incoming;}
    if(Array.isArray(current) || Array.isArray(incoming)){return mergeArray(current, incoming);}
    if(typeof current === "object" && typeof incoming === "object"){
      var out = Object.assign({}, current);
      Object.keys(incoming).forEach(function(key){out[key] = mergeValue(out[key], incoming[key], incomingNewer);});
      return out;
    }
    return incomingNewer ? incoming : current;
  }

  function normalizeDivisiones(value){
    if(window.BLDivisionesService && typeof window.BLDivisionesService.normalizeDivisiones === "function"){
      return window.BLDivisionesService.normalizeDivisiones(value);
    }
    if(Array.isArray(value)){return value.map(text).filter(Boolean);}
    var single = text(value);
    return single ? [single] : [];
  }

  function normalizeStudent(raw, fallbackId){
    var data = Object.assign({}, raw || {});
    var cedula = text(data.cedula || data.numeroIdentificacion || data.numeroidentificacion) || cedulaFromDocId(fallbackId || data._firebaseId || data.docId || data._docId);
    data.cedula = cedula;
    data.numeroIdentificacion = text(data.numeroIdentificacion || data.numeroidentificacion || cedula);
    data.divisiones = normalizeDivisiones(data.divisiones || data.division || data.Division || data.División);
    if(data.divisiones.length){data.division = data.divisiones[0];}else{delete data.division;}
    if(window.BLNormalizador && typeof window.BLNormalizador.normalizeStudent === "function"){
      data = window.BLNormalizador.normalizeStudent(data, 0, {source:"limpiar_base"});
    }
    data.cedula = cedula;
    data.numeroIdentificacion = text(data.numeroIdentificacion || cedula);
    data.docId = cedula;
    data._docId = cedula;
    data.updatedAt = now();
    data.ultimaSincronizacion = now();
    return data;
  }

  function cleanForFirebase(row){
    var clean = clone(row || {}) || {};
    Object.keys(clean).forEach(function(key){if(key.charAt(0) === "_"){delete clean[key];}});
    return clean;
  }

  function mergeStudentDocs(docs){
    var sorted = docs.slice().sort(function(a, b){return parseTime(a.data) - parseTime(b.data);});
    var merged = {};
    sorted.forEach(function(doc){
      var incoming = Object.assign({}, doc.data || {}, {_firebaseId:doc.id});
      var incomingNewer = parseTime(incoming) >= parseTime(merged);
      Object.keys(incoming).forEach(function(key){merged[key] = mergeValue(merged[key], incoming[key], incomingNewer);});
    });
    var cedula = cedulaOf({id:sorted[0] && sorted[0].id, data:merged});
    return normalizeStudent(merged, cedula);
  }

  function normalizePeriod(raw, fallbackId){
    var data = Object.assign({}, raw || {});
    data.id = text(data.id || data.periodoId || fallbackId);
    data.label = text(data.label || data.periodoLabel || data.periodo || data.id);
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.normalizePeriod === "function"){
      data = window.BLPeriodosCanon.normalizePeriod(data);
    }
    data.updatedAt = now();
    return data;
  }

  function periodKey(period){
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.keyFromPeriod === "function"){
      return window.BLPeriodosCanon.keyFromPeriod(period);
    }
    return norm(period && (period.label || period.periodoLabel || period.id || period.periodoId));
  }

  function groupByStudent(docs){
    var groups = {};
    docs.forEach(function(doc){
      var cedula = cedulaOf(doc);
      if(!cedula){return;}
      if(!groups[cedula]){groups[cedula] = [];}
      groups[cedula].push(doc);
    });
    return groups;
  }

  function groupByPeriod(docs){
    var groups = {};
    docs.forEach(function(doc){
      var period = normalizePeriod(doc.data, doc.id);
      var key = periodKey(period);
      if(!key){return;}
      if(!groups[key]){groups[key] = [];}
      groups[key].push({id:doc.id, data:period});
    });
    return groups;
  }

  async function commitSetDelete(db, sets, deletes){
    var size = 430;
    var all = sets.map(function(x){return {type:"set", item:x};}).concat(deletes.map(function(x){return {type:"delete", item:x};}));
    for(var i = 0; i < all.length; i += size){
      var batch = db.batch();
      all.slice(i, i + size).forEach(function(entry){
        if(entry.type === "set"){batch.set(entry.item.ref, entry.item.data, {merge:true});}
        else{batch.delete(entry.item.ref);}
      });
      await batch.commit();
    }
  }

  function appendLog(summary){
    try{
      var list = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
      if(!Array.isArray(list)){list = [];}
      list.unshift(summary);
      localStorage.setItem(LOG_KEY, JSON.stringify(list.slice(0, 50)));
    }catch(error){}
  }

  async function limpiarFirebase(){
    var db = ensureFirebase();
    var studentDocs = await readDocs(db, STUDENTS);
    var periodDocs = await readDocs(db, PERIODS);
    var studentGroups = groupByStudent(studentDocs);
    var periodGroups = groupByPeriod(periodDocs);
    var sets = [];
    var deletes = [];
    var docsFusionados = 0;
    var docsEliminados = 0;
    var periodosUnidos = 0;
    var errores = [];

    Object.keys(studentGroups).forEach(function(cedula){
      try{
        var docs = studentGroups[cedula];
        var merged = mergeStudentDocs(docs);
        sets.push({ref:db.collection(STUDENTS).doc(cedula), data:cleanForFirebase(merged)});
        docs.forEach(function(doc){
          if(text(doc.id) !== cedula){
            deletes.push({ref:db.collection(STUDENTS).doc(doc.id)});
            docsEliminados += 1;
          }
        });
        if(docs.length > 1 || docs.some(function(doc){return text(doc.id) !== cedula;})){docsFusionados += 1;}
      }catch(error){errores.push({tipo:"estudiante", id:cedula, mensaje:error.message || String(error)});}
    });

    Object.keys(periodGroups).forEach(function(key){
      try{
        var docs = periodGroups[key];
        var merged = docs.reduce(function(acc, doc){return Object.assign({}, acc, doc.data || {});}, {});
        merged = normalizePeriod(merged, key);
        var id = text(merged.id || merged.periodoId || key);
        sets.push({ref:db.collection(PERIODS).doc(id), data:cleanForFirebase(merged)});
        docs.forEach(function(doc){
          if(text(doc.id) !== id){deletes.push({ref:db.collection(PERIODS).doc(doc.id)});periodosUnidos += 1;}
        });
      }catch(error){errores.push({tipo:"periodo", id:key, mensaje:error.message || String(error)});}
    });

    await commitSetDelete(db, sets, deletes);

    var summary = {
      ok:errores.length === 0,
      ejecutadoEn:now(),
      documentosFusionados:docsFusionados,
      documentosEliminados:docsEliminados,
      periodosUnidos:periodosUnidos,
      errores:errores,
      mensaje:"Firebase y Base Local reparados. Documentos fusionados: " + docsFusionados + ". Documentos eliminados: " + docsEliminados + ". Períodos unidos: " + periodosUnidos + "."
    };
    appendLog(summary);
    return summary;
  }

  async function ejecutar(){
    var summary = await limpiarFirebase();
    if(window.BaseLocalFirebase && typeof window.BaseLocalFirebase.pull === "function"){
      await window.BaseLocalFirebase.pull();
    }
    try{
      if(window.RequisitosBL && typeof window.RequisitosBL.rebuildSnapshotToCollections === "function"){
        window.RequisitosBL.rebuildSnapshotToCollections({force:true});
      }else if(window.RequisitosBL && typeof window.RequisitosBL.mirrorSnapshotToCollections === "function"){
        window.RequisitosBL.mirrorSnapshotToCollections({force:true, rebuild:true});
      }
      if(window.RequisitosBL && typeof window.RequisitosBL.notificar === "function"){
        window.RequisitosBL.notificar("limpieza-complete", summary);
      }
    }catch(error){}
    return summary;
  }

  function getLogs(){try{var rows = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");return Array.isArray(rows) ? rows : [];}catch(error){return [];}}

  window.BLLimpiarBaseService = {ejecutar:ejecutar, limpiarFirebase:limpiarFirebase, getLogs:getLogs, logKey:LOG_KEY};
})(window);
