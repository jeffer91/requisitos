/* =========================================================
Nombre completo: stats.rules.js
Ruta o ubicación: /Requisitos/Stats/stats.rules.js
Función o funciones:
- Exponer reglas de Stats para requisitos, aprobación final y clasificación de períodos.
- Delegar en BL2RequirementsEngine cuando esté disponible.
- Mantener respaldo interno para compatibilidad si Stats se abre sin BL2 core.
- Separar requisitos aplicables para PVC, Regulares y requisitos finales.
Con qué se conecta:
- ../BaseLocal2/core/bl2-requirements-engine.js
- stats.core.js
- stats.app.js
- stats.students.js
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();}
  function compact(value){return norm(value).replace(/[^a-z0-9]/g, "");}
  function label(key, fallback){try{if(window.BLCampos && typeof window.BLCampos.requirementLabel === "function"){return window.BLCampos.requirementLabel(key, fallback);}}catch(error){}return fallback || key;}
  function req(key, fallback, group){return {key:key,label:label(key,fallback),group:group || "requisito"};}
  function clone(item){return {key:item.key,label:label(item.key,item.label),group:item.group || "requisito"};}
  function clones(list){return (list || []).map(clone);}

  var BASE = [req("academico","Académico"),req("documentacion","Documentación"),req("financiero","Financiero"),req("practicasvinculacion","Prácticas"),req("vinculacion","Vinculación"),req("seguimientograduados","Seguimiento graduados"),req("ingles","Inglés"),req("actualizaciondatos","Actualización de datos")];
  var EXTRA = [req("titulacion","Titulación")];
  var FINAL = [req("aprobaciontitulacion","Aprobación titulación","final"),req("aprobacioncomplexivoproyecto","Aprobación complexivo/proyecto","final")];
  var FILTER = BASE.concat(EXTRA).concat(FINAL);
  var MONTHS = {enero:1,ene:1,febrero:2,feb:2,marzo:3,mar:3,abril:4,abr:4,mayo:5,may:5,junio:6,jun:6,julio:7,jul:7,agosto:8,ago:8,septiembre:9,setiembre:9,sept:9,sep:9,set:9,octubre:10,oct:10,noviembre:11,nov:11,diciembre:12,dic:12};
  var CUMPLE = ["si","sí","s","ok","cumple","aprobado","aprobada","1","true","x","validado","validada","completo","completa"];
  var ALIASES = {academico:["academico","académico","Academico","Académico"],documentacion:["documentacion","documentación","Documentacion","Documentación"],financiero:["financiero","Financiero"],titulacion:["titulacion","titulación","Titulacion","Titulación"],practicasvinculacion:["practicasvinculacion","practicas","prácticas","PracticasVinculacion","PrácticasVinculacion","Prácticas Vinculación","Practicas Vinculacion","Practicas"],vinculacion:["vinculacion","vinculación","Vinculacion","Vinculación"],seguimientograduados:["seguimientograduados","seguimiento graduados","SeguimientoGraduados","Seguimiento graduados"],ingles:["ingles","inglés","Ingles","Inglés"],actualizaciondatos:["actualizaciondatos","actualización datos","actualizacion datos","ActualizacionDatos","ActualizaciónDatos","Actualización de datos"],aprobaciontitulacion:["aprobaciontitulacion","aprobación titulación","aprobacion titulacion","AprobacionTitulacion","AprobaciónTitulación","Aprobación titulación"],aprobacioncomplexivoproyecto:["aprobacioncomplexivoproyecto","aprobación complexivo proyecto","aprobacion complexivo proyecto","aprobacion complexivo/proyecto","AprobacionComplexivoProyecto","AprobaciónComplexivoProyecto","Aprobación complexivo/proyecto"]};

  function engine(){return window.BL2RequirementsEngine || null;}
  function useEngine(fn, fallback){try{if(engine() && typeof engine()[fn] === "function"){return engine()[fn];}}catch(error){}return fallback;}
  function listFromEngine(name, fallback){try{if(engine() && Array.isArray(engine()[name])){return clones(engine()[name]);}}catch(error){}return clones(fallback);}

  function monthsFromText(value){var source=norm(value),out=[],seen={};Object.keys(MONTHS).forEach(function(name){var month=MONTHS[name],pattern=new RegExp("(^|[^a-z])"+name+"([^a-z]|$)","i");if(pattern.test(source)&&!seen[month]){seen[month]=true;out.push(month);}});return out;}
  function monthsFromNumbers(value){var source=text(value),out=[],seen={},m,yearMonth=/(?:19|20)\d{2}\D{0,5}(0?[1-9]|1[0-2])/g,monthYear=/(0?[1-9]|1[0-2])\D{0,5}(?:19|20)\d{2}/g;function add(month){month=Number(month);if(month>=1&&month<=12&&!seen[month]){seen[month]=true;out.push(month);}}while((m=yearMonth.exec(source))!==null){add(m[1]);}while((m=monthYear.exec(source))!==null){add(m[1]);}return out;}
  function extractMonths(value){var map={};return monthsFromText(value).concat(monthsFromNumbers(value)).filter(function(month){if(map[month]){return false;}map[month]=true;return true;});}
  function hasPair(months,a,b){return months.indexOf(a)>=0&&months.indexOf(b)>=0;}
  function classifyPeriodFallback(value){var raw=text(value),months=extractMonths(raw),regular=hasPair(months,10,3)||hasPair(months,4,9),pattern=hasPair(months,10,3)?"OCTUBRE_MARZO":(hasPair(months,4,9)?"ABRIL_SEPTIEMBRE":"PVC");return {id:regular?"REGULAR":"PVC",label:regular?"Regular":"PVC",isRegular:regular,isPVC:!regular,pattern:pattern,months:months,raw:raw};}
  function periodText(row){row=row||{};return text(row._bl2Periodo||row.periodoLabel||row.periodo||row.Periodo||row.periodoId||row.idPeriodo||row.periodId||"");}
  function classifyStudentFallback(row){return classifyPeriodFallback(periodText(row));}
  function isFinalFallback(key){var k=compact(key);return FINAL.some(function(item){return compact(item.key)===k;});}
  function isTitulacionFallback(key){return compact(key)==="titulacion";}
  function requirementsForPeriodFallback(periodValue){var info=typeof periodValue==="object"&&periodValue&&periodValue.id?periodValue:classifyPeriodFallback(periodValue),list=clones(BASE);if(info.id==="REGULAR"){list=list.concat(clones(EXTRA));}return list;}
  function requirementsForStudentFallback(row){return requirementsForPeriodFallback(classifyStudentFallback(row));}
  function appliesRequirementFallback(key,periodValue){var k=compact(key);if(isFinalFallback(k)){return true;}if(isTitulacionFallback(k)){return classifyPeriodFallback(periodValue).id==="REGULAR";}return BASE.some(function(item){return compact(item.key)===k;});}
  function getRequirementByKeyFallback(key){var k=compact(key);return clones(FILTER).filter(function(item){return compact(item.key)===k;})[0]||req(key,key);}
  function valueOfFallback(row,key){row=row||{};var target=compact(key),aliases=(ALIASES[target]||[key]).map(compact),direct=[key].concat(ALIASES[target]||[]),keys=Object.keys(row),i;for(i=0;i<direct.length;i++){if(Object.prototype.hasOwnProperty.call(row,direct[i])){return row[direct[i]];}}for(i=0;i<keys.length;i++){if(aliases.indexOf(compact(keys[i]))>=0){return row[keys[i]];}}for(i=0;i<keys.length;i++){if(compact(keys[i])===target){return row[keys[i]];}}return "";}
  function cellStatusFallback(value){return CUMPLE.indexOf(norm(value))>=0?"cumple":"no_cumple";}
  function isCumpleFallback(value){return cellStatus(value)==="cumple";}
  function requirementStatusFallback(row,key){var period=classifyStudent(row||{}),item=getRequirementByKey(key),applies=isFinalRequirement(item.key)||appliesRequirement(item.key,period.raw||period.id);if(!applies){return {key:item.key,label:item.label,status:"no_aplica",cumple:false,applies:false,periodType:period};}var status=cellStatus(valueOf(row,item.key));return {key:item.key,label:item.label,status:status,cumple:status==="cumple",applies:true,periodType:period};}
  function missingRequirementsFallback(row){return requirementsForStudent(row).filter(function(item){return !isCumple(valueOf(row,item.key));});}
  function studentApprovalFallback(row){var period=classifyStudent(row),applicable=requirementsForPeriod(period),missing=applicable.filter(function(item){return !isCumple(valueOf(row,item.key));});return {approved:missing.length===0,label:missing.length===0?"Aprobado":"No cumple",periodType:period,applicableRequirements:applicable,missingRequirements:missing,notApplicableRequirements:period.id==="PVC"?clones(EXTRA):[]};}
  function finalApprovalFallback(row){return clones(FINAL).map(function(item){var status=cellStatus(valueOf(row,item.key));return {key:item.key,label:item.label,status:status,cumple:status==="cumple"};});}

  function classifyPeriod(value){return useEngine("classifyPeriod",classifyPeriodFallback)(value);}
  function classifyStudent(row){return useEngine("classifyStudent",classifyStudentFallback)(row);}
  function isRegularPeriod(value){return classifyPeriod(value).id==="REGULAR";}
  function isFinalRequirement(key){return useEngine("isFinalRequirement",isFinalFallback)(key);}
  function isTitulacionRequirement(key){return useEngine("isTitulacionRequirement",isTitulacionFallback)(key);}
  function requirementsForPeriod(periodValue){return useEngine("requirementsForPeriod",requirementsForPeriodFallback)(periodValue);}
  function requirementsForStudent(row){return useEngine("requirementsForStudent",requirementsForStudentFallback)(row);}
  function appliesRequirement(key,periodValue){return useEngine("appliesRequirement",appliesRequirementFallback)(key,periodValue);}
  function getRequirementByKey(key){return useEngine("getRequirementByKey",getRequirementByKeyFallback)(key);}
  function valueOf(row,key){return useEngine("valueOf",valueOfFallback)(row,key);}
  function cellStatus(value){return useEngine("cellStatus",cellStatusFallback)(value);}
  function isCumple(value){return useEngine("isCumple",isCumpleFallback)(value);}
  function requirementStatus(row,key){return useEngine("requirementStatus",requirementStatusFallback)(row,key);}
  function missingRequirements(row){return missingRequirementsFallback(row);}
  function studentApproval(row){return useEngine("studentApproval",studentApprovalFallback)(row);}
  function finalApproval(row){return useEngine("finalApproval",finalApprovalFallback)(row);}

  window.StatsRules = {BASE_REQUIREMENTS:listFromEngine("BASE_REQUIREMENTS",BASE),REGULAR_EXTRA_REQUIREMENTS:listFromEngine("REGULAR_EXTRA_REQUIREMENTS",EXTRA),FINAL_REQUIREMENTS:listFromEngine("FINAL_REQUIREMENTS",FINAL),FILTER_REQUIREMENTS:listFromEngine("FILTER_REQUIREMENTS",FILTER),text:text,norm:norm,compact:compact,valueOf:valueOf,cellStatus:cellStatus,isCumple:isCumple,extractMonths:function(value){return useEngine("extractMonths",extractMonths)(value);},classifyPeriod:classifyPeriod,classifyStudent:classifyStudent,isRegularPeriod:isRegularPeriod,requirementsForPeriod:requirementsForPeriod,requirementsForStudent:requirementsForStudent,appliesRequirement:appliesRequirement,isFinalRequirement:isFinalRequirement,isTitulacionRequirement:isTitulacionRequirement,getRequirementByKey:getRequirementByKey,requirementStatus:requirementStatus,missingRequirements:missingRequirements,studentApproval:studentApproval,finalApproval:finalApproval};
})(window);
