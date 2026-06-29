/* =========================================================
Nombre completo: bl-estudiantes.service.js
Ruta o ubicación: /Requisitos/BaseLocal/services/bl-estudiantes.service.js
Función o funciones:
- Leer la colección Estudiantes desde Firestore.
- Normalizar estudiantes con cédula como clave principal.
- Conservar todos los campos originales de Firestore.
- Fusionar duplicados por cédula sin perder campos útiles.
- Preparar soporte para documentos antiguos tipo cedula_periodo.
Con qué se conecta:
- bl-campos.js
- bl-normalizador.js
- bl-divisiones.service.js
- baselocal.firebase.js
========================================================= */
(function(window){
  "use strict";

  var COLLECTION = "Estudiantes";

  function campos(){if(!window.BLCampos){throw new Error("BLCampos no disponible.");}return window.BLCampos;}
  function normalizador(){if(!window.BLNormalizador){throw new Error("BLNormalizador no disponible.");}return window.BLNormalizador;}
  function text(value){return campos().text(value);}
  function clone(value){try{return JSON.parse(JSON.stringify(value == null ? null : value));}catch(error){return value;}}

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

  function cedulaFromDocId(value){
    var raw = text(value);
    var match = raw.match(/^(\d{7,13})(?:\D|$)/);
    return match ? match[1] : "";
  }

  function docToStudent(doc, index){
    var data = cleanValue(typeof doc.data === "function" ? doc.data() : {});
    var firebaseId = text(doc.id || data.id);
    var cedulaDoc = cedulaFromDocId(firebaseId);
    var raw = Object.assign({}, data || {}, {_firebaseId:firebaseId, _firebaseCollection:COLLECTION});
    if(!text(raw.cedula || raw.Cedula || raw.CEDULA || raw.numeroIdentificacion || raw.numeroidentificacion) && cedulaDoc){
      raw.cedula = cedulaDoc;
      raw.numeroIdentificacion = cedulaDoc;
    }
    return normalizador().normalizeStudent(raw, index || 0, {source:"firebase"});
  }

  async function read(db){
    if(!db || typeof db.collection !== "function"){throw new Error("Firestore no disponible para leer Estudiantes.");}
    var snap = await db.collection(COLLECTION).get();
    var rows = [];
    if(snap && typeof snap.forEach === "function"){
      var index = 0;
      snap.forEach(function(doc){rows.push(docToStudent(doc, index));index += 1;});
    }else if(snap && Array.isArray(snap.docs)){
      rows = snap.docs.map(function(doc, index){return docToStudent(doc, index);});
    }
    return dedupeByCedula(rows);
  }

  function updatedTime(row){
    row = row || {};
    var raw = text(campos().getValue(row, "updatedAt", "") || row.ultimaSincronizacion || row.actualizadoEn || row.createdAt || row.creadoEn || "");
    var time = Date.parse(raw);
    return Number.isFinite(time) ? time : 0;
  }

  function normalizeDivisiones(value){return normalizador().normalizeDivisiones(value);}

  function valueHasData(value){
    if(value === undefined || value === null){return false;}
    if(Array.isArray(value)){return value.length > 0;}
    if(typeof value === "object"){return Object.keys(value).length > 0;}
    return text(value) !== "";
  }

  function mergeValue(current, incoming, incomingNewer){
    if(!valueHasData(incoming)){return current;}
    if(!valueHasData(current)){return incoming;}
    if(Array.isArray(current) || Array.isArray(incoming)){
      var seen = {};
      var merged = [];
      (Array.isArray(current) ? current : [current]).concat(Array.isArray(incoming) ? incoming : [incoming]).forEach(function(item){
        var key = text(typeof item === "object" && item ? JSON.stringify(item) : item);
        if(!key || seen[key]){return;}
        seen[key] = true;
        merged.push(item);
      });
      return merged;
    }
    return incomingNewer ? incoming : current;
  }

  function mergeStudents(current, incoming){
    var base = normalizador().normalizeStudent(current || {}, 0, {source:(current && current._source) || "firebase"});
    var next = normalizador().normalizeStudent(incoming || {}, 0, {source:(incoming && incoming._source) || "firebase"});
    var incomingNewer = updatedTime(next) >= updatedTime(base);
    var out = Object.assign({}, base);
    Object.keys(next).forEach(function(key){out[key] = mergeValue(out[key], next[key], incomingNewer);});

    var cedula = text(base.cedula || next.cedula || base.numeroIdentificacion || next.numeroIdentificacion);
    if(cedula){out.cedula = cedula;out.numeroIdentificacion = text(out.numeroIdentificacion || cedula);}
    out.divisiones = normalizeDivisiones([].concat(normalizeDivisiones(base.divisiones || base.division), normalizeDivisiones(next.divisiones || next.division)));
    if(out.divisiones.length){out.division = out.divisiones[0];}else{delete out.division;}
    out._firebaseDuplicates = [].concat(base._firebaseDuplicates || [], next._firebaseDuplicates || []);
    if(text(base._firebaseId) && out._firebaseDuplicates.indexOf(text(base._firebaseId)) < 0){out._firebaseDuplicates.push(text(base._firebaseId));}
    if(text(next._firebaseId) && out._firebaseDuplicates.indexOf(text(next._firebaseId)) < 0){out._firebaseDuplicates.push(text(next._firebaseId));}
    return normalizador().normalizeStudent(out, 0, {source:out._source || "firebase"});
  }

  function dedupeByCedula(students){
    var map = {};
    (students || []).forEach(function(student){
      var normalized = normalizador().normalizeStudent(student, 0, {source:student && student._source || "firebase"});
      var key = text(normalized.cedula || normalized.numeroIdentificacion || cedulaFromDocId(normalized._firebaseId || normalized.docId));
      if(!key){return;}
      map[key] = map[key] ? mergeStudents(map[key], normalized) : normalized;
    });
    return Object.keys(map).map(function(key){return map[key];});
  }

  function normalizeLocalList(students){return dedupeByCedula(students || []);}

  window.BLEstudiantesService = {
    collection:COLLECTION,
    read:read,
    dedupeByCedula:dedupeByCedula,
    normalizeLocalList:normalizeLocalList,
    mergeStudents:mergeStudents,
    cedulaFromDocId:cedulaFromDocId,
    normalizeStudent:function(row, index, options){return normalizador().normalizeStudent(row, index, options || {});}
  };
})(window);
