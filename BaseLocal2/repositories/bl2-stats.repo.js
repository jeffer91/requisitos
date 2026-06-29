/* =========================================================
Nombre completo: bl2-stats.repo.js
Ruta o ubicación: /Requisitos/BaseLocal2/repositories/bl2-stats.repo.js
Función o funciones:
- Calcular estadísticas reutilizables para Stats, Coordi y Reportes desde BL2.
- Usar BL2DataEngine y BL2RequirementsEngine como fuente oficial.
- Mantener formato compatible con stats.core.js.
- Leer requisitos con alias flexibles desde el normalizador central.
Con qué se conecta:
- core/bl2-data-engine.js
- core/bl2-requirements-engine.js
- bl2-estudiantes.repo.js
- bl2-cache-resumen.service.js
- Stats/stats.core.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-alpha.3-core";

  function studentsRepo(){return window.BL2EstudiantesRepo || null;}
  function cache(){return window.BL2CacheResumen || null;}
  function engine(){return window.BL2DataEngine || null;}
  function reqEngine(){return window.BL2RequirementsEngine || window.StatsRules || null;}
  function text(v){return String(v == null ? "" : v).trim();}
  function norm(v){return text(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}
  function pct(n,d){return d ? Math.round((n * 10000) / d) / 100 : 0;}
  function estadoMatricula(v){return norm(v || "ACTIVO") === "retirado" ? "RETIRADO" : "ACTIVO";}

  function requirements(){return reqEngine() && reqEngine().FILTER_REQUIREMENTS ? reqEngine().FILTER_REQUIREMENTS.slice() : [];}
  function baseRequirements(){return reqEngine() && reqEngine().BASE_REQUIREMENTS ? reqEngine().BASE_REQUIREMENTS.slice() : [];}
  function finalRequirements(){return reqEngine() && reqEngine().FINAL_REQUIREMENTS ? reqEngine().FINAL_REQUIREMENTS.slice() : [];}
  function valueOf(row,key){return reqEngine() && typeof reqEngine().valueOf === "function" ? reqEngine().valueOf(row || {}, key) : (row && row[key] != null ? row[key] : "");}
  function estadoCelda(v){return reqEngine() && typeof reqEngine().cellStatus === "function" ? reqEngine().cellStatus(v) : (norm(v) === "cumple" ? "cumple" : "no_cumple");}
  function estadoGeneral(row){
    if(reqEngine() && typeof reqEngine().studentApproval === "function"){
      var approval = reqEngine().studentApproval(row || {});
      return {id:approval.approved ? "cumple" : "no_cumple",label:approval.label || (approval.approved ? "Aprobado" : "No cumple"),ok:approval.applicableRequirements.length - approval.missingRequirements.length,no:approval.missingRequirements.length,pend:0,approved:approval.approved,periodType:approval.periodType,applicableRequirements:approval.applicableRequirements,missingRequirements:approval.missingRequirements,notApplicableRequirements:approval.notApplicableRequirements || []};
    }
    return {id:"no_cumple",label:"No cumple",ok:0,no:1,pend:0,approved:false};
  }
  function divisionOf(row){if(row && row._bl2Division){return row._bl2Division;}var list = Array.isArray(row && row.divisiones) ? row.divisiones : [];return list[0] || row.division || "Sin división";}
  function samePeriod(a,b){if(!text(b)){return true;}if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function"){return window.BLPeriodosCanon.samePeriod(a,b);}return text(a) === text(b) || norm(a) === norm(b);}

  function decorate(row){
    var r = Object.assign({}, row || {});
    r._estado = r._estado || estadoGeneral(r);
    r._estadoMatricula = estadoMatricula(r._bl2EstadoMatricula || r.estadoMatricula);
    r._cedula = text(r._bl2Id || r.cedula || r.numeroIdentificacion || r.numeroidentificacion);
    r._nombres = text(r._bl2Nombre || r.nombres || r.Nombres || r.nombre || r.estudiante);
    r._carrera = text(r._bl2Carrera || r.nombrecarrera || r.nombreCarrera || r.NombreCarrera || r.carrera) || "SIN CARRERA";
    r._division = divisionOf(r);
    r._periodo = text(r._bl2Periodo || r.periodoLabel || r.periodoId) || "SIN PERÍODO";
    r._periodoId = text(r._bl2PeriodoId || r.periodoId || r._bl2Periodo);
    r._correo = text(r._bl2CorreoPersonal || r.CorreoPersonal || r.correoPersonal || r._bl2CorreoInstitucional || r.CorreoInstitucional || r.correoInstitucional);
    r._celular = text(r._bl2Celular || r.celular || r.Celular || r.telefono || r.whatsapp);
    return r;
  }

  function rows(opts){
    opts = opts || {};
    var result;
    if(engine() && typeof engine().listStudents === "function"){
      result = engine().listStudents(Object.assign({}, opts, {limit:0}));
    }else if(studentsRepo() && typeof studentsRepo().buscar === "function"){
      result = studentsRepo().buscar({periodId:opts.periodId || "",division:opts.division || "",matricula:opts.matricula == null ? "ACTIVO" : opts.matricula,search:"",limit:0,force:opts.force === true});
    }else{
      result = {rows:[], total:0};
    }
    var list = (result.rows || []).map(decorate);
    var career = text(opts.career || opts.carrera), status = text(opts.status || opts.estado);
    return list.filter(function(s){if(opts.periodId && !samePeriod(s._periodoId || s._periodo, opts.periodId)){return false;}if(career && s._carrera !== career){return false;}if(status && s._estado.id !== status){return false;}return true;});
  }

  function byKey(list,getKey){var out={};list.forEach(function(row){var k=getKey(row)||"Sin dato";if(!out[k]){out[k]={key:k,total:0,cumple:0,pendiente:0,no_cumple:0,avance:0};}out[k].total++;out[k][row._estado.id]++;});Object.keys(out).forEach(function(k){out[k].avance=pct(out[k].cumple,out[k].total);});return Object.keys(out).map(function(k){return out[k];}).sort(function(a,b){return b.total-a.total||a.key.localeCompare(b.key,"es");});}
  function requisitos(list){
    var reqs = requirements().filter(function(item){return item.group !== "final";});
    return reqs.map(function(req){var item={key:req.key,label:req.label,total:list.length,aplica:0,no_aplica:0,cumple:0,pendiente:0,no_cumple:0,avance:0,atencion:0};list.forEach(function(row){var st=reqEngine() && typeof reqEngine().requirementStatus === "function" ? reqEngine().requirementStatus(row,req.key) : {applies:true,status:estadoCelda(valueOf(row,req.key)),cumple:estadoCelda(valueOf(row,req.key))==="cumple"};if(st.applies === false){item.no_aplica++;return;}item.aplica++;if(st.cumple){item.cumple++;}else{item.no_cumple++;}});item.avance=pct(item.cumple,item.aplica||item.total);item.atencion=item.no_cumple*3+item.pendiente;return item;});
  }
  function requisitosFinales(list){return finalRequirements().map(function(req){var item={key:req.key,label:req.label,total:list.length,aplica:list.length,no_aplica:0,cumple:0,pendiente:0,no_cumple:0,avance:0};list.forEach(function(row){if(estadoCelda(valueOf(row,req.key))==="cumple"){item.cumple++;}else{item.no_cumple++;}});item.avance=pct(item.cumple,item.aplica);return item;});}
  function listOptions(base){var map={};(base||[]).forEach(function(x){if(text(x)){map[x]=true;}});return Object.keys(map).sort(function(a,b){return a.localeCompare(b,"es");});}
  function periodList(){if(engine() && typeof engine().listPeriods === "function"){return engine().listPeriods();}return studentsRepo() && studentsRepo().listPeriods ? studentsRepo().listPeriods() : [];}

  function resumen(opts){opts=Object.assign({matricula:"ACTIVO"},opts||{});if(cache()){return cache().getOrSet("stats",opts,function(){return buildResumen(opts);},{ttl:3000});}return buildResumen(opts);}
  function buildResumen(opts){
    if(engine() && typeof engine().statsSummary === "function"){
      var fromEngine = engine().statsSummary(opts);
      if(fromEngine && Array.isArray(fromEngine.rows)){
        fromEngine.rows = fromEngine.rows.map(decorate);
        fromEngine.estudiantes = fromEngine.rows;
        fromEngine.requisitosFinales = requisitosFinales(fromEngine.rows);
        return fromEngine;
      }
    }
    var list = rows(opts), total=list.length, estados={cumple:0,pendiente:0,no_cumple:0}, matriculas={ACTIVO:0,RETIRADO:0}, reqs=requisitos(list), finals=requisitosFinales(list);
    list.forEach(function(s){estados[s._estado.id]++;matriculas[s._estadoMatricula]=(matriculas[s._estadoMatricula]||0)+1;});
    var totalReq=reqs.reduce(function(a,r){return a+(r.aplica||r.total||0);},0), okReq=reqs.reduce(function(a,r){return a+r.cumple;},0), baseForDivision=rows({periodId:opts.periodId||"",matricula:opts.matricula||"",division:"",career:"",status:""}), baseForCareer=rows({periodId:opts.periodId||"",matricula:opts.matricula||"",division:opts.division||"",career:"",status:""});
    return {total:total,estados:estados,matriculas:matriculas,avanceGeneral:pct(okReq,totalReq),requisitos:reqs,requisitosFinales:finals,carreras:byKey(list,function(s){return s._carrera;}),periodos:byKey(list,function(s){return s._periodo;}),divisiones:byKey(list,function(s){return s._division;}),periodList:periodList(),divisionList:listOptions(baseForDivision.map(function(s){return s._division||"Sin división";})),careerList:listOptions(baseForCareer.map(function(s){return s._carrera||"SIN CARRERA";})),rows:list,estudiantes:list,diagnostics:{generatedAt:new Date().toISOString(),source:"BL2StatsRepo",version:VERSION,totalStudents:total,totalRequirements:totalReq,fulfilledRequirements:okReq,filters:opts||{}}};
  }

  window.BL2StatsRepo={version:VERSION,REQS:requirements(),BASE_REQUIREMENTS:baseRequirements(),rows:rows,resumen:resumen,estadoCelda:estadoCelda,estadoGeneral:estadoGeneral,estadoMatricula:estadoMatricula,divisionOf:divisionOf,valueOf:valueOf,requisitos:requisitos,requisitosFinales:requisitosFinales,source:function(){return engine()?"BL2DataEngine":"BL2StatsRepo";}};
})(window);
