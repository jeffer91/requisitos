/* =========================================================
Nombre completo: carga.save.js
Ruta o ubicación: /Carga/process/carga.save.js
Función o funciones:
- Validar el archivo y el período antes de guardar.
- Guardar exclusivamente mediante ConCarga.
- Mantener las nubes pendientes y emitir los eventos esperados por la pantalla.
- Evitar cualquier llamada directa a BL2Core, BDLocal o repositorios.
Con qué se conecta:
- ../carga.connection-bridge.js
- ../../BDLocal/conexiones/cone.carga.js
========================================================= */
(function(window){
  "use strict";

  var activeSave=null;

  function text(value){return String(value==null?"":value).trim();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(error){}}
  function connector(){return window.ConCarga||window.BDLocalCarga||null;}
  function canonicalPeriodId(value){
    value=text(value);
    var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }
  function normalizeCedula(value){
    var raw=text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
    return /^\d{9}$/.test(raw)?"0"+raw:raw;
  }
  function firstValue(row,fields){
    row=row||{};
    function key(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");}
    var wanted=(fields||[]).map(key);
    var keys=Object.keys(row);
    for(var i=0;i<keys.length;i+=1){if(wanted.indexOf(key(keys[i]))>=0){return row[keys[i]];}}
    return "";
  }
  function localPeriod(){
    var id="";var label="";
    try{id=localStorage.getItem("carga.periodoSeleccionado")||"";label=localStorage.getItem("carga.periodoSeleccionadoLabel")||"";}catch(error){}
    id=canonicalPeriodId(id);
    return {periodoId:id,periodoLabel:label||id,periodoCanonicoId:id,periodoCanonicoLabel:label||id,valid:!!id&&id!=="SIN_PERIODO"};
  }
  function selectedPeriod(normalized,options){
    normalized=normalized||{};options=options||{};
    var detected=normalized.periodoDetectado||{};var local=localPeriod();
    var id=canonicalPeriodId(options.periodoCanonicoId||options.periodoId||detected.periodoCanonicoId||detected.periodoId||detected.id||local.periodoId||"");
    var label=text(options.periodoCanonicoLabel||options.periodoLabel||detected.periodoCanonicoLabel||detected.periodoLabel||detected.label||local.periodoLabel||id);
    return {id:id,label:label||id,periodoId:id,periodoLabel:label||id,periodoCanonicoId:id,periodoCanonicoLabel:label||id,valid:!!id&&id!=="SIN_PERIODO"};
  }
  function rowsFromNormalized(normalized){
    normalized=normalized||{};
    if(Array.isArray(normalized.rowsMapeadas)){return normalized.rowsMapeadas;}
    if(Array.isArray(normalized.rows)){return normalized.rows;}
    if(Array.isArray(normalized.students)){return normalized.students;}
    return [];
  }
  function injectPeriod(row,period){
    row=Object.assign({},row||{});
    var cedula=normalizeCedula(firstValue(row,["numeroIdentificacion","NumeroIdentificacion","identificacion","cedula","cédula","documento"]));
    row.numeroIdentificacion=cedula;row.cedula=cedula;
    row.periodoId=period.periodoId;row.periodoLabel=period.periodoLabel;
    row.periodoCanonicoId=period.periodoId;row.periodoCanonicoLabel=period.periodoLabel;
    row.ultimoPeriodoId=period.periodoId;row.PeriodoId=period.periodoId;row.periodId=period.periodoId;
    row.Periodo=period.periodoLabel;row.PeriodoLabel=period.periodoLabel;
    row._periodoSeleccionado=period.periodoId;row._periodoSeleccionadoLabel=period.periodoLabel;
    row.estadoMatricula=text(row.estadoMatricula||row.EstadoMatricula||"ACTIVO").toUpperCase()||"ACTIVO";
    return row;
  }
  function validateAnalysis(analysis,period){
    var limit=Number(window.CargaConfig&&window.CargaConfig.maxPeriodDifferencePercent||10);
    if(!analysis||analysis.ok!==true){throw new Error("El archivo debe analizarse y aprobarse antes de guardar.");}
    if(canonicalPeriodId(analysis.periodoId)!==canonicalPeriodId(period.periodoId)){throw new Error("El período cambió después del análisis. Analiza el archivo nuevamente.");}
    if(!analysis.firstLoad&&Number(analysis.percent||0)>limit){throw new Error("La diferencia de cédulas supera el límite del "+limit+"%.");}
    return true;
  }
  function localOptions(options){
    return Object.assign({},options||{},{sync:false,localOnly:true,cloudSync:false,manualCloudSync:true,batchSize:Number(options&&options.batchSize||window.CargaConfig&&window.CargaConfig.defaultBatchSize||250)});
  }
  function ensureConnector(){
    var con=connector();
    if(!con){return Promise.reject(new Error("ConCarga no está cargado."));}
    return Promise.resolve(typeof con.ready==="function"?con.ready():true).then(function(result){
      if(result&&result.ok===false){throw new Error(result.error||"ConCarga no está listo.");}
      if(typeof con.saveStudents!=="function"&&typeof con.guardarEstudiantes!=="function"){throw new Error("ConCarga no permite guardar estudiantes.");}
      return con;
    });
  }
  function normalizeResult(result,period,rows){
    result=result||{};
    var warnings=result.warnings||result.advertencias||[];
    var errors=result.errors||result.errores||[];
    return Object.assign({},result,{
      ok:result.ok!==false,engine:"ConCarga",periodoId:period.periodoId,periodoLabel:period.periodoLabel,
      total:result.total||result.totalEntrada||rows.length,totalEntrada:result.totalEntrada||result.total||rows.length,
      saved:result.saved||result.guardados||result.nuevos||0,guardados:result.guardados||result.saved||result.nuevos||0,
      updated:result.updated||result.actualizados||0,actualizados:result.actualizados||result.updated||0,
      merged:result.merged||result.duplicados||result.duplicadosCorregidos||0,duplicados:result.duplicados||result.merged||result.duplicadosCorregidos||0,
      warnings:warnings,advertencias:warnings,errors:errors,errores:errors,changes:result.changes||result.cambios||[]
    });
  }
  function executeSave(normalized,validation,options){
    normalized=normalized||{};validation=validation||{};options=localOptions(options||{});
    var rows=rowsFromNormalized(normalized);var period=selectedPeriod(normalized,options);
    if(!rows.length){return Promise.resolve({ok:false,total:0,saved:0,updated:0,merged:0,message:"No existen estudiantes para guardar."});}
    if(validation.ok===false&&options.allowErrors!==true){return Promise.resolve({ok:false,total:rows.length,saved:0,updated:0,merged:0,errors:validation.errors||[],warnings:validation.warnings||[],message:"La carga tiene errores y no fue guardada."});}
    if(!period.valid){return Promise.resolve({ok:false,total:rows.length,saved:0,updated:0,merged:0,message:"Selecciona un período antes de guardar."});}
    try{validateAnalysis(options.analysis,period);}catch(error){return Promise.resolve({ok:false,total:rows.length,saved:0,updated:0,merged:0,message:error.message||String(error)});}
    var prepared=rows.map(function(row){return injectPeriod(row,period);});
    emit("bdlocal:carga-save-start",{total:prepared.length,periodoId:period.periodoId,periodoLabel:period.periodoLabel,source:"ConCarga",at:new Date().toISOString()});
    return ensureConnector().then(function(con){
      var task=typeof con.saveStudents==="function"
        ?con.saveStudents(clone(prepared),Object.assign({},options,period,{normalized:true,source:options.source||"carga_excel",fileName:normalized.fileName||"",origen:normalized.origen||"",markRetired:options.markRetired===true}))
        :con.guardarEstudiantes(clone(prepared),period,options);
      return Promise.resolve(task);
    }).then(function(result){
      var finalResult=normalizeResult(result,period,prepared);
      emit("bdlocal:changes-created",{source:"ConCarga",localOnly:true,manualCloudSync:true,periodoId:period.periodoId,total:Array.isArray(finalResult.changes)?finalResult.changes.length:Number(finalResult.changes||0),changes:Array.isArray(finalResult.changes)?finalResult.changes:[],targets:["firebase","supabase","google"],at:new Date().toISOString()});
      emit("bdlocal:carga-save-finish",{ok:finalResult.ok,engine:"ConCarga",total:finalResult.total,saved:finalResult.saved,updated:finalResult.updated,merged:finalResult.merged,periodoId:period.periodoId,periodoLabel:period.periodoLabel,at:new Date().toISOString()});
      return finalResult;
    }).catch(function(error){
      emit("bdlocal:carga-save-error",{ok:false,source:"ConCarga",error:error.message||String(error),periodoId:period.periodoId,at:new Date().toISOString()});
      throw error;
    });
  }
  function save(normalized,validation,options){
    if(activeSave){return activeSave;}
    activeSave=executeSave(normalized,validation,options).finally(function(){activeSave=null;});
    return activeSave;
  }
  window.CargaSave={
    version:"2.0.0-concarga-only",save:save,isSaving:function(){return !!activeSave;},
    helpers:{selectedPeriod:selectedPeriod,injectPeriod:injectPeriod,normalizeCedula:normalizeCedula,validateAnalysis:validateAnalysis,ensureDependencies:ensureConnector}
  };
})(window);