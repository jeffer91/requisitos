/* =========================================================
Nombre completo: repo.core.js
Ruta o ubicación: /Requisitos/Reportes/repo.core.js
Función o funciones:
- Leer reportes desde BL2ReportesRepo/BL2DataEngine y usar ExcelLocalRepo como respaldo.
- Generar reportes generales, por carrera, por requisito y pendientes críticos.
- Respetar reglas PVC/Regular mediante BL2RequirementsEngine.
- Filtrar por período, división, matrícula y carrera.
- Mostrar ACTIVO por defecto.
Con qué se conecta:
- ../BaseLocal2/repositories/bl2-reportes.repo.js
- ../BaseLocal2/core/bl2-data-engine.js
- ../BaseLocal2/core/bl2-requirements-engine.js
- excel-local.repo.js
- bl-periodos-canon.service.js
- bl-divisiones.service.js
- repo.app.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-repo-core.1";
  var FALLBACK_REQS=[{key:"academico",label:"Académico"},{key:"documentacion",label:"Documentación"},{key:"financiero",label:"Financiero"},{key:"practicasvinculacion",label:"Prácticas"},{key:"vinculacion",label:"Vinculación"},{key:"seguimientograduados",label:"Seguimiento graduados"},{key:"ingles",label:"Inglés"},{key:"actualizaciondatos",label:"Actualización datos"}];

  function bl2(){return window.BL2ReportesRepo||null;}
  function useBL2(){return !!(bl2()&&typeof bl2().reportBuild==="function");}
  function dataEngine(){return window.BL2DataEngine||null;}
  function normalizer(){return window.BL2StudentNormalizer||null;}
  function reqEngine(){return window.BL2RequirementsEngine||window.StatsRules||null;}
  function text(v){return String(v==null?"":v).trim();}
  function norm(v){return text(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();}
  function pct(n,d){return d?Math.round((n*10000)/d)/100:0;}
  function estadoMatricula(v){return norm(v||"ACTIVO")==="retirado"?"RETIRADO":"ACTIVO";}
  function repo(){if(!window.ExcelLocalRepo)throw new Error("ExcelLocalRepo no disponible. Primero carga un Excel en Carga.");return window.ExcelLocalRepo;}
  function periods(){if(useBL2()){var data=bl2().reportBuild({matricula:"ACTIVO"});return data.periodList||[];}try{if(dataEngine()&&typeof dataEngine().listPeriods==="function")return dataEngine().listPeriods()||[];}catch(error){}return repo().listPeriods?repo().listPeriods():repo().getSnapshot().periods||[];}
  function rawStudents(matricula){try{if(dataEngine()&&typeof dataEngine().listStudents==="function")return dataEngine().listStudents({matricula:matricula==null?"ACTIVO":matricula,limit:0}).rows||[];}catch(error){}if(repo().listStudentsByStatus&&matricula!==undefined)return repo().listStudentsByStatus(matricula||"");return repo().listAllStudents?repo().listAllStudents():repo().getSnapshot().students||[];}
  function samePeriod(a,b){if(!text(b))return true;if(window.BLPeriodosCanon&&typeof window.BLPeriodosCanon.samePeriod==="function")return window.BLPeriodosCanon.samePeriod(a,b);return text(a)===text(b)||norm(a)===norm(b);}
  function divisionOf(row){if(row&&row._bl2Division)return row._bl2Division;if(window.BLDivisionesService&&typeof window.BLDivisionesService.studentDivision==="function")return window.BLDivisionesService.studentDivision(row);var list=Array.isArray(row&&row.divisiones)?row.divisiones:[];return list[0]||row.division||row.Division||row.División||"Sin división";}
  function hasDivision(row,division){if(!text(division))return true;if(window.BLDivisionesService&&typeof window.BLDivisionesService.hasDivision==="function")return window.BLDivisionesService.hasDivision(row,division);return norm(divisionOf(row))===norm(division);}
  function valueOf(row,key){try{if(reqEngine()&&typeof reqEngine().valueOf==="function")return reqEngine().valueOf(row||{},key);}catch(error){}return row&&row[key]!=null?row[key]:"";}
  function estadoCelda(v){try{if(reqEngine()&&typeof reqEngine().cellStatus==="function")return reqEngine().cellStatus(v);}catch(error){}return norm(v)==="cumple"?"cumple":"no_cumple";}
  function applicableReqs(row){try{if(reqEngine()&&typeof reqEngine().requirementsForStudent==="function")return reqEngine().requirementsForStudent(row||{});}catch(error){}return FALLBACK_REQS.slice();}
  function estadoGeneral(row){try{if(reqEngine()&&typeof reqEngine().studentApproval==="function"){var a=reqEngine().studentApproval(row||{});return {id:a.approved?"cumple":"no_cumple",label:a.approved?"Cumple todo":"No cumple",ok:a.applicableRequirements.length-a.missingRequirements.length,no:a.missingRequirements.length,pend:0,approved:a.approved,applicableRequirements:a.applicableRequirements,missingRequirements:a.missingRequirements};}}catch(error){}var ok=0,no=0;applicableReqs(row).forEach(function(req){if(estadoCelda(valueOf(row,req.key))==="cumple")ok++;else no++;});return {id:no?"no_cumple":"cumple",label:no?"No cumple":"Cumple todo",ok:ok,no:no,pend:0};}
  function decorate(row){var r=normalizer()&&typeof normalizer().normalize==="function"?normalizer().normalize(row||{}, {clone:false}):Object.assign({},row||{});r._cedula=text(r._bl2Id||r.cedula||r.numeroIdentificacion||r.numeroidentificacion);r._nombres=text(r._bl2Nombre||r.nombres||r.Nombres||r.nombre||r.estudiante);r._carrera=text(r._bl2Carrera||r.nombrecarrera||r.nombreCarrera||r.NombreCarrera||r.carrera)||"SIN CARRERA";r._division=divisionOf(r);r._periodo=text(r._bl2Periodo||r.periodoLabel||r.periodoId)||"SIN PERÍODO";r._periodoId=text(r._bl2PeriodoId||r.periodoId||r.ultimoPeriodoId||r.periodId);r._estadoMatricula=estadoMatricula(r._bl2EstadoMatricula||r.estadoMatricula);r._estado=estadoGeneral(r);return r;}
  function filtered(opts){opts=opts||{};var periodId=text(opts.periodId),division=text(opts.division),career=text(opts.career),matricula=opts.matricula==null?"ACTIVO":text(opts.matricula);return rawStudents(matricula).map(decorate).filter(function(s){if(matricula&&s._estadoMatricula!==matricula)return false;if(periodId&&!samePeriod(s._periodoId||s._periodo,periodId))return false;if(division&&!hasDivision(s,division))return false;if(career&&s._carrera!==career)return false;return true;});}
  function options(values){var map={};(values||[]).forEach(function(x){x=text(x);if(x)map[x]=true;});return Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es");});}
  function careers(list){return options((list||rawStudents("ACTIVO").map(decorate)).map(function(s){return s._carrera||"SIN CARRERA";}));}
  function divisions(list){var rows=list||rawStudents("ACTIVO").map(decorate);if(window.BLDivisionesService&&typeof window.BLDivisionesService.listDivisionsWithEmpty==="function")return window.BLDivisionesService.listDivisionsWithEmpty(rows,"");return options(rows.map(function(s){return divisionOf(s);}));}
  function byCareer(list){var map={};list.forEach(function(s){var k=s._carrera;if(!map[k])map[k]={key:k,total:0,cumple:0,pendiente:0,no_cumple:0,avance:0};map[k].total++;map[k][s._estado.id]++;});Object.keys(map).forEach(function(k){map[k].avance=pct(map[k].cumple,map[k].total);});return Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){return b.no_cumple-a.no_cumple||b.pendiente-a.pendiente||a.key.localeCompare(b.key,"es");});}
  function byRequirement(list){return FALLBACK_REQS.map(function(req){var r={key:req.key,label:req.label,total:list.length,cumple:0,pendiente:0,no_cumple:0,avance:0,atencion:0};list.forEach(function(row){var e=estadoCelda(valueOf(row,req.key));r[e==="cumple"?"cumple":"no_cumple"]++;});r.avance=pct(r.cumple,r.total);r.atencion=r.no_cumple*3+r.pendiente;return r;}).sort(function(a,b){return b.atencion-a.atencion;});}
  function pendingStudents(list){return list.filter(function(s){return s._estado.id!=="cumple";}).sort(function(a,b){return (b._estado.no*3+b._estado.pend)-(a._estado.no*3+a._estado.pend)||a._nombres.localeCompare(b._nombres,"es");});}
  function build(opts){opts=opts||{};if(opts.matricula==null)opts.matricula="ACTIVO";if(useBL2())return bl2().reportBuild(opts);var list=filtered(opts);var kpis={total:list.length,cumple:0,pendiente:0,no_cumple:0,avance:0};list.forEach(function(s){kpis[s._estado.id]++;});kpis.avance=pct(kpis.cumple,kpis.total);var baseForDivision=filtered({periodId:opts.periodId||"",division:"",matricula:opts.matricula||"",career:""});var baseForCareer=filtered({periodId:opts.periodId||"",division:opts.division||"",matricula:opts.matricula||"",career:""});var data={tipo:text(opts.tipo)||"general",generatedAt:new Date().toISOString(),kpis:kpis,carreras:byCareer(list),requisitos:byRequirement(list),pendientes:pendingStudents(list),periodList:periods(),divisionList:divisions(baseForDivision),careerList:careers(baseForCareer),rows:list,filters:opts,source:"RepoCore",version:VERSION};data.text=makeText(data);data.html=makeHtml(data);return data;}
  function makeText(data){var k=data.kpis;var lines=["REPORTE DE REQUISITOS","Fecha: "+new Date(data.generatedAt).toLocaleString(),"Tipo: "+data.tipo,"Matrícula: "+(data.filters.matricula||"Todos"),"División: "+(data.filters.division||"Todas"),"","RESUMEN GENERAL","Total estudiantes: "+k.total,"Cumplen todo: "+k.cumple,"Con pendientes: "+k.pendiente,"No cumplen: "+k.no_cumple,"Avance general: "+k.avance+"%",""];if(data.carreras[0])lines.push("Carrera con mayor atención: "+data.carreras[0].key+" (No cumple: "+data.carreras[0].no_cumple+", pendientes: "+data.carreras[0].pendiente+")");if(data.requisitos[0])lines.push("Requisito crítico: "+data.requisitos[0].label+" (No cumple: "+data.requisitos[0].no_cumple+", pendientes: "+data.requisitos[0].pendiente+")");lines.push("","RECOMENDACIÓN","Priorizar estudiantes activos con no cumplen y luego los que tienen pendientes acumulados.");return lines.join("\n");}
  function makeHtml(data){return "<h1>Reporte de Requisitos</h1><pre>"+makeText(data).replace(/&/g,"&amp;").replace(/</g,"&lt;")+"</pre>";}
  function source(){return useBL2()?"BL2ReportesRepo":(dataEngine()?"BL2DataEngine":"ExcelLocalRepo");}
  window.RepoCore={version:VERSION,REQS:FALLBACK_REQS,periods:periods,careers:careers,divisions:divisions,build:build,estadoCelda:estadoCelda,estadoGeneral:estadoGeneral,estadoMatricula:estadoMatricula,divisionOf:divisionOf,source:source};
})(window);
