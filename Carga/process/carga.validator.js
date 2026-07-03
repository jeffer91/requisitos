/* =========================================================
Nombre completo: carga.validator.js
Ruta o ubicación: /Requisitos/Carga/process/carga.validator.js
Función o funciones:
- Validar la carga antes de guardar en Base Local.
- Exigir que exista un período seleccionado antes de cargar.
- Validar cédulas, nombres, carreras y divisiones con mensajes claros.
- Permitir duplicados dentro del mismo Excel, pero avisar que se fusionarán.
- Bloquear estudiantes sin período.
Con qué se conecta:
- carga.normalizer.js
- bdl.validator.estudiante.js
- bdl.norm.periodo.js
- bdl.norm.estudiante.js
- bdl.norm.carrera.js
- bdl.norm.division.js
========================================================= */
(function(window){
  "use strict";

  function text(value){
    return String(value == null ? "" : value).trim();
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

  function validate(normalized){
    normalized = normalized || {};

    var rows = Array.isArray(normalized.rowsMapeadas) ? normalized.rowsMapeadas : [];
    var errors = [];
    var warnings = [];
    var periodo = selectedPeriod(normalized);

    if(!rows.length){
      errors.push({
        row: 0,
        tipo: "SIN_REGISTROS",
        campo: "archivo",
        mensaje: "No se encontraron estudiantes para guardar."
      });
    }

    if(!periodValid(periodo)){
      errors.push({
        row: 0,
        tipo: "PERIODO_NO_SELECCIONADO",
        campo: "periodo",
        mensaje: "Primero selecciona un período. Luego carga el Excel. La Base Local no acepta estudiantes sin período."
      });
    }

    if(window.BDLValidatorEstudiante && typeof window.BDLValidatorEstudiante.validateRows === "function"){
      var result = window.BDLValidatorEstudiante.validateRows(rows, periodo);
      errors = errors.concat(result.errors || []);
      warnings = warnings.concat(result.warnings || []);

      return {
        ok: errors.length === 0,
        errors: errors,
        warnings: warnings,
        duplicates: result.duplicates || [],
        total: rows.length,
        periodo: periodo,
        preparedRows: result.preparedRows || rows,
        message: errors.length ? "La carga tiene errores y no puede guardarse." : "Carga validada correctamente."
      };
    }

    rows.forEach(function(row, index){
      var numero = window.BDLNormEstudiante && typeof window.BDLNormEstudiante.numero === "function"
        ? window.BDLNormEstudiante.numero(row)
        : text(row.numeroIdentificacion || row.cedula || row.Cedula || "");

      if(!numero || numero === "SIN_IDENTIFICACION"){
        errors.push({
          row: index + 1,
          tipo: "IDENTIFICACION_VACIA",
          campo: "numeroIdentificacion",
          mensaje: "Registro sin número de identificación."
        });
      }

      if(!row.nombreCarrera && !row.NombreCarrera && !row.carrera && !row.Carrera){
        warnings.push({
          row: index + 1,
          tipo: "CARRERA_VACIA",
          campo: "carrera",
          mensaje: "Registro sin carrera detectada."
        });
      }
    });

    return {
      ok: errors.length === 0,
      errors: errors,
      warnings: warnings,
      duplicates: [],
      total: rows.length,
      periodo: periodo,
      preparedRows: rows,
      message: errors.length ? "La carga tiene errores y no puede guardarse." : "Carga validada correctamente."
    };
  }

  window.CargaValidator = {
    validate: validate
  };
})(window);