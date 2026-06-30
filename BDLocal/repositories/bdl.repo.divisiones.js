(function(window){
  "use strict";

  var B = window.BDLRepoBase;
  var T = window.BDLNormText;
  if(!B || !T){ throw new Error("BDLRepoDivisiones requiere BDLRepoBase y BDLNormText."); }

  function guardarMuchos(rows){
    return B.putAll(B.stores.estudianteDivisiones, rows);
  }

  function porEstudiante(idEstudiantePeriodo){
    return B.byIndex(B.stores.estudianteDivisiones, "by_idEstudiantePeriodo", idEstudiantePeriodo, { limit: 0 });
  }

  function porPeriodo(periodoId){
    return B.byIndex(B.stores.estudianteDivisiones, "by_periodoId", periodoId, { limit: 0 });
  }

  function porPeriodoDivision(periodoId, divisionKey){
    return B.byIndex(B.stores.estudianteDivisiones, "by_periodo_division", [periodoId, divisionKey], { limit: 0 });
  }

  function normCedula(value){ return String(value == null ? "" : value).replace(/[^0-9]/g, ""); }
  function label(num){ return String(num).padStart(2, "0"); }
  function carreraKey(row){ return T.key(row.nombreCarrera || row.NombreCarrera || row.carrera || row.Carrera || "SIN_CARRERA"); }
  function carreraLabel(row){ return T.cleanSpaces(row.nombreCarrera || row.NombreCarrera || row.carrera || row.Carrera || "Sin carrera"); }

  function divisionRow(student, division){
    var id = student.idEstudiantePeriodo || (student.periodoId + "__" + student.numeroIdentificacion);
    return {
      id: id + "__principal",
      idEstudiantePeriodo: id,
      periodoId: student.periodoId,
      numeroIdentificacion: student.numeroIdentificacion || student.cedula || student.Cedula || "",
      division: division,
      divisionKey: T.key(division),
      esPrincipal: true,
      actualizadaEn: B.now()
    };
  }

  function updateStudent(student, division){
    var resumen = Object.assign({}, student || {});
    var id = resumen.idEstudiantePeriodo;
    resumen.divisionPrincipal = division;
    resumen.division = division;
    resumen.Division = division;
    resumen.divisiones = [division];
    resumen.actualizadoEn = B.now();
    return B.put(B.stores.estudiantesResumen, resumen).then(function(){
      return B.get(B.stores.estudiantesDetalle, id).then(function(detalle){
        if(!detalle){ return null; }
        detalle = Object.assign({}, detalle, { divisionPrincipal: division, division: division, Division: division, divisiones: [division], actualizadoEn: B.now() });
        return B.put(B.stores.estudiantesDetalle, detalle);
      });
    }).then(function(){
      return B.put(B.stores.estudianteDivisiones, divisionRow(resumen, division));
    });
  }

  function aplicarAsignaciones(periodoId, asignaciones){
    asignaciones = asignaciones || [];
    var byCedula = {};
    var byId = {};
    asignaciones.forEach(function(item){
      var division = T.cleanSpaces(item.division || item.nombre || "");
      if(!division){ return; }
      if(item.idEstudiantePeriodo){ byId[String(item.idEstudiantePeriodo)] = division; }
      var ced = normCedula(item.cedula || item.numeroIdentificacion || item.identificacion || "");
      if(ced){ byCedula[ced] = division; }
    });
    return B.byIndex(B.stores.estudiantesResumen, "by_periodoId", periodoId, { limit: 0 }).then(function(students){
      var updated = 0;
      var chain = Promise.resolve();
      students.forEach(function(student){
        var division = byId[student.idEstudiantePeriodo] || byCedula[normCedula(student.numeroIdentificacion || student.cedula || student.Cedula)];
        if(!division){ return; }
        chain = chain.then(function(){ return updateStudent(student, division).then(function(){ updated += 1; }); });
      });
      return chain.then(function(){
        B.cacheClear();
        if(window.BDLRepoEstudiantes && window.BDLRepoEstudiantes.mirrorSnapshot){ window.BDLRepoEstudiantes.mirrorSnapshot(); }
        return { ok:true, updated: updated, total: asignaciones.length };
      });
    });
  }

  function generarAutomaticas(periodoId, options){
    options = options || {};
    var tamano = Math.max(1, Number(options.tamano || 30));
    var prefijo = T.cleanSpaces(options.prefijo || "DIV");
    var porCarrera = options.porCarrera !== false;
    return B.byIndex(B.stores.estudiantesResumen, "by_periodoId", periodoId, { limit: 0 }).then(function(students){
      var groups = {};
      students.forEach(function(student){
        var key = porCarrera ? carreraKey(student) : "GENERAL";
        if(!groups[key]){ groups[key] = { label: porCarrera ? carreraLabel(student) : "General", rows: [] }; }
        groups[key].rows.push(student);
      });
      var asignaciones = [];
      Object.keys(groups).sort().forEach(function(key){
        var group = groups[key];
        group.rows.sort(function(a,b){ return String(a.nombres || "").localeCompare(String(b.nombres || ""), "es"); });
        group.rows.forEach(function(student, index){
          var n = Math.floor(index / tamano) + 1;
          var division = prefijo + "-" + label(n) + (porCarrera ? " · " + group.label : "");
          asignaciones.push({ idEstudiantePeriodo: student.idEstudiantePeriodo, division: division });
        });
      });
      return aplicarAsignaciones(periodoId, asignaciones).then(function(result){
        result.generated = asignaciones.length;
        return result;
      });
    });
  }

  window.BDLRepoDivisiones = {
    guardarMuchos: guardarMuchos,
    porEstudiante: porEstudiante,
    porPeriodo: porPeriodo,
    porPeriodoDivision: porPeriodoDivision,
    aplicarAsignaciones: aplicarAsignaciones,
    generarAutomaticas: generarAutomaticas
  };
})(window);
