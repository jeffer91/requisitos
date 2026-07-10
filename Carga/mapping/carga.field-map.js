(function(window){
  "use strict";

  var T = window.BDLNormText;
  if(!T){ throw new Error("BDLNormText debe cargarse antes de CargaFieldMap."); }

  var aliases = {
    numeroIdentificacion: ["numeroidentificacion", "identificacion", "cedula", "cédula", "documento", "id"],
    nombres: ["nombres", "nombre", "estudiante", "alumno"],
    periodoId: ["periodoid", "periodo", "periodolabel", "cohorte"],
    codigoCarrera: ["codigocarrera", "códigocarrera", "codcarrera"],
    nombreCarrera: ["nombrecarrera", "carrera", "programa"],
    sede: ["sede", "campus"],
    modalidad: ["modalidad", "tipomodalidad"],
    estadoMatricula: ["estadomatricula", "matriculaestado", "estado"],
    division: ["division", "división", "divisionprincipal"],
    divisiones: ["divisiones"],
    correoPersonal: ["correopersonal", "correo", "email"],
    correoInstitucional: ["correoinstitucional"],
    celular: ["celular", "telefono", "teléfono"],
    Notafinal: ["notafinal", "final", "notafinalcomplexivo"],
    Notart: ["notart", "notaarticulo", "articulo", "artículo"],
    Notdef: ["notdef", "notadefensa", "defensa"]
  };

  function canonicalField(field){
    var k = T.key(field);
    var found = "";
    Object.keys(aliases).some(function(target){
      if(aliases[target].indexOf(k) >= 0){ found = target; return true; }
      return false;
    });
    return found || field;
  }

  function mapRow(row){
    var out = {};
    Object.keys(row || {}).forEach(function(field){ out[canonicalField(field)] = row[field]; });
    return out;
  }

  function mapRows(rows){ return (Array.isArray(rows) ? rows : []).map(mapRow); }

  window.CargaFieldMap = { canonicalField: canonicalField, mapRow: mapRow, mapRows: mapRows, aliases: aliases };
})(window);
