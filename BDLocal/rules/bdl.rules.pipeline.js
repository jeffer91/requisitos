/* =========================================================
Archivo: bdl.rules.pipeline.js
Ruta: /BDLocal/rules/bdl.rules.pipeline.js
Función:
- Definir pipelines reutilizables de reglas BDLocal.
- Preparar el flujo de importación sin activar todavía una migración obligatoria.
- Encadenar período, persona, matrícula, requisitos, notas, errores y sync.
Con qué se conecta:
- BDLocal/rules/bdl.rules.index.js
- BDLocal/services/bdl.service.index.js
========================================================= */
(function(window){
  "use strict";

  var Rules = window.BDLRules;
  if(!Rules){ return; }

  var IMPORT_ROW_STEPS = [
    "periodo.require",
    "persona.normalize",
    "matricula.normalize",
    "requisitos.extract",
    "notas.normalize"
  ];

  function normalizeImportRows(rows, context){
    rows = Array.isArray(rows) ? rows : [];
    return Rules.pipeline(IMPORT_ROW_STEPS, rows, context || {}).then(function(normalized){
      var duplicateResult = Rules.has("duplicados.merge") ? Rules.run("duplicados.merge", normalized, context || {}) : { rows: normalized, duplicated: [] };
      return Promise.resolve(duplicateResult).then(function(merged){
        var finalRows = Array.isArray(merged.rows) ? merged.rows : normalized;
        var errors = Rules.has("errors.collect") ? Rules.run("errors.collect", finalRows, context || {}) : [];
        return Promise.resolve(errors).then(function(errorRows){
          return {
            rows: finalRows,
            duplicated: merged.duplicated || [],
            totalDuplicated: merged.totalDuplicated || 0,
            errors: errorRows || [],
            steps: IMPORT_ROW_STEPS.slice()
          };
        });
      });
    });
  }

  function buildSyncChanges(rows, context){
    rows = Array.isArray(rows) ? rows : [];
    if(!Rules.has("sync.change")){ return Promise.resolve([]); }
    return Rules.run("sync.change", rows, context || {});
  }

  Rules.register("pipeline.import.rows", function(payload, context){
    return normalizeImportRows(payload, context || {});
  });

  Rules.register("pipeline.sync.changes", function(payload, context){
    return buildSyncChanges(payload, context || {});
  });

  window.BDLRulesPipeline = {
    importRowSteps: IMPORT_ROW_STEPS.slice(),
    normalizeImportRows: normalizeImportRows,
    buildSyncChanges: buildSyncChanges
  };
})(window);
