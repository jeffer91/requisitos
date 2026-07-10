(function(window){
  "use strict";

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function unique(values){
    var map = {};
    var out = [];
    (Array.isArray(values) ? values : []).forEach(function(value){
      var clean = text(value);
      var key = clean.toLowerCase();
      if(clean && !map[key]){
        map[key] = true;
        out.push(clean);
      }
    });
    return out;
  }

  function rowsFromState(state){
    state = state || {};
    var normalized = state.normalized || {};
    return Array.isArray(normalized.rowsMapeadas) ? normalized.rowsMapeadas : [];
  }

  function collectFields(rows){
    var fields = [];
    (Array.isArray(rows) ? rows : []).slice(0, 100).forEach(function(row){
      Object.keys(row || {}).forEach(function(key){ fields.push(key); });
    });
    return unique(fields).sort(function(a, b){ return a.localeCompare(b); });
  }

  function collectCareers(rows){
    return unique((Array.isArray(rows) ? rows : []).map(function(row){
      return row.nombreCarrera || row.NombreCarrera || row.Carrera || row.carrera || row.programa || "";
    })).sort(function(a, b){ return a.localeCompare(b); });
  }

  function collectRequirements(rows){
    if(window.CargaDetectRequisitos && typeof window.CargaDetectRequisitos.detect === "function"){
      return window.CargaDetectRequisitos.detect(rows).filter(function(item){ return !!item.detected; }).map(function(item){
        return item.campoFirebase || item.requisitoId || "";
      });
    }
    return [];
  }

  function build(result, validation, state){
    result = result || {};
    validation = validation || {};
    state = state || {};

    var normalized = state.normalized || {};
    var periodo = normalized.periodoDetectado || {};
    var rows = rowsFromState(state);
    var campos = collectFields(rows);
    var carreras = collectCareers(rows);
    var requisitos = unique(collectRequirements(rows));

    return {
      ok: !!result.ok && validation.ok !== false,
      total: result.total || validation.total || normalized.total || rows.length || 0,
      guardados: result.saved || 0,
      errores: (validation.errors || []).length + Number(result.errors || 0),
      advertencias: (validation.warnings || []).length,
      archivo: normalized.fileName || state.fileName || "",
      periodo: {
        id: periodo.periodoId || "",
        label: periodo.periodoLabel || periodo.periodoId || ""
      },
      campos: {
        total: campos.length,
        nombres: campos
      },
      carreras: {
        total: carreras.length,
        nombres: carreras
      },
      requisitos: {
        total: requisitos.length,
        nombres: requisitos
      },
      detalle: {
        result: result,
        validation: validation,
        normalized: normalized
      },
      createdAt: new Date().toISOString()
    };
  }

  window.CargaReport = { build: build };
})(window);
