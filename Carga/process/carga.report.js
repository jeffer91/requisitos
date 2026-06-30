(function(window){
  "use strict";

  function build(result, validation){
    result = result || {};
    validation = validation || {};
    return {
      ok: !!result.ok && validation.ok !== false,
      total: result.total || validation.total || 0,
      guardados: result.saved || 0,
      errores: (validation.errors || []).length + Number(result.errors || 0),
      advertencias: (validation.warnings || []).length,
      detalle: {
        result: result,
        validation: validation
      },
      createdAt: new Date().toISOString()
    };
  }

  window.CargaReport = { build: build };
})(window);
