/* =========================================================
Nombre completo: bdl.sync.changes.js
Ruta o ubicación: /Requisitos/BDLocal/sync/bdl.sync.changes.js
Función o funciones:
- Crear cambios inteligentes desde Base Local.
- Preparar cambios completos para Firebase, Supabase y Google Sheets.
- Evitar subir toda la base cuando solo cambió un estudiante o registro.
- Generar huella del contenido para evitar duplicados exactos.
- Mantener una estructura única de cambio para la cola de sincronización.
Con qué se conecta:
- bdl.sync.queue.js
- bdl.sync.worker.js
- bdl.sync.upload.js
- bdl.sync.firebase.js
- fb.upload.js
- sb.upload-critical.js
- gs.sync-continuous.js
========================================================= */
(function(window){
  "use strict";

  var S = window.BDLSyncConfig || null;

  var BASES_DEFAULT = ["firebase", "supabase", "google_sheets"];

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function now(){
    return S && typeof S.now === "function" ? S.now() : new Date().toISOString();
  }

  function clone(value){
    try{
      return JSON.parse(JSON.stringify(value == null ? null : value));
    }catch(error){
      return value;
    }
  }

  function key(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
  }

  function stableStringify(value){
    if(value == null){
      return "";
    }

    if(typeof value !== "object"){
      return String(value);
    }

    if(Array.isArray(value)){
      return "[" + value.map(stableStringify).join(",") + "]";
    }

    return "{" + Object.keys(value).sort().map(function(k){
      return JSON.stringify(k) + ":" + stableStringify(value[k]);
    }).join(",") + "}";
  }

  function hash(value){
    var str = stableStringify(value);
    var h = 0;
    var i;

    if(!str){
      return "h0";
    }

    for(i = 0; i < str.length; i += 1){
      h = ((h << 5) - h) + str.charCodeAt(i);
      h = h & h;
    }

    return "h" + Math.abs(h);
  }

  function normalizeBaseName(value){
    var k = key(value);

    if(k === "sheets" || k === "google" || k === "googlesheets" || k === "google_sheet"){
      return "google_sheets";
    }

    if(k === "firestore"){
      return "firebase";
    }

    return k || "";
  }

  function normalizeBases(value){
    var list;

    if(Array.isArray(value)){
      list = value;
    }else if(text(value)){
      list = text(value).split(/[;,|]/);
    }else{
      list = BASES_DEFAULT.slice();
    }

    var seen = {};
    var out = [];

    list.forEach(function(item){
      var b = normalizeBaseName(item);
      if(!b || seen[b]){
        return;
      }

      if(b === "firebase" || b === "supabase" || b === "google_sheets"){
        seen[b] = true;
        out.push(b);
      }
    });

    return out.length ? out : BASES_DEFAULT.slice();
  }

  function collectionFor(tabla){
    tabla = key(tabla);

    if(S && S.collections){
      if(tabla === "estudiantes" && S.collections.estudiantes){ return S.collections.estudiantes; }
      if(tabla === "periodos" && S.collections.periodos){ return S.collections.periodos; }
    }

    if(tabla === "estudiantes"){ return "Estudiantes"; }
    if(tabla === "periodos"){ return "periodos"; }
    if(tabla === "requisitos"){ return "estudiante_requisitos"; }
    if(tabla === "notas"){ return "estudiante_notas"; }
    if(tabla === "divisiones"){ return "estudiante_divisiones"; }

    return tabla || "registros";
  }

  function tableForSupabase(tabla){
    tabla = key(tabla);

    if(S && S.supabase && S.supabase.tableKeys && S.supabase.tableKeys[tabla]){
      return S.supabase.tableKeys[tabla];
    }

    if(tabla === "estudiantes"){ return "estudiantes_periodo_resumen"; }
    if(tabla === "periodos"){ return "periodos"; }
    if(tabla === "requisitos"){ return "estudiante_requisitos"; }
    if(tabla === "notas"){ return "estudiante_notas"; }
    if(tabla === "divisiones"){ return "estudiante_divisiones"; }

    return tabla || "registros";
  }

  function sheetFor(tabla){
    tabla = key(tabla);

    if(tabla === "estudiantes"){ return "Estudiantes"; }
    if(tabla === "periodos"){ return "Periodos"; }
    if(tabla === "requisitos"){ return "Requisitos"; }
    if(tabla === "notas"){ return "Notas"; }
    if(tabla === "divisiones"){ return "Divisiones"; }

    return tabla ? tabla.charAt(0).toUpperCase() + tabla.slice(1) : "Registros";
  }

  function extractStudentId(datos){
    datos = datos || {};

    return text(
      datos.estudianteId ||
      datos.numeroIdentificacion ||
      datos.cedula ||
      datos.identificacion ||
      datos.resumen && datos.resumen.numeroIdentificacion ||
      datos.persona && datos.persona.numeroIdentificacion ||
      ""
    );
  }

  function extractPeriodId(datos){
    datos = datos || {};

    return text(
      datos.periodoId ||
      datos.periodId ||
      datos.periodo && datos.periodo.periodoId ||
      datos.resumen && datos.resumen.periodoId ||
      ""
    );
  }

  function labelBase(base){
    if(base === "firebase"){ return "Firebase"; }
    if(base === "supabase"){ return "Supabase"; }
    if(base === "google_sheets"){ return "Google Sheets"; }
    return base;
  }

  function destino(base, tabla){
    if(base === "firebase"){
      return {
        base: base,
        label: labelBase(base),
        collection: collectionFor(tabla)
      };
    }

    if(base === "supabase"){
      return {
        base: base,
        label: labelBase(base),
        table: tableForSupabase(tabla)
      };
    }

    if(base === "google_sheets"){
      return {
        base: base,
        label: labelBase(base),
        sheet: sheetFor(tabla)
      };
    }

    return {
      base: base,
      label: labelBase(base)
    };
  }

  function build(tabla, accion, idRegistro, datos, options){
    options = options || {};
    datos = clone(datos || {});

    var bases = normalizeBases(options.bases || options.targets || datos._syncBases);
    var fingerprint = hash(datos);
    var createdAt = now();
    var tablaFinal = key(tabla || datos.tabla || "registros") || "registros";
    var idFinal = text(idRegistro || datos.idRegistro || datos.idEstudiantePeriodo || datos.id || "");
    var accionFinal = key(accion || datos.accion || "upsert") || "upsert";
    var estudianteId = extractStudentId(datos);
    var periodoId = extractPeriodId(datos);

    return bases.map(function(base){
      var d = destino(base, tablaFinal);

      return {
        id: "",
        base: base,
        baseLabel: d.label,
        tabla: tablaFinal,
        accion: accionFinal,
        idRegistro: idFinal,
        estudianteId: estudianteId,
        periodoId: periodoId,
        datos: datos,
        destino: d,
        fingerprint: fingerprint,
        dedupeKey: [
          base,
          tablaFinal,
          accionFinal,
          idFinal,
          fingerprint
        ].join("|"),
        replaceKey: [
          base,
          tablaFinal,
          idFinal
        ].join("|"),
        estado: "pendiente",
        prioridad: Number(options.prioridad || 5),
        origen: text(options.source || options.origen || "bdlocal"),
        createdAt: createdAt,
        updatedAt: createdAt
      };
    });
  }

  function fromEstudiantePayload(payload, options){
    payload = payload || {};
    var resumen = payload.resumen || {};
    var id = text(payload.idEstudiantePeriodo || resumen.idEstudiantePeriodo || resumen.id || payload.id || "");

    return build("estudiantes", "upsert", id, payload, options || {});
  }

  function fromPeriodo(periodo, options){
    periodo = periodo || {};
    var id = text(periodo.periodoId || periodo.id || periodo.value || "");

    return build("periodos", "upsert", id, periodo, options || {});
  }

  function isSameContent(a, b){
    return hash(a || {}) === hash(b || {});
  }

  function groupByBase(changes){
    var map = {};

    (Array.isArray(changes) ? changes : []).forEach(function(change){
      var b = normalizeBaseName(change && change.base);
      if(!b){ return; }
      map[b] = map[b] || [];
      map[b].push(change);
    });

    return map;
  }

  window.BDLSyncChanges = {
    basesDefault: BASES_DEFAULT.slice(),
    normalizeBases: normalizeBases,
    normalizeBaseName: normalizeBaseName,
    build: build,
    fromEstudiantePayload: fromEstudiantePayload,
    fromPeriodo: fromPeriodo,
    hash: hash,
    stableStringify: stableStringify,
    isSameContent: isSameContent,
    groupByBase: groupByBase,
    labelBase: labelBase
  };
})(window);