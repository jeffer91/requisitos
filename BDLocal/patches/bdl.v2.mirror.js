/* =========================================================
Nombre completo: bdl.v2.mirror.js
Ruta o ubicación: /BDLocal/patches/bdl.v2.mirror.js
Función o funciones:
- Espejar datos legacy hacia tablas V2 sin borrar información existente.
- Mantener compatibilidad mientras el Core usa tablas legacy.
- Consolidar telegramUser y telegramChatId en personas y contactos_estudiante.
- Evitar que una carga con campos vacíos borre contactos o Telegram válidos.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.1.0-telegram-safe";
  var FLAG = "__bdlV2MirrorInstalled";
  if(window[FLAG]){ return; }
  window[FLAG] = true;

  function text(value){ return String(value == null ? "" : value).trim(); }
  function nowISO(){ return new Date().toISOString(); }
  function clone(value){
    if(value === undefined){ return undefined; }
    try{ return JSON.parse(JSON.stringify(value)); }
    catch(error){ return value; }
  }
  function normalizeCedula(value){
    var raw = text(value).replace(/[^0-9A-Za-z]/g,"");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }
  function normalizeUser(value){
    var rules = window.BDLRulesPersona;
    if(rules && typeof rules.normalizeTelegramUser === "function"){ return rules.normalizeTelegramUser(value); }
    return text(value).replace(/^@+/,"").replace(/\s+/g,"");
  }
  function normalizeChatId(value){
    var rules = window.BDLRulesPersona;
    if(rules && typeof rules.normalizeTelegramChatId === "function"){ return rules.normalizeTelegramChatId(value); }
    return text(value).replace(/\s+/g,"");
  }
  function first(row,names){
    row = row || {};
    for(var i=0;i<names.length;i+=1){ if(text(row[names[i]])){ return row[names[i]]; } }
    return "";
  }
  function telegram(row){
    row = row || {};
    return {
      telegramUser:normalizeUser(first(row,["telegramUser","_telegramUser","telegramUsername","usuarioTelegram","telegram","Telegram"])),
      telegramChatId:normalizeChatId(first(row,["telegramChatId","_telegramChatId","chatIdTelegram","telegramChatID","chatId"])),
      telegramUpdatedAt:text(first(row,["telegramUpdatedAt","telegramActualizadoEn"])),
      telegramSource:text(first(row,["telegramSource","origenTelegram"])),
      telegramCheckedAt:text(first(row,["telegramCheckedAt","telegramRevisadoEn"])),
      telegramVerifiedAt:text(first(row,["telegramVerifiedAt","telegramVerificadoEn"]))
    };
  }
  function stores(){
    var s = window.BL2Config && window.BL2Config.stores || {};
    return {
      estudiantes:s.estudiantes || "estudiantes",
      requisitos:s.requisitos || "requisitos",
      contactos:s.contactos || "contactos",
      notas:s.notas || "notas",
      periodos:s.periodos || "periodos",
      personas:s.personas || "personas",
      matriculas:s.matriculasPeriodo || "matriculas_periodo",
      requisitosV2:s.requisitosEstudiante || "requisitos_estudiante",
      contactosV2:s.contactosEstudiante || "contactos_estudiante",
      notasV2:s.notasTitulacion || "notas_titulacion",
      divisiones:s.divisionesEstudiante || "divisiones_estudiante",
      periodosCarreras:s.periodosCarreras || "periodos_carreras",
      periodosDivisiones:s.periodosDivisiones || "periodos_divisiones"
    };
  }
  function studentId(row){
    row = row || {};
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || row.NumeroIdentificacion || "");
    var periodoId = text(row.periodoId || row.periodId || row.ultimoPeriodoId || "");
    return text(row.id || row.studentId || row.idEstudiantePeriodo || (cedula && periodoId ? cedula + "__" + periodoId : ""));
  }
  function mergeNonEmpty(existing,incoming){
    existing = existing || {};
    incoming = incoming || {};
    var merged = Object.assign({},existing);
    Object.keys(incoming).forEach(function(key){
      var value = incoming[key];
      if(value === undefined || value === null || text(value) === ""){
        if(merged[key] === undefined){ merged[key] = value; }
        return;
      }
      merged[key] = clone(value);
    });
    merged.createdAt = existing.createdAt || incoming.createdAt || nowISO();
    merged.updatedAt = text(incoming.updatedAt || existing.updatedAt) || nowISO();
    return merged;
  }
  function mergedBulkPut(storeName,rows,originalBulkPut){
    rows = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if(!rows.length){ return Promise.resolve([]); }
    var current = window.BL2DB;
    if(!current || typeof current.get !== "function"){ return originalBulkPut(storeName,rows); }
    return Promise.all(rows.map(function(row){
      var key = row.id !== undefined ? row.id : (row.cedula !== undefined ? row.cedula : row.idEstudiantePeriodo);
      if(!text(key)){ return row; }
      return current.get(storeName,key).catch(function(){ return null; }).then(function(existing){ return mergeNonEmpty(existing,row); });
    })).then(function(merged){ return originalBulkPut(storeName,merged); });
  }
  function personaFromStudent(row){
    row = row || {};
    var personaRule = window.BDLRulesPersona;
    var persona = personaRule && typeof personaRule.buildPersona === "function" ? personaRule.buildPersona(row) : null;
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || row.NumeroIdentificacion || "");
    if(!cedula){ return null; }
    var tg = telegram(row);
    return Object.assign({
      cedula:cedula,
      numeroIdentificacion:cedula,
      nombreCompleto:text(row.Nombres || row.nombres || row.Nombre || row.nombre || ""),
      nombres:text(row.Nombres || row.nombres || row.Nombre || row.nombre || ""),
      correoPersonal:text(row.CorreoPersonal || row.correoPersonal || ""),
      correoInstitucional:text(row.CorreoInstitucional || row.correoInstitucional || ""),
      celular:text(row.Celular || row.celular || ""),
      source:"v2_mirror",
      updatedAt:text(row.updatedAt || "") || nowISO()
    },persona || {},tg,{
      cedula:cedula,
      numeroIdentificacion:cedula,
      _telegramUser:tg.telegramUser,
      _telegramChatId:tg.telegramChatId
    });
  }
  function matriculaFromStudent(row){
    row = row || {};
    var id = studentId(row);
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || row.NumeroIdentificacion || "");
    var periodoId = text(row.periodoId || row.periodId || row.ultimoPeriodoId || "");
    if(!id || !cedula || !periodoId){ return null; }
    return {
      idEstudiantePeriodo:id,
      cedula:cedula,
      periodoId:periodoId,
      periodoLabel:text(row.periodoLabel || row.Periodo || row.periodo || periodoId),
      carrera:text(row.NombreCarrera || row.nombreCarrera || row.Carrera || row.carrera || ""),
      codigoCarrera:text(row.CodigoCarrera || row.codigoCarrera || ""),
      division:text(row.division || row._division || ""),
      estadoMatricula:text(row.estadoMatricula || "ACTIVO").toUpperCase() === "RETIRADO" ? "RETIRADO" : "ACTIVO",
      sede:text(row.Sede || row.sede || ""),
      horarioComplexivo:text(row.HorarioComplexivo || row.horarioComplexivo || ""),
      source:"v2_mirror",
      updatedAt:text(row.updatedAt || "") || nowISO()
    };
  }
  function contactFromStudent(row){
    row = row || {};
    var id = studentId(row);
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || "");
    var periodoId = text(row.periodoId || row.periodId || row.ultimoPeriodoId || "");
    if(!id || !cedula || !periodoId){ return null; }
    var tg = telegram(row);
    return Object.assign({
      id:id,
      idEstudiantePeriodo:id,
      studentId:id,
      cedula:cedula,
      periodoId:periodoId,
      periodoLabel:text(row.periodoLabel || periodoId),
      CorreoPersonal:text(row.CorreoPersonal || row.correoPersonal || ""),
      CorreoInstitucional:text(row.CorreoInstitucional || row.correoInstitucional || ""),
      Celular:text(row.Celular || row.celular || ""),
      correoPersonal:text(row.CorreoPersonal || row.correoPersonal || ""),
      correoInstitucional:text(row.CorreoInstitucional || row.correoInstitucional || ""),
      celular:text(row.Celular || row.celular || ""),
      source:"v2_mirror",
      updatedAt:text(row.updatedAt || "") || nowISO()
    },tg,{
      _telegramUser:tg.telegramUser,
      _telegramChatId:tg.telegramChatId
    });
  }
  function divisionFromStudent(row){
    var id = studentId(row);
    var division = text(row && (row.division || row._division || ""));
    if(!id || !division){ return null; }
    return { id:id + "__" + division.toLowerCase().replace(/[^a-z0-9]+/g,"_"),idEstudiantePeriodo:id,cedula:normalizeCedula(row.cedula || row.numeroIdentificacion || ""),periodoId:text(row.periodoId || row.periodId || ""),division:division,source:"v2_mirror",updatedAt:text(row.updatedAt || "") || nowISO() };
  }
  function requisitoV2(row){
    row = row || {};
    var cedula = normalizeCedula(row.cedula || "");
    var periodoId = text(row.periodoId || "");
    var key = text(row.key || row.nombre || row.requisitoKey || "");
    var idEP = text(row.studentId || row.idEstudiantePeriodo || (cedula && periodoId ? cedula + "__" + periodoId : ""));
    if(!cedula || !periodoId || !key){ return null; }
    return Object.assign({},row,{ id:row.id || (idEP + "__" + key.toLowerCase().replace(/[^a-z0-9]+/g,"_")),idEstudiantePeriodo:idEP,cedula:cedula,periodoId:periodoId,requisitoKey:key,estado:text(row.estado || row.valor || row.value || ""),source:"v2_mirror",updatedAt:text(row.updatedAt || "") || nowISO() });
  }
  function contactoV2(row){
    row = row || {};
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || "");
    var periodoId = text(row.periodoId || row.periodId || "");
    var idEP = text(row.studentId || row.idEstudiantePeriodo || row.id || (cedula && periodoId ? cedula + "__" + periodoId : ""));
    if(!cedula || !periodoId || !idEP){ return null; }
    var tg = telegram(row);
    return Object.assign({},row,{
      id:idEP,idEstudiantePeriodo:idEP,studentId:idEP,cedula:cedula,periodoId:periodoId,
      correoPersonal:text(row.correoPersonal || row.CorreoPersonal || ""),
      correoInstitucional:text(row.correoInstitucional || row.CorreoInstitucional || ""),
      celular:text(row.celular || row.Celular || row.telefono || ""),
      telegramUser:tg.telegramUser,telegramChatId:tg.telegramChatId,
      telegramUpdatedAt:tg.telegramUpdatedAt,telegramSource:tg.telegramSource,
      telegramCheckedAt:tg.telegramCheckedAt,telegramVerifiedAt:tg.telegramVerifiedAt,
      _telegramUser:tg.telegramUser,_telegramChatId:tg.telegramChatId,
      source:"v2_mirror",updatedAt:text(row.updatedAt || "") || nowISO()
    });
  }
  function notaV2(row){
    row = row || {};
    var cedula = normalizeCedula(row.cedula || "");
    var periodoId = text(row.periodoId || "");
    var idEP = text(row.idEstudiantePeriodo || row.studentId || row.id || (cedula && periodoId ? cedula + "__" + periodoId : ""));
    if(!idEP || !cedula || !periodoId){ return null; }
    return Object.assign({},row,{ idEstudiantePeriodo:idEP,cedula:cedula,periodoId:periodoId,source:"v2_mirror",updatedAt:text(row.updatedAt || "") || nowISO() });
  }
  function periodRows(period){
    period = period || {};
    var periodoId = text(period.id || period.periodoId || "");
    var out = [];
    if(!periodoId){ return out; }
    (Array.isArray(period.carrerasDetectadas) ? period.carrerasDetectadas : []).forEach(function(carrera){ var label=text(carrera.nombre || carrera.label || carrera.carrera || carrera);if(label){out.push({type:"career",id:periodoId+"__"+label.toLowerCase().replace(/[^a-z0-9]+/g,"_"),periodoId:periodoId,carrera:label,updatedAt:nowISO(),source:"v2_mirror"});} });
    (Array.isArray(period.divisiones) ? period.divisiones : []).forEach(function(division){ division=text(division);if(division){out.push({type:"division",id:periodoId+"__"+division.toLowerCase().replace(/[^a-z0-9]+/g,"_"),periodoId:periodoId,division:division,updatedAt:nowISO(),source:"v2_mirror"});} });
    return out;
  }
  function mirrorRows(storeName,rows,originalPut,originalBulkPut){
    var s = stores();
    rows = Array.isArray(rows) ? rows : [];
    if(!rows.length){ return Promise.resolve({ mirrored:0 }); }
    var tasks = [];
    if(storeName === s.estudiantes){
      var personas=rows.map(personaFromStudent).filter(Boolean);
      var matriculas=rows.map(matriculaFromStudent).filter(Boolean);
      var contactos=rows.map(contactFromStudent).filter(Boolean);
      var divisiones=rows.map(divisionFromStudent).filter(Boolean);
      if(personas.length){tasks.push(mergedBulkPut(s.personas,personas,originalBulkPut));}
      if(matriculas.length){tasks.push(mergedBulkPut(s.matriculas,matriculas,originalBulkPut));}
      if(contactos.length){tasks.push(mergedBulkPut(s.contactosV2,contactos,originalBulkPut));}
      if(divisiones.length){tasks.push(mergedBulkPut(s.divisiones,divisiones,originalBulkPut));}
    }
    if(storeName === s.requisitos){var requisitos=rows.map(requisitoV2).filter(Boolean);if(requisitos.length){tasks.push(mergedBulkPut(s.requisitosV2,requisitos,originalBulkPut));}}
    if(storeName === s.contactos){var contacts=rows.map(contactoV2).filter(Boolean);if(contacts.length){tasks.push(mergedBulkPut(s.contactosV2,contacts,originalBulkPut));}}
    if(storeName === s.notas){var notas=rows.map(notaV2).filter(Boolean);if(notas.length){tasks.push(mergedBulkPut(s.notasV2,notas,originalBulkPut));}}
    if(storeName === s.periodos){rows.forEach(function(p){periodRows(p).forEach(function(item){tasks.push(originalPut(item.type === "career" ? s.periodosCarreras : s.periodosDivisiones,item));});});}
    return tasks.length ? Promise.all(tasks).then(function(){return {mirrored:tasks.length};}) : Promise.resolve({mirrored:0});
  }
  function install(){
    var db = window.BL2DB || null;
    if(!db || typeof db.put !== "function" || typeof db.bulkPut !== "function"){ return false; }
    if(db.__v2MirrorInstalled){ return true; }
    var originalPut = db.put.bind(db);
    var originalBulkPut = db.bulkPut.bind(db);
    db.put = function(storeName,value){
      return originalPut(storeName,value).then(function(saved){
        return mirrorRows(storeName,[saved || value],originalPut,originalBulkPut).catch(function(error){try{console.warn("[BDLV2Mirror] No se pudo espejar a V2",error);}catch(inner){}}).then(function(){return saved;});
      });
    };
    db.bulkPut = function(storeName,rows){
      rows = Array.isArray(rows) ? rows : [];
      return originalBulkPut(storeName,rows).then(function(saved){
        return mirrorRows(storeName,saved && saved.length ? saved : rows,originalPut,originalBulkPut).catch(function(error){try{console.warn("[BDLV2Mirror] No se pudo espejar lote",error);}catch(inner){}}).then(function(){return saved;});
      });
    };
    db.__v2MirrorInstalled = true;
    db.v2MirrorVersion = VERSION;
    try{window.dispatchEvent(new CustomEvent("bdlocal:v2-mirror-ready",{detail:{version:VERSION,at:nowISO(),telegramSafe:true}}));}catch(error){}
    return true;
  }

  window.BDLV2Mirror = { version:VERSION,install:install,mirrorRows:mirrorRows,mergeNonEmpty:mergeNonEmpty,personaFromStudent:personaFromStudent,contactFromStudent:contactFromStudent };
  install();
})(window);
