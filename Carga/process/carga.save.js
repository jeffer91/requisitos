/* =========================================================
Nombre completo: carga.save.js
Ruta o ubicación: /Requisitos/Carga/process/carga.save.js
Función o funciones:
- Guardar la carga validada en Base Local.
- Usar siempre el período seleccionado antes de cargar Excel.
- Evitar guardar registros si hay errores graves.
- Generar señal para sincronización inteligente después de guardar.
- Recalcular carreras, requisitos y dashboard del período.
Con qué se conecta:
- carga.validator.js
- bdl.validator.estudiante.js
- bdl.repo.estudiantes.js
- bdl.repo.carreras.js
- bdl.repo.requisitos.js
- bdl.repo.dashboard.js
- bdl.sync.queue.js
- bdl.sync.engine.js
========================================================= */
(function(window){
  "use strict";

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function emit(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    }catch(error){}
  }

  function selectedPeriod(normalized){
    normalized = normalized || {};
    var p = normalized.periodoDetectado || {};

    if(window.BDLValidatorEstudiante && typeof window.BDLValidatorEstudiante.periodFromSelected === "function"){
      return window.BDLValidatorEstudiante.periodFromSelected(p);
    }

    if(window.BDLNormPeriodo && typeof window.BDLNormPeriodo.normalize === "function"){
      return window.BDLNormPeriodo.normalize({}, {
        periodoId: p.periodoId || p.id || p.value || "",
        periodoLabel: p.periodoLabel || p.label || p.nombre || p.periodoId || ""
      });
    }

    return {
      periodoId: text(p.periodoId || p.id || p.value || ""),
      periodoLabel: text(p.periodoLabel || p.label || p.nombre || p.periodoId || ""),
      valid: !!text(p.periodoId || p.id || p.value || "")
    };
  }

  function periodValid(periodo){
    if(window.BDLNormPeriodo && typeof window.BDLNormPeriodo.isValid === "function"){
      return window.BDLNormPeriodo.isValid(periodo);
    }
    return !!(periodo && periodo.periodoId && periodo.periodoId !== "SIN_PERIODO");
  }

  function injectPeriod(row, periodo){
    if(window.BDLValidatorEstudiante && typeof window.BDLValidatorEstudiante.injectPeriod === "function"){
      return window.BDLValidatorEstudiante.injectPeriod(row, periodo);
    }

    row = Object.assign({}, row || {});
    row.periodoId = periodo.periodoId;
    row.PeriodoId = periodo.periodoId;
    row.periodId = periodo.periodoId;
    row.periodo = periodo.periodoLabel;
    row.Periodo = periodo.periodoLabel;
    row.periodoLabel = periodo.periodoLabel;
    row.PeriodoLabel = periodo.periodoLabel;
    row._periodoSeleccionado = periodo.periodoId;
    row._periodoSeleccionadoLabel = periodo.periodoLabel;
    return row;
  }

  function enqueueSyncHint(result, periodoInfo){
    result = result || {};
    var changes = Array.isArray(result.changes) ? result.changes : [];

    emit("bdlocal:changes-created", {
      source: "CargaSave",
      periodoId: periodoInfo.periodoId,
      periodoLabel: periodoInfo.periodoLabel,
      total: changes.length,
      changes: changes,
      at: new Date().toISOString()
    });

    if(window.BDLSyncEngine && typeof window.BDLSyncEngine.syncBackground === "function"){
      try{
        window.BDLSyncEngine.syncBackground();
      }catch(error){}
    }else{
      emit("bdlocal:sync-requested", {
        source: "CargaSave",
        reason: "carga_guardada",
        pending: changes.length,
        at: new Date().toISOString()
      });
    }
  }

  function save(normalized, validation, options){
    options = options || {};
    normalized = normalized || {};
    validation = validation || {};

    var periodoInfo = selectedPeriod(normalized);
    var rows = Array.isArray(normalized.rowsMapeadas) ? normalized.rowsMapeadas : [];

    if(validation.ok === false && options.allowErrors !== true){
      return Promise.resolve({
        ok: false,
        saved: 0,
        updated: 0,
        merged: 0,
        total: normalized.total || rows.length || 0,
        errors: (validation.errors || []).length,
        warnings: (validation.warnings || []).length,
        message: "La carga tiene errores y no fue guardada."
      });
    }

    if(!periodValid(periodoInfo)){
      return Promise.resolve({
        ok: false,
        saved: 0,
        updated: 0,
        merged: 0,
        total: normalized.total || rows.length || 0,
        errors: 1,
        warnings: (validation.warnings || []).length,
        message: "No se puede guardar: primero selecciona un período."
      });
    }

    if(!window.BDLRepoEstudiantes){
      return Promise.reject(new Error("BDLRepoEstudiantes no está disponible."));
    }

    var preparedRows = rows.map(function(row){
      return injectPeriod(row, periodoInfo);
    });

    emit("bdlocal:carga-save-start", {
      total: preparedRows.length,
      periodoId: periodoInfo.periodoId,
      periodoLabel: periodoInfo.periodoLabel,
      at: new Date().toISOString()
    });

    return window.BDLRepoEstudiantes.guardarMuchos(preparedRows, periodoInfo, {
      source: "carga_excel",
      fileName: normalized.fileName || "",
      origen: normalized.origen || "",
      sync: options.sync !== false
    }).then(function(result){
      result = result || {};

      var tasks = [];

      if(window.BDLRepoCarreras && typeof window.BDLRepoCarreras.guardarDesdeEstudiantes === "function"){
        tasks.push(window.BDLRepoCarreras.guardarDesdeEstudiantes(preparedRows).catch(function(error){
          console.warn("[CargaSave] No se pudo actualizar carreras", error);
          return null;
        }));
      }

      if(window.BDLRepoRequisitos && typeof window.BDLRepoRequisitos.guardarCatalogo === "function"){
        tasks.push(window.BDLRepoRequisitos.guardarCatalogo().catch(function(error){
          console.warn("[CargaSave] No se pudo actualizar catálogo de requisitos", error);
          return null;
        }));
      }

      if(window.BDLRepoDashboard && typeof window.BDLRepoDashboard.recalcularBasico === "function"){
        tasks.push(window.BDLRepoDashboard.recalcularBasico(periodoInfo.periodoId).catch(function(error){
          console.warn("[CargaSave] No se pudo recalcular dashboard", error);
          return null;
        }));
      }

      return Promise.all(tasks).then(function(){
        var finalResult = Object.assign({
          ok: true,
          periodoId: periodoInfo.periodoId,
          periodoLabel: periodoInfo.periodoLabel
        }, result);

        enqueueSyncHint(finalResult, periodoInfo);

        emit("bdlocal:carga-save-finish", {
          ok: true,
          total: finalResult.total || preparedRows.length,
          saved: finalResult.saved || 0,
          updated: finalResult.updated || 0,
          merged: finalResult.merged || 0,
          errors: finalResult.errors || 0,
          changes: Array.isArray(finalResult.changes) ? finalResult.changes.length : 0,
          periodoId: periodoInfo.periodoId,
          periodoLabel: periodoInfo.periodoLabel,
          at: new Date().toISOString()
        });

        return finalResult;
      });
    }).catch(function(error){
      emit("bdlocal:carga-save-error", {
        ok: false,
        error: error && error.message ? error.message : String(error),
        periodoId: periodoInfo.periodoId,
        at: new Date().toISOString()
      });
      throw error;
    });
  }

  window.CargaSave = {
    save: save
  };
})(window);