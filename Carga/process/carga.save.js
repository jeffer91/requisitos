/* =========================================================
Nombre completo: carga.save.js
Ruta o ubicación: /Carga/process/carga.save.js
Función o funciones:
- Validar y guardar exclusivamente mediante ConCarga.
- Preservar estados manuales y campos que el archivo no contiene.
- Preservar CorreoPersonal cuando la columna existe pero llega vacía.
- Informar por separado el guardado local y el registro de auditoría.
========================================================= */
(function(window){
  "use strict";

  var activeSave=null;
  var AUDIT_FALLBACK_KEY="carga.importaciones.pendientes.v1";
  var REQUIREMENT_GROUPS=[
    ["Academico",["Academico","Académico","academico"]],
    ["Documentacion",["Documentacion","Documentación","documentacion"]],
    ["Financiero",["Financiero","financiero"]],
    ["Titulacion",["Titulacion","Titulación","titulacion"]],
    ["PracticasVinculacion",["PracticasVinculacion","PrácticasVinculacion","Prácticas/Vinculación","Practicas/Vinculacion"]],
    ["Vinculacion",["Vinculacion","Vinculación","vinculacion"]],
    ["SeguimientoGraduados",["SeguimientoGraduados","seguimientoGraduados"]],
    ["Ingles",["Ingles","Inglés","ingles"]],
    ["ActualizacionDatos",["ActualizacionDatos","ActualizaciónDatos","actualizacionDatos"]],
    ["AprobacionTitulacion",["AprobacionTitulacion","AprobaciónTitulacion","aprobacionTitulacion"]],
    ["AprobacionComplexivoProyecto",["AprobacionComplexivoProyecto","AprobaciónComplexivoProyecto","aprobacionComplexivoProyecto"]]
  ];
  var CONTACT_GROUPS=[
    ["CorreoPersonal",["CorreoPersonal","correoPersonal","correo_personal"]],
    ["CorreoInstitucional",["CorreoInstitucional","correoInstitucional","correo_institucional"]],
    ["Celular",["Celular","celular","Telefono","Teléfono","telefono"]],
    ["telegramUser",["telegramUser","_telegramUser","usuarioTelegram","telegram"]],
    ["telegramChatId",["telegramChatId","_telegramChatId","chatIdTelegram","chatId"]]
  ];
  var NOTE_GROUPS=[
    ["Notart",["Notart","Nart","notart","notaArticulo","NotaArticulo"]],
    ["Notdef",["Notdef","Ndef","notdef","notaDefensa","NotaDefensa"]],
    ["Notafinal",["Notafinal","NotaFinal","Nfinal","notafinal","notaFinal"]],
    ["notaTeorica",["notaTeorica","teorico","NotaTeorica","Nota 1"]],
    ["notaPractica",["notaPractica","practico","NotaPractica","Nota 2"]],
    ["notaComplexivo",["notaComplexivo","complexivo","NotaComplexivo"]],
    ["notaSupletorio",["notaSupletorio","supletorioComplexivo","Supletorio Complexivo"]],
    ["notaEscrito",["notaEscrito","escrito","trabajoEscrito"]],
    ["notaDefensaTrabajo",["notaDefensaTrabajo","defensaTrabajo"]],
    ["notaTrabajoTitulacion",["notaTrabajoTitulacion","trabajoTitulacion"]],
    ["notaOficial",["notaOficial"]],
    ["estadoEvaluacion",["estadoEvaluacion","estadoDefensa","resultadoTitulacion"]]
  ];

  function text(value){return String(value==null?"":value).trim();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail:detail||{}}));}catch(error){}}
  function progress(percent,message){emit("carga:progress",{percent:Math.max(0,Math.min(100,Number(percent)||0)),message:message||"Guardando",phase:"saving"});}
  function connector(){return window.ConCarga||window.BDLocalCarga||null;}
  function canonicalPeriodId(value){value=text(value);var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");}
  function normalizeCedula(value){var raw=text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();return /^\d{9}$/.test(raw)?"0"+raw:raw;}
  function fieldKey(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");}
  function fieldName(row,fields){
    row=row||{};var wanted=(fields||[]).map(fieldKey),keys=Object.keys(row);
    for(var i=0;i<keys.length;i+=1){if(wanted.indexOf(fieldKey(keys[i]))>=0){return keys[i];}}
    return "";
  }
  function firstValue(row,fields){var name=fieldName(row,fields);return name?row[name]:"";}
  function hasField(row,fields){return !!fieldName(row,fields);}
  function cedulaOf(row){return normalizeCedula(firstValue(row||{},["numeroIdentificacion","NumeroIdentificacion","identificacion","cedula","cédula","documento"]));}
  function localPeriod(){var id="",label="";try{id=localStorage.getItem("carga.periodoSeleccionado")||"";label=localStorage.getItem("carga.periodoSeleccionadoLabel")||"";}catch(error){}id=canonicalPeriodId(id);return {periodoId:id,periodoLabel:label||id,periodoCanonicoId:id,periodoCanonicoLabel:label||id,valid:!!id&&id!=="SIN_PERIODO"};}
  function selectedPeriod(normalized,options){normalized=normalized||{};options=options||{};var detected=normalized.periodoDetectado||{},local=localPeriod();var id=canonicalPeriodId(options.periodoCanonicoId||options.periodoId||detected.periodoCanonicoId||detected.periodoId||detected.id||local.periodoId||"");var label=text(options.periodoCanonicoLabel||options.periodoLabel||detected.periodoCanonicoLabel||detected.periodoLabel||detected.label||local.periodoLabel||id);return {id:id,label:label||id,periodoId:id,periodoLabel:label||id,periodoCanonicoId:id,periodoCanonicoLabel:label||id,valid:!!id&&id!=="SIN_PERIODO"};}
  function rowsFromNormalized(normalized){normalized=normalized||{};if(Array.isArray(normalized.rowsMapeadas)){return normalized.rowsMapeadas;}if(Array.isArray(normalized.rows)){return normalized.rows;}if(Array.isArray(normalized.students)){return normalized.students;}return [];}
  function injectPeriod(row,period){
    row=Object.assign({},row||{});var cedula=cedulaOf(row);
    row.numeroIdentificacion=cedula;row.cedula=cedula;row.periodoId=period.periodoId;row.periodoLabel=period.periodoLabel;row.periodoCanonicoId=period.periodoId;row.periodoCanonicoLabel=period.periodoLabel;row.ultimoPeriodoId=period.periodoId;row.PeriodoId=period.periodoId;row.periodId=period.periodoId;row.Periodo=period.periodoLabel;row.PeriodoLabel=period.periodoLabel;row._periodoSeleccionado=period.periodoId;row._periodoSeleccionadoLabel=period.periodoLabel;row.estadoMatricula=text(row.estadoMatricula||row.EstadoMatricula||"ACTIVO").toUpperCase()||"ACTIVO";
    return row;
  }
  function validateAnalysis(analysis,period){var limit=Number(window.CargaConfig&&window.CargaConfig.maxPeriodDifferencePercent||10);if(!analysis||analysis.ok!==true){throw new Error("El archivo debe analizarse y aprobarse antes de guardar.");}if(canonicalPeriodId(analysis.periodoId)!==canonicalPeriodId(period.periodoId)){throw new Error("El período cambió después del análisis. Analiza el archivo nuevamente.");}if(!analysis.firstLoad&&Number(analysis.percent||0)>limit){throw new Error("La diferencia de cédulas supera el límite del "+limit+"%.");}return true;}
  function localOptions(options){return Object.assign({},options||{},{sync:false,localOnly:true,cloudSync:false,manualCloudSync:true,batchSize:Number(options&&options.batchSize||window.CargaConfig&&window.CargaConfig.defaultBatchSize||250)});}
  function ensureConnector(){var con=connector();if(!con){return Promise.reject(new Error("ConCarga no está cargado."));}return Promise.resolve(typeof con.ready==="function"?con.ready():true).then(function(result){if(result&&result.ok===false){throw new Error(result.error||"ConCarga no está listo.");}if(typeof con.saveStudents!=="function"&&typeof con.guardarEstudiantes!=="function"){throw new Error("ConCarga no permite guardar estudiantes.");}return con;});}
  function manualEnrollment(row){return row&&(row.estadoMatriculaManual===true||text(row.estadoMatriculaManual).toLowerCase()==="true"||text(row.estadoMatriculaManualOrigen)!=="");}
  function copyMissingGroup(row,previous,group){
    var canonical=group[0],aliases=group[1];
    if(hasField(row,aliases)){return;}
    var value=firstValue(previous,aliases.concat([canonical]));
    if(value!==undefined&&value!==null&&text(value)!==""){row[canonical]=clone(value);}
  }
  function preserveBlankPersonalEmail(row,previous){
    var aliases=["CorreoPersonal","correoPersonal","correo_personal"],incomingName=fieldName(row,aliases);
    if(!incomingName||text(row[incomingName])!==""){return;}
    var previousValue=firstValue(previous,aliases);
    if(text(previousValue)===""){return;}
    row[incomingName]=clone(previousValue);
    row.CorreoPersonal=clone(previousValue);
    row._correoPersonalPreservado=true;
  }
  function preserveExistingFields(con,rows,period,options){
    if(!con||typeof con.listStudents!=="function"){return Promise.resolve(rows);}
    return Promise.resolve(con.listStudents({periodoId:period.periodoId,periodId:period.periodoId,matricula:"",limit:0})).then(function(existing){
      existing=Array.isArray(existing)?existing:(existing&&Array.isArray(existing.rows)?existing.rows:[]);
      var index=Object.create(null);existing.forEach(function(row){var id=cedulaOf(row);if(id){index[id]=row;}});
      return rows.map(function(input){
        var row=Object.assign({},input||{}),previous=index[cedulaOf(row)];
        if(!previous){return row;}
        if(!(options&&options.overrideManualEnrollment===true)&&manualEnrollment(previous)){
          ["estadoMatricula","retirado","retiradoEn","reactivadoEn","estadoMatriculaActualizadaEn","estadoMatriculaManual","estadoMatriculaManualActualizadaEn","estadoMatriculaManualOrigen"].forEach(function(field){if(previous[field]!==undefined){row[field]=clone(previous[field]);}});
          row._estadoMatriculaManualPreservado=true;
        }
        preserveBlankPersonalEmail(row,previous);
        REQUIREMENT_GROUPS.concat(CONTACT_GROUPS,NOTE_GROUPS).forEach(function(group){copyMissingGroup(row,previous,group);});
        row._camposAusentesPreservados=true;
        return row;
      });
    });
  }
  function stable(value){if(value==null){return "";}if(typeof value!=="object"){return String(value);}if(Array.isArray(value)){return "["+value.map(stable).join(",")+"]";}return "{"+Object.keys(value).filter(function(key){return key.charAt(0)!=="_"&&["createdAt","updatedAt","ultimaEdicionLocal"].indexOf(key)<0;}).sort().map(function(key){return JSON.stringify(key)+":"+stable(value[key]);}).join(",")+"}";}
  function hash(value){var source=stable(value),result=2166136261;for(var i=0;i<source.length;i+=1){result^=source.charCodeAt(i);result+=(result<<1)+(result<<4)+(result<<7)+(result<<8)+(result<<24);}return (result>>>0).toString(16);}
  function importHash(normalized,prepared,period,options){return text(options&&options.fileHash||normalized&&normalized.fileHash||normalized&&normalized.archivoHash)||hash({periodoId:period.periodoId,archivo:text(normalized&&normalized.fileName),rows:prepared});}
  function normalizeResult(result,period,rows){result=result||{};var warnings=result.warnings||result.advertencias||[],errors=result.errors||result.errores||[];return Object.assign({},result,{ok:result.ok!==false,engine:"ConCarga",periodoId:period.periodoId,periodoLabel:period.periodoLabel,total:result.total||result.totalEntrada||rows.length,totalEntrada:result.totalEntrada||result.total||rows.length,saved:result.saved||result.guardados||result.nuevos||0,guardados:result.guardados||result.saved||result.nuevos||0,updated:result.updated||result.actualizados||0,actualizados:result.actualizados||result.updated||0,merged:result.merged||result.duplicados||result.duplicadosCorregidos||0,duplicados:result.duplicados||result.merged||result.duplicadosCorregidos||0,warnings:warnings,advertencias:warnings,errors:errors,errores:errors,changes:result.changes||result.cambios||[]});}
  function buildImportRecord(normalized,period,prepared,result,options){return {periodoId:period.periodoId,archivoNombre:text(normalized.fileName||options.fileName||"carga_estudiantes"),archivoHash:importHash(normalized,prepared,period,options),archivoTipo:text(normalized.detectedType||normalized.fileType||options.fileType||"ARCHIVO"),totalFilas:Number(result.totalEntrada||prepared.length),nuevos:Number(result.guardados||0),actualizados:Number(result.actualizados||0),sinCambios:Number(result.sinCambios||0),retirados:Number(result.retirados||0),errores:Array.isArray(result.errores)?result.errores.slice():[],totalDetectados:Number(result.totalEntrada||prepared.length),totalEncontrados:Number(result.guardados||0)+Number(result.actualizados||0)+Number(result.sinCambios||0),totalNoEncontrados:0,totalDuplicados:Number(result.duplicados||0),totalConflictos:0,totalGuardados:Number(result.guardados||0)+Number(result.actualizados||0),estado:result.ok===false?"ERROR":"PROCESADA",source:"CARGA_ARCHIVO",tipo:"ARCHIVO_ESTUDIANTES",usuario:text(options.usuario||options.user||""),createdAt:text(result.finishedAt)||new Date().toISOString()};}
  function queueAuditFallback(record,error){
    try{
      var current=[];try{current=JSON.parse(localStorage.getItem(AUDIT_FALLBACK_KEY)||"[]");}catch(parseError){current=[];}
      current=Array.isArray(current)?current:[];
      var id=record.archivoHash+"__"+record.periodoId;
      current=current.filter(function(item){return item&&item._fallbackId!==id;});
      current.push(Object.assign({},record,{_fallbackId:id,_error:text(error&&error.message||error),_queuedAt:new Date().toISOString()}));
      localStorage.setItem(AUDIT_FALLBACK_KEY,JSON.stringify(current.slice(-100)));
      return true;
    }catch(storageError){return false;}
  }
  function registerImport(con,record,result){
    if(!con||typeof con.saveImport!=="function"){return Promise.reject(new Error("ConCarga no permite registrar la importación."));}
    return con.saveImport(record).then(function(saved){result.importacion=saved;result.importacionId=saved&&saved.id||"";result.auditOk=true;return saved;});
  }
  function executeSave(normalized,validation,options){
    normalized=normalized||{};validation=validation||{};options=localOptions(options||{});
    var rows=rowsFromNormalized(normalized),period=selectedPeriod(normalized,options),prepared=[],activeConnector=null;
    if(!rows.length){return Promise.resolve({ok:false,total:0,saved:0,updated:0,merged:0,message:"No existen estudiantes para guardar."});}
    if(validation.ok===false&&options.allowErrors!==true){return Promise.resolve({ok:false,total:rows.length,saved:0,updated:0,merged:0,errors:validation.errors||[],warnings:validation.warnings||[],message:"La carga tiene errores y no fue guardada."});}
    if(!period.valid){return Promise.resolve({ok:false,total:rows.length,saved:0,updated:0,merged:0,message:"Selecciona un período antes de guardar."});}
    try{validateAnalysis(options.analysis,period);}catch(error){return Promise.resolve({ok:false,total:rows.length,saved:0,updated:0,merged:0,message:error.message||String(error)});}
    prepared=rows.map(function(row){return injectPeriod(row,period);});progress(5,"Preparando "+prepared.length+" estudiantes");
    emit("bdlocal:carga-save-start",{total:prepared.length,periodoId:period.periodoId,periodoLabel:period.periodoLabel,source:"ConCarga",at:new Date().toISOString()});
    return ensureConnector().then(function(con){
      activeConnector=con;progress(15,"Protegiendo información existente");
      return preserveExistingFields(con,prepared,period,options).then(function(finalRows){
        prepared=finalRows;progress(35,"Guardando estudiantes en BDLocal");
        var task=typeof con.saveStudents==="function"?con.saveStudents(clone(prepared),Object.assign({},options,period,{normalized:true,source:options.source||"carga_excel",fileName:normalized.fileName||"",origen:normalized.origen||"",markRetired:options.markRetired===true})):con.guardarEstudiantes(clone(prepared),period,options);
        return Promise.resolve(task);
      });
    }).then(function(result){
      var finalResult=normalizeResult(result,period,prepared);
      if(finalResult.ok===false){return finalResult;}
      progress(82,"Estudiantes guardados. Registrando auditoría");
      var record=buildImportRecord(normalized,period,prepared,finalResult,options);
      return registerImport(activeConnector,record,finalResult).catch(function(error){
        finalResult.ok=true;finalResult.auditOk=false;finalResult.auditError=text(error&&error.message||error);finalResult.auditQueued=queueAuditFallback(record,error);finalResult.message="Los estudiantes se guardaron en BDLocal, pero el registro de auditoría quedó pendiente.";
        emit("bdlocal:carga-audit-pending",{ok:false,periodoId:period.periodoId,error:finalResult.auditError,queued:finalResult.auditQueued,record:record,at:new Date().toISOString()});
      }).then(function(){return finalResult;});
    }).then(function(finalResult){
      progress(100,finalResult.auditOk===false?"Guardado completo; auditoría pendiente":"Carga guardada y auditada");
      emit("bdlocal:changes-created",{source:"ConCarga",localOnly:true,manualCloudSync:true,periodoId:period.periodoId,total:Array.isArray(finalResult.changes)?finalResult.changes.length:Number(finalResult.changes||0),changes:Array.isArray(finalResult.changes)?finalResult.changes:[],targets:["firebase","supabase","google"],importacionId:finalResult.importacionId||"",auditOk:finalResult.auditOk!==false,at:new Date().toISOString()});
      emit("bdlocal:carga-save-finish",{ok:finalResult.ok,engine:"ConCarga",total:finalResult.total,saved:finalResult.saved,updated:finalResult.updated,merged:finalResult.merged,periodoId:period.periodoId,periodoLabel:period.periodoLabel,importacionId:finalResult.importacionId||"",auditOk:finalResult.auditOk!==false,at:new Date().toISOString()});
      return finalResult;
    }).catch(function(error){emit("bdlocal:carga-save-error",{ok:false,source:"ConCarga",error:error.message||String(error),periodoId:period.periodoId,at:new Date().toISOString()});throw error;});
  }
  function save(normalized,validation,options){if(activeSave){return activeSave;}activeSave=executeSave(normalized,validation,options).finally(function(){activeSave=null;});return activeSave;}

  window.CargaSave={version:"3.0.0-email-audit-safe",save:save,isSaving:function(){return !!activeSave;},helpers:{selectedPeriod:selectedPeriod,injectPeriod:injectPeriod,normalizeCedula:normalizeCedula,validateAnalysis:validateAnalysis,ensureDependencies:ensureConnector,preserveManualEnrollment:preserveExistingFields,preserveExistingFields:preserveExistingFields,preserveBlankPersonalEmail:preserveBlankPersonalEmail,hasField:hasField,importHash:importHash,queueAuditFallback:queueAuditFallback}};
})(window);
