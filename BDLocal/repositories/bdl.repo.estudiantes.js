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

  function pageOptions(options){
    options = options || {};
    var page = Math.max(1, Number(options.page || 1));
    var limit = options.limit === 0 ? 0 : Math.max(1, Number(options.limit || 100));
    return Object.assign({}, options, {
      page: page,
      limit: limit,
      offset: options.offset == null ? (page - 1) * (limit || 0) : Number(options.offset || 0)
    });
  }

  function withAliases(row){
    row = Object.assign({}, row || {});
    row.cedula = row.cedula || row.numeroIdentificacion || "";
    row.Cedula = row.Cedula || row.numeroIdentificacion || "";
    row.Nombres = row.Nombres || row.nombres || "";
    row.NombreCarrera = row.NombreCarrera || row.nombreCarrera || "";
    row.Carrera = row.Carrera || row.nombreCarrera || "";
    row.CodigoCarrera = row.CodigoCarrera || row.codigoCarrera || "";
    row.Sede = row.Sede || row.sede || "";
    row.Periodo = row.Periodo || row.periodoLabel || row.periodoId || "";
    row.periodo = row.periodo || row.periodoLabel || row.periodoId || "";
    row.periodoLabel = row.periodoLabel || row.periodoId || "";
    row.division = row.division || row.divisionPrincipal || "";
    row.Division = row.Division || row.divisionPrincipal || "";
    row.divisiones = Array.isArray(row.divisiones) ? row.divisiones : (row.divisionPrincipal ? [row.divisionPrincipal] : []);
    row.Academico = row.Academico || row.academico || "";
    row.Financiero = row.Financiero || row.financiero || "";
    row.Documentacion = row.Documentacion || row.documentacion || "";
    row.Titulacion = row.Titulacion || row.titulacion || "";
    row.Ingles = row.Ingles || row.ingles || "";
    row.ActualizacionDatos = row.ActualizacionDatos || row.actualizacionDatos || "";
    row.AprobacionTitulacion = row.AprobacionTitulacion || row.aprobacionTitulacion || "";
    row.AprobacionComplexivoProyecto = row.AprobacionComplexivoProyecto || row.aprobacionComplexivoProyecto || "";
    row.estado = row.estado || row.estadoGeneral || "";
    return row;
  }

  function mirrorSnapshot(){
    return Promise.all([
      B.list(B.stores.periodos, { limit: 0 }),
      B.list(B.stores.estudiantesResumen, { limit: 0 })
    ]).then(function(parts){
      var periods = (parts[0] || []).map(function(p){
        return Object.assign({}, p, {
          id: p.periodoId,
          value: p.periodoId,
          label: p.periodoLabel || p.periodoId
        });
      });
      var students = (parts[1] || []).map(withAliases);
      var snapshot = {
        meta: {
          app: "Requisitos",
          module: "BDLocal",
          source: "BDLRepoEstudiantes",
          updatedAt: B.now(),
          totalPeriods: periods.length,
          totalStudents: students.length
        },
        periods: periods,
        students: students,
        history: [],
        diagnostics: []
      };
      try{ window.localStorage.setItem("REQ_BDLOCAL_LEGACY_SNAPSHOT_V1", JSON.stringify(snapshot)); }catch(error){}
      try{ window.localStorage.setItem("REQ_EXCEL_LOCAL_V1:snapshot", JSON.stringify(snapshot)); }catch(error){}
      try{ window.dispatchEvent(new CustomEvent("bdlocal:legacy-snapshot", { detail: { totalStudents: students.length, totalPeriods: periods.length, at: B.now() } })); }catch(error){}
      return snapshot;
    });
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
    return chain.then(function(finalResult){
      return mirrorSnapshot().catch(function(error){
        console.warn("[BDLRepoEstudiantes] No se pudo crear snapshot legacy", error);
        return null;
      }).then(function(){ return finalResult; });
    });
  }

  function listarResumen(periodoId, options){
    options = pageOptions(options || {});
    if(periodoId){
      return B.byIndex(B.stores.estudiantesResumen, "by_periodoId", periodoId, options);
    }
    return B.list(B.stores.estudiantesResumen, options);
  }

  function contarPorPeriodo(periodoId){
    if(!periodoId){ return Promise.resolve(0); }
    return B.byIndex(B.stores.estudiantesResumen, "by_periodoId", periodoId, { limit: 0 }).then(function(rows){
      return rows.length;
    });
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
    contarPorPeriodo: contarPorPeriodo,
    obtenerResumen: obtenerResumen,
    obtenerDetalle: obtenerDetalle,
    mirrorSnapshot: mirrorSnapshot
  };
})(window);
