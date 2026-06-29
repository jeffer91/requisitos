/* =========================================================
Nombre completo: bl2-reportes.repo.js
Ruta o ubicación: /Requisitos/BaseLocal2/repositories/bl2-reportes.repo.js
Función o funciones:
- Generar reportes y coordinación desde BL2DataEngine/BL2StatsRepo.
- Evitar duplicar cálculos en Coordi y Reportes.
- Usar BL2RequirementsEngine para respetar PVC/Regular.
- Leer requisitos con alias centralizados y no exigir Titulación en PVC.
- Mantener formatos compatibles con coordi.core.js y repo.core.js.
Con qué se conecta:
- ../core/bl2-data-engine.js
- ../core/bl2-requirements-engine.js
- bl2-stats.repo.js
- bl2-cache-resumen.service.js
- Coordi/coordi.core.js
- Reportes/repo.core.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-alpha.3-core";

  function stats(){return window.BL2StatsRepo || null;}
  function cache(){return window.BL2CacheResumen || null;}
  function reqEngine(){return window.BL2RequirementsEngine || window.StatsRules || null;}
  function engine(){return window.BL2DataEngine || null;}
  function text(v){return String(v==null?"":v).trim();}
  function pct(n,d){return d?Math.round((n*10000)/d)/100:0;}
  function now(){return new Date().toISOString();}
  function estadoCelda(value){try{if(reqEngine()&&typeof reqEngine().cellStatus==="function")return reqEngine().cellStatus(value);}catch(error){}try{if(stats()&&typeof stats().estadoCelda==="function")return stats().estadoCelda(value);}catch(error){}return String(value||"").toLowerCase().indexOf("cumple")>=0?"cumple":"no_cumple";}
  function valueOf(row,key){try{if(reqEngine()&&typeof reqEngine().valueOf==="function")return reqEngine().valueOf(row||{},key);}catch(error){}return row&&row[key]!=null?row[key]:"";}
  function requirementList(){try{if(reqEngine()&&Array.isArray(reqEngine().FILTER_REQUIREMENTS))return reqEngine().FILTER_REQUIREMENTS.slice();}catch(error){}return stats()&&stats().REQS?stats().REQS.slice():[];}
  function isFinal(key){try{return reqEngine()&&typeof reqEngine().isFinalRequirement==="function"&&reqEngine().isFinalRequirement(key);}catch(error){return false;}}
  function reqStatus(row,key){try{if(reqEngine()&&typeof reqEngine().requirementStatus==="function")return reqEngine().requirementStatus(row||{},key);}catch(error){}return {applies:true,cumple:estadoCelda(valueOf(row,key))==="cumple",status:estadoCelda(valueOf(row,key))};}

  function priority(row){
    var e=row&&row._estado?row._estado:{ok:0,no:0,pend:0};
    var score=(e.no||0)*3+(e.pend||0);
    var level=score>=8||(e.no||0)>=2?"alta":score>=3?"media":"baja";
    var total=e.applicableRequirements&&e.applicableRequirements.length?e.applicableRequirements.length:((reqEngine()&&reqEngine().BASE_REQUIREMENTS)?reqEngine().BASE_REQUIREMENTS.length:8);
    return {level:level,label:level==="alta"?"Alta":level==="media"?"Media":"Baja",score:score,ok:e.ok||0,no:e.no||0,pend:e.pend||0,total:total};
  }

  function coordiSummary(opts){
    opts=opts||{};
    if(cache()){return cache().getOrSet("coordi",opts,function(){return buildCoordi(opts);},{ttl:3000});}
    return buildCoordi(opts);
  }

  function summaryBase(opts){
    opts=opts||{};
    if(stats()&&typeof stats().resumen==="function")return stats().resumen({periodId:opts.periodId||"",division:opts.division||"",matricula:opts.matricula==null?"ACTIVO":opts.matricula,career:opts.career||"",status:opts.status||"",force:opts.force===true});
    if(engine()&&typeof engine().statsSummary==="function")return engine().statsSummary(opts);
    return {rows:[],periodList:[],divisionList:[],careerList:[],carreras:[],requisitos:[],requisitosFinales:[],total:0,estados:{cumple:0,pendiente:0,no_cumple:0},avanceGeneral:0};
  }

  function buildCoordi(opts){
    var base=summaryBase(Object.assign({matricula:"ACTIVO"},opts||{}));
    var priorityLevel=text(opts.priority);
    var rows=(base.rows||[]).map(function(row){var r=Object.assign({},row);r._priority=priority(r);return r;}).filter(function(row){return !priorityLevel||row._priority.level===priorityLevel;}).sort(function(a,b){return b._priority.score-a._priority.score||String(a._nombres||"").localeCompare(String(b._nombres||""),"es");});
    var k={total:rows.length,alta:0,media:0,baja:0,carreras:0};
    rows.forEach(function(s){k[s._priority.level]++;});
    var carreras=byCareer(rows);k.carreras=carreras.length;
    return {kpis:k,rows:rows,carreras:carreras,requisitos:byRequirement(rows),periodList:base.periodList||[],divisionList:base.divisionList||[],careerList:base.careerList||[],diagnostics:{generatedAt:now(),source:"BL2ReportesRepo.coordi",version:VERSION,filters:opts,total:rows.length,baseSource:base.diagnostics&&base.diagnostics.source}};
  }

  function byCareer(list){var map={};list.forEach(function(s){var k=s._carrera||"SIN CARRERA";if(!map[k])map[k]={key:k,total:0,alta:0,media:0,baja:0,pendientes:0,noCumple:0,avance:0};map[k].total++;map[k][s._priority.level]++;map[k].pendientes+=s._priority.pend;map[k].noCumple+=s._priority.no;});Object.keys(map).forEach(function(k){var x=map[k];x.avance=pct(x.baja,x.total);});return Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){return b.alta-a.alta||b.pendientes-a.pendientes||a.key.localeCompare(b.key,"es");});}
  function byRequirement(list){return requirementList().filter(function(req){return !isFinal(req.key);}).map(function(req){var item={key:req.key,label:req.label,total:list.length,cumple:0,pendiente:0,no_cumple:0,no_aplica:0,atencion:0,avance:0};list.forEach(function(row){var st=reqStatus(row,req.key);if(st.applies===false){item.no_aplica++;return;}if(st.cumple){item.cumple++;}else{item.no_cumple++;}});item.atencion=item.no_cumple*3+item.pendiente;item.avance=pct(item.cumple,item.total-item.no_aplica);return item;}).sort(function(a,b){return b.atencion-a.atencion;});}

  function reportBuild(opts){
    opts=Object.assign({tipo:"general",matricula:"ACTIVO"},opts||{});
    if(cache()){return cache().getOrSet("reportes",opts,function(){return buildReport(opts);},{ttl:3000});}
    return buildReport(opts);
  }

  function buildReport(opts){
    var base=summaryBase(opts);
    var kpis={total:base.total||0,cumple:(base.estados&&base.estados.cumple)||0,pendiente:(base.estados&&base.estados.pendiente)||0,no_cumple:(base.estados&&base.estados.no_cumple)||0,avance:base.avanceGeneral||0};
    var pendientes=(base.rows||[]).filter(function(s){return s._estado&&s._estado.id!=="cumple";}).sort(function(a,b){return ((b._estado.no||0)*3+(b._estado.pend||0))-((a._estado.no||0)*3+(a._estado.pend||0))||String(a._nombres||"").localeCompare(String(b._nombres||""),"es");});
    var data={tipo:text(opts.tipo)||"general",generatedAt:now(),kpis:kpis,carreras:base.carreras||[],requisitos:(base.requisitos||byRequirement(base.rows||[])).slice().sort(function(a,b){return (b.atencion||0)-(a.atencion||0);}),pendientes:pendientes,periodList:base.periodList||[],divisionList:base.divisionList||[],careerList:base.careerList||[],rows:base.rows||[],filters:opts,source:"BL2ReportesRepo",diagnostics:{source:"BL2ReportesRepo.reportes",version:VERSION,baseSource:base.diagnostics&&base.diagnostics.source,generatedAt:now()}};
    data.text=makeText(data);data.html=makeHtml(data);return data;
  }

  function makeText(data){var k=data.kpis;var lines=["REPORTE DE REQUISITOS","Fecha: "+new Date(data.generatedAt).toLocaleString(),"Tipo: "+data.tipo,"Matrícula: "+(data.filters.matricula||"Todos"),"División: "+(data.filters.division||"Todas"),"","RESUMEN GENERAL","Total estudiantes: "+k.total,"Cumplen todo: "+k.cumple,"Con pendientes: "+k.pendiente,"No cumplen: "+k.no_cumple,"Avance general: "+k.avance+"%",""];if(data.carreras[0])lines.push("Carrera con mayor atención: "+data.carreras[0].key+" (No cumple: "+data.carreras[0].no_cumple+", pendientes: "+data.carreras[0].pendiente+")");if(data.requisitos[0])lines.push("Requisito crítico: "+data.requisitos[0].label+" (No cumple: "+data.requisitos[0].no_cumple+", pendientes: "+data.requisitos[0].pendiente+")");lines.push("","RECOMENDACIÓN","Priorizar estudiantes activos con no cumplen y luego los que tienen pendientes acumulados.");return lines.join("\n");}
  function makeHtml(data){return "<h1>Reporte de Requisitos</h1><pre>"+makeText(data).replace(/&/g,"&amp;").replace(/</g,"&lt;")+"</pre>";}
  function message(data,type){data=data||coordiSummary({});type=type||"general";var k=data.kpis||{};var topCareer=(data.carreras||[])[0];var topReq=(data.requisitos||[])[0];if(type==="carrera"&&topCareer){return "Resumen de coordinación por carrera:\n\nLa carrera con mayor atención es "+topCareer.key+".\nTotal estudiantes: "+topCareer.total+".\nPrioridad alta: "+topCareer.alta+".\nPendientes acumulados: "+topCareer.pendientes+".\n\nSe recomienda revisar primero los casos de prioridad alta y confirmar los requisitos pendientes.";}if(type==="pendientes"&&topReq){return "Seguimiento de requisitos críticos:\n\nEl requisito con mayor atención es: "+topReq.label+".\nPendientes: "+topReq.pendiente+".\nNo cumplen: "+topReq.no_cumple+".\n\nFavor revisar esta información y coordinar la actualización correspondiente.";}return "Resumen general de coordinación:\n\nTotal estudiantes revisados: "+(k.total||0)+".\nDivisión: "+((data.diagnostics&&data.diagnostics.filters&&data.diagnostics.filters.division)||"Todas")+".\nPrioridad alta: "+(k.alta||0)+".\nPrioridad media: "+(k.media||0)+".\nPrioridad baja: "+(k.baja||0)+".\nCarreras involucradas: "+(k.carreras||0)+".\n\nSe recomienda iniciar el seguimiento por los estudiantes con prioridad alta.";}

  window.BL2ReportesRepo={version:VERSION,coordiSummary:coordiSummary,reportBuild:reportBuild,message:message,priority:priority,byRequirement:byRequirement,source:function(){return "BL2ReportesRepo";}};
})(window);
