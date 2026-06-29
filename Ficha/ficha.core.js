/* =========================================================
Nombre completo: ficha.core.js
Ruta o ubicación: /Requisitos/Ficha/ficha.core.js
Función o funciones:
- Leer estudiantes desde el motor central BL2 y usar ExcelLocalRepo solo como respaldo.
- Normalizar datos de la ficha individual con BL2StudentNormalizer.
- Calcular requisitos con BL2RequirementsEngine para respetar PVC/Regular.
- No exigir Titulación en PVC.
- Mantener aprobación final separada de requisitos base.
- Buscar y listar estudiantes sin cargar toda la base innecesariamente.
- Generar mensajes para WhatsApp y Telegram con saludo automático.
- Leer y evaluar notas Nart, Ndef y Nfin.
Con qué se conecta:
- ../BaseLocal2/core/bl2-student-normalizer.js
- ../BaseLocal2/core/bl2-requirements-engine.js
- ../BaseLocal2/core/bl2-data-engine.js
- ../BaseLocal2/core/bl2-screen-adapter.js
- ../BaseLocal2/repositories/bl2-estudiantes.repo.js
- ../BaseLocal2/repositories/bl2-requisitos.repo.js
- ../BaseLocal/services/bl-notas-defensa.service.js
- ficha.app.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-ficha-core.1";
  var cache = {periods:null, divisions:{}};

  function text(v){return String(v == null ? "" : v).trim();}
  function norm(v){return text(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();}
  function compact(v){return norm(v).replace(/[^a-z0-9]/g, "");}
  function label(key, fallback){try{if(window.BLCampos && typeof window.BLCampos.requirementLabel === "function"){return window.BLCampos.requirementLabel(key, fallback);}}catch(error){}return fallback || key;}
  function req(key, fallback, group){return {key:key, field:key, label:label(key, fallback), group:group || "requisito"};}
  function cloneReq(item){return {key:item.key, field:item.field || item.key, label:item.label || item.key, group:item.group || "requisito", icon:item.icon || ""};}
  function cloneList(list){return (list || []).map(cloneReq);}

  var FALLBACK_BASE = [req("academico","Académico"),req("documentacion","Documentación"),req("financiero","Financiero"),req("practicasvinculacion","Prácticas"),req("vinculacion","Vinculación"),req("seguimientograduados","Seguimiento graduados"),req("ingles","Inglés"),req("actualizaciondatos","Actualización de datos")];
  var FALLBACK_EXTRA = [req("titulacion","Titulación")];
  var FALLBACK_FINAL = [req("aprobaciontitulacion","Aprobación titulación","final"),req("aprobacioncomplexivoproyecto","Aprobación complexivo/proyecto","final")];

  var NOTE_FIELDS = [
    {key:"nart", label:"Nart", aliases:["Notart","notart","Nart","nart","N_ART","N-ART","NotaArt","notaArt","notaArticulo","nota_articulo"]},
    {key:"ndef", label:"Ndef", aliases:["Notdef","notdef","Ndef","ndef","N_DEF","N-DEF","NotaDef","notaDef","notaDefensa","nota_defensa"]},
    {key:"nfin", label:"Nfin", aliases:["Notafinal","notafinal","NotaFinal","notaFinal","Nfin","nfin","N_FIN","N-FIN","Nota final","nota final"]}
  ];

  function normalizer(){return window.BL2StudentNormalizer || null;}
  function reqEngine(){return window.BL2RequirementsEngine || window.StatsRules || null;}
  function dataEngine(){return window.BL2DataEngine || null;}
  function screenAdapter(){return window.BL2ScreenAdapter || null;}
  function bl2Students(){return window.BL2EstudiantesRepo || null;}
  function bl2Reqs(){return window.BL2RequisitosRepo || null;}
  function notasService(){return window.BLNotasDefensa || null;}
  function excelRepo(){return window.ExcelLocalRepo || null;}

  function normalizeStudent(row){
    var r = normalizer() && typeof normalizer().normalize === "function" ? normalizer().normalize(row || {}, {clone:false}) : Object.assign({}, row || {});
    r._id = text(r._bl2Id || r.cedula || r.numeroIdentificacion || r.numeroidentificacion || r._docId || r.docId || r.id);
    r._cedula = text(r._bl2Id || r.cedula || r.numeroIdentificacion || r.numeroidentificacion || r.Cedula || r.NumeroIdentificacion);
    r._nombres = text(r._bl2Nombre || r.nombres || r.Nombres || r.nombre || r.Nombre || r.estudiante || r.Estudiante || r.apellidosNombres || r.ApellidosNombres);
    r._carrera = text(r._bl2Carrera || r.nombrecarrera || r.nombreCarrera || r.NombreCarrera || r.carrera || r.Carrera) || "SIN CARRERA";
    r._division = divisionOf(r);
    r._sede = text(r._bl2Sede || fieldValue(r, "sede", r.Sede || ""));
    r._horario = text(r._bl2Jornada || pick(r, ["horariocomplexivo","HorarioComplexivo","horarioComplexivo","horario","jornada","Jornada"], ""));
    r._celular = text(r._bl2Celular || fieldValue(r, "celular", r.telefono || r.whatsapp || ""));
    r._correo = text(r._bl2CorreoPersonal || fieldValue(r, "correoPersonal", fieldValue(r, "correoInstitucional", r.CorreoPersonal || r.CorreoInstitucional || "")));
    r._periodo = text(r._bl2Periodo || r.periodoLabel || r.periodo || r.Periodo || r.periodoId || r._bl2PeriodoId);
    r._periodoId = text(r._bl2PeriodoId || r.periodoId || r.ultimoPeriodoId || r.periodId || r._bl2Periodo || r._periodo);
    r._estadoMatricula = estadoMatricula(r._bl2EstadoMatricula || fieldValue(r, "estadoMatricula", r.estadoMatricula));
    var tg = telegramInfo(r);r._telegramUser = tg.user;r._telegramChatId = tg.chatId;
    r._approval = studentApproval(r);
    r._estado = estadoGeneral(r);
    r._finalApproval = finalApproval(r);
    return r;
  }

  function pick(row, aliases, fallback){
    var keys = Object.keys(row || {}), wanted = (aliases || []).map(compact);
    for(var i=0;i<aliases.length;i+=1){if(Object.prototype.hasOwnProperty.call(row || {}, aliases[i]) && text(row[aliases[i]]) !== ""){return row[aliases[i]];}}
    for(var j=0;j<keys.length;j+=1){if(wanted.indexOf(compact(keys[j])) >= 0 && row[keys[j]] != null && text(row[keys[j]]) !== ""){return row[keys[j]];}}
    return fallback;
  }

  function fieldValue(row, field, fallback){
    if(!row){return fallback;}
    try{if(normalizer() && typeof normalizer().value === "function"){var nv = normalizer().value(row, field);if(text(nv) !== ""){return nv;}}}catch(error){}
    try{if(window.BLCampos && typeof window.BLCampos.getValue === "function"){var bv = window.BLCampos.getValue(row, field, fallback);if(text(bv) !== ""){return bv;}}}catch(error){}
    return pick(row, [field], fallback);
  }

  function reqValue(row, req){
    try{if(reqEngine() && typeof reqEngine().valueOf === "function"){return reqEngine().valueOf(row || {}, req.key || req.field);}}catch(error){}
    try{if(bl2Reqs() && typeof bl2Reqs().field === "function"){return bl2Reqs().field(row || {}, req.key || req.field, "");}}catch(error){}
    return fieldValue(row, req.field || req.key, pick(row, [req.key], ""));
  }

  function estadoMatricula(v){return norm(v || "ACTIVO") === "retirado" ? "RETIRADO" : "ACTIVO";}
  function estadoCelda(v){try{if(reqEngine() && typeof reqEngine().cellStatus === "function"){return reqEngine().cellStatus(v);}}catch(error){}var k = norm(v);if(["cumple","si","sí","s","ok","aprobado","aprobada","1","true","x","validado","completo","completa"].indexOf(k) >= 0){return "cumple";}return "no_cumple";}
  function samePeriod(a,b){if(!text(b)){return true;}try{if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function"){return window.BLPeriodosCanon.samePeriod(a,b);}}catch(error){}return text(a) === text(b) || norm(a) === norm(b);}
  function divisionOf(row){if(row && row._bl2Division){return row._bl2Division;}try{if(window.BLDivisionesService && typeof window.BLDivisionesService.studentDivision === "function"){return window.BLDivisionesService.studentDivision(row);}}catch(error){}var list = Array.isArray(row && row.divisiones) ? row.divisiones : [];return list[0] || (row && (row.division || row.Division || row.División)) || "Sin división";}
  function hasDivision(row, division){if(!text(division)){return true;}try{if(window.BLDivisionesService && typeof window.BLDivisionesService.hasDivision === "function"){return window.BLDivisionesService.hasDivision(row, division);}}catch(error){}return norm(divisionOf(row)) === norm(division);}

  function requirementsForStudent(row){
    try{if(reqEngine() && typeof reqEngine().requirementsForStudent === "function"){return cloneList(reqEngine().requirementsForStudent(row || {}));}}catch(error){}
    var periodInfo = classifyStudent(row);
    return periodInfo.id === "REGULAR" ? cloneList(FALLBACK_BASE.concat(FALLBACK_EXTRA)) : cloneList(FALLBACK_BASE);
  }
  function finalRequirements(){try{if(reqEngine() && Array.isArray(reqEngine().FINAL_REQUIREMENTS)){return cloneList(reqEngine().FINAL_REQUIREMENTS);}}catch(error){}return cloneList(FALLBACK_FINAL);}
  function classifyStudent(row){try{if(reqEngine() && typeof reqEngine().classifyStudent === "function"){return reqEngine().classifyStudent(row || {});}}catch(error){}return {id:"PVC", label:"PVC", isPVC:true, isRegular:false, pattern:"PVC", raw:text(row && (row._periodo || row.periodoLabel || row.periodoId))};}
  function requirementStatus(row, req){try{if(reqEngine() && typeof reqEngine().requirementStatus === "function"){return reqEngine().requirementStatus(row || {}, req.key);}}catch(error){}var estado=estadoCelda(reqValue(row,req));return {key:req.key,label:req.label,status:estado,labelStatus:estado === "cumple" ? "Cumple" : "No cumple",cumple:estado === "cumple",applies:true};}
  function studentApproval(row){try{if(reqEngine() && typeof reqEngine().studentApproval === "function"){return reqEngine().studentApproval(row || {});}}catch(error){}var applicable=requirementsForStudent(row),missing=applicable.filter(function(req){return estadoCelda(reqValue(row,req)) !== "cumple";});return {approved:missing.length===0,label:missing.length?"No cumple":"Aprobado",applicableRequirements:applicable,missingRequirements:missing,notApplicableRequirements:classifyStudent(row).id === "PVC" ? cloneList(FALLBACK_EXTRA) : [],periodType:classifyStudent(row)};}
  function finalApproval(row){try{if(reqEngine() && typeof reqEngine().finalApproval === "function"){return reqEngine().finalApproval(row || {});}}catch(error){}return finalRequirements().map(function(req){var estado=estadoCelda(reqValue(row,req));return {key:req.key,label:req.label,status:estado,cumple:estado === "cumple"};});}
  function estadoGeneral(row){var approval = studentApproval(row);var ok = approval.applicableRequirements.length - approval.missingRequirements.length;var no = approval.missingRequirements.length;return {id:approval.approved ? "cumple" : "no_cumple",label:approval.approved ? "Aprobado" : "No cumple",ok:ok,no:no,pend:0,approved:approval.approved,periodType:approval.periodType,applicableRequirements:approval.applicableRequirements,missingRequirements:approval.missingRequirements,notApplicableRequirements:approval.notApplicableRequirements || []};}

  function periods(){
    if(cache.periods){return cache.periods.slice();}
    var list=[];
    try{if(dataEngine() && typeof dataEngine().listPeriods === "function"){list=dataEngine().listPeriods()||[];}}catch(error){}
    if(!list.length){try{if(bl2Students() && typeof bl2Students().listPeriods === "function"){list=bl2Students().listPeriods()||[];}}catch(error){}}
    if(!list.length){try{if(excelRepo() && typeof excelRepo().listPeriods === "function"){list=excelRepo().listPeriods()||[];}}catch(error){}}
    cache.periods=list.slice();return list;
  }

  function queryRows(options){
    options=options||{};
    var payload={periodId:options.periodId||"",division:options.division||"",matricula:options.matricula==null?"ACTIVO":options.matricula,search:options.search||"",limit:Math.max(1, Number(options.limit || 400) || 400),force:options.force===true};
    try{if(dataEngine() && typeof dataEngine().listStudents === "function"){var er=dataEngine().listStudents(payload);return (er.rows||[]).map(normalizeStudent);}}catch(error){console.warn("[FichaCore] BL2DataEngine falló", error);}
    try{if(bl2Students() && typeof bl2Students().buscar === "function"){var br=bl2Students().buscar(payload);return (br.rows||[]).map(normalizeStudent);}}catch(error){console.warn("[FichaCore] BL2EstudiantesRepo falló", error);}
    return rowsFromExcel(payload);
  }

  function rowsFromExcel(options){
    if(!excelRepo()){return [];}
    var rows=[];
    try{if(typeof excelRepo().filterStudents === "function"){rows=excelRepo().filterStudents({periodoId:options.periodId||"",estadoMatricula:options.matricula||"",division:options.division||""});}else if(typeof excelRepo().listStudentsByStatus === "function"){rows=excelRepo().listStudentsByStatus(options.matricula||"",options.periodId||"");}else if(typeof excelRepo().listAllStudents === "function"){rows=excelRepo().listAllStudents();}}catch(error){rows=[];}
    var q=norm(options.search||""), limit=Math.max(1, Number(options.limit||400)||400);
    return (rows||[]).map(normalizeStudent).filter(function(s){if(options.matricula&&s._estadoMatricula!==options.matricula){return false;}if(options.periodId&&!samePeriod(s._periodoId||s._periodo,options.periodId)){return false;}if(options.division&&!hasDivision(s,options.division)){return false;}if(q){var hay=norm([s._cedula,s._nombres,s._carrera,s._division,s._correo,s._celular,s._periodo,s._estadoMatricula,s._telegramUser,s._telegramChatId].join(" "));if(hay.indexOf(q)<0){return false;}}return true;}).slice(0,limit);
  }

  function students(matricula){return queryRows({matricula:matricula == null ? "ACTIVO" : matricula, limit:400});}
  function divisions(list, opts){opts=opts||{};var key=[opts.periodId||"", opts.matricula==null?"ACTIVO":opts.matricula].join("|");if(!list && cache.divisions[key]){return cache.divisions[key].slice();}var rows=list || queryRows({periodId:opts.periodId||"",matricula:opts.matricula==null?"ACTIVO":opts.matricula,limit:5000});var map={};rows.forEach(function(s){map[divisionOf(s)||"Sin división"]=true;});var out=Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es");});if(!list){cache.divisions[key]=out.slice();}return out;}
  function filter(opts){opts=opts||{};return queryRows({periodId:opts.periodId||"",division:opts.division||"",matricula:opts.matricula==null?"ACTIVO":opts.matricula,search:opts.search||"",limit:opts.limit||400,force:opts.force===true});}
  function getById(id, opts){var wanted=text(id), options=opts||{};if(!wanted){return null;}try{if(screenAdapter() && typeof screenAdapter().forFicha === "function"){var s=screenAdapter().forFicha(wanted, options);if(s && s.found && s.student){return normalizeStudent(s.student);}}}catch(error){}try{if(dataEngine() && typeof dataEngine().getStudentById === "function"){var d=dataEngine().getStudentById(wanted, options);if(d){return normalizeStudent(d);}}}catch(error){}try{if(bl2Students() && typeof bl2Students().obtenerPorCedula === "function"){var b=bl2Students().obtenerPorCedula(wanted, options);if(b){return normalizeStudent(b);}}}catch(error){}return filter(Object.assign({}, options, {matricula:options.matricula == null ? "" : options.matricula, search:wanted, limit:40})).find(function(s){return text(s._id) === wanted || text(s._cedula) === wanted;}) || null;}

  function buildReq(row, req){var status=requirementStatus(row, req);var raw=text(reqValue(row, req));return {key:status.key||req.key, field:req.field||req.key, label:status.label||req.label, icon:req.icon||"", value:raw || (status.applies === false ? "NO APLICA" : "NO CUMPLE"), estado:status.status, aplica:status.applies !== false, periodType:status.periodType};}
  function requisitos(row){return requirementsForStudent(row).map(function(req){return buildReq(row, req);}).filter(function(item){return item.aplica !== false;});}
  function especiales(row){return finalRequirements().map(function(req){return buildReq(row, req);});}
  function pendientes(row, includeSpecial){var source = includeSpecial ? requisitos(row).concat(especiales(row)) : requisitos(row);return source.filter(function(req){return req.estado !== "cumple" && req.estado !== "no_aplica";});}

  function numberValue(value){if(notasService() && typeof notasService().normalizarNota === "function"){return notasService().normalizarNota(value);}var raw=text(value).replace(",", ".");if(!raw){return null;}var n=Number(raw);return Number.isFinite(n)?n:null;}
  function round2(value){if(notasService() && typeof notasService().redondear2 === "function"){return notasService().redondear2(value);}return Number.isFinite(value)?Math.round(value*100)/100:null;}
  function calcularNfin(nart, ndef){if(notasService() && typeof notasService().calcularNfin === "function"){return notasService().calcularNfin(nart, ndef);}var art=numberValue(nart), def=numberValue(ndef);if(art===null||def===null||art<7){return null;}return round2((art*0.70)+(def*0.30));}
  function estadoNota(value){var n=numberValue(value);return n!=null&&n>=7?"cumple":"no_cumple";}
  function notasDesdeServicio(row){if(!(notasService() && typeof notasService().extraerNotas === "function")){return null;}var info=notasService().extraerNotas(row||{}), values={nart:info.nart,ndef:info.ndef,nfin:info.nfin};return NOTE_FIELDS.map(function(note){var n=values[note.key];return {key:note.key,label:note.label,value:n==null?"—":String(round2(n)),number:n,estado:estadoNota(n)};});}
  function notas(row){try{if(bl2Reqs() && typeof bl2Reqs().notes === "function"){return bl2Reqs().notes(row, NOTE_FIELDS);}}catch(error){}var fromService=notasDesdeServicio(row);if(fromService){return fromService;}var nart=numberValue(pick(row, NOTE_FIELDS[0].aliases, "")), ndef=numberValue(pick(row, NOTE_FIELDS[1].aliases, "")), nfin=numberValue(pick(row, NOTE_FIELDS[2].aliases, ""));if(nfin===null){nfin=calcularNfin(nart, ndef);}var values={nart:nart,ndef:ndef,nfin:nfin};return NOTE_FIELDS.map(function(note){var n=values[note.key];return {key:note.key,label:note.label,value:n==null?"—":String(round2(n)),number:n,estado:estadoNota(n)};});}

  function telegramInfo(row){var user=text(pick(row,["telegramUser","TelegramUser","telegramuser","usuarioTelegram","UsuarioTelegram","telegram","Telegram"],""));var chatId=text(pick(row,["telegramChatId","TelegramChatId","telegramchatid","chatIdTelegram","ChatIdTelegram","chatId","ChatId"],""));return {user:user,chatId:chatId};}
  function telegramUrl(row){var info=telegramInfo(row);if(info.user){return "https://t.me/" + encodeURIComponent(info.user.replace(/^@+/, ""));}if(info.chatId){return "tg://user?id=" + encodeURIComponent(info.chatId);}return "";}
  function saludo(){var h=new Date().getHours();if(h<12){return "Buen día";}if(h<19){return "Buena tarde";}return "Buena noche";}
  function studentMessage(row){row=normalizeStudent(row||{});var faltantes=pendientes(row,true);var lines=[saludo()+", "+(row._nombres||"estudiante")+".","","Le escribimos desde el área de Titulación.","Carrera: "+(row._carrera||"—"),"Período: "+(row._periodo||"—"),""];if(faltantes.length){lines.push("Requisitos pendientes:");faltantes.forEach(function(req){lines.push("- "+req.label);});}else{lines.push("No registra requisitos pendientes.");}lines.push("","Por favor revisar y regularizar la información pendiente.");return lines.join("\n");}
  function whatsappUrl(row){row=normalizeStudent(row||{});var phone=text(row&&row._celular).replace(/[^0-9]/g,"");if(!phone){return "";}if(phone.length===10&&phone.charAt(0)==="0"){phone="593"+phone.slice(1);}return "https://wa.me/"+phone+"?text="+encodeURIComponent(studentMessage(row));}
  function toText(row){if(!row){return "";}row=normalizeStudent(row);var faltantes=pendientes(row,true), tg=telegramInfo(row), ns=notas(row), approval=studentApproval(row);var lines=["FICHA DEL ESTUDIANTE","Nombre: "+row._nombres,"Cédula: "+row._cedula,"Carrera: "+row._carrera,"Período: "+row._periodo,"Matrícula: "+row._estadoMatricula,"Tipo de período: "+(approval.periodType&&approval.periodType.label||"—"),"Estado: "+(row._estado&&row._estado.label),"Correo: "+row._correo,"Celular: "+row._celular,"Telegram: "+(tg.user||tg.chatId||"—"),"","REQUISITOS PENDIENTES"];if(faltantes.length){faltantes.forEach(function(req){lines.push("- "+req.label);});}else{lines.push("Sin requisitos pendientes.");}lines.push("","NOTAS");ns.forEach(function(n){lines.push(n.label+": "+n.value);});return lines.join("\n");}
  function invalidate(){cache.periods=null;cache.divisions={};try{if(dataEngine()&&typeof dataEngine().invalidate==="function"){dataEngine().invalidate();}}catch(error){}try{if(window.BL2CacheResumen&&typeof window.BL2CacheResumen.invalidate==="function"){window.BL2CacheResumen.invalidate();}}catch(error){} }
  function source(){if(dataEngine()){return "BL2DataEngine";}if(bl2Students()){return "BL2";}return "ExcelLocalRepo";}

  window.FichaCore={version:VERSION,REQS:FALLBACK_BASE,SPECIAL_REQS:FALLBACK_FINAL,ALL_REQS:FALLBACK_BASE.concat(FALLBACK_EXTRA).concat(FALLBACK_FINAL),NOTE_FIELDS:NOTE_FIELDS,periods:periods,students:students,divisions:divisions,filter:filter,getById:getById,requisitos:requisitos,especiales:especiales,pendientes:pendientes,notas:notas,whatsappUrl:whatsappUrl,telegramUrl:telegramUrl,telegramInfo:telegramInfo,studentMessage:studentMessage,toText:toText,estadoCelda:estadoCelda,estadoNota:estadoNota,estadoMatricula:estadoMatricula,divisionOf:divisionOf,fieldValue:fieldValue,reqValue:reqValue,studentApproval:studentApproval,finalApproval:finalApproval,requirementsForStudent:requirementsForStudent,invalidate:invalidate,source:source,calcularNfin:calcularNfin};
})(window);
