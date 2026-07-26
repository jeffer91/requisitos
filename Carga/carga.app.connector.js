/* =========================================================
Nombre completo: carga.app.connector.js
Ruta o ubicación: /Carga/carga.app.connector.js
Función o funciones:
- Orquestar lectura, normalización, validación, comparación y guardado.
- Procesar cargas grandes sin duplicar innecesariamente los datos en memoria.
- Consultar y modificar BDLocal exclusivamente mediante ConCarga.
========================================================= */
(function(window){
  "use strict";

  var cfg=window.CargaConfig;
  var state=window.CargaState;
  var approvedGuard=null;
  var saveTask=null;
  var deleteTask=null;

  if(!cfg||!state){throw new Error("CargaConfig y CargaState deben cargarse antes de CargaApp.");}

  function text(value){return String(value==null?"":value).trim();}
  function clone(value){
    if(value&&Array.isArray(value.rowsMapeadas)){return value;}
    try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}
  }
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(error){}}
  function progress(percent,message,phase){
    if(state&&typeof state.patch==="function"){state.patch({progress:{current:Number(percent)||0,total:100,message:message||""}});}
    emit("carga:progress",{percent:Math.max(0,Math.min(100,Number(percent)||0)),message:message||"",phase:phase||"analysis"});
  }
  function connector(){return window.ConCarga||window.BDLocalCarga||null;}
  function canon(value){value=text(value);var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");}
  function periodInfo(options){options=options||{};var id=canon(options.periodoCanonicoId||options.periodoId||options.id||"");var label=text(options.periodoCanonicoLabel||options.periodoLabel||options.label||id);return {id:id,periodoId:id,periodoCanonicoId:id,label:label,periodoLabel:label,periodoCanonicoLabel:label};}
  function ensureConnector(){var con=connector();if(!con){return Promise.reject(new Error("ConCarga no está cargado."));}return Promise.resolve(typeof con.ready==="function"?con.ready():true).then(function(result){if(result&&result.ok===false){throw new Error(result.error||"ConCarga no está listo.");}return con;});}
  function requireModule(name,method){var module=window[name];if(!module||(method&&typeof module[method]!=="function")){throw new Error(method?name+"."+method+" no está disponible.":name+" no está disponible.");}return module;}
  function normalizeCedula(value){var raw=text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();return /^\d{9}$/.test(raw)?"0"+raw:raw;}
  function fieldKey(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");}
  function firstValue(row,fields){row=row||{};var wanted=(fields||[]).map(fieldKey),keys=Object.keys(row);for(var i=0;i<keys.length;i+=1){if(wanted.indexOf(fieldKey(keys[i]))>=0){return row[keys[i]];}}return "";}
  function cedulaOf(row){return normalizeCedula(firstValue(row,["numeroIdentificacion","NumeroIdentificacion","identificacion","cedula","cédula","documento"]));}
  function uniqueCedulas(rows){var map=Object.create(null);(rows||[]).forEach(function(row){var id=cedulaOf(row);if(id){map[id]=true;}});return Object.keys(map).sort();}
  function signature(periodoId,cedulas){var source=canon(periodoId)+"|"+cedulas.join("|"),hash=2166136261;for(var i=0;i<source.length;i+=1){hash^=source.charCodeAt(i);hash+=(hash<<1)+(hash<<4)+(hash<<7)+(hash<<8)+(hash<<24);}return canon(periodoId)+":"+(hash>>>0).toString(16)+":"+cedulas.length;}
  function invalidateAnalysis(){approvedGuard=null;}

  function processRows(rows,options){
    options=Object.assign({},periodInfo(options||{}),options||{});rows=Array.isArray(rows)?rows:[];invalidateAnalysis();
    state.setStatus(cfg.estados.mapping,"Normalizando datos");progress(52,"Preparando "+rows.length+" filas","analysis");
    var normalizer=requireModule("CargaNormalizer",window.CargaNormalizer&&typeof window.CargaNormalizer.normalizeRowsAsync==="function"?"normalizeRowsAsync":"normalizeRows");
    var task=typeof normalizer.normalizeRowsAsync==="function"?normalizer.normalizeRowsAsync(rows,options):Promise.resolve(normalizer.normalizeRows(rows,options));
    return Promise.resolve(task).then(function(normalized){
      normalized=normalized||{};normalized.periodoDetectado=normalized.periodoDetectado||{};
      normalized.periodoDetectado.periodoId=canon(normalized.periodoDetectado.periodoId||options.periodoId);
      normalized.periodoDetectado.periodoLabel=text(normalized.periodoDetectado.periodoLabel||options.periodoLabel||options.periodoId);
      normalized.periodoDetectado.periodoCanonicoId=normalized.periodoDetectado.periodoId;normalized.periodoDetectado.periodoCanonicoLabel=normalized.periodoDetectado.periodoLabel;
      normalized.fileName=text(normalized.fileName||options.fileName);normalized.origen=text(normalized.origen||options.origen);
      state.patch({rows:rows,normalized:normalized,origen:normalized.origen,fileName:normalized.fileName});
      state.setStatus(cfg.estados.validating,"Validando datos");progress(78,"Validando "+rows.length+" filas","analysis");
      return new Promise(function(resolve,reject){window.setTimeout(function(){try{resolve(requireModule("CargaValidator","validate").validate(normalized)||{});}catch(error){reject(error);}},0);}).then(function(validation){
        validation.errors=Array.isArray(validation.errors)?validation.errors:[];validation.warnings=(Array.isArray(options.readerWarnings)?options.readerWarnings:[]).concat(Array.isArray(validation.warnings)?validation.warnings:[]);validation.ok=validation.errors.length===0&&validation.ok!==false;
        progress(92,"Preparando vista previa","analysis");var preview={rows:[]};if(window.CargaPreview&&typeof window.CargaPreview.build==="function"){try{preview=window.CargaPreview.build(normalized,validation)||preview;}catch(error){}}
        state.patch({preview:preview&&Array.isArray(preview.rows)?preview.rows:[],errors:validation.errors,warnings:validation.warnings});state.setStatus(validation.ok?cfg.estados.ready:cfg.estados.error,validation.ok?"Archivo listo para comparar":"Archivo con errores");
        progress(96,validation.ok?"Archivo analizado. Comparando con BDLocal...":"Archivo analizado con errores","analysis");emit("carga:processed",{total:rows.length,ok:validation.ok,errors:validation.errors.length,warnings:validation.warnings.length,periodoId:options.periodoId,fileName:normalized.fileName});return {normalized:normalized,validation:validation,preview:preview};
      });
    });
  }
  function readFile(file,options){
    if(!file){return Promise.reject(new Error("Selecciona un archivo."));}
    options=Object.assign({},periodInfo(options||{}),options||{},{fileName:file.name||""});state.reset();invalidateAnalysis();state.setStatus(cfg.estados.reading,"Leyendo archivo");progress(0,"Preparando archivo","reading");
    return requireModule("CargaReaderFile","read").read(file).then(function(result){result=result||{};return processRows(result.rows||[],Object.assign({},options,result,{origen:result.origen||"archivo",fileName:result.fileName||options.fileName,readerWarnings:result.warnings||[]}));}).catch(function(error){state.setStatus(cfg.estados.error,error.message||"No se pudo leer el archivo");progress(0,error.message||"No se pudo leer el archivo","error");throw error;});
  }
  function readClipboard(value,options){options=Object.assign({},periodInfo(options||{}),options||{},{origen:"clipboard",fileName:"pegado_manual"});state.reset();invalidateAnalysis();return requireModule("CargaReaderClipboard","read").read(value).then(function(result){return processRows(result.rows||[],Object.assign({},options,result||{}));});}
  function compareWithPeriod(period){
    var info=periodInfo(period),current=state.get(),normalized=current.normalized||{},fileRows=normalized.rowsMapeadas||current.rows||[],fileIds=uniqueCedulas(fileRows);
    if(!info.id){return Promise.reject(new Error("Selecciona un período antes de analizar."));}if(!fileIds.length){return Promise.reject(new Error("El archivo no contiene cédulas válidas."));}
    progress(97,"Comparando "+fileIds.length+" estudiantes con BDLocal","analysis");
    return ensureConnector().then(function(con){return con.listStudents({periodoId:info.id,matricula:""});}).then(function(rows){
      var existing=uniqueCedulas(rows),fileMap=Object.create(null),existingMap=Object.create(null);fileIds.forEach(function(id){fileMap[id]=true;});existing.forEach(function(id){existingMap[id]=true;});
      var common=fileIds.filter(function(id){return existingMap[id];}),onlyFile=fileIds.filter(function(id){return !existingMap[id];}),onlyExisting=existing.filter(function(id){return !fileMap[id];}),union=Object.create(null);fileIds.concat(existing).forEach(function(id){union[id]=true;});
      var firstLoad=!existing.length,different=onlyFile.length+onlyExisting.length,percent=firstLoad?0:different/Math.max(1,Object.keys(union).length)*100,limit=Number(cfg.maxPeriodDifferencePercent||10),errors=Array.isArray(current.errors)?current.errors.length:0,ok=!errors&&(firstLoad||percent<=limit);
      approvedGuard={ok:ok,periodoId:info.id,periodoLabel:info.label,existing:existing.length,inFile:fileIds.length,common:common.length,onlyFile:onlyFile.length,onlyExisting:onlyExisting.length,different:different,percent:Number(percent.toFixed(4)),limit:limit,firstLoad:firstLoad,signature:signature(info.id,fileIds),message:errors?"Corrige los errores del archivo antes de guardar.":firstLoad?"Primera carga del período: no existen estudiantes anteriores para comparar.":ok?"La diferencia es "+percent.toFixed(2)+"%. Puede guardar el archivo.":"La diferencia es "+percent.toFixed(2)+"% y supera el límite del "+limit+"%.",checkedAt:new Date().toISOString(),source:"ConCarga"};
      progress(100,ok?"Análisis completado":"Análisis completado con bloqueo","analysis");emit("carga:period-compared",clone(approvedGuard));return clone(approvedGuard);
    });
  }
  function canSave(period){var info=periodInfo(period),current=state.get(),rows=current.normalized&&current.normalized.rowsMapeadas||[];return !!(approvedGuard&&approvedGuard.ok&&approvedGuard.periodoId===info.id&&approvedGuard.signature===signature(info.id,uniqueCedulas(rows)));}
  function buildReport(result,current){result=result||{};current=current||state.get();var report={};if(window.CargaReport&&typeof window.CargaReport.build==="function"){try{report=window.CargaReport.build(result,{ok:!(current.errors||[]).length,errors:current.errors||[],warnings:current.warnings||[],total:(current.rows||[]).length},current)||{};}catch(error){}}return Object.assign({},report,result,{ok:result.ok!==false&&report.ok!==false,total:result.total||result.totalEntrada||report.total||(current.rows||[]).length,saved:result.saved||result.guardados||report.saved||report.guardados||0,guardados:result.guardados||result.saved||report.guardados||report.saved||0,updated:result.updated||result.actualizados||report.updated||report.actualizados||0,actualizados:result.actualizados||result.updated||report.actualizados||report.updated||0,merged:result.merged||result.duplicados||report.merged||report.duplicados||0,duplicados:result.duplicados||result.merged||report.duplicados||report.merged||0});}
  function save(options){
    options=Object.assign({},periodInfo(options||{}),options||{});var period={id:options.periodoId,periodoId:options.periodoId};if(saveTask){return saveTask;}if(!canSave(period)){return Promise.resolve({ok:false,total:0,saved:0,updated:0,merged:0,message:"El archivo debe analizarse y aprobarse antes de guardar."});}
    var current=state.get();state.setStatus(cfg.estados.committing,"Guardando en BDLocal");progress(2,"Preparando guardado","saving");
    saveTask=requireModule("CargaSave","save").save(current.normalized,{ok:!(current.errors||[]).length,errors:current.errors||[],warnings:current.warnings||[]},Object.assign({},options,{analysis:clone(approvedGuard),markRetired:approvedGuard.firstLoad?false:options.markRetired===true})).then(function(result){var report=buildReport(result,state.get());state.patch({lastResult:report});state.setStatus(report.ok?cfg.estados.done:cfg.estados.error,report.ok?"Carga guardada":report.message||"Carga no guardada");if(report.ok){invalidateAnalysis();}progress(100,report.auditOk===false?"Carga guardada; auditoría pendiente":"Carga guardada correctamente","saving");emit("carga:saved",report);return report;}).catch(function(error){state.setStatus(cfg.estados.error,error.message||"No se pudo guardar");progress(0,error.message||"No se pudo guardar","error");emit("carga:save-error",{error:error.message||String(error)});throw error;}).finally(function(){saveTask=null;});return saveTask;
  }
  function deleteStudentsByPeriod(period){if(deleteTask){return deleteTask;}var info=periodInfo(period);deleteTask=ensureConnector().then(function(con){return con.deleteStudentsByPeriod(info.id,{localOnly:true,sync:false});}).then(function(result){invalidateAnalysis();return result||{ok:true};}).finally(function(){deleteTask=null;});return deleteTask;}
  function deletePeriod(period){if(deleteTask){return deleteTask;}var info=periodInfo(period);deleteTask=ensureConnector().then(function(con){return con.deletePeriod(info.id,{deleteStudents:true,deleteDivisions:true,localOnly:true,sync:false});}).then(function(result){invalidateAnalysis();return result||{ok:true};}).finally(function(){deleteTask=null;});return deleteTask;}

  window.CargaApp={version:"4.1.0-low-memory",processRows:processRows,readFile:readFile,readClipboard:readClipboard,compareWithPeriod:compareWithPeriod,canSave:canSave,invalidateAnalysis:invalidateAnalysis,save:save,deleteStudentsByPeriod:deleteStudentsByPeriod,deletePeriod:deletePeriod,state:state.get,connectionSource:function(){return "ConCarga";}};
})(window);
