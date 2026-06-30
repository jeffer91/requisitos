(function(window){
  "use strict";

  var T = window.BDLNormText;
  if(!T){ throw new Error("BDLNormText debe cargarse antes de BDLNormNota."); }

  var notas = [
    { tipoNota: "final", campos: ["Notafinal", "notaFinal", "NotaFinal", "final", "Final"] },
    { tipoNota: "articulo", campos: ["Notart", "notaArticulo", "NotaArticulo", "articulo", "Articulo", "Artículo"] },
    { tipoNota: "defensa", campos: ["Notdef", "notaDefensa", "NotaDefensa", "defensa", "Defensa"] }
  ];

  function estado(valor){
    if(valor == null){ return "SIN_NOTA"; }
    return valor >= 7 ? "APROBADO" : "REPROBADO";
  }

  function registros(row, idEstudiantePeriodo, periodoId, numeroIdentificacion){
    var now = new Date().toISOString();
    var result = [];
    notas.forEach(function(nota){
      var raw = T.first(row, nota.campos);
      if(T.text(raw) === ""){ return; }
      var valor = T.number(raw);
      result.push({
        idNota: idEstudiantePeriodo + "__" + nota.tipoNota,
        idEstudiantePeriodo: idEstudiantePeriodo,
        periodoId: periodoId,
        numeroIdentificacion: numeroIdentificacion,
        tipoNota: nota.tipoNota,
        valor: valor,
        valorOriginal: T.text(raw),
        estado: estado(valor),
        observacion: valor == null ? "Nota no numérica" : "",
        updatedAt: now,
        syncStatus: "sincronizado"
      });
    });
    return result;
  }

  window.BDLNormNota = {
    registros: registros,
    estado: estado
  };
})(window);
