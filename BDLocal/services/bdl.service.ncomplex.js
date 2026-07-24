/* =========================================================
Nombre completo: bdl.service.ncomplex.js
Ruta: /BDLocal/services/bdl.service.ncomplex.js
Función:
- Unir estudiantes, períodos y evaluaciones de titulación.
- Entregar filtros, paginación y resúmenes a Ncomplex.
- Conservar evaluaciones_titulacion y espejarlas en notas_titulacion.
- Registrar cambios únicamente para Firebase e historial por campo.
- Cambiar modalidad sin borrar notas de la modalidad anterior.
========================================================= */
(function(window){
  "use strict";

  var VERSION="2.0.0-unified-notes-history";
  var Services=window.BDLServices;
  if(!Services){return;}

  var AUDIT_FIELDS=[
    "modalidadTitulacion","notaTeorica","notaPractica","notaComplexivo",
    "notaTeoricaSupletorio","notaPracticaSupletorio","notaSupletorio",
    "notaEscrito","notaDefensaTrabajo","notaTrabajoTitulacion","notaOficial",
    "estadoEvaluacion","oportunidadAplicada","notaMinimaAprobacion",
    "codigoTitulacion","horarioOrigen"
  ];

  function text(value){return String(value==null?"":value).trim();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();}
  function key(value){return norm(value).replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");}
  function now(){return new Date().toISOString();}
  function rules(){return window.BDLRulesEvaluacionesTitulacion||null;}
  function evaluationRepo(){return window.BDLRepoEvaluacionesTitulacion||Services.repo("evaluaciones_titulacion")||Services.repo("ncomplex");}
  function notesRepo(){return window.BDLRepoNotas||Services.repo("notas")||Services.repo("notas_titulacion");}
  function importsRepo(){return window.BDLRepoImportaciones||Services.repo("importaciones");}
  function changesRepo(){return Services.repo("cambios_pendientes")||window.BDLRepoCambios||Services.repo("cambios");}
  function logsRepo(){return window.BDLRepoLogs||Services.repo("logs");}
  function studentsService(){return Services.get("estudiantes");}
  function periodsService(){return Services.get("periodos");}

  function studentPeriodId(periodoId,cedula){
    var helper=rules();
    return helper&&typeof helper.makeId==="function"?helper.makeId(periodoId,cedula):text(cedula)+"__"+text(periodoId);
  }
  function studentCedula(row){
    var helper=rules(),value=row&&(row.cedula||row.numeroIdentificacion||row.NumeroIdentificacion||row._cedula);
    return helper&&typeof helper.normalizeCedula==="function"?helper.normalizeCedula(value):text(value);
  }
  function studentPeriod(row){
    var helper=rules(),value=row&&(row.periodoId||row.periodId||row.periodoCanonicoId||row.ultimoPeriodoId||row._periodoId);
    return helper&&typeof helper.canonicalPeriodId==="function"?helper.canonicalPeriodId(value):text(value);
  }
  function studentCareer(row){return text(row&&(row.NombreCarrera||row.nombreCarrera||row.Carrera||row.carrera||row._carrera));}
  function studentName(row){return text(row&&(row.Nombres||row.nombres||row.Nombre||row.nombre||row.nombreCompleto||row.Estudiante));}

  function baseEvaluation(student,options){
    var helper=rules();
    var payload={periodoId:studentPeriod(student)||text(options&&options.periodoId),cedula:studentCedula(student),modalidadTitulacion:student&&student.modalidadTitulacion,origen:"ncomplex"};
    return helper&&typeof helper.build==="function"?helper.build(payload,options||{}):payload;
  }
  function mergeStudentEvaluation(student,evaluation,options){
    var base=Object.assign({},student||{}),current=evaluation||baseEvaluation(student,options||{});
    var id=studentPeriodId(studentPeriod(student),studentCedula(student));
    return Object.assign({},base,current,{
      id:id||current.id,studentId:id||current.studentId,idEstudiantePeriodo:id||current.idEstudiantePeriodo,
      periodoId:studentPeriod(student)||current.periodoId,cedula:studentCedula(student)||current.cedula,
      Nombres:studentName(student),nombres:studentName(student),NombreCarrera:studentCareer(student),carrera:studentCareer(student),
      CodigoCarrera:text(student&&(student.CodigoCarrera||student.codigoCarrera)),
      estadoMatricula:text(student&&(student.estadoMatricula||student._estadoMatricula||"ACTIVO")).toUpperCase(),
      HorarioComplexivo:text(student&&(student.HorarioComplexivo||student.horarioComplexivo||student.Horario||current.horarioOrigen)),
      _ncomplexHasSavedEvaluation:!!evaluation,_ncomplexEvaluation:current
    });
  }
  function loadStudents(options){
    var service=studentsService();options=options||{};
    if(service&&typeof service.list==="function"){
      return service.list({periodoId:options.periodoId||options.periodId||"",matricula:options.matricula||options.estadoMatricula||""}).then(function(rows){return Array.isArray(rows)?rows:[];});
    }
    return Services.getStudents(options).then(function(rows){return Array.isArray(rows)?rows:[];});
  }
  function loadEvaluations(options){var repo=evaluationRepo();return repo&&typeof repo.list==="function"?repo.list(options||{}):Promise.resolve([]);}
  function applyFilters(rows,options){
    options=options||{};
    var carrera=norm(options.carrera||options.NombreCarrera||"");
    var modalidad=text(options.modalidadTitulacion||options.modalidad||"");
    var helper=rules();if(modalidad&&helper&&typeof helper.modality==="function"){modalidad=helper.modality(modalidad);}
    var estado=text(options.estadoEvaluacion||options.estado||"").toUpperCase();
    var matricula=text(options.estadoMatricula||options.matricula||"").toUpperCase();
    var search=norm(options.search||options.busqueda||options.query||"");
    var soloFaltantes=options.soloFaltantes===true||text(options.soloFaltantes).toLowerCase()==="true";
    return (Array.isArray(rows)?rows:[]).filter(function(row){
      if(row&&row.eliminado===true){return false;}
      if(carrera&&norm(studentCareer(row)).indexOf(carrera)<0){return false;}
      if(modalidad&&text(row.modalidadTitulacion)!==modalidad){return false;}
      if(estado&&text(row.estadoEvaluacion).toUpperCase()!==estado){return false;}
      if(matricula&&matricula!=="TODOS"&&matricula!=="TODO"&&text(row.estadoMatricula).toUpperCase()!==matricula){return false;}
      if(soloFaltantes&&["SIN_NOTAS","INCOMPLETO"].indexOf(text(row.estadoEvaluacion).toUpperCase())<0){return false;}
      if(search){var hay=norm([row.cedula,row.numeroIdentificacion,row.Nombres,row.nombres,row.NombreCarrera,row.CodigoCarrera,row.HorarioComplexivo].join(" "));if(hay.indexOf(search)<0){return false;}}
      return true;
    });
  }
  function list(options){
    options=options||{};
    return Promise.all([loadStudents(options),loadEvaluations(options)]).then(function(result){
      var students=result[0]||[],evaluations=result[1]||[],map=Object.create(null);
      evaluations.forEach(function(row){var id=studentPeriodId(row.periodoId,row.cedula)||text(row.idEstudiantePeriodo||row.id);if(id&&!row.eliminado){map[id]=row;}});
      return applyFilters(students.map(function(student){var id=studentPeriodId(studentPeriod(student),studentCedula(student));return mergeStudentEvaluation(student,map[id]||null,options);}),options)
        .sort(function(a,b){var career=norm(studentCareer(a)).localeCompare(norm(studentCareer(b)));return career||norm(studentName(a)).localeCompare(norm(studentName(b)));});
    });
  }
  function getPage(options){options=Object.assign({page:1,limit:25},options||{});return list(options).then(function(rows){var page=Services.paginate(rows,options);page.source="bdl.service.ncomplex";return page;});}
  function getByPeriodoCedula(periodoId,cedula){var repo=evaluationRepo();return repo&&typeof repo.getByPeriodoCedula==="function"?repo.getByPeriodoCedula(periodoId,cedula):Promise.resolve(null);}

  function firebaseOnlyChange(table,row,payload,recordId){
    var stamp=now();
    return {
      periodoId:text(row&&row.periodoId),cedula:text(row&&row.cedula),tabla:table,tipo:table,
      registroId:text(recordId||row&&row.idEstudiantePeriodo),accion:"UPSERT",payload:clone(payload),prioridad:1,
      estadoSheets:"SINCRONIZADO",statusGoogle:"SINCRONIZADO",
      estadoSupabase:"SINCRONIZADO",statusSupabase:"SINCRONIZADO",
      estadoFirebase:"PENDIENTE",statusFirebase:"PENDIENTE",
      source:"ncomplex",origen:"ncomplex",createdAt:stamp,updatedAt:stamp
    };
  }
  function changeFromEvaluation(evaluation){return firebaseOnlyChange("evaluaciones_titulacion",evaluation,evaluation,evaluation.idEstudiantePeriodo);}
  function noteMirror(evaluation){
    evaluation=Object.assign({},evaluation||{});
    var id=studentPeriodId(evaluation.periodoId,evaluation.cedula);
    return Object.assign({},evaluation,{
      id:id,notaId:id,idEstudiantePeriodo:id,studentId:id,
      periodoId:text(evaluation.periodoId),periodId:text(evaluation.periodoId),
      cedula:text(evaluation.cedula),numeroIdentificacion:text(evaluation.cedula),
      origen:"ncomplex",updatedAt:text(evaluation.updatedAt)||now()
    });
  }
  function changedFields(before,after){
    before=before||{};after=after||{};
    return AUDIT_FIELDS.filter(function(field){return JSON.stringify(before[field])!==JSON.stringify(after[field]);});
  }
  function historyItems(before,after,context){
    var stamp=now(),id=text(after.idEstudiantePeriodo||studentPeriodId(after.periodoId,after.cedula));
    return changedFields(before,after).map(function(field,index){
      var row={
        id:"historial__ncomplex__"+id+"__"+key(field)+"__"+stamp.replace(/[^0-9]/g,"")+"__"+index,
        entidad:"notas",entidadId:id,periodoId:after.periodoId,cedula:after.cedula,campo:field,
        anterior:before[field]!==undefined?clone(before[field]):null,nuevo:clone(after[field]),
        accion:"ACTUALIZAR_EVALUACION",usuario:text(context&&context.usuario||context&&context.user),
        pantalla:"Ncomplex",createdAt:stamp,updatedAt:stamp
      };
      return {row:row,change:firebaseOnlyChange("historial",after,row,row.id)};
    });
  }
  function persistAuxiliary(before,saved,context){
    var noteRepo=notesRepo(),changes=changesRepo(),logs=logsRepo();
    if(!noteRepo||typeof noteRepo.save!=="function"){return Promise.reject(new Error("Repositorio notas_titulacion no disponible."));}
    if(!changes||typeof changes.saveMany!=="function"){return Promise.reject(new Error("Repositorio cambios_pendientes no disponible."));}
    var histories=historyItems(before,saved,context),note=noteMirror(saved);
    var logTask=logs&&typeof logs.saveMany==="function"
      ? logs.saveMany(histories.map(function(item){return {id:item.row.id,scope:"Ncomplex",level:"INFO",message:"Cambio de "+item.row.campo,data:item.row,createdAt:item.row.createdAt,updatedAt:item.row.updatedAt};}))
      : Promise.resolve([]);
    return noteRepo.save(note).then(function(){return logTask;}).then(function(){
      return changes.saveMany([changeFromEvaluation(saved)].concat(histories.map(function(item){return item.change;})),{source:"ncomplex"});
    }).then(function(){return saved;});
  }
  function notifySaved(saved,count){try{window.dispatchEvent(new CustomEvent("bdlocal:ncomplex-saved",{detail:{periodoId:saved&&saved.periodoId||"",cedula:saved&&saved.cedula||"",saved:Number(count||1),history:true,notesMirror:true}}));}catch(error){}}
  function saveEvaluation(row,context){
    var current=evaluationRepo();context=context||{};
    if(!current||typeof current.save!=="function"){return Promise.reject(new Error("Repositorio evaluaciones_titulacion no disponible."));}
    var before=null;
    var periodoId=studentPeriod(row),cedula=studentCedula(row);
    return getByPeriodoCedula(periodoId,cedula).then(function(existing){before=existing||{};return current.save(row,context);})
      .then(function(saved){return persistAuxiliary(before,saved,context);})
      .then(function(saved){notifySaved(saved,1);return saved;});
  }
  function saveMany(rows,context){
    rows=Array.isArray(rows)?rows:[];var saved=[],chain=Promise.resolve();
    rows.forEach(function(row){chain=chain.then(function(){return saveEvaluation(row,context||{}).then(function(item){saved.push(item);});});});
    return chain.then(function(){if(saved.length){notifySaved(saved[0],saved.length);}return saved;});
  }
  function changeModality(periodoId,cedula,modalidad){
    var helper=rules(),normalized=helper&&helper.modality?helper.modality(modalidad):text(modalidad);
    return getByPeriodoCedula(periodoId,cedula).then(function(existing){return saveEvaluation(Object.assign({},existing||{},{periodoId:periodoId,cedula:cedula,modalidadTitulacion:normalized,origen:"ncomplex_modalidad",updatedAt:now()}),{origen:"ncomplex_modalidad"});});
  }
  function getSummary(options){
    return list(options||{}).then(function(rows){
      var summary={total:rows.length,examenComplexivo:0,trabajoTitulacion:0,completos:0,incompletos:0,sinNotas:0,aprobados:0,noAprobados:0,porCarrera:{}};
      rows.forEach(function(row){
        var mode=text(row.modalidadTitulacion),state=text(row.estadoEvaluacion).toUpperCase();
        if(mode==="TRABAJO_TITULACION"){summary.trabajoTitulacion+=1;}else{summary.examenComplexivo+=1;}
        if(state==="SIN_NOTAS"){summary.sinNotas+=1;}else if(state==="INCOMPLETO"){summary.incompletos+=1;}else{summary.completos+=1;}
        if(state==="APROBADO"){summary.aprobados+=1;}if(state==="NO_APROBADO"){summary.noAprobados+=1;}
        var career=studentCareer(row)||"SIN CARRERA";if(!summary.porCarrera[career]){summary.porCarrera[career]={total:0,examenComplexivo:0,trabajoTitulacion:0,incompletos:0,sinNotas:0};}
        var item=summary.porCarrera[career];item.total+=1;if(mode==="TRABAJO_TITULACION"){item.trabajoTitulacion+=1;}else{item.examenComplexivo+=1;}if(state==="SIN_NOTAS"){item.sinNotas+=1;}else if(state==="INCOMPLETO"){item.incompletos+=1;}
      });return summary;
    });
  }
  function listPeriods(){var service=periodsService();return service&&typeof service.list==="function"?service.list():Services.getPeriods();}
  function importChange(saved){return firebaseOnlyChange("importaciones",saved,saved,saved.id||saved.importacionId);}
  function saveImport(row){
    var repo=importsRepo(),changes=changesRepo();
    if(!repo||typeof repo.save!=="function"){return Promise.reject(new Error("Repositorio importaciones no disponible."));}
    if(!changes||typeof changes.save!=="function"){return Promise.reject(new Error("Repositorio cambios_pendientes no disponible."));}
    return repo.save(row).then(function(saved){return changes.save(importChange(saved),{source:"ncomplex_import"}).then(function(){return saved;});});
  }
  function listImports(options){var repo=importsRepo();return repo&&typeof repo.list==="function"?repo.list(options||{}):Promise.resolve([]);}

  var api={
    version:VERSION,list:list,getPage:getPage,page:getPage,getSummary:getSummary,summary:getSummary,
    getByPeriodoCedula:getByPeriodoCedula,saveEvaluation:saveEvaluation,save:saveEvaluation,
    saveMany:saveMany,changeModality:changeModality,listPeriods:listPeriods,
    saveImport:saveImport,listImports:listImports,applyFilters:applyFilters,
    studentPeriodId:studentPeriodId,noteMirror:noteMirror,changeFromEvaluation:changeFromEvaluation
  };
  Services.register("ncomplex",api);Services.register("evaluaciones_titulacion",api);window.BDLServiceNcomplex=api;
})(window);
