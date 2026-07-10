(function(window){
  "use strict";

  function detect(rows){
    var catalog = window.BDLNormRequisito ? window.BDLNormRequisito.catalogo() : [];
    var fields = {};
    (Array.isArray(rows) ? rows : []).slice(0, 20).forEach(function(row){
      Object.keys(row || {}).forEach(function(k){ fields[k] = true; });
    });
    return catalog.map(function(req){
      return { requisitoId: req.requisitoId, campoFirebase: req.campoFirebase, detected: !!fields[req.campoFirebase] || !!fields[req.requisitoId] };
    });
  }

  window.CargaDetectRequisitos = { detect: detect };
})(window);
