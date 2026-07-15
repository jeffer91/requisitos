/* =========================================================
Nombre completo: ncomplex.save.js
Ruta o ubicación: /Ncomplex/ncomplex.save.js
Función o funciones:
- Preparar y guardar las evaluaciones modificadas mediante ConNcomplex.
- Registrar cada importación de texto en la tabla importaciones.
- Limpiar cambios pendientes de pantalla únicamente después de confirmación de BDLocal.
- Mantener el botón de guardado y los mensajes de progreso.
Con qué se conecta:
- BDLocal/conexiones/cone.ncomplex.js
- ncomplex.state.js
- ncomplex.calculator.js
- ncomplex.matcher.js
- ncomplex.app.js
========================================================= */
(function(window,document){
  "use strict";

  var State = window.NcomplexState || {};
  var Calculator = window.NcomplexCalculator || {};

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function connector(){
    return window.ConNcomplex || window.BDLocalConeNcomplex || null;
  }

  function now(){
    return new Date().toISOString();
  }

  function hash(value){
    value = String(value == null ? "" : value);
    var result = 2166136261;
    for(var index = 0; index < value.length; index += 1){
      result ^= value.charCodeAt(index);
      result += (result << 1) + (result << 4) + (result << 7) + (result << 8) + (result << 24);
    }
    return (result >>> 0).toString(16);
  }

  function setStatus(message, type){
    var status = document.getElementById("ncomplex-status");
    if(status){
      status.textContent = message || "";
      status.className = "ncomplex-statusbar " + (type ? "is-" + type : "");
    }
    if(State.patch){ State.patch({ statusMessage: message || "" }, "save-status"); }
  }

  function updateButton(){
    var button = document.getElementById("ncomplex-btn-save");
    var current = State.get ? State.get() : {};
    var total = Object.keys(current.dirty || {}).length;
    if(button){
      button.disabled = !total || !!current.saving;
      button.textContent = current.saving
        ? "Guardando..."
        : total
          ? "Guardar cambios (" + total + ")"
          : "Guardar cambios";
    }
    return total;
  }

  function validRows(rows){
    return (Array.isArray(rows) ? rows : []).map(function(row){
      return Calculator.recalculate ? Calculator.recalculate(row) : Object.assign({}, row);
    }).filter(function(row){
      return !!(
        text(row.periodoId || row.periodId) &&
        text(row.cedula || row.numeroIdentificacion) &&
        text(row.idEstudiantePeriodo || row.studentId || row.id)
      );
    });
  }

  function buildImportRecord(savedRows){
    var current = State.get ? State.get() : {};
    var parsed = current.parsedImport || {};
    var matched = current.matchedImport || {};
    var raw = text(parsed.rawText || "");
    var createdAt = now();

    return {
      id: "ncomplex_import__" + hash([
        current.selectedPeriodId,
        raw,
        createdAt
      ].join("|")),
      periodoId: text(current.selectedPeriodId),
      source: "NCOMPLEX_TEXTO_PEGADO",
      rawTextHash: raw ? "text__" + hash(raw) : "",
      totalDetectados: Number(parsed.total || matched.totalImported || 0),
      totalEncontrados: Number(matched.totalMatched || 0),
      totalNoEncontrados: Number(matched.totalUnmatched || 0),
      totalDuplicados: Number(matched.totalDuplicates || 0),
      totalConflictos: Number(matched.totalConflicts || 0),
      totalGuardados: Number(savedRows && savedRows.length || 0),
      estado: "PROCESADO",
      createdAt: createdAt,
      updatedAt: createdAt,
      origen: "ncomplex"
    };
  }

  function saveImportIfNeeded(savedRows){
    var current = State.get ? State.get() : {};
    var con = connector();
    if(!current.parsedImport || !current.importApplied){ return Promise.resolve(null); }
    if(!con || typeof con.saveImport !== "function"){ return Promise.resolve(null); }
    return con.saveImport(buildImportRecord(savedRows)).catch(function(error){
      try{ console.warn("[NcomplexSave] No se pudo registrar la importación", error); }catch(innerError){}
      return null;
    });
  }

  function save(){
    var con = connector();
    var current = State.get ? State.get() : {};
    var rows = validRows(State.dirtyRows ? State.dirtyRows() : []);

    if(!rows.length){
      setStatus("No hay cambios pendientes para guardar.", "info");
      updateButton();
      return Promise.resolve({ ok: true, saved: 0, rows: [] });
    }

    if(!con || typeof con.saveMany !== "function"){
      var missing = new Error("ConNcomplex no está disponible para guardar.");
      setStatus(missing.message, "error");
      return Promise.reject(missing);
    }

    if(State.patch){ State.patch({ saving: true }, "saving-start"); }
    setStatus("Guardando " + rows.length + " evaluación(es) en BDLocal...", "info");
    updateButton();

    return con.saveMany(rows, {
      periodoId: current.selectedPeriodId,
      origen: "ncomplex_pantalla"
    }).then(function(saved){
      saved = Array.isArray(saved) ? saved : [];
      return saveImportIfNeeded(saved).then(function(){
        if(State.clearDirty){
          State.clearDirty(saved.map(function(row){
            return State.recordId ? State.recordId(row) : text(row.idEstudiantePeriodo || row.id);
          }));
        }
        if(State.patch){
          State.patch({
            saving: false,
            lastSavedAt: now(),
            importApplied: false
          }, "saving-complete");
        }
        setStatus(saved.length + " evaluación(es) guardada(s) correctamente.", "success");
        updateButton();
        return { ok: true, saved: saved.length, rows: saved };
      });
    }).catch(function(error){
      if(State.patch){ State.patch({ saving: false }, "saving-error"); }
      setStatus(error && error.message ? error.message : String(error), "error");
      updateButton();
      throw error;
    });
  }

  window.NcomplexSave = {
    version: "1.0.0-bloque-2",
    save: save,
    updateButton: updateButton,
    setStatus: setStatus,
    buildImportRecord: buildImportRecord,
    validRows: validRows
  };
})(window,document);