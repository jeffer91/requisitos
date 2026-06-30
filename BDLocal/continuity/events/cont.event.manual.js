/* =========================================================
Nombre completo: cont.event.manual.js
Ruta: /BDLocal/continuity/events/cont.event.manual.js
Función:
- Registrar cambios manuales importantes de la app.
- Crear evento de continuidad.
- Intentar protección secundaria sin bloquear el guardado local.
========================================================= */
(function(window){
  "use strict";

  function txt(value){ return String(value == null ? "" : value).trim(); }
  function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name, { detail:detail || {} })); }catch(error){} }

  function studentId(row){
    row = row || {};
    return txt(row.idEstudiantePeriodo || row._idEstudiantePeriodo || row._bl2Id || row._defId || row._id || row._docId || row.docId || row.numeroIdentificacion || row.NumeroIdentificacion || row.identificacion || row.Identificacion || row.cedula || row.Cedula || row.CEDULA || row._cedula || row.id || "");
  }

  function periodId(row){
    row = row || {};
    return txt(row.periodoId || row._periodoId || row.ultimoPeriodoId || row.periodId || row.PeriodoId || row.periodo || row.Periodo || row._periodo || row._periodoNormalizado || "");
  }

  function protectAsync(event){
    if(!window.BDLContinuity || typeof window.BDLContinuity.protectEvent !== "function"){ return; }
    Promise.resolve().then(function(){ return window.BDLContinuity.protectEvent(event); }).then(function(result){
      emit("bdlocal:manual-event-protected", { event:event, result:result });
    }).catch(function(error){
      emit("bdlocal:manual-event-protect-error", { event:event, error:error && error.message ? error.message : String(error) });
    });
  }

  function record(input, options){
    input = input || {};
    options = options || {};
    if(!input.prioridad){ input.prioridad = window.BDLContEventClassify ? window.BDLContEventClassify.classify(input) : "manual"; }
    if(!input.origen){ input.origen = "bdlocal_manual"; }

    var event = null;
    if(window.BDLContinuity && typeof window.BDLContinuity.createEvent === "function"){
      event = window.BDLContinuity.createEvent(input);
    }else if(window.BDLContEventCreate && typeof window.BDLContEventCreate.create === "function"){
      event = window.BDLContEventCreate.create(input);
    }

    if(event && options.protect !== false){ protectAsync(event); }
    return event;
  }

  function recordNota(row, field, oldValue, newValue, meta){
    row = row || {};
    return record({
      tipoDato: "nota",
      prioridad: "critico",
      estudianteId: studentId(row),
      periodoId: periodId(row),
      campo: txt(field || "nota"),
      valorAnterior: oldValue == null ? "" : oldValue,
      valorNuevo: newValue == null ? "" : newValue,
      meta: Object.assign({ row:row }, meta || {})
    });
  }

  function recordDivision(action, periodoIdValue, nombre, payload){
    return record({
      tipoDato: "division",
      prioridad: "manual",
      estudianteId: "",
      periodoId: txt(periodoIdValue),
      campo: txt(action || "division"),
      valorAnterior: payload && payload.oldNombre ? payload.oldNombre : "",
      valorNuevo: txt(nombre),
      meta: payload || {}
    });
  }

  function recordTelegram(row, field, oldValue, newValue, meta){
    row = row || {};
    return record({
      tipoDato: "telegram",
      prioridad: "manual",
      estudianteId: studentId(row),
      periodoId: periodId(row),
      campo: txt(field || "telegram"),
      valorAnterior: oldValue == null ? "" : oldValue,
      valorNuevo: newValue == null ? "" : newValue,
      meta: Object.assign({ row:row }, meta || {})
    });
  }

  function recordTitulo(row, field, oldValue, newValue, meta){
    row = row || {};
    return record({
      tipoDato: "titulo",
      prioridad: "critico",
      estudianteId: studentId(row),
      periodoId: periodId(row),
      campo: txt(field || "titulo"),
      valorAnterior: oldValue == null ? "" : oldValue,
      valorNuevo: newValue == null ? "" : newValue,
      meta: Object.assign({ row:row }, meta || {})
    });
  }

  function recordModalidad(row, oldValue, newValue, meta){
    row = row || {};
    return record({
      tipoDato: "modalidad",
      prioridad: "manual",
      estudianteId: studentId(row),
      periodoId: periodId(row),
      campo: "modalidadTitulacion",
      valorAnterior: oldValue == null ? "" : oldValue,
      valorNuevo: newValue == null ? "" : newValue,
      meta: Object.assign({ row:row }, meta || {})
    });
  }

  window.BDLManualEvents = {
    record: record,
    recordNota: recordNota,
    recordDivision: recordDivision,
    recordTelegram: recordTelegram,
    recordTitulo: recordTitulo,
    recordModalidad: recordModalidad,
    studentId: studentId,
    periodId: periodId
  };
})(window);