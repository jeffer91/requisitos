/* =========================================================
Nombre completo: sb.mapper.js
Ruta: /BDLocal/connections/supabase/sb.mapper.js
Función:
- Convertir eventos/datos críticos de BDLocal al formato de Supabase.
========================================================= */
(function(window){
  "use strict";

  function txt(value){ return String(value == null ? "" : value).trim(); }
  function now(){ return new Date().toISOString(); }

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

  window.BDLSupabaseMapper = {
    tableForEvent: tableForEvent,
    eventToRow: eventToRow
  };
})(window);
