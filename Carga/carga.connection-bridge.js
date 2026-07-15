/* =========================================================
Archivo: carga.connection-bridge.js
Ruta: /Carga/carga.connection-bridge.js
Función:
- Reemplazar comparación, guardado y borrado de Carga por operaciones de ConCarga.
- Mantener el análisis y la interfaz existentes sin acceder directamente a BL2Core.
========================================================= */
(function(window){
  "use strict";
  var guard=null;
  var saveTask=null;
  var deleteTask=null;
  function text(v){return String(v==null?"":v).trim();}
  function clone(v){try{return JSON.parse(JSON.stringify(v));}catch(error){return v;}}
  function connector(){return window.ConCarga||window.BDLocalCarga||null;}
  function state(){return window.CargaState&&window.CargaState.get?window.CargaState.get():{};}
  function canon(v){return text(v).replace(/_+/g,"__");}
  function cedula(row){
    row=row||{};
    var value=text(row.numeroIdentificacion||row.NumeroIdentificacion||row.identificacion||row.cedula||row["cédula"]||row.documento).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
    return /^\d{9}$/.test(value)?"0"+value:value;
  }
  function ids(rows){var map={};(rows||[]).forEach(function(row){var id=cedula(row);if(id){map[id]=true;}});return Object.keys(map).sort();}
  function periodInfo(period){
    period=period||{};
    var id=canon(period.periodoCanonicoId||period.periodoId||period.id||"");
    return {id:id,periodoId:id,periodoLabel:text(period.periodoCanonicoLabel||period.periodoLabel||period.label||id)};
  }
  function signature(periodoId,list){
    var source=canon(periodoId)+"|"+list.join("|");var hash=2166136261;
    for(var i=0;i<source.length;i+=1){hash^=source.charCodeAt(i);hash+=(hash<<1)+(hash<<4)+(hash<<7)+(hash<<8)+(hash<<24);}
    return canon(periodoId)+":"+(hash>>>0).toString(16)+":"+list.length;
  }
  function ensure(){
    var con=connector();
    if(!con){return Promise.reject(new Error("ConCarga no está cargado."));}
    return Promise.resolve(typeof con.ready==="function"?con.ready():true).then(function(result){
      if(result&&result.ok===false){throw new Error(result.error||"ConCarga no está listo.");}
      return con;
    });
  }
  function compare(period){
    var info=periodInfo(period);var current=state();var normalized=current.normalized||{};
    var fileRows=normalized.rowsMapeadas||current.rows||[];var fileIds=ids(fileRows);
    if(!info.id){return Promise.reject(new Error("Selecciona un período antes de analizar."));}
    if(!fileIds.length){return Promise.reject(new Error("El archivo no contiene cédulas válidas."));}
    return ensure().then(function(con){return con.listStudents({periodoId:info.id,matricula:""});}).then(function(rows){
      var existing=ids(rows);var fileMap={};var existingMap={};
      fileIds.forEach(function(id){fileMap[id]=true;});existing.forEach(function(id){existingMap[id]=true;});
      var common=fileIds.filter(function(id){return existingMap[id];});
      var onlyFile=fileIds.filter(function(id){return !existingMap[id];});
      var onlyExisting=existing.filter(function(id){return !fileMap[id];});
      var union={};fileIds.concat(existing).forEach(function(id){union[id]=true;});
      var firstLoad=!existing.length;var different=onlyFile.length+onlyExisting.length;
      var percent=firstLoad?0:(different/Math.max(1,Object.keys(union).length))*100;
      var limit=Number(window.CargaConfig&&window.CargaConfig.maxPeriodDifferencePercent||10);
      var errors=Array.isArray(current.errors)?current.errors.length:0;
      var ok=!errors&&(firstLoad||percent<=limit);
      guard={ok:ok,periodoId:info.id,periodoLabel:info.periodoLabel,existing:existing.length,inFile:fileIds.length,common:common.length,onlyFile:onlyFile.length,onlyExisting:onlyExisting.length,different:different,percent:Number(percent.toFixed(4)),limit:limit,firstLoad:firstLoad,signature:signature(info.id,fileIds),checkedAt:new Date().toISOString(),message:errors?"Corrige los errores del archivo antes de guardar.":firstLoad?"Primera carga del período.":ok?"La diferencia es "+percent.toFixed(2)+"%. Puede guardar el archivo.":"La diferencia supera el límite del "+limit+"%."};
      try{window.dispatchEvent(new CustomEvent("carga:period-compared",{detail:clone(guard)}));}catch(error){}
      return clone(guard);
    });
  }
  function canSave(period){
    var info=periodInfo(period);var current=state();var rows=current.normalized&&current.normalized.rowsMapeadas||[];
    return !!(guard&&guard.ok&&guard.periodoId===info.id&&guard.signature===signature(info.id,ids(rows)));
  }
  function save(options){
    options=Object.assign({},options||{});var info=periodInfo(options);var current=state();
    if(saveTask){return saveTask;}
    if(!canSave(info)){return Promise.resolve({ok:false,total:0,saved:0,updated:0,merged:0,message:"El archivo debe analizarse y aprobarse antes de guardar."});}
    if(!window.CargaSave||typeof window.CargaSave.save!=="function"){return Promise.reject(new Error("CargaSave no está disponible."));}
    saveTask=window.CargaSave.save(clone(current.normalized),{ok:!(current.errors||[]).length,errors:current.errors||[],warnings:current.warnings||[]},Object.assign({},options,info,{analysis:clone(guard),markRetired:guard.firstLoad?false:options.markRetired===true})).then(function(result){
      if(result&&result.ok!==false){guard=null;}
      return result;
    }).finally(function(){saveTask=null;});
    return saveTask;
  }
  function removeStudents(period){
    if(deleteTask){return deleteTask;}var info=periodInfo(period);
    deleteTask=ensure().then(function(con){return con.deleteStudentsByPeriod(info.id,{localOnly:true,sync:false});}).then(function(result){guard=null;return result||{ok:true};}).finally(function(){deleteTask=null;});
    return deleteTask;
  }
  function removePeriod(period){
    if(deleteTask){return deleteTask;}var info=periodInfo(period);
    deleteTask=ensure().then(function(con){return con.deletePeriod(info.id,{deleteStudents:true,deleteDivisions:true,localOnly:true,sync:false});}).then(function(result){guard=null;return result||{ok:true};}).finally(function(){deleteTask=null;});
    return deleteTask;
  }
  function install(){
    if(!window.CargaApp){return false;}
    window.CargaApp.compareWithPeriod=compare;
    window.CargaApp.canSave=canSave;
    window.CargaApp.invalidateAnalysis=function(){guard=null;};
    window.CargaApp.save=save;
    window.CargaApp.deleteStudentsByPeriod=removeStudents;
    window.CargaApp.deletePeriod=removePeriod;
    window.CargaApp.connectionSource=function(){return "ConCarga";};
    return true;
  }
  window.CargaConnectionBridge={version:"1.0.0-concarga-only",install:install,compareWithPeriod:compare,canSave:canSave};
  install();
})(window);