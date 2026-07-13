(function(window){
  "use strict";

  function build(normalized, validation, limit){
    normalized = normalized || {};
    limit = Number(limit || (window.CargaConfig && window.CargaConfig.maxPreviewRows) || 100);
    var rows = (normalized.rowsMapeadas || []).slice(0, limit);
    return {
      rows: rows,
      total: normalized.total || 0,
      showing: rows.length,
      periodoDetectado: normalized.periodoDetectado || null,
      validation: validation || null,
      carreraResumen: window.CargaDetectCarrera ? window.CargaDetectCarrera.detect(rows) : {},
      requisitosResumen: window.CargaDetectRequisitos ? window.CargaDetectRequisitos.detect(rows) : []
    };
  }

  window.CargaPreview = { build: build };
})(window);
