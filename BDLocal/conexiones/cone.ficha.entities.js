/* =========================================================
Nombre completo: cone.ficha.entities.js
Ruta: /BDLocal/conexiones/cone.ficha.entities.js
Función:
- Extender ConFicha para distribuir ediciones entre entidades V2.
- Mantener compatibilidad con BL2Core y la interfaz existente.
- Actualizar personas/contactos, matrículas, requisitos y notas.
- Crear cambios Firebase específicos e historial por campo.
- No realizar sincronizaciones externas automáticamente.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-entity-writes";
  var api=window.ConFicha||window.BDLocalFicha||null;
  if(!api||api.__entityWritesInstalled){return;}

  var originalUpdate=api.updateStudent;
  var originalEnrollment=api.updateEnrollmentStatus;
  var originalModality=api.updateGraduationModality;

  var REQUIREMENTS=[
    "Academico","Documentacion","Financiero","Titulacion","PracticasVinculacion",
    "Vinculacion","SeguimientoGraduados","Ingles","ActualizacionDatos",
    "AprobacionTitulacion","AprobacionComplexivoProyecto"
  ];
  var CONTACT_FIELDS=[
    "CorreoPersonal","correoPersonal","CorreoInstitucional","correoInstitucional",
    "Celular","celular","telefono","telegramUser","telegramChatId","_telegramUser","_telegramChatId"
  ];
  var PERSON_FIELDS=[
    "Nombres","nombres","nombreCompleto","CorreoPersonal","correoPersonal",
    "CorreoInstitucional","correoInstitucional","Celular","celular","telefono",
    "telegramUser","telegramChatId","_telegramUser","_telegramChatId",
    "Sede","sede","CodigoCarrera","codigoCarrera","NombreCarrera","nombreCarrera"
  ];
  var ENROLLMENT_FIELDS=[
    "estadoMatricula","retirado","retiradoEn","reactivadoEn","estadoMatriculaActualizadaEn",
    "estadoMatriculaManual","estadoMatriculaManualActualizadaEn","estadoMatriculaManualOrigen",
    "division","divisiones","divisionActualizadaEn","modalidadTitulacion","modalidadTitulacionActualizadaEn",
    "Sede","sede","CodigoCarrera","codigoCarrera","NombreCarrera","nombreCarrera","HorarioComplexivo","horarioComplexivo"
  ];
  var NOTE_FIELDS=[
    "Notart","Nart","notart","notaArticulo","Notdef","Ndef","notdef","notaDefensa",
    "Notafinal","Nfinal","notafinal","notaFinal","notaTeorica","notaPractica","notaComplexivo",
    "notaTeoricaSupletorio","notaPracticaSupletorio","notaSupletorio","notaEscrito",
    "notaDefensaTrabajo","notaTrabajoTitulacion","notaOficial","estadoEvaluacion",
    "oportunidadAplicada","notaMinimaAprobacion","codigoTitulacion","horarioOrigen"
  ];

  function text(value){return String(value==null?"":value).trim();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"");}
  function now(){return new Date().toISOString();}
  function registry(){return window.BDLRepositories||null;}
  function repo(name,fallback){var current=registry();return current&&typeof current.get==="function"?(current.get(name)||fallback||null):(fallback||null);}
  function personRepo(){return repo("personas",window.BDLRepoPersonas);}
  function enrollmentRepo(){return repo("matriculas",window.BDLRepoMatriculas);}
  function requirementsRepo(){return repo("requisitos",window.BDLRepoRequisitos);}
  function notesRepo(){return repo("notas",window.BDLRepoNotas);}
  function contactsRepo(){return repo("contactos",window.BDLRepoContactos);}
  function changesRepo(){return repo("cambios_pendientes",window.BDLRepoCambios)||repo("cambios",window.BDLRepoCambios);}
  function logsRepo(){return repo("logs",window.BDLRepoLogs);}
  function has(list,field){var key=norm(field);return list.some(function(item){return norm(item)===key;});}
  function requirementName(field){var key=norm(field);return REQUIREMENTS.filter(function(item){return norm(item)===key;})[0]||"";}
  function identity(student,id,options){
    student=student||{};options=options||{};
    var utils=window.BDLocalConUtils||{};
    var cedula=typeof utils.normalizeCedula==="function"?utils.normalizeCedula(student.cedula||student.numeroIdentificacion||options.cedula||""):text(student.cedula||student.numeroIdentificacion||options.cedula);
    var periodoId=typeof utils.canonicalPeriodId==="function"?utils.canonicalPeriodId(student.periodoId||student.periodId||options.periodoId||options.periodId||""):text(student.periodoId||student.periodId||options.periodoId||options.periodId);
    var localId=text(student.idEstudiantePeriodo||student.studentId||student.id||id||(cedula&&periodoId?cedula+"__"+periodoId:""));
    return {cedula:cedula,periodoId:periodoId,localId:localId};
  }
  function currentStudent(id,options){
    if(typeof api.getStudentById==="function"){
      var found=api.getStudentById(id,Object.assign({matricula:""},options||{}));
      if(found){return found;}
    }
    return null;
  }
  function changedFields(before,changes){
    before=before||{};changes=changes||{};
    return Object.keys(changes).filter(function(field){return JSON.stringify(before[field])!==JSON.stringify(changes[field]);});
  }
  function patchFor(fields,changes){
    var patch={};
    Object.keys(changes||{}).forEach(function(field){if(has(fields,field)){patch[field]=clone(changes[field]);}});
    return patch;
  }
  function firebaseOnlyChange(table,identityData,payload,action,recordId){
    var current=changesRepo();
    if(!current||typeof current.save!=="function"){return Promise.reject(new Error("No se pudo preparar cambios_pendientes."));}
    return current.save({
      tabla:table,
      periodoId:identityData.periodoId||"global",
      cedula:identityData.cedula,
      registroId:text(recordId||identityData.localId||identityData.cedula),
      accion:text(action||"UPSERT").toUpperCase(),
      payload:clone(payload||{}),
      estadoSheets:"SINCRONIZADO",statusGoogle:"SINCRONIZADO",
      estadoSupabase:"SINCRONIZADO",statusSupabase:"SINCRONIZADO",
      estadoFirebase:"PENDIENTE",statusFirebase:"PENDIENTE",
      createdAt:now(),updatedAt:now()
    },{source:"cone.ficha.entities"});
  }
  function savePersonAndContact(before,changes,idData){
    var personPatch=patchFor(PERSON_FIELDS,changes);
    var contactPatch=patchFor(CONTACT_FIELDS,changes);
    if(!Object.keys(personPatch).length&&!Object.keys(contactPatch).length){return Promise.resolve([]);}
    var base=Object.assign({},before,personPatch,contactPatch,{cedula:idData.cedula,numeroIdentificacion:idData.cedula,periodoId:idData.periodoId,id:idData.localId,idEstudiantePeriodo:idData.localId,studentId:idData.localId,updatedAt:now()});
    var tasks=[];
    var pRepo=personRepo();
    if(Object.keys(personPatch).length&&pRepo&&typeof pRepo.save==="function"){tasks.push(pRepo.save(base));}
    var cRepo=contactsRepo();
    if(Object.keys(contactPatch).length&&cRepo&&typeof cRepo.save==="function"){tasks.push(cRepo.save(base,{writeLegacy:true}));}
    return Promise.all(tasks).then(function(){return firebaseOnlyChange("personas",idData,base,"UPSERT",idData.cedula);});
  }
  function saveEnrollment(before,changes,idData){
    var patch=patchFor(ENROLLMENT_FIELDS,changes);
    if(!Object.keys(patch).length){return Promise.resolve(null);}
    var current=enrollmentRepo();
    if(!current||typeof current.save!=="function"){return Promise.reject(new Error("Repositorio de matrículas no disponible."));}
    var row=Object.assign({},before,patch,{id:idData.localId,idEstudiantePeriodo:idData.localId,studentId:idData.localId,cedula:idData.cedula,numeroIdentificacion:idData.cedula,periodoId:idData.periodoId,periodId:idData.periodoId,updatedAt:now()});
    return current.save(row).then(function(saved){return firebaseOnlyChange("matriculas_periodo",idData,saved||row,"UPSERT",idData.localId);});
  }
  function saveRequirements(changes,idData){
    var current=requirementsRepo();
    var fields=Object.keys(changes||{}).map(function(field){return {field:field,name:requirementName(field)};}).filter(function(item){return !!item.name;});
    if(!fields.length){return Promise.resolve(null);}
    if(!current||typeof current.saveMany!=="function"){return Promise.reject(new Error("Repositorio de requisitos no disponible."));}
    var rows=fields.map(function(item){return {
      idEstudiantePeriodo:idData.localId,studentId:idData.localId,
      cedula:idData.cedula,numeroIdentificacion:idData.cedula,
      periodoId:idData.periodoId,periodId:idData.periodoId,
      requisitoKey:item.name,requirementKey:item.name,key:item.name,nombre:item.name,
      valor:changes[item.field],estado:changes[item.field],updatedAt:now()
    };});
    return current.saveMany(rows).then(function(){return firebaseOnlyChange("requisitos_estudiante",idData,{cedula:idData.cedula,periodoId:idData.periodoId,idEstudiantePeriodo:idData.localId,updatedAt:now()},"UPSERT",idData.localId);});
  }
  function saveNotes(before,changes,idData){
    var patch=patchFor(NOTE_FIELDS,changes);
    if(!Object.keys(patch).length){return Promise.resolve(null);}
    var current=notesRepo();
    if(!current||typeof current.save!=="function"){return Promise.reject(new Error("Repositorio de notas no disponible."));}
    var read=typeof current.getByPeriodoCedula==="function"?current.getByPeriodoCedula(idData.periodoId,idData.cedula):Promise.resolve(null);
    return Promise.resolve(read).then(function(existing){
      var row=Object.assign({},existing||{},before||{},patch,{id:idData.localId,idEstudiantePeriodo:idData.localId,studentId:idData.localId,cedula:idData.cedula,numeroIdentificacion:idData.cedula,periodoId:idData.periodoId,periodId:idData.periodoId,updatedAt:now()});
      return current.save(row).then(function(saved){return firebaseOnlyChange("notas_titulacion",idData,saved||row,"UPSERT",idData.localId);});
    });
  }
  function auditFields(before,changes,idData,options){
    var fields=changedFields(before,changes);
    if(!fields.length){return Promise.resolve([]);}
    var localLogs=logsRepo();
    var tasks=fields.map(function(field,index){
      var timestamp=now();
      var history={
        id:"historial__"+idData.localId+"__"+norm(field)+"__"+timestamp.replace(/[^0-9]/g,"")+"__"+index,
        entidad:requirementName(field)?"requisitos":has(NOTE_FIELDS,field)?"notas":has(ENROLLMENT_FIELDS,field)?"matriculas":"estudiantes",
        entidadId:has(PERSON_FIELDS,field)?idData.cedula:idData.localId,
        periodoId:idData.periodoId,
        cedula:idData.cedula,
        campo:field,
        anterior:before&&before[field]!==undefined?clone(before[field]):null,
        nuevo:clone(changes[field]),
        accion:text(options&&options.action||"ACTUALIZAR").toUpperCase(),
        usuario:text(options&&options.usuario||options&&options.user||""),
        pantalla:"Ficha",
        createdAt:timestamp,
        updatedAt:timestamp
      };
      var saveLog=localLogs&&typeof localLogs.save==="function"?localLogs.save({id:history.id,scope:"Ficha",level:"INFO",message:"Cambio de "+field,data:history,createdAt:timestamp,updatedAt:timestamp}):Promise.resolve(null);
      return Promise.resolve(saveLog).then(function(){return firebaseOnlyChange("historial",idData,history,"UPSERT",history.id);});
    });
    return Promise.all(tasks);
  }
  function distribute(before,changes,idData,options){
    return Promise.all([
      savePersonAndContact(before,changes,idData),
      saveEnrollment(before,changes,idData),
      saveRequirements(changes,idData),
      saveNotes(before,changes,idData),
      auditFields(before,changes,idData,options)
    ]);
  }
  function updateStudentByEntity(id,changes,options){
    options=Object.assign({},options||{});changes=Object.assign({},changes||{});
    var before=currentStudent(id,options)||{};
    var idData=identity(before,id,options);
    if(!idData.cedula||!idData.periodoId){return Promise.reject(new Error("Ficha no pudo identificar cédula y período."));}
    if(typeof originalUpdate!=="function"){return Promise.reject(new Error("ConFicha.updateStudent original no está disponible."));}
    return Promise.resolve(originalUpdate.call(api,id,changes,options)).then(function(saved){
      return distribute(before,changes,idData,options).then(function(){
        try{window.dispatchEvent(new CustomEvent("ficha:entity-writes-saved",{detail:{ok:true,id:idData.localId,cedula:idData.cedula,periodoId:idData.periodoId,fields:Object.keys(changes),at:now()}}));}catch(error){}
        return saved;
      });
    });
  }
  function wrapSpecial(original,action){
    return function(id,value,options){
      options=Object.assign({},options||{});var before=currentStudent(id,options)||{};
      if(typeof original!=="function"){return Promise.reject(new Error("Editor de Ficha no disponible."));}
      return Promise.resolve(original.call(api,id,value,options)).then(function(result){
        var student=result&&result.student||currentStudent(id,options)||{};
        var idData=identity(student,id,options);
        var changes={};
        if(action==="matricula"){
          ["estadoMatricula","retirado","retiradoEn","reactivadoEn","estadoMatriculaActualizadaEn"].forEach(function(field){if(student[field]!==undefined){changes[field]=student[field];}});
        }else{
          changes.modalidadTitulacion=result&&result.value||student.modalidadTitulacion;
          changes.modalidadTitulacionActualizadaEn=student.modalidadTitulacionActualizadaEn||now();
        }
        return distribute(before,changes,idData,options).then(function(){return result;});
      });
    };
  }

  api.updateStudent=updateStudentByEntity;
  api.actualizarEstudiante=updateStudentByEntity;
  api.updateStudentField=function(id,field,value,options){var changes={};changes[field]=value;return updateStudentByEntity(id,changes,options||{});};
  api.updateEnrollmentStatus=wrapSpecial(originalEnrollment,"matricula");
  api.updateGraduationModality=wrapSpecial(originalModality,"modalidad");
  api.entityWriteStatus=function(){return {version:VERSION,installed:true,manualOnly:true,history:true};};
  api.__entityWritesInstalled=true;

  if(window.BL2ScreenAdapter){
    window.BL2ScreenAdapter.updateStudent=updateStudentByEntity;
    window.BL2ScreenAdapter.updateStudentField=api.updateStudentField;
    window.BL2ScreenAdapter.updateEnrollmentStatus=api.updateEnrollmentStatus;
    window.BL2ScreenAdapter.updateGraduationModality=api.updateGraduationModality;
  }
  window.ConFichaEntities={version:VERSION,install:function(){return true;},updateStudent:updateStudentByEntity,distribute:distribute,status:api.entityWriteStatus};
})(window);
