/* =========================================================
Nombre completo: coordi.core.js
Ruta o ubicación: /Requisitos/Coordi/coordi.core.js
Función o funciones:
- Leer coordinación desde BL2ReportesRepo/BL2DataEngine y usar ExcelLocalRepo como respaldo.
- Calcular prioridades usando BL2RequirementsEngine para respetar PVC/Regular.
- Generar resúmenes por carrera, requisito y estudiante.
- Filtrar por período, división, carrera y prioridad.
Con qué se conecta:
- ../BaseLocal2/repositories/bl2-reportes.repo.js
- ../BaseLocal2/core/bl2-data-engine.js
- ../BaseLocal2/core/bl2-requirements-engine.js
- excel-local.repo.js
- bl-periodos-canon.service.js
- bl-divisiones.service.js
- bl-campos.js
- coordi.app.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-coordi-core.1";

  function label(key,fallback){try{if(window.BLCampos&&typeof window.BLCampos.requirementLabel==="function")return window.BLCampos.requirementLabel(key,fallback);}catch(error){}return fallback||key;}
  function req(key,fallback){return {key:key,label:label(key,fallback)};}
  var FALLBACK_REQS=[req("academico","Académico"),req("documentacion","Documentación"),req("financiero","Financiero"),req("practicasvinculacion","Prácticas"),req("vinculacion","Vinculación"),req("seguimientograduados","Seguimiento graduados"),req("ingles","Inglés"),req("actualizaciondatos","Actualización de datos")];

  function bl2(){return window.BL2ReportesRepo||null;}
  function reqEngine(){return window.BL2RequirementsEngine||window.StatsRules||null;}
  function dataEngine(){return window.BL2DataEngine||null;}
  function normalizer(){return window.BL2StudentNormalizer||null;}
  function useBL2(){return !!(bl2()&&typeof bl2().coordiSummary==="function");}
  function text(v){return String(v==null?"":v).trim();}
  function norm(v){return text(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();}
  function pct(n,d){return d?Math.round((n*10000)/d)/100:0;}
  function repo(){if(!window.ExcelLocalRepo)throw new Error("ExcelLocalRepo no disponible. Primero carga un Excel en Requisito.");return window.ExcelLocalRepo;}

  function periods(){if(useBL2())return (bl2().coordiSummary({}).periodList||[]);try{if(dataEngine()&&typeof dataEngine().listPeriods==="function")return dataEngine().listPeriods()||[];}catch(error){}return repo().listPeriods?repo().listPeriods():repo().getSnapshot().periods||[];}
  function rawStudents(){try{if(dataEngine()&&typeof dataEngine().listStudents==="function")return dataEngine().listStudents({matricula:"ACTIVO",limit:0}).rows||[];}catch(error){}return repo().listAllStudents?repo().listAllStudents():repo().getSnapshot().students||[];}
  function samePeriod(a,b){if(!text(b))return true;if(window.BLPeriodosCanon&&typeof window.BLPeriodosCanon.samePeriod==="function")return window.BLPeriodosCanon.samePeriod(a,b);return text(a)===text(b)||norm(a)===norm(b);}
  function divisionOf(row){if(row&&row._bl2Division)return row._bl2Division;if(window.BLDivisionesService&&typeof window.BLDivisionesService.studentDivision==="function")return window.BLDivisionesService.studentDivision(row);var list=Array.isArray(row&&row.divisiones)?row.divisiones:[];return list[0]||row.division||row.Division||row.División||"Sin división";}
  function hasDivision(row,division){if(!text(division))return true;if(window.BLDivisionesService&&typeof window.BLDivisionesService.hasDivision==="function")return window.BLDivisionesService.hasDivision(row,division);return norm(divisionOf(row))===norm(division);}
  function valueOf(row,key){try{if(reqEngine()&&typeof reqEngine().valueOf==="function")return reqEngine().valueOf(row||{},key);}catch(error){}try{if(normalizer()&&typeof normalizer().value==="function")return normalizer().value(row||{},key);}catch(error){}return row&&row[key]!=null?row[key]:"";}
  function estadoCelda(v){try{if(reqEngine()&&typeof reqEngine().cellStatus==="function")return reqEngine().cellStatus(v);}catch(error){}return norm(v)==="cumple"?"cumple":"no_cumple";}
  function applicableReqs(row){try{if(reqEngine()&&typeof reqEngine().requirementsForStudent==="function")return reqEngine().requirementsForStudent(row||{});}catch(error){}return FALLBACK_REQS.slice();}

  function priority(row){
    if(useBL2())return bl2().priority(row);
    var no=0,pend=0,ok=0;
    applicableReqs(row).forEach(function(req){var e=estadoCelda(valueOf(row,req.key));if(e==="cumple")ok++;else no++;});
    var score=no*3+pend, level=score>=8||no>=2?"alta":score>=3?"media":"baja";
    return {level:level,label:level==="alta"?"Alta":level==="media"?"Media":"Baja",score:score,ok:ok,no:no,pend:pend,total:applicableReqs(row).length};
  }

  function decorate(row){var r=normalizer()&&typeof normalizer().normalize==="function"?normalizer().normalize(row||{}, {clone:false}):Object.assign({},row||{});r._cedula=text(r._bl2Id||r.cedula||r.numeroIdentificacion||r.numeroidentificacion);r._nombres=text(r._bl2Nombre||r.nombres||r.Nombres||r.nombre||r.estudiante);r._carrera=text(r._bl2Carrera||r.nombrecarrera||r.nombreCarrera||r.NombreCarrera||r.carrera)||"SIN CARRERA";r._division=divisionOf(r);r._periodo=text(r._bl2Periodo||r.periodoLabel||r.periodoId)||"SIN PERÍODO";r._periodoId=text(r._bl2PeriodoId||r.periodoId||r.ultimoPeriodoId||r.periodId);r._correo=text(r._bl2CorreoPersonal||r.correopersonal||r.correoPersonal||r.correoinstitucional||r.correoInstitucional);r._celular=text(r._bl2Celular||r.celular||r.telefono||r.whatsapp);r._priority=priority(r);return r;}
  function filtered(opts){opts=opts||{};if(useBL2())return bl2().coordiSummary(opts).rows||[];var periodId=text(opts.periodId),division=text(opts.division),career=text(opts.career),priorityLevel=text(opts.priority);return rawStudents().map(decorate).filter(function(s){if(periodId&&!samePeriod(s._periodoId||s._periodo,periodId))return false;if(division&&!hasDivision(s,division))return false;if(career&&s._carrera!==career)return false;if(priorityLevel&&s._priority.level!==priorityLevel)return false;return true;});}
  function listOptions(values){var map={};(values||[]).forEach(function(value){value=text(value);if(value)map[value]=true;});return Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es");});}
  function careers(list){return listOptions((list||rawStudents().map(decorate)).map(function(s){return s._carrera||"SIN CARRERA";}));}
  function divisions(list){var rows=list||rawStudents().map(decorate);if(window.BLDivisionesService&&typeof window.BLDivisionesService.listDivisionsWithEmpty==="function")return window.BLDivisionesService.listDivisionsWithEmpty(rows,"");return listOptions(rows.map(function(s){return divisionOf(s);}));}
  function byCareer(list){var map={};list.forEach(function(s){var k=s._carrera;if(!map[k])map[k]={key:k,total:0,alta:0,media:0,baja:0,pendientes:0,noCumple:0,avance:0};map[k].total++;map[k][s._priority.level]++;map[k].pendientes+=s._priority.pend;map[k].noCumple+=s._priority.no;});Object.keys(map).forEach(function(k){var x=map[k];x.avance=pct(x.baja,x.total);});return Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){return b.alta-a.alta||b.pendientes-a.pendientes||a.key.localeCompare(b.key,"es");});}
  function byRequirement(list){return FALLBACK_REQS.map(function(req){var item={key:req.key,label:req.label,total:list.length,cumple:0,pendiente:0,no_cumple:0,atencion:0};list.forEach(function(row){var e=estadoCelda(valueOf(row,req.key));item[e==="cumple"?"cumple":"no_cumple"]++;});item.atencion=item.no_cumple*3+item.pendiente;return item;}).sort(function(a,b){return b.atencion-a.atencion;});}
  function summary(opts){opts=opts||{};if(useBL2())return bl2().coordiSummary(opts);var list=filtered(opts);var k={total:list.length,alta:0,media:0,baja:0,carreras:0};list.forEach(function(s){k[s._priority.level]++;});var careerSummary=byCareer(list);k.carreras=careerSummary.length;var baseForDivision=filtered({periodId:opts.periodId||"",division:"",career:"",priority:""});var baseForCareer=filtered({periodId:opts.periodId||"",division:opts.division||"",career:"",priority:""});return {kpis:k,rows:list.sort(function(a,b){return b._priority.score-a._priority.score||a._nombres.localeCompare(b._nombres,"es");}),carreras:careerSummary,requisitos:byRequirement(list),periodList:periods(),divisionList:divisions(baseForDivision),careerList:careers(baseForCareer),diagnostics:{generatedAt:new Date().toISOString(),source:"CoordiCore",version:VERSION,filters:opts,total:list.length,divisiones:divisions(baseForDivision)}};}
  function message(data,type){if(useBL2())return bl2().message(data,type);data=data||summary({});type=type||"general";var k=data.kpis||{},topCareer=(data.carreras||[])[0],topReq=(data.requisitos||[])[0];if(type==="carrera"&&topCareer){return "Resumen de coordinación por carrera:\n\nLa carrera con mayor atención es "+topCareer.key+".\nTotal estudiantes: "+topCareer.total+".\nPrioridad alta: "+topCareer.alta+".\nPendientes acumulados: "+topCareer.pendientes+".\n\nSe recomienda revisar primero los casos de prioridad alta y confirmar los requisitos pendientes.";}if(type==="pendientes"&&topReq){return "Seguimiento de requisitos críticos:\n\nEl requisito con mayor atención es: "+topReq.label+".\nPendientes: "+topReq.pendiente+".\nNo cumplen: "+topReq.no_cumple+".\n\nFavor revisar esta información y coordinar la actualización correspondiente.";}return "Resumen general de coordinación:\n\nTotal estudiantes revisados: "+(k.total||0)+".\nDivisión: "+((data.diagnostics&&data.diagnostics.filters&&data.diagnostics.filters.division)||"Todas")+".\nPrioridad alta: "+(k.alta||0)+".\nPrioridad media: "+(k.media||0)+".\nPrioridad baja: "+(k.baja||0)+".\nCarreras involucradas: "+(k.carreras||0)+".\n\nSe recomienda iniciar el seguimiento por los estudiantes con prioridad alta.";}
  function source(){return useBL2()?"BL2ReportesRepo":(dataEngine()?"BL2DataEngine":"ExcelLocalRepo");}
  window.CoordiCore={version:VERSION,REQS:FALLBACK_REQS,periods:periods,careers:careers,divisions:divisions,filtered:filtered,summary:summary,message:message,priority:priority,divisionOf:divisionOf,source:source};
})(window);
