/* =========================================================
Nombre completo: bdl.repo.contactos.js
Ruta o ubicación: /BDLocal/repositories/bdl.repo.contactos.js
Función o funciones:
- Usar contactos_estudiante como repositorio principal.
- Mantener lectura y escritura compatible con contactos legacy.
- Consolidar telegramUser y telegramChatId sin borrar valores válidos.
- Propagar Telegram a todas las matrículas locales sin crear cola externa.
- Registrar revisiones vacías sin eliminar Telegram existente.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.2.0-v2-telegram-safe-review";
  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }
  function now(){ return new Date().toISOString(); }
  function normalizeCedula(value){
    var rules = window.BDLRulesPersona;
    if(rules && typeof rules.normalizeCedula === "function"){ return rules.normalizeCedula(value); }
    var raw = text(value).replace(/[^0-9A-Za-z]/g,"");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }
  function normalizeUser(value){
    var rules = window.BDLRulesPersona;
    return rules && rules.normalizeTelegramUser ? rules.normalizeTelegramUser(value) : text(value).replace(/^@+/,"").replace(/\s+/g,"");
  }
  function normalizeChatId(value){
    var rules = window.BDLRulesPersona;
    return rules && rules.normalizeTelegramChatId ? rules.normalizeTelegramChatId(value) : text(value).replace(/\s+/g,"");
  }
  function v2Store(){ return Repos.storeName("contactosEstudiante","contactos_estudiante"); }
  function legacyStore(){ return Repos.storeName("contactos","contactos"); }
  function personStore(){ return Repos.storeName("personas","personas"); }
  function enrollmentStore(){ return Repos.storeName("matriculasPeriodo","matriculas_periodo"); }
  function studentStore(){ return Repos.storeName("estudiantes","estudiantes"); }
  function stableId(cedula,periodoId){ return normalizeCedula(cedula) + "__" + text(periodoId); }

  function mergeNonEmpty(existing,incoming){
    existing = existing || {};
    incoming = incoming || {};
    var merged = Object.assign({},existing);
    Object.keys(incoming).forEach(function(key){
      var value = incoming[key];
      if(value === undefined || value === null || text(value) === ""){
        if(merged[key] === undefined){ merged[key] = value; }
      }else{ merged[key] = value; }
    });
    merged.createdAt = existing.createdAt || incoming.createdAt || now();
    merged.updatedAt = text(incoming.updatedAt || existing.updatedAt) || now();
    return merged;
  }

  function normalize(row){
    row = Object.assign({},row || {});
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion);
    var periodoId = text(row.periodoId || row.periodId);
    var id = text(row.id || row.idEstudiantePeriodo || row.studentId || (cedula && periodoId ? stableId(cedula,periodoId) : ""));
    var user = normalizeUser(row.telegramUser || row._telegramUser || row.usuarioTelegram || row.telegram || "");
    var chatId = normalizeChatId(row.telegramChatId || row._telegramChatId || row.chatIdTelegram || row.chatId || "");
    return Object.assign({},row,{
      id:id,idEstudiantePeriodo:text(row.idEstudiantePeriodo || id),studentId:text(row.studentId || id),
      cedula:cedula,numeroIdentificacion:text(row.numeroIdentificacion || cedula),periodoId:periodoId,
      correoPersonal:text(row.correoPersonal || row.CorreoPersonal || ""),
      correoInstitucional:text(row.correoInstitucional || row.CorreoInstitucional || ""),
      celular:text(row.celular || row.Celular || row.telefono || ""),
      telegramUser:user,telegramChatId:chatId,_telegramUser:user,_telegramChatId:chatId,
      telegramUpdatedAt:text(row.telegramUpdatedAt || row.telegramActualizadoEn || ""),
      telegramSource:text(row.telegramSource || row.origenTelegram || ""),
      telegramCheckedAt:text(row.telegramCheckedAt || row.telegramRevisadoEn || ""),
      telegramVerifiedAt:text(row.telegramVerifiedAt || row.telegramVerificadoEn || ""),
      updatedAt:text(row.updatedAt || "") || now()
    });
  }

  function combine(v2Rows,legacyRows){
    var map = Object.create(null);
    (legacyRows || []).forEach(function(row){var item=normalize(row);if(item.id){map[item.id]=mergeNonEmpty(map[item.id],item);}});
    (v2Rows || []).forEach(function(row){var item=normalize(row);if(item.id){map[item.id]=mergeNonEmpty(map[item.id],item);}});
    return Object.keys(map).map(function(key){return map[key];});
  }

  function list(options){
    options = options || {};
    return Promise.all([Repos.safeGetAll(v2Store()),Repos.safeGetAll(legacyStore())]).then(function(values){
      var rows=combine(values[0],values[1]);
      rows=Repos.byPeriodo(rows,options.periodoId);
      if(text(options.cedula)){rows=Repos.byCedula(rows,normalizeCedula(options.cedula));}
      return rows;
    });
  }
  function getByCedula(cedula,periodoId){return list({cedula:cedula,periodoId:periodoId}).then(function(rows){return rows[0]||null;});}
  function getExisting(storeName,id){var current=Repos.db();return current&&current.get?current.get(storeName,id).catch(function(){return null;}):Promise.resolve(null);}

  function save(row,options){
    options = options || {};
    row = normalize(row);
    if(!row.id || !row.cedula || !row.periodoId){return Promise.reject(new Error("El contacto requiere cédula y período."));}
    return getExisting(v2Store(),row.id).then(function(existing){
      var merged=normalize(mergeNonEmpty(existing,row));
      return Repos.safePut(v2Store(),merged).then(function(){
        if(options.writeLegacy===false){return merged;}
        return getExisting(legacyStore(),row.id).then(function(old){return Repos.safePut(legacyStore(),normalize(mergeNonEmpty(old,merged))).then(function(){return merged;});});
      });
    });
  }

  function telegramPatch(data,options){
    data = data || {};options = options || {};
    var user=normalizeUser(data.telegramUser || data._telegramUser || data.usuarioTelegram || "");
    var chatId=normalizeChatId(data.telegramChatId || data._telegramChatId || data.chatId || "");
    var timestamp=text(data.telegramUpdatedAt || options.telegramUpdatedAt || "") || now();
    return {
      telegramUser:user,telegramChatId:chatId,_telegramUser:user,_telegramChatId:chatId,
      telegramUpdatedAt:timestamp,telegramSource:text(data.telegramSource || options.source || "local"),
      telegramCheckedAt:text(data.telegramCheckedAt || options.checkedAt || timestamp),
      telegramVerifiedAt:text(data.telegramVerifiedAt || options.verifiedAt || "")
    };
  }

  function saveTelegram(row,options){
    var patch=telegramPatch(row,options);
    return save(Object.assign({},row || {},patch),Object.assign({writeLegacy:true},options || {}));
  }

  function savePersonTelegram(cedula,patch){
    var current=Repos.db();
    if(!current||!current.get){return Promise.resolve(null);}
    return current.get(personStore(),cedula).catch(function(){return null;}).then(function(existing){
      var person=mergeNonEmpty(existing,Object.assign({cedula:cedula,numeroIdentificacion:cedula},patch,{updatedAt:text(existing&&existing.updatedAt)||now()}));
      return Repos.safePut(personStore(),person);
    });
  }

  function rowsByCedula(storeName,cedula){
    return Repos.safeQueryByIndex(storeName,"cedula",cedula).then(function(rows){
      if(rows && rows.length){return rows;}
      return Repos.safeGetAll(storeName).then(function(all){return (all || []).filter(function(row){return normalizeCedula(row.cedula || row.numeroIdentificacion)===cedula;});});
    });
  }

  function safeStudentPatch(row,patch){
    var output={
      telegramUpdatedAt:patch.telegramUpdatedAt,
      telegramSource:patch.telegramSource,
      telegramCheckedAt:patch.telegramCheckedAt,
      telegramVerifiedAt:patch.telegramVerifiedAt
    };
    if(text(patch.telegramUser)){
      output.telegramUser=patch.telegramUser;
      output._telegramUser=patch.telegramUser;
    }
    if(text(patch.telegramChatId)){
      output.telegramChatId=patch.telegramChatId;
      output._telegramChatId=patch.telegramChatId;
    }
    output.updatedAt=row.updatedAt || now();
    return mergeNonEmpty(row,output);
  }

  function updateStudentCopies(cedula,patch){
    return rowsByCedula(studentStore(),cedula).then(function(rows){
      if(!rows.length){return [];}
      var updated=rows.map(function(row){return safeStudentPatch(row,patch);});
      return Repos.bulkPut(studentStore(),updated).then(function(){return updated;});
    });
  }

  function saveTelegramForCedula(cedula,data,options){
    options = options || {};
    cedula = normalizeCedula(cedula || data && data.cedula);
    if(!cedula){return Promise.reject(new Error("Telegram requiere cédula."));}
    var patch=telegramPatch(data,options);

    return Promise.all([
      savePersonTelegram(cedula,patch),
      updateStudentCopies(cedula,patch),
      rowsByCedula(enrollmentStore(),cedula)
    ]).then(function(values){
      var students=values[1] || [];
      var enrollments=values[2] || [];
      var periods={};
      students.forEach(function(row){if(text(row.periodoId)){periods[text(row.periodoId)]={id:text(row.id || stableId(cedula,row.periodoId)),periodoId:text(row.periodoId),periodoLabel:text(row.periodoLabel)};}});
      enrollments.forEach(function(row){if(text(row.periodoId)){periods[text(row.periodoId)]={id:text(row.idEstudiantePeriodo || row.id || stableId(cedula,row.periodoId)),periodoId:text(row.periodoId),periodoLabel:text(row.periodoLabel)};}});

      var saved=[];
      var chain=Promise.resolve();
      Object.keys(periods).forEach(function(periodoId){
        chain=chain.then(function(){
          var item=periods[periodoId];
          return saveTelegram(Object.assign({id:item.id,idEstudiantePeriodo:item.id,cedula:cedula,periodoId:item.periodoId,periodoLabel:item.periodoLabel},patch),options).then(function(contact){saved.push(contact);});
        });
      });
      return chain.then(function(){
        try{window.dispatchEvent(new CustomEvent("bdlocal:telegram-local-updated",{detail:{cedula:cedula,periodos:saved.length,source:patch.telegramSource,queued:false}}));}catch(error){}
        return {ok:true,cedula:cedula,periodos:saved.length,students:students.length,contacts:saved,telegramUser:patch.telegramUser,telegramChatId:patch.telegramChatId,queued:false};
      });
    });
  }

  var api={
    version:VERSION,primaryStore:v2Store,legacyStore:legacyStore,list:list,getByCedula:getByCedula,
    save:save,saveTelegram:saveTelegram,saveTelegramForCedula:saveTelegramForCedula,
    normalize:normalize,telegramPatch:telegramPatch,mergeNonEmpty:mergeNonEmpty,safeStudentPatch:safeStudentPatch
  };

  Repos.register("contactos",api);
  window.BDLRepoContactos=api;
})(window);
