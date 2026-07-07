/* =========================================================
Archivo: bdl.rules.sync.js
Ruta: /BDLocal/rules/bdl.rules.sync.js
Función:
- Preparar cambios pendientes por destino.
- Evitar el modelo inseguro de sincronizado:true único.
- Crear envoltorio estándar para Firebase, Supabase y Google Sheets.
- Mantener compatibilidad con la tabla actual cambios, cuyo keyPath es id.
Con qué se conecta:
- BDLocal/rules/bdl.rules.index.js
- BDLocal/sync/bdl.sync.index.js
========================================================= */
(function(window){
  "use strict";

  var Rules = window.BDLRules;
  if(!Rules){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }

  function safeJson(value){
    try{ return JSON.stringify(value || {}); }
    catch(error){ return "{}"; }
  }

  function hash(value){
    var raw = safeJson(value);
    var h = 0;
    for(var i = 0; i < raw.length; i++){
      h = ((h << 5) - h) + raw.charCodeAt(i);
      h |= 0;
    }
    return String(h);
  }

  function changeId(row, action, table){
    row = row || {};
    return [
      text(table || row.tabla || "registro"),
      text(action || row.accion || "UPSERT"),
      text(row.periodoId || "global"),
      text(row.cedula || row.registroId || row.id || "sin_id"),
      Date.now(),
      Math.random().toString(16).slice(2)
    ].join("__");
  }

  function build(row, options){
    row = row || {};
    options = options || {};

    var table = text(options.tabla || options.table || row.tabla || "registro");
    var action = text(options.accion || options.action || "UPSERT").toUpperCase();
    var registroId = text(options.registroId || row.idEstudiantePeriodo || row.id || row.cedula || "");
    var payload = options.payload || row;
    var id = text(row.id || row.cambioId || changeId(row, action, table));

    return {
      id: id,
      cambioId: id,
      periodoId: text(row.periodoId || options.periodoId || ""),
      cedula: text(row.cedula || options.cedula || ""),
      tabla: table,
      registroId: registroId,
      accion: action,
      payload: payload,
      hash: hash(payload),
      prioridad: Number(options.prioridad || options.priority || 4),
      source: text(options.source || row.origen || "local"),
      schemaVersion: text(options.schemaVersion || "1"),
      createdAt: text(row.createdAt || "") || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      estadoFirebase: text(row.estadoFirebase || "PENDIENTE"),
      estadoSupabase: text(row.estadoSupabase || "PENDIENTE"),
      estadoSheets: text(row.estadoSheets || row.statusGoogle || "PENDIENTE"),
      statusFirebase: text(row.statusFirebase || row.estadoFirebase || "PENDIENTE"),
      statusGoogle: text(row.statusGoogle || row.estadoSheets || "PENDIENTE"),
      intentosFirebase: Number(row.intentosFirebase || 0),
      intentosSupabase: Number(row.intentosSupabase || 0),
      intentosSheets: Number(row.intentosSheets || 0),
      ultimoErrorFirebase: text(row.ultimoErrorFirebase || ""),
      ultimoErrorSupabase: text(row.ultimoErrorSupabase || ""),
      ultimoErrorSheets: text(row.ultimoErrorSheets || ""),
      sincronizadoEnFirebase: text(row.sincronizadoEnFirebase || ""),
      sincronizadoEnSupabase: text(row.sincronizadoEnSupabase || ""),
      sincronizadoEnSheets: text(row.sincronizadoEnSheets || "")
    };
  }

  function apply(payload, context){
    context = context || {};
    if(Array.isArray(payload)){
      return payload.map(function(row){ return build(row, context); });
    }
    return build(payload || {}, context);
  }

  Rules.register("sync.change", apply);

  window.BDLRulesSync = {
    hash: hash,
    build: build,
    apply: apply
  };
})(window);
