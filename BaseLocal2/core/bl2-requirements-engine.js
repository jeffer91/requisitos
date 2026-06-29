/* =========================================================
Nombre completo: bl2-requirements-engine.js
Ruta o ubicación: /Requisitos/BaseLocal2/core/bl2-requirements-engine.js
Función o funciones:
- Centralizar reglas de requisitos para todas las pantallas de Requisitos.
- Clasificar períodos como PVC o Regular.
- Evaluar cumplimiento por estudiante sin depender de Stats.
- Definir requisitos base, extra regular y aprobación final.
Con qué se conecta:
- bl2-student-normalizer.js
- bl2-memory-index.js
- bl2-data-engine.js
- stats.rules.js como compatibilidad temporal
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-core.1";
  var MONTHS = {enero:1,ene:1,febrero:2,feb:2,marzo:3,mar:3,abril:4,abr:4,mayo:5,may:5,junio:6,jun:6,julio:7,jul:7,agosto:8,ago:8,septiembre:9,setiembre:9,sept:9,sep:9,set:9,octubre:10,oct:10,noviembre:11,nov:11,diciembre:12,dic:12};
  var OK_VALUES = ["si","sí","s","ok","cumple","aprobado","aprobada","1","true","x","validado","validada","completo","completa"];

  function req(key,label,group){return {key:key,label:label,group:group || "requisito"};}
  var BASE = [req("academico","Académico"),req("documentacion","Documentación"),req("financiero","Financiero"),req("practicasvinculacion","Prácticas"),req("vinculacion","Vinculación"),req("seguimientograduados","Seguimiento graduados"),req("ingles","Inglés"),req("actualizaciondatos","Actualización de datos")];
  var REGULAR_EXTRA = [req("titulacion","Titulación")];
  var FINAL = [req("aprobaciontitulacion","Aprobación titulación","final"),req("aprobacioncomplexivoproyecto","Aprobación complexivo/proyecto","final")];

  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();}
  function compact(value){return norm(value).replace(/[^a-z0-9]/g,"");}
  function cloneReq(item){return {key:item.key,label:item.label,group:item.group || "requisito"};}
  function cloneList(list){return (list || []).map(cloneReq);}

  var FIELD_ALIASES = {
    academico:["Academico","Académico","academico","académico"],
    documentacion:["Documentacion","Documentación","documentacion","documentación"],
    financiero:["Financiero","financiero"],
    titulacion:["Titulacion","Titulación","titulacion","titulación"],
    practicasvinculacion:["PrácticasVinculacion","PracticasVinculacion","practicasVinculacion","prácticasVinculacion","Prácticas Vinculación","Practicas Vinculacion","Prácticas/Vinculación","Practicas/Vinculacion","practicasvinculacion","Practicas","Prácticas"],
    vinculacion:["Vinculacion","Vinculación","vinculacion","vinculación"],
    seguimientograduados:["SeguimientoGraduados","seguimientoGraduados","seguimientograduados","Seguimiento graduados"],
    ingles:["Ingles","Inglés","ingles","inglés"],
    actualizaciondatos:["ActualizaciónDatos","ActualizacionDatos","actualizacionDatos","actualizaciónDatos","actualizaciondatos","Actualización de datos","Actualizacion de datos"],
    aprobaciontitulacion:["AprobacionTitulacion","AprobaciónTitulacion","Aprobacion Titulacion","aprobacionTitulacion","aprobaciontitulacion"],
    aprobacioncomplexivoproyecto:["AprobacionComplexivoProyecto","AprobaciónComplexivoProyecto","Aprobacion Complexivo Proyecto","Aprobacion Complexivo/Proyecto","aprobacionComplexivoProyecto","aprobacioncomplexivoproyecto"]
  };

  function ownValue(row, aliases){
    row = row || {};
    aliases = aliases || [];
    var keys = Object.keys(row);
    var wanted = aliases.map(compact);

    for(var i = 0; i < aliases.length; i += 1){
      if(Object.prototype.hasOwnProperty.call(row, aliases[i]) && text(row[aliases[i]]) !== ""){
        return row[aliases[i]];
      }
    }

    for(var j = 0; j < keys.length; j += 1){
      if(wanted.indexOf(compact(keys[j])) >= 0 && row[keys[j]] != null && text(row[keys[j]]) !== ""){
        return row[keys[j]];
      }
    }

    return "";
  }

  function valueOf(row,key){
    row = row || {};
    key = text(key);

    var direct = ownValue(row, [key]);
    if(text(direct) !== ""){
      return direct;
    }

    try{
      if(window.BL2StudentNormalizer && typeof window.BL2StudentNormalizer.value === "function"){
        var normalizedValue = window.BL2StudentNormalizer.value(row, key);
        if(text(normalizedValue) !== ""){
          return normalizedValue;
        }
      }
    }catch(error){}

    try{
      if(window.BLCampos && typeof window.BLCampos.getValue === "function"){
        var fieldValue = window.BLCampos.getValue(row, key, "");
        if(text(fieldValue) !== ""){
          return fieldValue;
        }
      }
    }catch(error){}

    var aliases = FIELD_ALIASES[compact(key)] || [];
    var aliasValue = ownValue(row, aliases);
    if(text(aliasValue) !== ""){
      return aliasValue;
    }

    try{
      if(window.StatsRules && typeof window.StatsRules.valueOf === "function"){
        var statsValue = window.StatsRules.valueOf(row, key);
        if(text(statsValue) !== ""){
          return statsValue;
        }
      }
    }catch(error){}

    return "";
  }

  function monthsFromText(value){
    var source = norm(value), out = [], seen = {};
    Object.keys(MONTHS).forEach(function(name){
      var month = MONTHS[name];
      var pattern = new RegExp("(^|[^a-z])" + name + "([^a-z]|$)", "i");
      if(pattern.test(source) && !seen[month]){seen[month] = true;out.push(month);}
    });
    return out;
  }

  function monthsFromNumbers(value){
    var source = text(value), out = [], seen = {}, m;
    var yearMonth = /(?:19|20)\d{2}\D{0,5}(0?[1-9]|1[0-2])/g;
    var monthYear = /(0?[1-9]|1[0-2])\D{0,5}(?:19|20)\d{2}/g;
    function add(month){month = Number(month);if(month >= 1 && month <= 12 && !seen[month]){seen[month]=true;out.push(month);}}
    while((m = yearMonth.exec(source)) !== null){add(m[1]);}
    while((m = monthYear.exec(source)) !== null){add(m[1]);}
    return out;
  }

  function extractMonths(value){
    var seen = {};
    return monthsFromText(value).concat(monthsFromNumbers(value)).filter(function(month){if(seen[month]){return false;}seen[month]=true;return true;});
  }
  function hasPair(months,a,b){return months.indexOf(a) >= 0 && months.indexOf(b) >= 0;}

  function classifyPeriod(value){
    var raw = text(value);
    var months = extractMonths(raw);
    var regular = hasPair(months,10,3) || hasPair(months,4,9);
    var pattern = hasPair(months,10,3) ? "OCTUBRE_MARZO" : (hasPair(months,4,9) ? "ABRIL_SEPTIEMBRE" : "PVC");
    return {id:regular ? "REGULAR" : "PVC",label:regular ? "Regular" : "PVC",isRegular:regular,isPVC:!regular,pattern:pattern,months:months,raw:raw};
  }

  function periodText(row){
    row = row || {};
    return text(row._bl2Periodo || row.periodoLabel || row.periodo || row.Periodo || row.periodoId || row._periodo || row._bl2PeriodoId || "");
  }
  function classifyStudent(row){return classifyPeriod(periodText(row));}
  function isFinalRequirement(key){var k = compact(key);return FINAL.some(function(item){return compact(item.key) === k;});}
  function isTitulacionRequirement(key){return compact(key) === "titulacion";}
  function requirementsForPeriod(periodValue){
    var info = typeof periodValue === "object" && periodValue && periodValue.id ? periodValue : classifyPeriod(periodValue);
    var list = cloneList(BASE);
    if(info.id === "REGULAR"){list = list.concat(cloneList(REGULAR_EXTRA));}
    return list;
  }
  function requirementsForStudent(row){return requirementsForPeriod(classifyStudent(row));}
  function appliesRequirement(key, periodValue){
    var k = compact(key);
    if(isFinalRequirement(k)){return true;}
    if(isTitulacionRequirement(k)){return classifyPeriod(periodValue).id === "REGULAR";}
    return BASE.some(function(item){return compact(item.key) === k;});
  }
  function getRequirementByKey(key){
    var k = compact(key);
    return cloneList(BASE.concat(REGULAR_EXTRA).concat(FINAL)).filter(function(item){return compact(item.key) === k;})[0] || req(key,key);
  }
  function cellStatus(value){return OK_VALUES.indexOf(norm(value)) >= 0 ? "cumple" : "no_cumple";}
  function isCumple(value){return cellStatus(value) === "cumple";}

  function requirementStatus(row,key){
    var period = classifyStudent(row || {});
    var reqItem = getRequirementByKey(key);
    var applies = isFinalRequirement(reqItem.key) || appliesRequirement(reqItem.key, period.raw || period.id);
    if(!applies){return {key:reqItem.key,label:reqItem.label,status:"no_aplica",labelStatus:"No aplica",cumple:false,applies:false,periodType:period};}
    var status = cellStatus(valueOf(row, reqItem.key));
    return {key:reqItem.key,label:reqItem.label,status:status,labelStatus:status === "cumple" ? "Cumple" : "No cumple",cumple:status === "cumple",applies:true,periodType:period};
  }

  function studentApproval(row){
    row = row || {};
    var period = classifyStudent(row);
    var applicable = requirementsForPeriod(period);
    var missing = applicable.filter(function(item){return !isCumple(valueOf(row,item.key));});
    return {approved:missing.length === 0,label:missing.length === 0 ? "Aprobado" : "No cumple",periodType:period,applicableRequirements:applicable,missingRequirements:missing,notApplicableRequirements:period.id === "PVC" ? cloneList(REGULAR_EXTRA) : []};
  }

  function finalApproval(row){return cloneList(FINAL).map(function(item){var status = cellStatus(valueOf(row,item.key));return {key:item.key,label:item.label,status:status,cumple:status === "cumple"};});}
  function requirementTotals(rows, requirements){
    rows = Array.isArray(rows) ? rows : [];
    requirements = requirements || cloneList(BASE.concat(REGULAR_EXTRA));
    return requirements.map(function(item){
      var out = {key:item.key,label:item.label,group:item.group || "requisito",total:rows.length,aplica:0,no_aplica:0,cumple:0,no_cumple:0,avance:0};
      rows.forEach(function(row){var status = requirementStatus(row,item.key);if(!status.applies){out.no_aplica += 1;return;}out.aplica += 1;if(status.cumple){out.cumple += 1;}else{out.no_cumple += 1;}});
      out.avance = out.aplica ? Math.round((out.cumple * 10000) / out.aplica) / 100 : 0;
      return out;
    });
  }

  window.BL2RequirementsEngine = {version:VERSION,BASE_REQUIREMENTS:cloneList(BASE),REGULAR_EXTRA_REQUIREMENTS:cloneList(REGULAR_EXTRA),FINAL_REQUIREMENTS:cloneList(FINAL),FILTER_REQUIREMENTS:cloneList(BASE.concat(REGULAR_EXTRA).concat(FINAL)),text:text,norm:norm,compact:compact,valueOf:valueOf,cellStatus:cellStatus,isCumple:isCumple,extractMonths:extractMonths,classifyPeriod:classifyPeriod,classifyStudent:classifyStudent,requirementsForPeriod:requirementsForPeriod,requirementsForStudent:requirementsForStudent,appliesRequirement:appliesRequirement,isFinalRequirement:isFinalRequirement,isTitulacionRequirement:isTitulacionRequirement,getRequirementByKey:getRequirementByKey,requirementStatus:requirementStatus,studentApproval:studentApproval,finalApproval:finalApproval,requirementTotals:requirementTotals};
})(window);
