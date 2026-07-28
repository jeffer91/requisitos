/* =========================================================
Nombre completo: cone.ficha.fast.js
Ruta: /BDLocal/conexiones/cone.ficha.fast.js
Función:
- Abrir Ficha inmediatamente desde la caché compartida.
- Evitar la hidratación completa de contactos e IndexedDB durante el arranque.
- Activar el conector completo y las escrituras únicamente al editar o cuando falte un período.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="2.0.0-cache-first";
  var HUB=window.BDLocalConexiones;
  var U=window.BDLocalConUtils;
  var base=document.currentScript&&document.currentScript.src||document.baseURI;
  var fullPromise=null;
  var api=null;

  if(!HUB||!U){return;}

  function text(value){return U.text?U.text(value):String(value==null?"":value).trim();}
  function normalizeCedula(value){return U.normalizeCedula?U.normalizeCedula(value):text(value);}
  function canonicalPeriodId(value){return U.canonicalPeriodId?U.canonicalPeriodId(value):text(value);}
  function samePeriod(a,b){return U.samePeriod?U.samePeriod(a,b):!b||text(a)===text(b);}
  function cache(){return U.readCache();}
  function resolve(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function existing(src){return Array.prototype.slice.call(document.scripts||[]).some(function(script){return script.src===src;});}
  function load(relative){
    var src=resolve(relative);
    if(existing(src)){return Promise.resolve(src);}
    return new Promise(function(resolvePromise,reject){
      var script=document.createElement("script");script.src=src;script.async=false;script.defer=false;script.setAttribute("data-ficha-fast-src",src);
      script.onload=function(){resolvePromise(src);};script.onerror=function(){reject(new Error("No se pudo cargar "+relative));};
      (document.head||document.documentElement).appendChild(script);
    });
  }

  function periods(){return (cache().periods||[]).map(function(row){return U.normalizePeriod?U.normalizePeriod(row):row;}).filter(Boolean);}
  function rows(options){return U.filterStudents(cache().students||[],options||{});}
  function divisions(options){
    var map=Object.create(null);
    rows(Object.assign({},options||{},{limit:0})).forEach(function(row){var value=text(row._division||row.division||"Sin división")||"Sin división";map[value]=true;});
    return Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es");});
  }
  function identity(row){
    row=row||{};var cedula=normalizeCedula(row.cedula||row.numeroIdentificacion||"");var periodoId=canonicalPeriodId(row.periodoId||row.periodId||row.ultimoPeriodoId||"");
    return text(row.idEstudiantePeriodo||row.studentId||row.id||row._id||(cedula&&periodoId?cedula+"__"+periodoId:""));
  }
  function getStudentById(id,options){
    id=text(id);if(!id){return null;}
    return rows(Object.assign({},options||{},{matricula:options&&options.matricula!=null?options.matricula:""})).filter(function(row){return [row.id,row._id,row.studentId,row.idEstudiantePeriodo,row.cedula,row.numeroIdentificacion].some(function(value){return text(value)===id;});})[0]||null;
  }
  function getStudentByCedula(cedula,periodoId){
    cedula=normalizeCedula(cedula);
    return rows({periodoId:periodoId||"",matricula:""}).filter(function(row){return normalizeCedula(row.cedula||row.numeroIdentificacion)===cedula;})[0]||null;
  }
  function getRequirements(filter){
    filter=filter||{};var periodoId=canonicalPeriodId(filter.periodoId||filter.periodId||"");var cedula=normalizeCedula(filter.cedula||filter.numeroIdentificacion||"");
    return (cache().requirements||[]).filter(function(row){return (!periodoId||samePeriod(row.periodoId||row.periodId||row.periodoCanonicoId,periodoId))&&(!cedula||normalizeCedula(row.cedula||row.numeroIdentificacion)===cedula);});
  }
  function getContact(filter){
    filter=filter||{};var student=getStudentById(filter.idEstudiantePeriodo||filter.studentId||filter.id||filter.cedula||filter.numeroIdentificacion,{periodoId:filter.periodoId||filter.periodId||"",matricula:""})||{};
    return {
      idEstudiantePeriodo:identity(student),cedula:normalizeCedula(student.cedula||student.numeroIdentificacion||filter.cedula||""),
      periodoId:canonicalPeriodId(student.periodoId||student.periodId||filter.periodoId||""),
      CorreoPersonal:text(student.CorreoPersonal||student.correoPersonal||student._correoPersonal||student._bl2CorreoPersonal||""),
      correoPersonal:text(student.CorreoPersonal||student.correoPersonal||student._correoPersonal||student._bl2CorreoPersonal||""),
      CorreoInstitucional:text(student.CorreoInstitucional||student.correoInstitucional||student._correoInstitucional||student._bl2CorreoInstitucional||""),
      correoInstitucional:text(student.CorreoInstitucional||student.correoInstitucional||student._correoInstitucional||student._bl2CorreoInstitucional||""),
      Celular:text(student.Celular||student.celular||student.telefono||student._celular||student._bl2Celular||""),
      celular:text(student.Celular||student.celular||student.telefono||student._celular||student._bl2Celular||""),
      telegramUser:text(student.telegramUser||student._telegramUser||""),telegramChatId:text(student.telegramChatId||student._telegramChatId||"")
    };
  }
  function hasPeriod(periodoId){periodoId=canonicalPeriodId(periodoId||"");return !periodoId||rows({periodoId:periodoId,matricula:"",limit:1}).length>0;}
  function ready(options){return Promise.resolve(HUB.ready(options||{})).then(function(){return cache();});}

  function ensureFull(){
    if(window.ConFicha&&window.ConFicha!==api&&window.ConFicha.source!==api.source){return Promise.resolve(window.ConFicha);}
    if(fullPromise){return fullPromise;}
    fullPromise=Promise.resolve()
      .then(function(){return HUB.activateHeavy?HUB.activateHeavy():HUB.ensureCoreReady();})
      .then(function(){return load("cone.ficha.js");})
      .then(function(){return load("cone.ficha.entities.js");})
      .then(function(){return load("cone.ficha.enrollment-lock.js");})
      .then(function(){
        var full=window.ConFicha;
        if(!full||full===api){throw new Error("El conector completo de Ficha no quedó disponible.");}
        return Promise.resolve(typeof full.ready==="function"?full.ready({source:"cone.ficha.fast.lazy"}):full).then(function(){return full;});
      })
      .catch(function(error){fullPromise=null;throw error;});
    return fullPromise;
  }

  function refresh(options){
    options=Object.assign({},options||{});var periodoId=canonicalPeriodId(options.periodoId||options.periodId||"");
    if(hasPeriod(periodoId)&&options.force!==true){return ready().then(function(){return cache();});}
    return ensureFull().then(function(full){return typeof full.refresh==="function"?full.refresh(options):cache();});
  }
  function delegate(method,args){return ensureFull().then(function(full){if(!full||typeof full[method]!=="function"){throw new Error("ConFicha."+method+" no está disponible.");}return full[method].apply(full,args||[]);});}
  function normalizeEnrollmentStatus(value){value=text(value).toUpperCase();return value==="ACTIVO"||value==="RETIRADO"?value:"";}
  function normalizeGraduationModality(value){var raw=text(value).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Z0-9]+/g,"_");if(raw.indexOf("COMPLEXIVO")>=0){return "EXAMEN_COMPLEXIVO";}if(raw.indexOf("TRABAJO")>=0||raw.indexOf("TESIS")>=0){return "TRABAJO_TITULACION";}if(raw.indexOf("ARTICULO")>=0){return "ARTICULO_ACADEMICO";}return "";}
  function periodType(options){options=options||{};var raw=text(options.periodType||options.tipoPeriodo||options.periodoLabel||options.periodoId||"").toUpperCase();return raw.indexOf("REGULAR")>=0?"REGULAR":"PVC";}
  function forFicha(id,options){var student=getStudentById(id,options||{});return {found:!!student,student:student,source:"BDLocalConFichaFast",contactHydrated:!!student};}

  api={
    version:VERSION,source:"BDLocal/conexiones/cone.ficha.fast.js",ready:ready,refresh:refresh,
    periods:periods,listPeriods:periods,getPeriods:periods,rows:rows,getStudents:rows,
    listStudents:function(options){var result=rows(options||{});return {ok:true,rows:result,total:result.length,source:"BDLocalConFichaFast"};},
    filter:rows,divisions:divisions,getStudentById:getStudentById,getStudentByCedula:getStudentByCedula,buscarPorCedula:getStudentByCedula,
    getContact:getContact,getRequirements:getRequirements,forFicha:forFicha,
    updateStudent:function(){return delegate("updateStudent",Array.prototype.slice.call(arguments));},
    actualizarEstudiante:function(){return delegate("updateStudent",Array.prototype.slice.call(arguments));},
    updateStudentField:function(){return delegate("updateStudentField",Array.prototype.slice.call(arguments));},
    updateEnrollmentStatus:function(){return delegate("updateEnrollmentStatus",Array.prototype.slice.call(arguments));},
    updateGraduationModality:function(){return delegate("updateGraduationModality",Array.prototype.slice.call(arguments));},
    normalizeEnrollmentStatus:normalizeEnrollmentStatus,normalizeGraduationModality:normalizeGraduationModality,periodType:periodType,
    activateFull:ensureFull
  };

  HUB.register("ficha",api);window.BDLocalFicha=api;window.ConFicha=api;
  window.BL2ScreenAdapter=Object.assign({},window.BL2ScreenAdapter||{},{forFicha:forFicha,listStudents:api.listStudents,getStudentById:getStudentById,getContact:getContact,updateStudent:api.updateStudent,updateStudentField:api.updateStudentField,updateEnrollmentStatus:api.updateEnrollmentStatus,updateGraduationModality:api.updateGraduationModality});
  ready({source:"cone.ficha.fast.bootstrap"}).catch(function(){});
})(window,document);
