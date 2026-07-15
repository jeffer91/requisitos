/* =========================================================
Nombre completo: ncomplex.state.js
Ruta o ubicación: /Ncomplex/ncomplex.state.js
Función o funciones:
- Mantener el estado único de la pantalla Ncomplex.
- Registrar filtros, estudiantes, importaciones, cambios pendientes y paginación.
- Notificar a los módulos visuales cuando el estado cambia.
Con qué se conecta:
- ncomplex.filters.js
- ncomplex.summary.js
- ncomplex.table.js
- ncomplex.modal.js
- ncomplex.save.js
- ncomplex.app.js
========================================================= */
(function(window){
  "use strict";

  var Config = window.NcomplexConfig || {};
  var listeners = [];

  function initial(){
    return {
      ready: false,
      loading: false,
      saving: false,
      error: "",
      statusMessage: "Preparando Ncomplex...",
      periods: [],
      records: [],
      filteredRecords: [],
      careers: [],
      selectedPeriodId: "",
      filters: {
        carrera: "",
        modalidad: "",
        estado: "",
        search: "",
        soloFaltantes: false,
        estadoMatricula: "ACTIVO"
      },
      page: 1,
      pageSize: Number(Config.pageSize || 25),
      totalPages: 1,
      parsedImport: null,
      matchedImport: null,
      importApplied: false,
      dirty: Object.create(null),
      selectedStudentId: "",
      lastLoadedAt: "",
      lastSavedAt: ""
    };
  }

  var state = initial();

  function snapshot(){
    return state;
  }

  function emit(reason, detail){
    listeners.slice().forEach(function(listener){
      try{
        listener(state, reason || "change", detail || {});
      }catch(error){
        try{ console.error("[NcomplexState]", error); }catch(innerError){}
      }
    });
  }

  function patch(values, reason){
    values = values || {};
    Object.keys(values).forEach(function(key){
      state[key] = values[key];
    });
    emit(reason || "patch", values);
    return state;
  }

  function setFilters(values, reason){
    state.filters = Object.assign({}, state.filters, values || {});
    state.page = 1;
    emit(reason || "filters", state.filters);
    return state.filters;
  }

  function setRecords(rows, reason){
    state.records = Array.isArray(rows) ? rows : [];
    emit(reason || "records", { total: state.records.length });
    return state.records;
  }

  function recordId(row){
    row = row || {};
    return String(
      row.idEstudiantePeriodo ||
      row.studentId ||
      row.id ||
      row.cedula ||
      ""
    ).trim();
  }

  function updateRecord(id, values, reason){
    id = String(id || "").trim();
    if(!id){ return null; }

    var found = null;
    state.records = state.records.map(function(row){
      if(recordId(row) !== id){ return row; }
      found = Object.assign({}, row, values || {});
      return found;
    });

    if(found){
      markDirty(id, found, false);
      emit(reason || "record-updated", { id: id, record: found });
    }
    return found;
  }

  function markDirty(id, row, notify){
    id = String(id || recordId(row)).trim();
    if(!id){ return false; }
    state.dirty[id] = row || true;
    if(notify !== false){ emit("dirty", { id: id }); }
    return true;
  }

  function clearDirty(ids){
    if(!Array.isArray(ids)){
      state.dirty = Object.create(null);
    }else{
      ids.forEach(function(id){ delete state.dirty[String(id || "")]; });
    }
    emit("dirty-cleared", { remaining: Object.keys(state.dirty).length });
  }

  function dirtyRows(){
    var wanted = state.dirty;
    return state.records.filter(function(row){
      return !!wanted[recordId(row)];
    });
  }

  function resetImport(){
    state.parsedImport = null;
    state.matchedImport = null;
    state.importApplied = false;
    emit("import-reset", {});
  }

  function reset(){
    state = initial();
    emit("reset", {});
    return state;
  }

  function subscribe(listener){
    if(typeof listener !== "function"){ return function(){}; }
    listeners.push(listener);
    return function(){
      listeners = listeners.filter(function(item){ return item !== listener; });
    };
  }

  window.NcomplexState = {
    version: "1.0.0-bloque-2",
    get: snapshot,
    patch: patch,
    setFilters: setFilters,
    setRecords: setRecords,
    updateRecord: updateRecord,
    recordId: recordId,
    markDirty: markDirty,
    clearDirty: clearDirty,
    dirtyRows: dirtyRows,
    resetImport: resetImport,
    reset: reset,
    subscribe: subscribe,
    emit: emit
  };
})(window);