/* =========================================================
Nombre completo: bdl.service.ncomplex.js
Ruta: /BDLocal/services/bdl.service.ncomplex.js
Función:
- Unir estudiantes, períodos y evaluaciones de titulación.
- Entregar filtros, paginación y resúmenes a la pantalla Ncomplex.
- Guardar evaluaciones y registrar cambios_pendientes.
- Cambiar la modalidad sin borrar notas de la modalidad anterior.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-ncomplex";
  var Services=window.BDLServices;
  if(!Services){return;}

  function text(value){return String(value==null?"":value).trim();}
  function norm(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();
  }
  function rules(){return window.BDLRulesEvaluacionesTitulacion||null;}
  function evaluationRepo(){return window.BDLRepoEvaluacionesTitulacion||Services.repo("evaluaciones_titulacion")||Services.repo("ncomplex");}
  function importsRepo(){return window.BDLRepoImportaciones||Services.repo("importaciones");}
  function changesRepo(){return window.BDLRepoCambios||Services.repo("cambios_pendientes")||Services.repo("cambios");}
  function studentsService(){return Services.get("estudiantes");}
  function periodsService(){return Services.get("periodos");}

  function studentPeriodId(periodoId,cedula){
    var helper=rules();
    return helper&&typeof helper.makeId==="function"
      ? helper.makeId(periodoId,cedula)
      : text(cedula)+"__"+text(periodoId);
  }

  function studentCedula(row){
    var helper=rules();
    var value=row&&(row.cedula||row.numeroIdentificacion||row.NumeroIdentificacion||row._cedula);
    return helper&&typeof helper.normalizeCedula==="function"?helper.normalizeCedula(value):text(value);
  }

  function studentPeriod(row){
    var helper=rules();
    var value=row&&(row.periodoId||row.periodId||row.periodoCanonicoId||row.ultimoPeriodoId||row._periodoId);
    return helper&&typeof helper.canonicalPeriodId==="function"?helper.canonicalPeriodId(value):text(value);
  }

  function studentCareer(row){
    return text(row&&(row.NombreCarrera||row.nombreCarrera||row.Carrera||row.carrera||row._carrera));
  }

  function studentName(row){
    return text(row&&(row.Nombres||row.nombres||row.Nombre||row.nombre||row.nombreCompleto||row.Estudiante));
  }

  function baseEvaluation(student,options){
    var helper=rules();
    var payload={
      periodoId:studentPeriod(student)||text(options&&options.periodoId),
      cedula:studentCedula(student),
      modalidadTitulacion:student&&student.modalidadTitulacion,
      origen:"ncomplex"
    };
    return helper&&typeof helper.build==="function"?helper.build(payload,options||{}):payload;
  }

  function mergeStudentEvaluation(student,evaluation,options){
    var base=Object.assign({},student||{});
    var current=evaluation||baseEvaluation(student,options||{});
    var id=studentPeriodId(studentPeriod(student),studentCedula(student));
    return Object.assign({},base,current,{
      id:id||current.id,
      studentId:id||current.studentId,
      idEstudiantePeriodo:id||current.idEstudiantePeriodo,
      periodoId:studentPeriod(student)||current.periodoId,
      cedula:studentCedula(student)||current.cedula,
      Nombres:studentName(student),
      nombres:studentName(student),
      NombreCarrera:studentCareer(student),
      carrera:studentCareer(student),
      CodigoCarrera:text(student&&(student.CodigoCarrera||student.codigoCarrera)),
      estadoMatricula:text(student&&(student.estadoMatricula||student._estadoMatricula||"ACTIVO")).toUpperCase(),
      HorarioComplexivo:text(student&&(student.HorarioComplexivo||student.horarioComplexivo||student.Horario||current.horarioOrigen)),
      _ncomplexHasSavedEvaluation:!!evaluation,
      _ncomplexEvaluation:current
    });
  }

  function loadStudents(options){
    var service=studentsService();
    options=options||{};
    if(service&&typeof service.list==="function"){
      return service.list({
        periodoId:options.periodoId||options.periodId||"",
        matricula:options.matricula||options.estadoMatricula||""
      }).then(function(rows){return Array.isArray(rows)?rows:[];});
    }
    return Services.getStudents(options).then(function(rows){return Array.isArray(rows)?rows:[];});
  }

  function loadEvaluations(options){
    var repo=evaluationRepo();
    return repo&&typeof repo.list==="function"?repo.list(options||{}):Promise.resolve([]);
  }

  function applyFilters(rows,options){
    options=options||{};
    var carrera=norm(options.carrera||options.NombreCarrera||"");
    var modalidad=text(options.modalidadTitulacion||options.modalidad||"");
    var helper=rules();
    if(modalidad&&helper&&typeof helper.modality==="function"){modalidad=helper.modality(modalidad);}
    var estado=text(options.estadoEvaluacion||options.estado||"").toUpperCase();
    var matricula=text(options.estadoMatricula||options.matricula||"").toUpperCase();
    var search=norm(options.search||options.busqueda||options.query||"");
    var soloFaltantes=options.soloFaltantes===true||text(options.soloFaltantes).toLowerCase()==="true";

    return (Array.isArray(rows)?rows:[]).filter(function(row){
      if(carrera&&norm(studentCareer(row)).indexOf(carrera)<0){return false;}
      if(modalidad&&text(row.modalidadTitulacion)!==modalidad){return false;}
      if(estado&&text(row.estadoEvaluacion).toUpperCase()!==estado){return false;}
      if(matricula&&matricula!=="TODOS"&&matricula!=="TODO"&&text(row.estadoMatricula).toUpperCase()!==matricula){return false;}
      if(soloFaltantes&&["SIN_NOTAS","INCOMPLETO"].indexOf(text(row.estadoEvaluacion).toUpperCase())<0){return false;}
      if(search){
        var hay=norm([row.cedula,row.numeroIdentificacion,row.Nombres,row.nombres,row.NombreCarrera,row.CodigoCarrera,row.HorarioComplexivo].join(" "));
        if(hay.indexOf(search)<0){return false;}
      }
      return true;
    });
  }

  function list(options){
    options=options||{};
    return Promise.all([loadStudents(options),loadEvaluations(options)]).then(function(result){
      var students=result[0]||[];
      var evaluations=result[1]||[];
      var map=Object.create(null);
      evaluations.forEach(function(row){
        var key=studentPeriodId(row.periodoId,row.cedula)||text(row.idEstudiantePeriodo||row.id);
        if(key){map[key]=row;}
      });
      var rows=students.map(function(student){
        var key=studentPeriodId(studentPeriod(student),studentCedula(student));
        return mergeStudentEvaluation(student,map[key]||null,options);
      });
      return applyFilters(rows,options).sort(function(a,b){
        var career=norm(studentCareer(a)).localeCompare(norm(studentCareer(b)));
        return career||norm(studentName(a)).localeCompare(norm(studentName(b)));
      });
    });
  }

  function getPage(options){
    options=Object.assign({page:1,limit:25},options||{});
    return list(options).then(function(rows){
      var page=Services.paginate(rows,options);
      page.source="bdl.service.ncomplex";
      return page;
    });
  }

  function getByPeriodoCedula(periodoId,cedula){
    var repo=evaluationRepo();
    return repo&&typeof repo.getByPeriodoCedula==="function"
      ? repo.getByPeriodoCedula(periodoId,cedula)
      : Promise.resolve(null);
  }

  function changeFromEvaluation(evaluation){
    return {
      periodoId:evaluation.periodoId,
      cedula:evaluation.cedula,
      tabla:"evaluaciones_titulacion",
      tipo:"evaluaciones_titulacion",
      registroId:evaluation.idEstudiantePeriodo,
      accion:"UPSERT",
      payload:evaluation,
      prioridad:1,
      estadoSheets:"PENDIENTE",
      estadoFirebase:"PENDIENTE",
      estadoSupabase:"PENDIENTE",
      source:"ncomplex",
      origen:"ncomplex"
    };
  }

  function notifySaved(saved,count){
    try{
      window.dispatchEvent(new CustomEvent("bdlocal:ncomplex-saved",{
        detail:{periodoId:saved&&saved.periodoId||"",cedula:saved&&saved.cedula||"",saved:Number(count||1)}
      }));
    }catch(error){}
  }

  function saveEvaluation(row,context){
    var repo=evaluationRepo();
    var changes=changesRepo();
    if(!repo||typeof repo.save!=="function"){return Promise.reject(new Error("Repositorio evaluaciones_titulacion no disponible."));}
    if(!changes||typeof changes.save!=="function"){return Promise.reject(new Error("Repositorio cambios_pendientes no disponible."));}
    return repo.save(row,context||{}).then(function(saved){
      return changes.save(changeFromEvaluation(saved),{source:"ncomplex"}).then(function(){
        notifySaved(saved,1);
        return saved;
      });
    });
  }

  function saveMany(rows,context){
    rows=Array.isArray(rows)?rows:[];
    var repo=evaluationRepo();
    var changes=changesRepo();
    if(!repo||typeof repo.saveMany!=="function"){return Promise.reject(new Error("Repositorio evaluaciones_titulacion no disponible."));}
    if(!changes||typeof changes.saveMany!=="function"){return Promise.reject(new Error("Repositorio cambios_pendientes no disponible."));}
    return repo.saveMany(rows,context||{}).then(function(saved){
      return changes.saveMany(saved.map(changeFromEvaluation),{source:"ncomplex"}).then(function(){
        if(saved.length){notifySaved(saved[0],saved.length);}
        return saved;
      });
    });
  }

  function changeModality(periodoId,cedula,modalidad){
    var helper=rules();
    var normalized=helper&&helper.modality?helper.modality(modalidad):text(modalidad);
    return getByPeriodoCedula(periodoId,cedula).then(function(existing){
      return saveEvaluation(Object.assign({},existing||{}, {
        periodoId:periodoId,
        cedula:cedula,
        modalidadTitulacion:normalized,
        origen:"ncomplex_modalidad",
        updatedAt:new Date().toISOString()
      }),{origen:"ncomplex_modalidad"});
    });
  }

  function getSummary(options){
    return list(options||{}).then(function(rows){
      var summary={total:rows.length,examenComplexivo:0,trabajoTitulacion:0,completos:0,incompletos:0,sinNotas:0,aprobados:0,noAprobados:0,porCarrera:{}};
      rows.forEach(function(row){
        var mode=text(row.modalidadTitulacion);
        var state=text(row.estadoEvaluacion).toUpperCase();
        if(mode==="TRABAJO_TITULACION"){summary.trabajoTitulacion+=1;}else{summary.examenComplexivo+=1;}
        if(state==="SIN_NOTAS"){summary.sinNotas+=1;}
        else if(state==="INCOMPLETO"){summary.incompletos+=1;}
        else{summary.completos+=1;}
        if(state==="APROBADO"){summary.aprobados+=1;}
        if(state==="NO_APROBADO"){summary.noAprobados+=1;}
        var career=studentCareer(row)||"SIN CARRERA";
        if(!summary.porCarrera[career]){summary.porCarrera[career]={total:0,examenComplexivo:0,trabajoTitulacion:0,incompletos:0,sinNotas:0};}
        var item=summary.porCarrera[career];item.total+=1;
        if(mode==="TRABAJO_TITULACION"){item.trabajoTitulacion+=1;}else{item.examenComplexivo+=1;}
        if(state==="SIN_NOTAS"){item.sinNotas+=1;}else if(state==="INCOMPLETO"){item.incompletos+=1;}
      });
      return summary;
    });
  }

  function listPeriods(){
    var service=periodsService();
    if(service&&typeof service.list==="function"){return service.list();}
    return Services.getPeriods();
  }

  function saveImport(row){
    var repo=importsRepo();
    return repo&&typeof repo.save==="function"?repo.save(row):Promise.reject(new Error("Repositorio importaciones no disponible."));
  }

  function listImports(options){
    var repo=importsRepo();
    return repo&&typeof repo.list==="function"?repo.list(options||{}):Promise.resolve([]);
  }

  var api={
    version:VERSION,
    list:list,
    getPage:getPage,
    page:getPage,
    getSummary:getSummary,
    summary:getSummary,
    getByPeriodoCedula:getByPeriodoCedula,
    saveEvaluation:saveEvaluation,
    save:saveEvaluation,
    saveMany:saveMany,
    changeModality:changeModality,
    listPeriods:listPeriods,
    saveImport:saveImport,
    listImports:listImports,
    applyFilters:applyFilters,
    studentPeriodId:studentPeriodId
  };

  Services.register("ncomplex",api);
  Services.register("evaluaciones_titulacion",api);
  window.BDLServiceNcomplex=api;
})(window);
