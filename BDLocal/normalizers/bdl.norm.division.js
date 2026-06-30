(function(window){
  "use strict";

  var T = window.BDLNormText;
  if(!T){ throw new Error("BDLNormText debe cargarse antes de BDLNormDivision."); }

  function parse(value){
    if(Array.isArray(value)){ return value.map(T.cleanSpaces).filter(Boolean); }
    return T.text(value).split(/[;,|]/).map(T.cleanSpaces).filter(Boolean);
  }

  function principal(row){
    return T.cleanSpaces(T.first(row, ["divisionPrincipal", "division", "Division", "división", "División"]));
  }

  function registros(row, idEstudiantePeriodo, periodoId, numeroIdentificacion){
    var main = principal(row);
    var values = parse(T.first(row, ["divisiones", "Divisiones"]));
    if(main && values.indexOf(main) < 0){ values.unshift(main); }
    if(!main && values.length){ main = values[0]; }
    return values.map(function(value, index){
      return {
        id: idEstudiantePeriodo + "__" + T.key(value),
        idEstudiantePeriodo: idEstudiantePeriodo,
        periodoId: periodoId,
        numeroIdentificacion: numeroIdentificacion,
        division: value,
        divisionKey: T.key(value),
        esPrincipal: index === 0 || value === main,
        actualizadaEn: new Date().toISOString()
      };
    });
  }

  window.BDLNormDivision = {
    parse: parse,
    principal: principal,
    registros: registros
  };
})(window);
