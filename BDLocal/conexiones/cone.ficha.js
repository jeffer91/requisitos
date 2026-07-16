/* =========================================================
Nombre completo: cone.ficha.js
Ruta o ubicación: /BDLocal/conexiones/cone.ficha.js
Función o funciones:
- Conectar Ficha con la caché consolidada de BDLocal.
- Unir estudiantes con contactos legacy y contactos_estudiante V2.
- Priorizar los datos no vacíos de contactos_estudiante por idEstudiantePeriodo.
- Consultar estudiantes, períodos, divisiones y requisitos.
- Recuperar estudiantes desde BDLocal cuando la caché compartida está vacía.
- Cambiar ACTIVO/RETIRADO mediante updateEnrollmentStatus.
- Guardar la modalidad mediante updateGraduationModality.
- Guardar ediciones mediante BL2Core.updateStudent.
- Refrescar la caché después de cada edición sin sincronizar servicios externos automáticamente.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.4.0-ficha-empty-cache-recovery";
  var HUB=window.BDLocalConexiones;
  var U=window.BDLocalConUtils;
  var hydrationPromise=null;
  var readyPromise=null;

  var ENROLLMENT={active:"ACTIVO",retired:"RETIRADO"};
  var MODALITY={
    complexivo:"EXAMEN_COMPLEXIVO",
    trabajo:"TRABAJO_TITULACION",
    articulo:"ARTICULO_ACADEMICO"
  };

  if(!HUB||!U){return;}

  function text(value){return U.text?U.text(value):String(value==null?"":value).trim();}
  function now(){return U.nowISO?U.nowISO():new Date().toISOString();}
  function clone(value){return U.clone?U.clone(value):JSON.parse(JSON.stringify(value));}
  function norm(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toUpperCase();
  }
  function emit(name,detail){
    try{window.dispatchEvent(new CustomEvent(name,{detail:clone(detail||{})}));}catch(error){}
  }

  function first(){
    for(var i=0;i<arguments.length;i+=1){
      if(arguments[i]!==undefined&&arguments[i]!==null&&text(arguments[i])!==""){return arguments[i];}
    }
    return "";
  }

  function setFichaStatus(message,cls){
    try{
      var node=window.document&&window.document.getElementById("ficha-status");
      if(node){node.textContent=message;node.className="ficha-status "+(cls||"");}
    }catch(error){}
  }

  function storeNames(){
    var stores=window.BL2Config&&window.BL2Config.stores||{};
    return {
      legacy:stores.contactos||"contactos",
      v2:stores.contactosEstudiante||"contactos_estudiante",
      persons:stores.personas||"personas"
    };
  }

  function identityKey(row){
    row=row||{};
    var cedula=U.normalizeCedula(row.cedula||row.numeroIdentificacion||row.NumeroIdentificacion||row.Cedula||"");
    var periodoId=U.canonicalPeriodId(row.periodoId||row.periodId||row.ultimoPeriodoId||row.idPeriodo||row._periodoId||row._bl2PeriodoId||"");
    return text(row.idEstudiantePeriodo||row.studentId||row.id||row._id||(cedula&&periodoId?cedula+"__"+periodoId:""));
  }

  function normalizeContact(row){
    row=Object.assign({},row||{});
    var cedula=U.normalizeCedula(row.cedula||row.numeroIdentificacion||row.NumeroIdentificacion||row.Cedula||"");
    var periodoId=U.canonicalPeriodId(row.periodoId||row.periodId||row.ultimoPeriodoId||row.idPeriodo||row._periodoId||"");
    var id=text(row.idEstudiantePeriodo||row.studentId||row.id||(cedula&&periodoId?cedula+"__"+periodoId:""));
    var personal=text(first(row.CorreoPersonal,row.correoPersonal,row.correopersonal,row.emailPersonal));
    var institucional=text(first(row.CorreoInstitucional,row.correoInstitucional,row.correoinstitucional,row.emailInstitucional));
    var celular=text(first(row.Celular,row.celular,row.telefono,row.Telefono,row["Teléfono"],row.whatsapp,row.WhatsApp));
    var telegramUser=text(first(row.telegramUser,row._telegramUser,row.telegramUsername,row.usuarioTelegram,row.telegram)).replace(/^@+/,"");
    var telegramChatId=text(first(row.telegramChatId,row._telegramChatId,row.chatIdTelegram,row.chatId));

    return Object.assign({},row,{
      id:id||row.id,
      idEstudiantePeriodo:text(row.idEstudiantePeriodo||id),
      studentId:text(row.studentId||id),
      cedula:cedula,
      numeroIdentificacion:cedula,
      periodoId:periodoId,
      periodId:periodoId,
      CorreoPersonal:personal,
      correoPersonal:personal,
      CorreoInstitucional:institucional,
      correoInstitucional:institucional,
      Celular:celular,
      celular:celular,
      telegramUser:telegramUser,
      telegramChatId:telegramChatId,
      _telegramUser:telegramUser,
      _telegramChatId:telegramChatId
    });
  }

  function normalizePerson(row){
    row=Object.assign({},row||{});
    var cedula=U.normalizeCedula(row.cedula||row.numeroIdentificacion||row.NumeroIdentificacion||row.Cedula||"");
    return Object.assign({},row,{
      cedula:cedula,
      numeroIdentificacion:cedula,
      correoPersonal:text(first(row.correoPersonal,row.CorreoPersonal)),
      correoInstitucional:text(first(row.correoInstitucional,row.CorreoInstitucional)),
      celular:text(first(row.celular,row.Celular,row.telefono,row.Telefono)),
      telegramUser:text(first(row.telegramUser,row._telegramUser)).replace(/^@+/,""),
      telegramChatId:text(first(row.telegramChatId,row._telegramChatId))
    });
  }

  function mergeNonEmpty(base,incoming){
    var output=Object.assign({},base||{});
    Object.keys(incoming||{}).forEach(function(key){
      var value=incoming[key];
      if(value!==undefined&&value!==null&&text(value)!==""){output[key]=value;}
      else if(output[key]===undefined){output[key]=value;}
    });
    return output;
  }

  function applyContact(student,contact,person){
    student=Object.assign({},student||{});
    contact=contact||{};
    person=person||{};

    var personal=text(first(
      contact.CorreoPersonal,contact.correoPersonal,
      student.CorreoPersonal,student.correoPersonal,student._correoPersonal,student._bl2CorreoPersonal,
      person.correoPersonal,person.CorreoPersonal
    ));
    var institucional=text(first(
      contact.CorreoInstitucional,contact.correoInstitucional,
      student.CorreoInstitucional,student.correoInstitucional,student._correoInstitucional,student._bl2CorreoInstitucional,
      person.correoInstitucional,person.CorreoInstitucional
    ));
    var celular=text(first(
      contact.Celular,contact.celular,
      student.Celular,student.celular,student._celular,student._bl2Celular,student.telefono,student.Telefono,
      person.celular,person.Celular
    ));
    var telegramUser=text(first(
      contact.telegramUser,contact._telegramUser,
      student.telegramUser,student._telegramUser,
      person.telegramUser,person._telegramUser
    )).replace(/^@+/,"");
    var telegramChatId=text(first(
      contact.telegramChatId,contact._telegramChatId,
      student.telegramChatId,student._telegramChatId,
      person.telegramChatId,person._telegramChatId
    ));

    student.CorreoPersonal=personal;
    student.correoPersonal=personal;
    student._correoPersonal=personal;
    student._bl2CorreoPersonal=personal;
    student.CorreoInstitucional=institucional;
    student.correoInstitucional=institucional;
    student._correoInstitucional=institucional;
    student._bl2CorreoInstitucional=institucional;
    student.Celular=celular;
    student.celular=celular;
    student._celular=celular;
    student._bl2Celular=celular;
    student.telegramUser=telegramUser;
    student._telegramUser=telegramUser;
    student.telegramChatId=telegramChatId;
    student._telegramChatId=telegramChatId;
    student._contact=clone(contact);
    return student;
  }

  function readStore(name){
    if(!window.BL2DB||typeof window.BL2DB.getAll!=="function"){return Promise.resolve([]);}
    return window.BL2DB.getAll(name).catch(function(error){
      try{console.warn("[ConFicha] No se pudo leer "+name,error);}catch(innerError){}
      return [];
    });
  }

  function buildMaps(legacyRows,v2Rows,personsRows){
    var contacts=Object.create(null);
    var persons=Object.create(null);

    (legacyRows||[]).forEach(function(input){
      var row=normalizeContact(input);
      var key=identityKey(row);
      if(key){contacts[key]=mergeNonEmpty(contacts[key],row);}
    });

    (v2Rows||[]).forEach(function(input){
      var row=normalizeContact(input);
      var key=identityKey(row);
      if(key){contacts[key]=mergeNonEmpty(contacts[key],row);}
    });

    (personsRows||[]).forEach(function(input){
      var row=normalizePerson(input);
      if(row.cedula){persons[row.cedula]=mergeNonEmpty(persons[row.cedula],row);}
    });

    return {contacts:contacts,persons:persons};
  }

  function hydrateRows(students,contactMap,personMap){
    return (students||[]).map(function(input){
      var student=U.normalizeStudent?U.normalizeStudent(input):Object.assign({},input||{});
      var key=identityKey(student);
      var cedula=U.normalizeCedula(student.cedula||student.numeroIdentificacion||"");
      return applyContact(student,contactMap[key]||null,personMap[cedula]||null);
    });
  }

  function invalidateFichaCaches(){
    try{
      if(window.FichaCore&&typeof window.FichaCore.invalidate==="function"){window.FichaCore.invalidate();}
    }catch(error){}
  }

  function hydrateCache(options){
    options=options||{};
    if(hydrationPromise&&!options.force){return hydrationPromise;}

    hydrationPromise=HUB.ensureCoreReady().then(function(){
      var names=storeNames();
      return Promise.all([readStore(names.legacy),readStore(names.v2),readStore(names.persons)]);
    }).then(function(result){
      var cache=U.readCache(true);
      var maps=buildMaps(result[0]||[],result[1]||[],result[2]||[]);
      var students=hydrateRows(cache.students||[],maps.contacts,maps.persons);
      var contacts=Object.keys(maps.contacts).map(function(key){return maps.contacts[key];});
      var persons=Object.keys(maps.persons).map(function(key){return maps.persons[key];});

      var updated=Object.assign({},cache,{
        meta:Object.assign({},cache.meta||{}, {
          source:options.source||"cone.ficha.contact-hydration",
          contactHydrationVersion:VERSION,
          contactHydratedAt:now(),
          totalContacts:contacts.length,
          totalPersons:persons.length
        }),
        students:students,
        contacts:contacts,
        persons:persons
      });

      var saved=U.writeCache(updated,{source:options.source||"cone.ficha.contact-hydration"});
      invalidateFichaCaches();
      U.emit("bdlocal:screen-data-updated",{
        source:"cone.ficha.contact-hydration",
        students:saved.students.length,
        contacts:contacts.length,
        persons:persons.length
      });
      return saved;
    }).catch(function(error){
      try{console.error("[ConFicha hidratación]",error);}catch(innerError){}
      return U.readCache();
    }).then(function(result){
      hydrationPromise=null;
      return result;
    });

    return hydrationPromise;
  }

  function hydratedCacheSync(){
    var cache=U.readCache();
    var maps=buildMaps(cache.contacts||[],[],cache.persons||[]);
    cache.students=hydrateRows(cache.students||[],maps.contacts,maps.persons);
    return cache;
  }

  function rows(options){
    options=options||{};
    var cache=hydratedCacheSync();
    var list=U.filterStudents(cache.students||[],options);
    var limit=Number(options.limit||0);
    return limit>0?list.slice(0,limit):list;
  }

  function periods(){return (U.readCache().periods||[]).map(U.normalizePeriod).filter(Boolean);}

  function divisions(options){
    var map={};
    rows(Object.assign({},options||{},{limit:0})).forEach(function(row){
      var division=text(row._division||row.division||"Sin división")||"Sin división";
      map[division]=true;
    });
    return Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es");});
  }

  function getStudentById(id,options){
    id=text(id);
    if(!id){return null;}
    return rows(Object.assign({},options||{}, {
      matricula:options&&options.matricula!=null?options.matricula:""
    })).filter(function(row){
      return text(row.id)===id||text(row._id)===id||
        text(row.studentId)===id||text(row.idEstudiantePeriodo)===id||
        text(row.cedula)===id||text(row.numeroIdentificacion)===id;
    })[0]||null;
  }

  function getStudentByCedula(cedula,periodoId){
    cedula=U.normalizeCedula(cedula);
    return rows({periodoId:periodoId||"",matricula:""}).filter(function(row){
      return U.normalizeCedula(row.cedula||row.numeroIdentificacion)===cedula;
    })[0]||null;
  }

  function getContact(filter){
    filter=filter||{};
    var cache=hydratedCacheSync();
    var wantedId=text(filter.idEstudiantePeriodo||filter.studentId||filter.id||"");
    var cedula=U.normalizeCedula(filter.cedula||filter.numeroIdentificacion||"");
    var periodoId=U.canonicalPeriodId(filter.periodoId||filter.periodId||"");

    return (cache.contacts||[]).filter(function(contact){
      var id=identityKey(contact);
      if(wantedId&&id!==wantedId){return false;}
      if(cedula&&U.normalizeCedula(contact.cedula||contact.numeroIdentificacion)!==cedula){return false;}
      if(periodoId&&!U.samePeriod(contact.periodoId||contact.periodId,periodoId)){return false;}
      return true;
    })[0]||null;
  }

  function getRequirements(filter){
    filter=filter||{};
    var requirements=U.readCache().requirements||[];
    var periodoId=U.canonicalPeriodId(filter.periodoId||filter.periodId||"");
    var cedula=U.normalizeCedula(filter.cedula||filter.numeroIdentificacion||"");
    return requirements.filter(function(requirement){
      if(periodoId&&!U.samePeriod(requirement.periodoId||requirement.periodId,periodoId)){return false;}
      if(cedula&&U.normalizeCedula(requirement.cedula||requirement.numeroIdentificacion)!==cedula){return false;}
      return true;
    });
  }

  function refresh(options){
    return HUB.refreshCache(Object.assign({source:"cone.ficha.refresh",full:true,immediate:true},options||{}))
      .then(function(){return hydrateCache({force:true,source:"cone.ficha.refresh.contacts"});});
  }

  function hasCachedStudents(cache){
    return !!(cache&&Array.isArray(cache.students)&&cache.students.length);
  }

  function ready(options){
    options=Object.assign({},options||{});
    if(readyPromise&&!options.force){return readyPromise;}

    var cache=U.readCache(true);
    var source=options.source||"cone.ficha.ready";
    var prepare;

    if(hasCachedStudents(cache)){
      prepare=Promise.resolve(cache);
    }else{
      setFichaStatus("Recuperando estudiantes desde Base Local...","");
      prepare=HUB.refreshCache({
        source:source+".empty-students",
        mode:"full",
        full:true,
        light:false,
        immediate:true,
        force:true,
        cooldown:0,
        incremental:false
      });
    }

    readyPromise=prepare.then(function(){
      return hydrateCache({
        force:true,
        source:source+".contacts"
      });
    }).then(function(result){
      if(!hasCachedStudents(result)){
        setFichaStatus("Sin estudiantes disponibles en Base Local.","warn");
      }
      return result;
    }).finally(function(){
      readyPromise=null;
    });

    return readyPromise;
  }

  function resolveStudentId(id,options){
    options=Object.assign({},options||{});
    var requested=text(id);
    var row=getStudentById(requested,{
      periodoId:options.periodoId||options.periodId||"",
      matricula:""
    });
    return identityKey(row)||requested;
  }

  function updateStudent(id,changes,options){
    options=Object.assign({},options||{});
    var periodoId=U.canonicalPeriodId(options.periodoId||options.periodId||"");
    var resolvedId=resolveStudentId(id,options);

    if(!resolvedId){return Promise.reject(new Error("No se pudo identificar al estudiante."));}

    return HUB.ensureCoreReady().then(function(){
      if(!window.BL2Core||typeof window.BL2Core.updateStudent!=="function"){
        throw new Error("BL2Core.updateStudent no está disponible.");
      }
      return window.BL2Core.updateStudent(resolvedId,changes||{},options);
    }).then(function(saved){
      return refresh({source:"cone.ficha.updateStudent",periodoId:periodoId}).then(function(){
        emit("ficha:student-saved",{
          ok:true,
          id:resolvedId,
          requestedId:text(id),
          periodoId:periodoId,
          changes:changes||{}
        });
        return saved;
      });
    });
  }

  function updateStudentField(id,field,value,options){
    var changes={};
    changes[field]=value;
    return updateStudent(id,changes,options||{});
  }

  function normalizeEnrollmentStatus(value){
    value=norm(value);
    if(value===ENROLLMENT.active){return ENROLLMENT.active;}
    if(value===ENROLLMENT.retired){return ENROLLMENT.retired;}
    return "";
  }

  function updateEnrollmentStatus(id,value,options){
    options=Object.assign({},options||{});
    var status=normalizeEnrollmentStatus(value);
    var stamp=now();

    if(!status){
      return Promise.reject(new Error("El estado debe ser ACTIVO o RETIRADO."));
    }

    var changes={
      estadoMatricula:status,
      retirado:status===ENROLLMENT.retired,
      estadoMatriculaActualizadaEn:stamp
    };

    if(status===ENROLLMENT.retired){
      changes.retiradoEn=stamp;
    }else{
      changes.retiradoEn="";
      changes.reactivadoEn=stamp;
    }

    options.action=status===ENROLLMENT.retired?"manual_retire":"manual_reactivate";
    options.source=options.source||"cone.ficha.updateEnrollmentStatus";

    return updateStudent(id,changes,options).then(function(saved){
      var result={ok:true,id:identityKey(saved)||text(id),status:status,student:saved||null,source:"ConFicha"};
      emit("ficha:enrollment-status-saved",result);
      return result;
    });
  }

  function normalizeGraduationModality(value){
    var raw=norm(value).replace(/[^A-Z0-9]+/g,"_");
    if(raw===MODALITY.complexivo||raw.indexOf("COMPLEXIVO")>=0){return MODALITY.complexivo;}
    if(raw===MODALITY.trabajo||raw.indexOf("TRABAJO")>=0||raw.indexOf("TESIS")>=0){return MODALITY.trabajo;}
    if(raw===MODALITY.articulo||raw.indexOf("ARTICULO")>=0){return MODALITY.articulo;}
    return "";
  }

  function periodType(options){
    options=options||{};
    if(options.isPVC===true){return "PVC";}
    if(options.isRegular===true){return "REGULAR";}

    var explicit=norm(first(
      options.periodType&&typeof options.periodType==="object"?(options.periodType.id||options.periodType.label):options.periodType,
      options.tipoPeriodo,
      options.periodoTipo,
      options.periodTypeId
    ));

    if(explicit.indexOf("PVC")>=0){return "PVC";}
    if(explicit.indexOf("REGULAR")>=0){return "REGULAR";}

    var raw=norm(first(options.periodoLabel,options.periodLabel,options.periodoId,options.periodId));
    if(raw.indexOf("PVC")>=0){return "PVC";}
    if((raw.indexOf("OCTUBRE")>=0&&raw.indexOf("MARZO")>=0)||(raw.indexOf("ABRIL")>=0&&raw.indexOf("SEPTIEMBRE")>=0)){
      return "REGULAR";
    }
    if(/20\d{2}[-_/ ]?10.*20\d{2}[-_/ ]?03/.test(raw)||/20\d{2}[-_/ ]?04.*20\d{2}[-_/ ]?09/.test(raw)){
      return "REGULAR";
    }

    return "PVC";
  }

  function updateGraduationModality(id,value,options){
    options=Object.assign({},options||{});
    var type=periodType(options);
    var modality=normalizeGraduationModality(value);

    if(type==="PVC"){
      modality=MODALITY.articulo;
    }else if([MODALITY.complexivo,MODALITY.trabajo].indexOf(modality)<0){
      return Promise.reject(new Error("En un período regular solo se permite Examen Complexivo o Trabajo de Titulación."));
    }

    var changes={
      modalidadTitulacion:modality,
      modalidadTitulacionActualizadaEn:now()
    };

    options.action="manual_graduation_modality";
    options.source=options.source||"cone.ficha.updateGraduationModality";
    options.periodType=type;

    return updateStudent(id,changes,options).then(function(saved){
      var result={ok:true,id:identityKey(saved)||text(id),value:modality,periodType:type,student:saved||null,source:"ConFicha"};
      emit("ficha:graduation-modality-saved",result);
      return result;
    });
  }

  function trackedUpdate(id,changes,options){
    setFichaStatus("Guardando cambio en Base Local...","");
    return updateStudent(id,changes,options||{}).then(function(saved){
      setFichaStatus("Cambio confirmado en Base Local y agregado a la cola.","ok");
      emit("ficha:student-save-confirmed",{ok:true,id:id,saved:saved||null});
      return saved;
    }).catch(function(error){
      var message=error&&error.message?error.message:String(error);
      setFichaStatus("No se pudo guardar en Base Local: "+message,"warn");
      emit("ficha:student-save-error",{ok:false,id:id,message:message});
      return null;
    });
  }

  function forFicha(id,options){
    var student=getStudentById(id,options||{});
    return {found:!!student,student:student,source:"BDLocalConFicha",contactHydrated:!!student};
  }

  var api={
    version:VERSION,
    source:"BDLocal/conexiones/cone.ficha.js",
    ready:ready,
    refresh:refresh,
    hydrateContacts:function(){return hydrateCache({force:true,source:"cone.ficha.manual-hydration"});},
    periods:periods,
    listPeriods:periods,
    getPeriods:periods,
    rows:rows,
    listStudents:function(options){var result=rows(options||{});return {ok:true,rows:result,total:result.length,source:"BDLocalConFicha"};},
    getStudents:rows,
    filter:rows,
    divisions:divisions,
    getStudentById:getStudentById,
    getStudentByCedula:getStudentByCedula,
    buscarPorCedula:getStudentByCedula,
    getContact:getContact,
    getRequirements:getRequirements,
    updateStudent:updateStudent,
    actualizarEstudiante:updateStudent,
    updateStudentField:updateStudentField,
    updateEnrollmentStatus:updateEnrollmentStatus,
    updateGraduationModality:updateGraduationModality,
    normalizeEnrollmentStatus:normalizeEnrollmentStatus,
    normalizeGraduationModality:normalizeGraduationModality,
    periodType:periodType,
    forFicha:forFicha
  };

  HUB.register("ficha",api);
  window.BDLocalFicha=api;
  window.ConFicha=api;

  window.BL2ScreenAdapter=Object.assign({},window.BL2ScreenAdapter||{}, {
    forFicha:forFicha,
    listStudents:api.listStudents,
    getStudentById:getStudentById,
    getContact:getContact,
    updateStudent:trackedUpdate,
    updateStudentField:function(id,field,value,options){
      var patch={};
      patch[field]=value;
      return trackedUpdate(id,patch,options||{});
    },
    updateEnrollmentStatus:updateEnrollmentStatus,
    updateGraduationModality:updateGraduationModality
  });

  window.BL2EstudiantesRepo=Object.assign({},window.BL2EstudiantesRepo||{}, {
    updateStudent:trackedUpdate,
    actualizar:trackedUpdate
  });

  window.ExcelLocalRepo=Object.assign({},window.ExcelLocalRepo||{}, {
    updateStudent:trackedUpdate,
    updateStudentField:function(id,field,value,options){
      var patch={};
      patch[field]=value;
      return trackedUpdate(id,patch,options||{});
    }
  });

  window.BL2DataEngine=Object.assign({},window.BL2DataEngine||{}, {
    updateStudent:trackedUpdate
  });

  window.addEventListener("bdlocal:conexiones-cache-updated",invalidateFichaCaches);
  window.addEventListener("bdlocal:screen-data-updated",invalidateFichaCaches);

  ready({source:"cone.ficha.bootstrap"}).catch(function(error){
    try{console.error("[ConFicha inicio]",error);}catch(innerError){}
    setFichaStatus(error&&error.message?error.message:String(error),"warn");
  });
})(window);
