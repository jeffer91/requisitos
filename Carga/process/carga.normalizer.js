(function(window){
  "use strict";

  function normalizeRows(rows, options){
    options = options || {};
    rows = Array.isArray(rows) ? rows : [];
    var mapped = window.CargaFieldMap ? window.CargaFieldMap.mapRows(rows) : rows;
    if(window.BDLNormCarrera){
      mapped = mapped.map(function(row){ return window.BDLNormCarrera.normalizeRow(row); });
    }
    var periodoDetectado = window.CargaDetectPeriodo ? window.CargaDetectPeriodo.detect(mapped, options.periodoId, options.periodoLabel) : { periodoId: options.periodoId || "SIN_PERIODO", periodoLabel: options.periodoLabel || options.periodoId || "Sin período" };
    var carrerasDetectadas = window.CargaDetectCarrera ? window.CargaDetectCarrera.detect(mapped) : {};
    var normalized = {
      origen: options.origen || "",
      detectedType: options.detectedType || "",
      fileName: options.fileName || "",
      periodoDetectado: periodoDetectado,
      carrerasDetectadas: carrerasDetectadas,
      rowsOriginales: rows,
      rowsMapeadas: mapped,
      total: mapped.length,
      createdAt: new Date().toISOString()
    };
    return normalized;
  }

  window.CargaNormalizer = { normalizeRows: normalizeRows };
})(window);