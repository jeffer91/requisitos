/* =========================================================
Nombre completo: tabla.core.js
Ruta o ubicación: /Requisitos/Gestion/Tabla/tabla.core.js
Función o funciones:
- Leer estudiantes desde BL2DataEngine y usar ExcelLocalRepo solo como respaldo.
- Calcular estado general con BL2RequirementsEngine para respetar PVC/Regular.
- No exigir Titulación en PVC.
- Aplicar filtros de período, división, matrícula, carrera, estado y búsqueda.
- Entregar resultados paginados para no renderizar toda la base.
- Normalizar datos de Telegram para contacto individual y masivo desde Tabla.
Con qué se conecta:
- ../../BaseLocal2/core/bl2-data-engine.js
- ../../BaseLocal2/core/bl2-student-normalizer.js
- ../../BaseLocal2/core/bl2-requirements-engine.js
- ../../BaseLocal2/repositories/bl2-estudiantes.repo.js
- ../../BaseLocal2/services/bl2-pagination.service.js
- excel-local.repo.js
- bl-periodos-canon.service.js
- bl-divisiones.service.js
- tabla.app.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-tabla-core.1";
  var TELEGRAM_USER_ALIASES=["_telegramUser","telegramUser","TelegramUser","telegramuser","usuarioTelegram","UsuarioTelegram","usuariotelegram","telegram","Telegram"];
  var TELEGRAM_CHAT_ID_ALIASES=["_telegramChatId","telegramChatId","TelegramChatId","telegramchatid","chatIdTelegram","ChatIdTelegram","chatidtelegram","chatId","ChatId","chatid"];

  function text(v){return String(v==null?"":v).trim();}
  function norm(v){return text(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();}
  function compact(v){return norm(v).replace(/[^a-z0-9]/g,"");}
  function cleanTelegramUser(v){return text(v).replace(/^@+/,"").trim();}
  function dataEngine(){return window.BL2DataEngine||null;}
  function normalizer(){return window.BL2StudentNormalizer||null;}
  function reqEngine(){return window.BL2RequirementsEngine||window.StatsRules||null;}
  function bl2Repo(){return window.BL2EstudiantesRepo||null;}
  function pager(){return window.BL2PaginationService||null;}
  function repo(){if(!window.ExcelLocalRepo)throw new Error("ExcelLocalRepo no disponible. Primero carga Base Local.");return window.ExcelLocalRepo;}
  function hasCore(){return !!(dataEngine()&&typeof dataEngine().listStudents==="function");}
  function hasBL2Repo(){return !!(bl2Repo()&&typeof bl2Repo().buscar==="function");}

  function estadoMatricula(v){return norm(v||"ACTIVO")==="retirado"?"RETIRADO":"ACTIVO";}
  function pick(row,aliases,fallback){var keys=Object.keys(row||{});for(var i=0;i<aliases.length;i++){for(var j=0;j<keys.length;j++){if(compact(keys[j])===compact(aliases[i])){var value=row[keys[j]];if(value!=null&&text(value)!=="")return value;}}}return fallback;}
  function telegramInfo(row){row=row||{};var user=cleanTelegramUser(pick(row,TELEGRAM_USER_ALIASES,""));var chatId=text(pick(row,TELEGRAM_CHAT_ID_ALIASES,""));return {user:user,chatId:chatId,hasTelegram:!!(user||chatId),canSendByBot:!!chatId};}
  function telegramUrl(row){var info=telegramInfo(row);if(info.user)return "https://t.me/"+encodeURIComponent(info.user);if(info.chatId)return "tg://user?id="+encodeURIComponent(info.chatId);return "";}

  function valueOf(row,key){try{if(reqEngine()&&typeof reqEngine().valueOf==="function")return reqEngine().valueOf(row||{},key);}catch(error){}try{if(normalizer()&&typeof normalizer().value==="function")return normalizer().value(row||{},key);}catch(error){}return row&&row[key]!=null?row[key]:"";}
  function estadoCelda(v){try{if(reqEngine()&&typeof reqEngine().cellStatus==="function")return reqEngine().cellStatus(v);}catch(error){}var k=norm(v);if(["si","sí","s","ok","cumple","aprobado","aprobada","1","true","x","validado","completo","completa"].indexOf(k)>=0)return "cumple";return "no_cumple";}
  function applicableRequirements(row){try{if(reqEngine()&&typeof reqEngine().requirementsForStudent==="function")return reqEngine().requirementsForStudent(row||{});}catch(error){}return [{key:"academico",label:"Académico"},{key:"documentacion",label:"Documentación"},{key:"financiero",label:"Financiero"},{key:"practicasvinculacion",label:"Prácticas"},{key:"vinculacion",label:"Vinculación"},{key:"seguimientograduados",label:"Seguimiento graduados"},{key:"ingles",label:"Inglés"},{key:"actualizaciondatos",label:"Actualización de datos"}];}
  function estadoEstudiante(row){
    try{if(reqEngine()&&typeof reqEngine().studentApproval==="function"){var approval=reqEngine().studentApproval(row||{});return {id:approval.approved?"cumple":"no_cumple",label:approval.approved?"Cumple todo":"No cumple",ok:approval.applicableRequirements.length-approval.missingRequirements.length,no:approval.missingRequirements.length,pend:0,approved:approval.approved,missingRequirements:approval.missingRequirements,applicableRequirements:approval.applicableRequirements};}}catch(error){}
    var ok=0,no=0;applicableRequirements(row).forEach(function(req){if(estadoCelda(valueOf(row,req.key))==="cumple")ok++;else no++;});return {id:no?"no_cumple":"cumple",label:no?"No cumple":"Cumple todo",ok:ok,no:no,pend:0};
  }

  function snapshot(){return repo().getSnapshot();}
  function periods(){try{if(dataEngine()&&typeof dataEngine().listPeriods==="function")return dataEngine().listPeriods()||[];}catch(error){}if(hasBL2Repo()&&typeof bl2Repo().listPeriods==="function")return bl2Repo().listPeriods()||[];return repo().listPeriods?repo().listPeriods():snapshot().periods||[];}
  function samePeriod(a,b){if(!text(b))return true;if(window.BLPeriodosCanon&&typeof window.BLPeriodosCanon.samePeriod==="function")return window.BLPeriodosCanon.samePeriod(a,b);return text(a)===text(b)||norm(a)===norm(b);}
  function divisionOf(row){if(row&&row._bl2Division)return row._bl2Division;if(window.BLDivisionesService&&typeof window.BLDivisionesService.studentDivision==="function")return window.BLDivisionesService.studentDivision(row);var list=Array.isArray(row&&row.divisiones)?row.divisiones:[];return list[0]||row.division||row.Division||row.División||"Sin división";}
  function hasDivision(row,division){if(!text(division))return true;if(row&&row._bl2Division)return norm(row._bl2Division)===norm(division);if(window.BLDivisionesService&&typeof window.BLDivisionesService.hasDivision==="function")return window.BLDivisionesService.hasDivision(row,division);return norm(divisionOf(row))===norm(division);}

  function normalizeRow(row){return normalizer()&&typeof normalizer().normalize==="function"?normalizer().normalize(row||{}, {clone:false}):Object.assign({},row||{});}
  function decorate(row){var r=normalizeRow(row);var tg=telegramInfo(r);r._estadoGeneral=estadoEstudiante(r);r._estadoMatricula=estadoMatricula(r._bl2EstadoMatricula||r.estadoMatricula);r._cedula=text(r._bl2Id||r.cedula||r.numeroIdentificacion||r.numeroidentificacion||r.Cedula||r.NumeroIdentificacion);r._nombres=text(r._bl2Nombre||r.nombres||r.Nombres||r.nombre||r.estudiante);r._carrera=text(r._bl2Carrera||r.nombrecarrera||r.nombreCarrera||r.NombreCarrera||r.carrera)||"SIN CARRERA";r._division=divisionOf(r);r._celular=text(r._bl2Celular||r.celular||r.Celular||r.telefono||r.whatsapp);r._correo=text(r._bl2CorreoPersonal||r.correopersonal||r.CorreoPersonal||r.correoPersonal||r._bl2CorreoInstitucional||r.correoinstitucional||r.CorreoInstitucional||r.correoInstitucional);r._periodo=text(r._bl2Periodo||r.periodoLabel||r.periodo||r.periodoId)||"SIN PERÍODO";r._periodoId=text(r._bl2PeriodoId||r.periodoId||r.ultimoPeriodoId||r.periodId||r._periodo);r._telegramUser=tg.user;r._telegramChatId=tg.chatId;r._telegramTiene=tg.hasTelegram;r._telegramBot=tg.canSendByBot;return r;}

  function rowsFromCore(opts){var result=dataEngine().listStudents({periodId:opts.periodId||"",division:opts.division||"",matricula:opts.matricula==null?"ACTIVO":opts.matricula,search:opts.search||"",limit:0,force:opts.force===true});return (result.rows||[]).map(decorate);}
  function rowsFromRepo(opts){var result=bl2Repo().buscar({periodId:opts.periodId||"",division:opts.division||"",matricula:opts.matricula==null?"ACTIVO":opts.matricula,search:opts.search||"",limit:0});return (result.rows||[]).map(decorate);}
  function rowsFromExcel(opts){var matricula=opts.matricula==null?"ACTIVO":text(opts.matricula);var rows=[];if(repo().filterStudents){rows=repo().filterStudents({periodoId:opts.periodId||"",estadoMatricula:matricula,division:opts.division||""});}else if(repo().listStudentsByStatus&&matricula!==undefined){rows=repo().listStudentsByStatus(matricula||"");}else{rows=repo().listAllStudents?repo().listAllStudents():snapshot().students||[];}return (rows||[]).map(decorate);}
  function baseRows(opts){opts=opts||{};try{if(hasCore())return rowsFromCore(opts);}catch(error){console.warn("[TablaCore] BL2DataEngine falló",error);}try{if(hasBL2Repo())return rowsFromRepo(opts);}catch(error){console.warn("[TablaCore] BL2EstudiantesRepo falló",error);}return rowsFromExcel(opts);}
  function filterAll(opts){opts=opts||{};var q=norm(opts.search);var periodId=text(opts.periodId);var division=text(opts.division);var career=text(opts.career);var status=text(opts.status);if(status==="pendiente")status="no_cumple";var matricula=opts.matricula==null?"ACTIVO":text(opts.matricula);return baseRows(opts).filter(function(s){if(matricula&&s._estadoMatricula!==matricula)return false;if(periodId&&!samePeriod(s._periodoId||s._periodo,periodId))return false;if(division&&!hasDivision(s,division))return false;if(career&&s._carrera!==career)return false;if(status&&s._estadoGeneral.id!==status)return false;if(q){var hay=norm([s._cedula,s._nombres,s._carrera,s._division,s._correo,s._celular,s._telegramUser,s._telegramChatId,s.periodoLabel,s.periodoId,s._periodo,s._estadoMatricula].join(" "));if(hay.indexOf(q)<0)return false;}return true;});}
  function filter(opts){return filterAll(opts);}
  function listOptions(values){var map={};(values||[]).forEach(function(value){value=text(value);if(value)map[value]=true;});return Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es");});}
  function careers(list){return listOptions((list||baseRows({matricula:"ACTIVO",limit:0})).map(function(s){return s._carrera||"SIN CARRERA";}));}
  function divisions(list,opts){opts=opts||{};if(!list&&hasBL2Repo()&&typeof bl2Repo().listDivisions==="function")return bl2Repo().listDivisions({periodId:opts.periodId||"",matricula:opts.matricula==null?"ACTIVO":opts.matricula});var rows=list||baseRows({periodId:opts.periodId||"",matricula:opts.matricula==null?"ACTIVO":opts.matricula,limit:0});if(window.BLDivisionesService&&typeof window.BLDivisionesService.listDivisionsWithEmpty==="function")return window.BLDivisionesService.listDivisionsWithEmpty(rows,"");return listOptions(rows.map(function(s){return divisionOf(s);}));}
  function page(opts){opts=opts||{};var rows=filterAll(opts);var pageInfo=pager()?pager().build(rows.length,{page:opts.page||1,pageSize:opts.pageSize||100}):{page:Number(opts.page||1)||1,pageSize:Number(opts.pageSize||100)||100,offset:((Number(opts.page||1)||1)-1)*(Number(opts.pageSize||100)||100),total:rows.length,pages:Math.max(1,Math.ceil(rows.length/(Number(opts.pageSize||100)||100))),hasPrev:false,hasNext:false,label:rows.length+" registros"};pageInfo.hasPrev=pageInfo.page>1;pageInfo.hasNext=pageInfo.page<pageInfo.pages;var pageRows=rows.slice(pageInfo.offset,pageInfo.offset+pageInfo.pageSize);return {rows:pageRows,allRows:rows,total:rows.length,pagination:pageInfo,summary:summary(rows),source:source()};}
  function summary(list){list=Array.isArray(list)?list:[];var careerMap={},c={total:list.length,cumple:0,pendiente:0,no_cumple:0,carreras:0};list.forEach(function(s){c[s._estadoGeneral.id]=(c[s._estadoGeneral.id]||0)+1;careerMap[text(s._carrera)||"SIN CARRERA"]=true;});c.carreras=Object.keys(careerMap).length;return c;}
  function whatsappUrl(row){var phone=text(row._celular).replace(/[^0-9]/g,"");if(!phone)return "";if(phone.length===10&&phone.charAt(0)==="0")phone="593"+phone.slice(1);var msg="Estimado/a "+(row._nombres||"estudiante")+", le escribimos sobre sus requisitos de titulación.";return "https://wa.me/"+phone+"?text="+encodeURIComponent(msg);}
  function source(){return hasCore()?"BL2DataEngine":(hasBL2Repo()?"BL2":"ExcelLocalRepo");}
  window.TablaCore={version:VERSION,estadoEstudiante:estadoEstudiante,estadoMatricula:estadoMatricula,periods:periods,students:function(matricula){return baseRows({matricula:matricula==null?"ACTIVO":matricula});},careers:careers,divisions:divisions,filter:filter,page:page,summary:summary,whatsappUrl:whatsappUrl,telegramInfo:telegramInfo,telegramUrl:telegramUrl,decorate:decorate,divisionOf:divisionOf,source:source};
})(window);
