/* =========================================================
Nombre completo: sb.mapper.js
Ruta: /BDLocal/connections/supabase/sb.mapper.js
Función:
- Convertir eventos/datos críticos de BDLocal al formato de Supabase.
- Convertir registros locales a app_records para fallback de Firebase.
========================================================= */
(function(window){
  "use strict";

  function txt(value){ return String(value == null ? "" : value).trim(); }
  function now(){ return new Date().toISOString(); }
  function key(value){ return txt(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase(); }

  function tableForEvent(event){
    event = event || {};
    var tipo = txt(event.tipoDato || event.campo).toLowerCase();
    var tables = window.BDLSupabaseConfig ? window.BDLSupabaseConfig.tables : {};
    if(tipo.indexOf("nota") >= 0 || tipo.indexOf("nart") >= 0 || tipo.indexOf("ndef") >= 0 || tipo.indexOf("nfin") >= 0){ return tables.notas || "manual_notas"; }
    if(tipo.indexOf("division") >= 0){ return tables.divisiones || "manual_divisiones"; }
    if(tipo.indexOf("telegram") >= 0 || tipo.indexOf("chat") >= 0){ return tables.telegram || "manual_telegram"; }
    if(tipo.indexOf("titulo") >= 0){ return tables.titulos || "manual_titulos"; }
    if(tipo.indexOf("decision") >= 0 || tipo.indexOf("aprobacion") >= 0){ return tables.decisiones || "manual_decisiones"; }
    return tables.eventos || "sync_eventos";
  }

  function eventToRow(event){
    event = event || {};
    return {
      id: txt(event.id) || ("evt_" + Date.now()),
      estudiante_id: txt(event.estudianteId),
      periodo_id: txt(event.periodoId),
      tipo_dato: txt(event.tipoDato || "dato"),
      prioridad: txt(event.prioridad || "manual"),
      campo: txt(event.campo),
      valor_anterior: event.valorAnterior == null ? null : event.valorAnterior,
      valor_nuevo: event.valorNuevo == null ? null : event.valorNuevo,
      origen: txt(event.origen || "bdlocal"),
      estado_firebase: txt(event.estadoFirebase || "pendiente"),
      estado_supabase: txt(event.estadoSupabase || "pendiente"),
      estado_respaldo: txt(event.estadoRespaldo || "pendiente"),
      payload: event,
      created_at: event.createdAt || now(),
      updated_at: now()
    };
  }

  function syncConfig(){ return window.BDLSyncConfig || {}; }
  function supaConfig(){ return syncConfig().supabase || {}; }
  function moduleKey(){ return supaConfig().moduleKey || "requisitos"; }

  function localTableFromCollection(collectionName){
    collectionName = txt(collectionName);
    var S = syncConfig();
    var s = supaConfig();
    if(collectionName === (S.collections && S.collections.periodos) || collectionName.toLowerCase() === "periodos"){
      return s.tableKeys && s.tableKeys.periodos ? s.tableKeys.periodos : "periodos";
    }
    return s.tableKeys && s.tableKeys.estudiantes ? s.tableKeys.estudiantes : "estudiantes_periodo_resumen";
  }

  function collectionFromLocalTable(tableKey){
    tableKey = txt(tableKey);
    var S = syncConfig();
    var s = supaConfig();
    if(tableKey === (s.tableKeys && s.tableKeys.periodos)){ return S.collections && S.collections.periodos ? S.collections.periodos : "periodos"; }
    return S.collections && S.collections.estudiantes ? S.collections.estudiantes : "Estudiantes";
  }

  function recordKey(tableKey, row, fallback){
    row = row || {};
    tableKey = txt(tableKey);
    if(tableKey === "periodos"){
      return txt(row.periodoId || row.id || row.value || row.label || row.periodoLabel || fallback || "SIN_PERIODO");
    }
    if(row.id){ return txt(row.id); }
    if(row.idNota){ return txt(row.idNota); }
    if(row.idRegistro){ return txt(row.idRegistro); }
    if(row._docId){ return txt(row._docId); }
    if(row.idEstudiantePeriodo && row.requisitoId){ return txt(row.idEstudiantePeriodo + "__" + row.requisitoId); }
    if(row.idEstudiantePeriodo && row.tipoNota){ return txt(row.idEstudiantePeriodo + "__" + row.tipoNota); }
    if(row.idEstudiantePeriodo && row.divisionKey){ return txt(row.idEstudiantePeriodo + "__" + row.divisionKey); }
    return txt(row.idEstudiantePeriodo || row.numeroIdentificacion || row.cedula || fallback || ("registro_" + Date.now()));
  }

  function estudianteId(row){
    row = row || {};
    return txt(row.numeroIdentificacion || row.cedula || row.Cedula || row.estudianteId || row.estudiante_id || "");
  }

  function periodoId(row){
    row = row || {};
    return txt(row.periodoId || row.periodo || row.Periodo || "");
  }

  function appRecord(tableKey, row, options){
    options = options || {};
    row = row || {};
    tableKey = txt(tableKey || options.tableKey || "registro");
    var rk = recordKey(tableKey, row, options.recordKey);
    var mk = txt(options.moduleKey || moduleKey());
    var updated = txt(row.updatedAt || row.updated_at || row.ultimaSincronizacion || now());
    return {
      id: mk + "__" + tableKey + "__" + key(rk),
      module_key: mk,
      table_key: tableKey,
      record_key: rk,
      periodo_id: periodoId(row),
      estudiante_id: estudianteId(row),
      source: txt(options.source || "bdlocal"),
      sync_status: txt(options.syncStatus || "sincronizado"),
      payload: row,
      schema_version: txt(options.schemaVersion || "1"),
      created_at: txt(row.createdAt || row.created_at || updated || now()),
      updated_at: updated || now()
    };
  }

  function itemToRecord(item){
    item = item || {};
    var tableKey = localTableFromCollection(item.tabla || "");
    var row = Object.assign({}, item.datos || {}, { _syncQueueId:item.id || "", _syncAccion:item.accion || "upsert" });
    return appRecord(tableKey, row, { recordKey:item.idRegistro, source:"bdlocal_sync_queue", syncStatus:"pendiente" });
  }

  function recordToPayload(row){
    row = row || {};
    var payload = row.payload && typeof row.payload === "object" ? Object.assign({}, row.payload) : {};
    payload._docId = payload._docId || row.record_key || row.id || "";
    payload._supabaseId = row.id || "";
    payload._tableKey = row.table_key || "";
    payload.updatedAt = payload.updatedAt || row.updated_at || row.created_at || now();
    return payload;
  }

  window.BDLSupabaseMapper = {
    tableForEvent: tableForEvent,
    eventToRow: eventToRow,
    localTableFromCollection: localTableFromCollection,
    collectionFromLocalTable: collectionFromLocalTable,
    appRecord: appRecord,
    itemToRecord: itemToRecord,
    recordToPayload: recordToPayload
  };
})(window);
