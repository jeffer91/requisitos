/* =========================================================
Archivo: bdl.rules.errors.js
Ruta: /BDLocal/rules/bdl.rules.errors.js
Función:
- Convertir errores y advertencias de reglas en registros normalizados.
- Diferenciar errores bloqueantes de advertencias.
- Preparar la futura tabla errores_validacion.
Con qué se conecta:
- BDLocal/rules/bdl.rules.index.js
- BDLocal/diagnostics/bdl.diagnostics.index.js
========================================================= */
(function(window){
  "use strict";

  var Rules = window.BDLRules;
  if(!Rules){ return; }

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function makeError(options){
    options = options || {};
    return {
      errorId: "err_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      periodoId: text(options.periodoId || ""),
      cedula: text(options.cedula || ""),
      tipo: text(options.tipo || options.type || "VALIDACION"),
      nivel: text(options.nivel || options.level || "ADVERTENCIA").toUpperCase(),
      mensaje: text(options.mensaje || options.message || ""),
      campo: text(options.campo || options.field || ""),
      valorOriginal: options.valorOriginal === undefined ? "" : options.valorOriginal,
      origen: text(options.origen || options.source || "rules"),
      createdAt: new Date().toISOString()
    };
  }

  function collectFromRow(row){
    row = row || {};
    var errors = [];

    if(row._bdlPeriodoError){
      errors.push(makeError({ periodoId: row.periodoId, cedula: row.cedula, nivel: "ERROR", campo: "periodoId", mensaje: row._bdlPeriodoError }));
    }

    if(row._bdlPersona && row._bdlPersona._bdlPersonaError){
      errors.push(makeError({ periodoId: row.periodoId, cedula: row.cedula, nivel: "ERROR", campo: "cedula", mensaje: row._bdlPersona._bdlPersonaError }));
    }

    if(row._bdlMatricula && row._bdlMatricula._bdlMatriculaError){
      errors.push(makeError({ periodoId: row.periodoId, cedula: row.cedula, nivel: "ERROR", campo: "idEstudiantePeriodo", mensaje: row._bdlMatricula._bdlMatriculaError }));
    }

    if(row._bdlNotas && row._bdlNotas._bdlNotasError){
      errors.push(makeError({ periodoId: row.periodoId, cedula: row.cedula, nivel: "ADVERTENCIA", campo: "notas", mensaje: row._bdlNotas._bdlNotasError }));
    }

    return errors;
  }

  function apply(payload){
    if(Array.isArray(payload)){
      return payload.reduce(function(all, row){
        return all.concat(collectFromRow(row));
      }, []);
    }
    return collectFromRow(payload || {});
  }

  Rules.register("errors.collect", apply);

  window.BDLRulesErrors = {
    makeError: makeError,
    collectFromRow: collectFromRow,
    apply: apply
  };
})(window);
