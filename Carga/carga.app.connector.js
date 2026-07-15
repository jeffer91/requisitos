/* =========================================================
Nombre completo: carga.app.connector.js
Ruta o ubicación: /Carga/carga.app.connector.js
Función o funciones:
- Orquestar lectura, normalización, validación, comparación y guardado.
- Consultar y modificar BDLocal exclusivamente mediante ConCarga.
- Mantener la API pública CargaApp usada por la interfaz.
Con qué se conecta:
- carga.state.js
- process/carga.normalizer.js
- process/carga.validator.js
- process/carga.preview.js
- process/carga.save.js
- ../BDLocal/conexiones/cone.carga.js
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
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(error){}}
  function connector(){return window.ConCarga||window.BDLocalCarga||null;}
  function canon(value){
    value=text(value);var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }
  function periodInfo(options){
    options=options||{};
    var id=canon(options.periodoCanonicoId||options.periodoId||options.id||"");
    var label=text(options.periodoCanonicoLabel||options.periodoLabel||options.label||id);
    return {id:id,periodoId:id,periodoCanonicoId:id,label:label,periodoLabel:label,periodoCanonicoLabel:label};
  }
  function ensureConnector(){
    var con=connector();
    if(!con){return Promise.reject(new Error("ConCarga no está cargado."));}
    return Promise.resolve(typeof con.ready==="function"?con.ready():true).then(function(result){
      if(result&&result.ok===false){throw new Error(result.error||"ConCarga no está listo.");}
      return con;
    });
  }
  function requireModule(name,method){
    var module=window[name];
    if(!module||(method&&typeof module[method]!=="function")){throw new Error(method?name+"."+method+" no está disponible.":name+" no está disponible.");}
    return module;
  }
  function normalizeCedula(value){
    var raw=text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
    return /^\d{9}$/.test(raw)?"0"+raw:raw;
  }
  function firstValue(row,fields){
    row=row||{};
    function key(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");}
    var wanted=(fields||[]).map(key);var keys=Object.keys(row);
    for(var i=0;i<keys.length;i+=1){if(wanted.indexOf(key(keys[i]))>=0){return row[keys[i]];}}
    return "";
  }
  function cedulaOf(row){return normalizeCedula(firstValue(row,["numeroIdentificacion","NumeroIdentificacion","identificacion","cedula","cédula","documento"]));}
  function uniqueCedulas(rows){var map={};(rows||[]).forEach(function(row){var id=cedulaOf(row);if(id){map[id]=true;}});return Object.keys(map).sort();}
  function signature(periodoId,cedulas){
    var source=canon(periodoId)+"|"+cedulas.join("|");var hash=2166136261;
    for(var i=0;i<source.length;i+=1){hash^=source.charCodeAt(i);hash+=(hash<<1)+(hash<<4)+(hash<<7)+(hash<<8)+(hash<<24);}
    return canon(periodoId)+":"+(hash>>>0).toString(16)+":"+cedulas.length;
  }
  function invalidateAnalysis(){approvedGuard=null;}

  function processRows(rows,options){
    options=Object.assign({},periodInfo(options||{}),options||{});rows=Array.isArray(rows)?rows:[];invalidateAnalysis();
    state.setStatus(cfg.estados.mapping,"Normalizando datos");
    var normalized=requireModule("CargaNormalizer","normalizeRows").normalizeRows(rows,options);
    normalized.periodoDetectado=normalized.periodoDetectado||{};
    normalized.periodoDetectado.periodoId=canon(normalized.periodoDetectado.periodoId||options.periodoId);
    normalized.periodoDetectado.periodoLabel=text(normalized.periodoDetectado.periodoLabel||options.periodoLabel||options.periodoId);
    normalized.periodoDetectado.periodoCanonicoId=normalized.periodoDetectado.periodoId;
    normalized.periodoDetectado.periodoCanonicoLabel=normalized.periodoDetectado.periodoLabel;
    normalized.fileName=text(normalized.fileName||options.fileName);
    normalized.origen=text(normalized.origen||options.origen);
    state.patch({rows:rows,normalized:normalized,origen:normalized.origen,fileName:normalized.fileName});
    state.setStatus(cfg.estados.validating,"Validando datos");
    var validation=requireModule("CargaValidator","validate").validate(normalized)||{};
    validation.errors=Array.isArray(validation.errors)?validation.errors:[];
    validation.warnings=(Array.isArray(options.readerWarnings)?options.readerWarnings:[]).concat(Array.isArray(validation.warnings)?validation.warnings:[]);
    validation.ok=validation.errors.length===0&&validation.ok!==false;
    var preview={rows:[]};
    if(window.CargaPreview&&typeof window.CargaPreview.build==="function"){
      try{preview=window.CargaPreview.build(normalized,validation)||preview;}catch(error){}
    }
    state.patch({preview:preview&&Array.isArray(preview.rows)?preview.rows:[],errors:validation.errors,warnings:validation.warnings});
    state.setStatus(validation.ok?cfg.estados.ready:cfg.estados.error,validation.ok?"Archivo listo para comparar":"Archivo con errores");
    emit("carga:processed",{total:rows.length,ok:validation.ok,errors:validation.errors.length,warnings:validation.warnings.length,periodoId:options.periodoId,fileName:normalized.fileName});
    return {normalized:normalized,validation:validation,preview:preview};
  }
  function readFile(file,options){
    if(!file){return Promise.reject(new Error("Selecciona un archivo."));}
    options=Object.assign({},periodInfo(options||{}),options||{},{fileName:file.name||""});
    state.reset();invalidateAnalysis();state.setStatus(cfg.estados.reading,"Leyendo archivo");
    return requireModule("CargaReaderFile","read").read(file).then(function(result){
      result=result||{};
      return processRows(result.rows||[],Object.assign({},options,result,{origen:result.origen||"archivo",fileName:result.fileName||options.fileName,readerWarnings:result.warnings||[]}));
    }).catch(function(error){state.setStatus(cfg.estados.error,error.message||"No se pudo leer el archivo");throw error;});
  }
  function readClipboard(value,options){
    options=Object.assign({},periodInfo(options||{}),options||{},{origen:"clipboard",fileName:"pegado_manual"});
    state.reset();invalidateAnalysis();
    return requireModule("CargaReaderClipboard","read").read(value).then(function(result){return processRows(result.rows||[],Object.assign({},options,result||{}));});
  }
  function compareWithPeriod(period){
    var info=periodInfo(period);var current=state.get();var normalized=current.normalized||{};
    var fileRows=normalized.rowsMapeadas||current.rows||[];var fileIds=uniqueCedulas(fileRows);
    if(!info.id){return Promise.reject(new Error("Selecciona un período antes de analizar."));}
    if(!fileIds.length){return Promise.reject(new Error("El archivo no contiene cédulas válidas."));}
    return ensureConnector().then(function(con){return con.listStudents({periodoId:info.id,matricula:""});}).then(function(rows){
      var existing=uniqueCedulas(rows);var fileMap={};var existingMap={};
      fileIds.forEach(function(id){fileMap[id]=true;});existing.forEach(function(id){existingMap[id]=true;});
      var common=fileIds.filter(function(id){return existingMap[id];});var onlyFile=fileIds.filter(function(id){return !existingMap[id];});var onlyExisting=existing.filter(function(id){return !fileMap[id];});
      var union={};fileIds.concat(existing).forEach(function(id){union[id]=true;});
      var firstLoad=!existing.length;var different=onlyFile.length+onlyExisting.length;var percent=firstLoad?0:(different/Math.max(1,Object.keys(union).length))*100;
      var limit=Number(cfg.maxPeriodDifferencePercent||10);var errors=Array.isArray(current.errors)?current.errors.length:0;var ok=!errors&&(firstLoad||percent<=limit);
      approvedGuard={ok:ok,periodoId:info.id,periodoLabel:info.label,existing:existing.length,inFile:fileIds.length,common:common.length,onlyFile:onlyFile.length,onlyExisting:onlyExisting.length,different:different,percent:Number(percent.toFixed(4)),limit:limit,firstLoad:firstLoad,signature:signature(info.id,fileIds),message:errors?"Corrige los errores del archivo antes de guardar.":firstLoad?"Primera carga del período: no existen estudiantes anteriores para comparar.":ok?"La diferencia es "+percent.toFixed(2)+"%. Puede guardar el archivo.":"La diferencia es "+percent.toFixed(2)+"% y supera el límite del "+limit+"%.",checkedAt:new Date().toISOString(),source:"ConCarga"};
      emit("carga:period-compared",clone(approvedGuard));return clone(approvedGuard);
    });
  }
  function canSave(period){
    var info=periodInfo(period);var current=state.get();var rows=current.normalized&&current.normalized.rowsMapeadas||[];
    return !!(approvedGuard&&approvedGuard.ok&&approvedGuard.periodoId===info.id&&approvedGuard.signature===signature(info.id,uniqueCedulas(rows)));
  }
  function buildReport(result,current){
    result=result||{};current=current||state.get();var report={};
    if(window.CargaReport&&typeof window.CargaReport.build==="function"){try{report=window.CargaReport.build(result,{ok:!(current.errors||[]).length,errors:current.errors||[],warnings:current.warnings||[],total:(current.rows||[]).length},current)||{};}catch(error){}}
    return Object.assign({},report,result,{ok:result.ok!==false&&report.ok!==false,total:result.total||result.totalEntrada||report.total||(current.rows||[]).length,saved:result.saved||result.guardados||report.saved||report.guardados||0,guardados:result.guardados||result.saved||report.guardados||report.saved||0,updated:result.updated||result.actualizados||report.updated||report.actualizados||0,actualizados:result.actualizados||result.updated||report.actualizados||report.updated||0,merged:result.merged||result.duplicados||report.merged||report.duplicados||0,duplicados:result.duplicados||result.merged||report.duplicados||report.merged||0});
  }
  function save(options){
    options=Object.assign({},periodInfo(options||{}),options||{});var period={id:options.periodoId,periodoId:options.periodoId};
    if(saveTask){return saveTask;}
    if(!canSave(period)){return Promise.resolve({ok:false,total:0,saved:0,updated:0,merged:0,message:"El archivo debe analizarse y aprobarse antes de guardar."});}
    var current=state.get();state.setStatus(cfg.estados.committing,"Guardando en BDLocal");
    saveTask=requireModule("CargaSave","save").save(clone(current.normalized),{ok:!(current.errors||[]).length,errors:current.errors||[],warnings:current.warnings||[]},Object.assign({},options,{analysis:clone(approvedGuard),markRetired:approvedGuard.firstLoad?false:options.markRetired===true})).then(function(result){
      var report=buildReport(result,state.get());state.patch({lastResult:report});state.setStatus(report.ok?cfg.estados.done:cfg.estados.error,report.ok?"Carga guardada":report.message||"Carga no guardada");if(report.ok){invalidateAnalysis();}emit("carga:saved",report);return report;
    }).catch(function(error){state.setStatus(cfg.estados.error,error.message||"No se pudo guardar");emit("carga:save-error",{error:error.message||String(error)});throw error;}).finally(function(){saveTask=null;});
    return saveTask;
  }
  function deleteStudentsByPeriod(period){
    if(deleteTask){return deleteTask;}var info=periodInfo(period);
    deleteTask=ensureConnector().then(function(con){return con.deleteStudentsByPeriod(info.id,{localOnly:true,sync:false});}).then(function(result){invalidateAnalysis();return result||{ok:true};}).finally(function(){deleteTask=null;});return deleteTask;
  }
  function deletePeriod(period){
    if(deleteTask){return deleteTask;}var info=periodInfo(period);
    deleteTask=ensureConnector().then(function(con){return con.deletePeriod(info.id,{deleteStudents:true,deleteDivisions:true,localOnly:true,sync:false});}).then(function(result){invalidateAnalysis();return result||{ok:true};}).finally(function(){deleteTask=null;});return deleteTask;
  }

  window.CargaApp={
    version:"3.0.0-concarga-only",processRows:processRows,readFile:readFile,readClipboard:readClipboard,
    compareWithPeriod:compareWithPeriod,canSave:canSave,invalidateAnalysis:invalidateAnalysis,
    save:save,deleteStudentsByPeriod:deleteStudentsByPeriod,deletePeriod:deletePeriod,
    state:state.get,connectionSource:function(){return "ConCarga";}
  };
})(window);