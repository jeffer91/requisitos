/* =========================================================
Nombre completo: bdl.v2.mirror.js
Ruta o ubicación: /BDLocal/patches/bdl.v2.mirror.js
Función o funciones:
- Espejar datos legacy hacia tablas V2 sin borrar información existente.
- Consolidar Telegram en personas y contactos_estudiante.
- Usar la clave primaria correcta de cada tabla V2.
- Evitar que campos vacíos borren contactos válidos.
- Exponer actualización local de Telegram mediante BL2Core.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.1.1-telegram-safe";
  var FLAG="__bdlV2MirrorInstalled";
  if(window[FLAG]){return;}
  window[FLAG]=true;

  function text(v){return String(v==null?"":v).trim();}
  function now(){return new Date().toISOString();}
  function clone(v){try{return JSON.parse(JSON.stringify(v));}catch(e){return v;}}
  function cedula(v){var raw=text(v).replace(/[^0-9A-Za-z]/g,"");return /^\d{9}$/.test(raw)?"0"+raw:raw;}
  function first(row,names){row=row||{};for(var i=0;i<names.length;i+=1){if(text(row[names[i]])){return row[names[i]];}}return "";}
  function user(v){var r=window.BDLRulesPersona;return r&&r.normalizeTelegramUser?r.normalizeTelegramUser(v):text(v).replace(/^@+/,"").replace(/\s+/g,"");}
  function chat(v){var r=window.BDLRulesPersona;return r&&r.normalizeTelegramChatId?r.normalizeTelegramChatId(v):text(v).replace(/\s+/g,"");}
  function telegram(row){return {
    telegramUser:user(first(row,["telegramUser","_telegramUser","telegramUsername","usuarioTelegram","telegram","Telegram"])),
    telegramChatId:chat(first(row,["telegramChatId","_telegramChatId","chatIdTelegram","telegramChatID","chatId"])),
    telegramUpdatedAt:text(first(row,["telegramUpdatedAt","telegramActualizadoEn"])),
    telegramSource:text(first(row,["telegramSource","origenTelegram"])),
    telegramCheckedAt:text(first(row,["telegramCheckedAt","telegramRevisadoEn"])),
    telegramVerifiedAt:text(first(row,["telegramVerifiedAt","telegramVerificadoEn"]))
  };}
  function stores(){var s=window.BL2Config&&window.BL2Config.stores||{};return {
    estudiantes:s.estudiantes||"estudiantes",requisitos:s.requisitos||"requisitos",contactos:s.contactos||"contactos",notas:s.notas||"notas",periodos:s.periodos||"periodos",
    personas:s.personas||"personas",matriculas:s.matriculasPeriodo||"matriculas_periodo",requisitosV2:s.requisitosEstudiante||"requisitos_estudiante",
    contactosV2:s.contactosEstudiante||"contactos_estudiante",notasV2:s.notasTitulacion||"notas_titulacion",divisiones:s.divisionesEstudiante||"divisiones_estudiante",
    periodosCarreras:s.periodosCarreras||"periodos_carreras",periodosDivisiones:s.periodosDivisiones||"periodos_divisiones"
  };}
  function studentId(row){var c=cedula(row.cedula||row.numeroIdentificacion||row.NumeroIdentificacion),p=text(row.periodoId||row.periodId||row.ultimoPeriodoId);return text(row.id||row.studentId||row.idEstudiantePeriodo||(c&&p?c+"__"+p:""));}
  function merge(existing,incoming){existing=existing||{};incoming=incoming||{};var out=Object.assign({},existing);Object.keys(incoming).forEach(function(k){var v=incoming[k];if(v===undefined||v===null||text(v)===""){if(out[k]===undefined){out[k]=v;}}else{out[k]=clone(v);}});out.createdAt=existing.createdAt||incoming.createdAt||now();out.updatedAt=text(incoming.updatedAt||existing.updatedAt)||now();return out;}

  function primaryKey(storeName,row,s){
    if(storeName===s.personas){return row.cedula;}
    if(storeName===s.matriculas||storeName===s.notasV2){return row.idEstudiantePeriodo||row.id;}
    return row.id||row.idEstudiantePeriodo||row.cedula;
  }
  function mergedPut(storeName,rows,originalBulkPut){
    rows=(rows||[]).filter(Boolean);if(!rows.length){return Promise.resolve([]);}
    var db=window.BL2DB,s=stores();
    if(!db||!db.get){return originalBulkPut(storeName,rows);}
    return Promise.all(rows.map(function(row){var key=primaryKey(storeName,row,s);if(!text(key)){return row;}return db.get(storeName,key).catch(function(){return null;}).then(function(existing){return merge(existing,row);});})).then(function(out){return originalBulkPut(storeName,out);});
  }

  function persona(row){
    var c=cedula(row.cedula||row.numeroIdentificacion||row.NumeroIdentificacion);if(!c){return null;}
    var base=window.BDLRulesPersona&&window.BDLRulesPersona.buildPersona?window.BDLRulesPersona.buildPersona(row):{};
    var tg=telegram(row);
    return Object.assign({cedula:c,numeroIdentificacion:c,nombreCompleto:text(row.Nombres||row.nombres||row.Nombre||row.nombre),nombres:text(row.Nombres||row.nombres||row.Nombre||row.nombre),correoPersonal:text(row.CorreoPersonal||row.correoPersonal),correoInstitucional:text(row.CorreoInstitucional||row.correoInstitucional),celular:text(row.Celular||row.celular),source:"v2_mirror",updatedAt:text(row.updatedAt)||now()},base,tg,{cedula:c,numeroIdentificacion:c,_telegramUser:tg.telegramUser,_telegramChatId:tg.telegramChatId});
  }
  function matricula(row){var id=studentId(row),c=cedula(row.cedula||row.numeroIdentificacion),p=text(row.periodoId||row.periodId||row.ultimoPeriodoId);if(!id||!c||!p){return null;}return {idEstudiantePeriodo:id,cedula:c,periodoId:p,periodoLabel:text(row.periodoLabel||p),carrera:text(row.NombreCarrera||row.nombreCarrera||row.Carrera||row.carrera),codigoCarrera:text(row.CodigoCarrera||row.codigoCarrera),division:text(row.division||row._division),estadoMatricula:text(row.estadoMatricula||"ACTIVO").toUpperCase()==="RETIRADO"?"RETIRADO":"ACTIVO",sede:text(row.Sede||row.sede),horarioComplexivo:text(row.HorarioComplexivo||row.horarioComplexivo),source:"v2_mirror",updatedAt:text(row.updatedAt)||now()};}
  function contacto(row){var id=studentId(row),c=cedula(row.cedula||row.numeroIdentificacion),p=text(row.periodoId||row.periodId||row.ultimoPeriodoId);if(!id||!c||!p){return null;}var tg=telegram(row);return Object.assign({id:id,idEstudiantePeriodo:id,studentId:id,cedula:c,periodoId:p,periodoLabel:text(row.periodoLabel||p),CorreoPersonal:text(row.CorreoPersonal||row.correoPersonal),CorreoInstitucional:text(row.CorreoInstitucional||row.correoInstitucional),Celular:text(row.Celular||row.celular),correoPersonal:text(row.CorreoPersonal||row.correoPersonal),correoInstitucional:text(row.CorreoInstitucional||row.correoInstitucional),celular:text(row.Celular||row.celular),source:"v2_mirror",updatedAt:text(row.updatedAt)||now()},tg,{_telegramUser:tg.telegramUser,_telegramChatId:tg.telegramChatId});}
  function division(row){var id=studentId(row),d=text(row.division||row._division);if(!id||!d){return null;}return {id:id+"__"+d.toLowerCase().replace(/[^a-z0-9]+/g,"_"),idEstudiantePeriodo:id,cedula:cedula(row.cedula||row.numeroIdentificacion),periodoId:text(row.periodoId||row.periodId),division:d,source:"v2_mirror",updatedAt:text(row.updatedAt)||now()};}
  function requisito(row){var c=cedula(row.cedula),p=text(row.periodoId),k=text(row.key||row.nombre||row.requisitoKey),id=text(row.studentId||row.idEstudiantePeriodo||(c&&p?c+"__"+p:""));if(!c||!p||!k){return null;}return Object.assign({},row,{id:row.id||(id+"__"+k.toLowerCase().replace(/[^a-z0-9]+/g,"_")),idEstudiantePeriodo:id,cedula:c,periodoId:p,requisitoKey:k,estado:text(row.estado||row.valor||row.value),source:"v2_mirror",updatedAt:text(row.updatedAt)||now()});}
  function legacyContact(row){var c=cedula(row.cedula||row.numeroIdentificacion),p=text(row.periodoId||row.periodId),id=text(row.studentId||row.idEstudiantePeriodo||row.id||(c&&p?c+"__"+p:""));if(!c||!p||!id){return null;}var tg=telegram(row);return Object.assign({},row,{id:id,idEstudiantePeriodo:id,studentId:id,cedula:c,periodoId:p,correoPersonal:text(row.correoPersonal||row.CorreoPersonal),correoInstitucional:text(row.correoInstitucional||row.CorreoInstitucional),celular:text(row.celular||row.Celular||row.telefono),telegramUser:tg.telegramUser,telegramChatId:tg.telegramChatId,telegramUpdatedAt:tg.telegramUpdatedAt,telegramSource:tg.telegramSource,telegramCheckedAt:tg.telegramCheckedAt,telegramVerifiedAt:tg.telegramVerifiedAt,_telegramUser:tg.telegramUser,_telegramChatId:tg.telegramChatId,source:"v2_mirror",updatedAt:text(row.updatedAt)||now()});}
  function nota(row){var c=cedula(row.cedula),p=text(row.periodoId),id=text(row.idEstudiantePeriodo||row.studentId||row.id||(c&&p?c+"__"+p:""));if(!id||!c||!p){return null;}return Object.assign({},row,{idEstudiantePeriodo:id,cedula:c,periodoId:p,source:"v2_mirror",updatedAt:text(row.updatedAt)||now()});}
  function periodRows(row){var p=text(row.id||row.periodoId),out=[];if(!p){return out;}(row.carrerasDetectadas||[]).forEach(function(x){var label=text(x.nombre||x.label||x.carrera||x);if(label){out.push({type:"career",id:p+"__"+label.toLowerCase().replace(/[^a-z0-9]+/g,"_"),periodoId:p,carrera:label,updatedAt:now(),source:"v2_mirror"});}});(row.divisiones||[]).forEach(function(x){var label=text(x);if(label){out.push({type:"division",id:p+"__"+label.toLowerCase().replace(/[^a-z0-9]+/g,"_"),periodoId:p,division:label,updatedAt:now(),source:"v2_mirror"});}});return out;}

  function mirrorRows(storeName,rows,originalPut,originalBulkPut){
    var s=stores(),tasks=[];rows=Array.isArray(rows)?rows:[];if(!rows.length){return Promise.resolve({mirrored:0});}
    if(storeName===s.estudiantes){var people=rows.map(persona).filter(Boolean),enrollments=rows.map(matricula).filter(Boolean),contacts=rows.map(contacto).filter(Boolean),divisions=rows.map(division).filter(Boolean);if(people.length){tasks.push(mergedPut(s.personas,people,originalBulkPut));}if(enrollments.length){tasks.push(mergedPut(s.matriculas,enrollments,originalBulkPut));}if(contacts.length){tasks.push(mergedPut(s.contactosV2,contacts,originalBulkPut));}if(divisions.length){tasks.push(mergedPut(s.divisiones,divisions,originalBulkPut));}}
    if(storeName===s.requisitos){var reqs=rows.map(requisito).filter(Boolean);if(reqs.length){tasks.push(mergedPut(s.requisitosV2,reqs,originalBulkPut));}}
    if(storeName===s.contactos){var contacts2=rows.map(legacyContact).filter(Boolean);if(contacts2.length){tasks.push(mergedPut(s.contactosV2,contacts2,originalBulkPut));}}
    if(storeName===s.notas){var notes=rows.map(nota).filter(Boolean);if(notes.length){tasks.push(mergedPut(s.notasV2,notes,originalBulkPut));}}
    if(storeName===s.periodos){rows.forEach(function(p){periodRows(p).forEach(function(item){tasks.push(originalPut(item.type==="career"?s.periodosCarreras:s.periodosDivisiones,item));});});}
    return tasks.length?Promise.all(tasks).then(function(){return {mirrored:tasks.length};}):Promise.resolve({mirrored:0});
  }

  function exposeCoreTelegram(){
    var core=window.BL2Core,repo=window.BDLRepoContactos;
    if(!core||!repo||!repo.saveTelegramForCedula){return false;}
    core.updateTelegramByCedula=function(c,data,options){return repo.saveTelegramForCedula(c,data,Object.assign({source:"BL2Core.telegram_local"},options||{}));};
    core.actualizarTelegramPorCedula=core.updateTelegramByCedula;
    core.guardarTelegram=core.updateTelegramByCedula;
    core.__telegramLocalOnly=true;
    return true;
  }

  function install(){
    var db=window.BL2DB;if(!db||!db.put||!db.bulkPut){return false;}
    if(db.__v2MirrorInstalled){exposeCoreTelegram();return true;}
    var originalPut=db.put.bind(db),originalBulkPut=db.bulkPut.bind(db);
    db.put=function(storeName,value){return originalPut(storeName,value).then(function(saved){return mirrorRows(storeName,[saved||value],originalPut,originalBulkPut).catch(function(error){try{console.warn("[BDLV2Mirror]",error);}catch(e){}}).then(function(){return saved;});});};
    db.bulkPut=function(storeName,rows){rows=Array.isArray(rows)?rows:[];return originalBulkPut(storeName,rows).then(function(saved){return mirrorRows(storeName,saved&&saved.length?saved:rows,originalPut,originalBulkPut).catch(function(error){try{console.warn("[BDLV2Mirror]",error);}catch(e){}}).then(function(){return saved;});});};
    db.__v2MirrorInstalled=true;db.v2MirrorVersion=VERSION;exposeCoreTelegram();
    try{window.dispatchEvent(new CustomEvent("bdlocal:v2-mirror-ready",{detail:{version:VERSION,at:now(),telegramSafe:true}}));}catch(e){}
    return true;
  }

  window.BDLV2Mirror={version:VERSION,install:install,mirrorRows:mirrorRows,mergeNonEmpty:merge,personaFromStudent:persona,contactFromStudent:contacto,exposeCoreTelegram:exposeCoreTelegram};
  install();
})(window);
