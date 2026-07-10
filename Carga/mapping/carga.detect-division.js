(function(window){
  "use strict";

  function detect(rows){
    var counts = {};
    var T = window.BDLNormText;
    (Array.isArray(rows) ? rows : []).forEach(function(row){
      var value = T ? T.cleanSpaces(T.first(row, ["divisionPrincipal", "division", "Division", "división", "División"])) : "";
      if(value){ counts[value] = (counts[value] || 0) + 1; }
    });
    return counts;
  }

  window.CargaDetectDivision = { detect: detect };
})(window);
