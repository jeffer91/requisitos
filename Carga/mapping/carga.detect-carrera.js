(function(window){
  "use strict";

  function detect(rows){
    var T = window.BDLNormText;
    var C = window.BDLNormCarrera;
    var counts = {};
    (Array.isArray(rows) ? rows : []).forEach(function(row){
      var raw = T ? T.first(row, ["nombreCarrera", "NombreCarrera", "carrera", "Carrera", "programa", "Programa"]) : "";
      var code = T ? T.first(row, ["codigoCarrera", "CodigoCarrera", "CódigoCarrera", "codCarrera", "CodCarrera"]) : "";
      var info = C ? C.normalize(raw, code) : { nombre:T ? T.upper(raw) : String(raw || "") };
      if(info.nombre){ counts[info.nombre] = (counts[info.nombre] || 0) + 1; }
    });
    return counts;
  }

  window.CargaDetectCarrera = { detect: detect };
})(window);