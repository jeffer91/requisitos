(function(window){
  "use strict";

  function detect(rows){
    var fields = {};
    (Array.isArray(rows) ? rows : []).slice(0, 20).forEach(function(row){ Object.keys(row || {}).forEach(function(k){ fields[k] = true; }); });
    return {
      final: !!(fields.Notafinal || fields.notaFinal || fields.NotaFinal),
      articulo: !!(fields.Notart || fields.notaArticulo || fields.NotaArticulo),
      defensa: !!(fields.Notdef || fields.notaDefensa || fields.NotaDefensa)
    };
  }

  window.CargaDetectNotas = { detect: detect };
})(window);
