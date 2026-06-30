(function(window){
  "use strict";

  var B = window.BDLRepoBase;
  var E = window.BDLNormEstudiante;
  var R = window.BDLNormRequisito;
  var N = window.BDLNormNota;
  var D = window.BDLNormDivision;
  var X = window.BDLNormError;

  if(!B || !E || !R || !N || !D || !X){
    throw new Error("BDLRepoEstudiantes requiere normalizadores completos.");
  }

  function guardarRegistro(row, periodoInfo){
    var normalized = E.normalize(row, periodoInfo);
    var id = normalized.resumen.idEstudiantePeriodo;
    var numero = normalized.resumen.numeroIdentificacion;
    var periodoId = normalized.resumen.periodoId;
    var requisitos = R.registros(row, id, periodoId, numero);
    var notas = N.registros(row, id, periodoId, numero);
    var divisiones = D.registros(row, id, periodoId, numero);
    var errores = X.revisarBasicos(row, normalized.periodo, numero);

    return Promise.all([
      B.put(B.stores.periodos, normalized.periodo),
      B.put(B.stores.estudiantesPersona, normalized.persona),
      B.put(B.stores.estudiantesResumen, normalized.resumen),
      B.put(B.stores.estudiantesDetalle, normalized.detalle),
      B.putAll(B.stores.estudianteRequisitos, requisitos),
      B.putAll(B.stores.estudianteNotas, notas),
      B.putAll(B.stores.estudianteDivisiones, divisiones),
      B.putAll(B.stores.erroresDatos, errores)
    ]).then(function(){
      B.cacheClear();
      return { idEstudiantePeriodo: id, errores: errores.length };
    });
  }

  function guardarMuchos(rows, periodoInfo){
    rows = B.asArray(rows);
    var result = { saved: 0, errors: 0, total: rows.length };
    var chain = Promise.resolve(result);
    rows.forEach(function(row){
      chain = chain.then(function(){
        return guardarRegistro(row, periodoInfo).then(function(saved){
          result.saved += 1;
          result.errors += saved.errores || 0;
          return result;
        });
      });
    });
    return chain;
  }

  function listarResumen(periodoId, options){
    options = options || {};
    if(periodoId){
      return B.byIndex(B.stores.estudiantesResumen, "by_periodoId", periodoId, options);
    }
    return B.list(B.stores.estudiantesResumen, options);
  }

  function obtenerResumen(idEstudiantePeriodo){
    return B.get(B.stores.estudiantesResumen, idEstudiantePeriodo);
  }

  function obtenerDetalle(idEstudiantePeriodo){
    return Promise.all([
      B.get(B.stores.estudiantesResumen, idEstudiantePeriodo),
      B.get(B.stores.estudiantesDetalle, idEstudiantePeriodo),
      B.byIndex(B.stores.estudianteRequisitos, "by_idEstudiantePeriodo", idEstudiantePeriodo, { limit: 0 }),
      B.byIndex(B.stores.estudianteNotas, "by_idEstudiantePeriodo", idEstudiantePeriodo, { limit: 0 }),
      B.byIndex(B.stores.estudianteDivisiones, "by_idEstudiantePeriodo", idEstudiantePeriodo, { limit: 0 })
    ]).then(function(parts){
      return {
        resumen: parts[0] || null,
        detalle: parts[1] || null,
        requisitos: parts[2] || [],
        notas: parts[3] || [],
        divisiones: parts[4] || []
      };
    });
  }

  window.BDLRepoEstudiantes = {
    guardarRegistro: guardarRegistro,
    guardarMuchos: guardarMuchos,
    listarResumen: listarResumen,
    obtenerResumen: obtenerResumen,
    obtenerDetalle: obtenerDetalle
  };
})(window);
