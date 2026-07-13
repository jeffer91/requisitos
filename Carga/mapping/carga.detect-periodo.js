(function(window){
  "use strict";

  function detect(rows, fallback, fallbackLabel){
    rows = Array.isArray(rows) ? rows : [];
    if(fallback){ return { periodoId: fallback, periodoLabel: fallbackLabel || fallback, counts: {} }; }
    var counts = {};
    rows.forEach(function(row){
      var p = window.BDLNormPeriodo ? window.BDLNormPeriodo.normalize(row || {}, fallback).periodoId : "SIN_PERIODO";
      counts[p] = (counts[p] || 0) + 1;
    });
    var best = Object.keys(counts).sort(function(a, b){ return counts[b] - counts[a]; })[0] || "SIN_PERIODO";
    return { periodoId: best, periodoLabel: best, counts: counts };
  }

  window.CargaDetectPeriodo = { detect: detect };
})(window);