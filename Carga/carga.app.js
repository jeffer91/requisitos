(function(window){
  "use strict";

  var cfg = window.CargaConfig;
  var state = window.CargaState;

  if(!cfg || !state){ throw new Error("CargaConfig y CargaState deben cargarse antes de CargaApp."); }

  function processRows(rows, options){
    options = options || {};
    state.setStatus(cfg.estados.mapping, "Normalizando datos");
    var normalized = window.CargaNormalizer.normalizeRows(rows, options);
    state.patch({ rows: rows, normalized: normalized });

    state.setStatus(cfg.estados.validating, "Validando datos");
    var validation = window.CargaValidator.validate(normalized);
    var preview = window.CargaPreview.build(normalized, validation);
    state.patch({ preview: preview.rows, errors: validation.errors, warnings: validation.warnings });
    state.setStatus(validation.ok ? cfg.estados.ready : cfg.estados.error, validation.ok ? "Carga lista" : "Carga con errores");
    return { normalized: normalized, validation: validation, preview: preview };
  }

  function readFile(file){
    state.reset();
    state.setStatus(cfg.estados.reading, "Leyendo archivo");
    return window.CargaReaderFile.read(file).then(function(result){
      state.patch({ origen: result.origen, fileName: result.fileName, rows: result.rows });
      return processRows(result.rows, result);
    });
  }

  function readClipboard(text){
    state.reset();
    state.setStatus(cfg.estados.reading, "Leyendo datos pegados");
    return window.CargaReaderClipboard.read(text).then(function(result){
      state.patch({ origen: result.origen, fileName: result.fileName, rows: result.rows });
      return processRows(result.rows, result);
    });
  }

  function save(options){
    var current = state.get();
    state.setStatus(cfg.estados.committing, "Guardando en BDLocal");
    return window.CargaSave.save(current.normalized, { errors: current.errors, warnings: current.warnings, ok: current.errors.length === 0 }, options || {}).then(function(result){
      var report = window.CargaReport.build(result, { errors: current.errors, warnings: current.warnings, ok: current.errors.length === 0, total: current.rows.length });
      state.patch({ lastResult: report });
      state.setStatus(report.ok ? cfg.estados.done : cfg.estados.error, report.ok ? "Carga guardada" : "Carga no guardada");
      return report;
    });
  }

  window.CargaApp = { processRows: processRows, readFile: readFile, readClipboard: readClipboard, save: save, state: state.get };
})(window);
