/* =========================================================
Nombre completo: bdl.rules.persona.js
Ruta o ubicación: /BDLocal/rules/bdl.rules.persona.js
Función o funciones:
- Normalizar identidad y datos permanentes de la persona.
- Separar persona de matrícula y período académico.
- Conservar identificaciones extranjeras sin cambiar su longitud.
- Completar el cero solo para cédulas ecuatorianas verificadas.
- Normalizar telegramUser y telegramChatId sin perder campos parciales.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.2.0-identity-safe";
  var Rules = window.BDLRules;
  var Config = window.BL2Config || {};
  var utils = Config.utils || {};
  var fields = Config.fields || {};

  if(!Rules){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }

  function pick(row,names){
    row = row || {};
    names = Array.isArray(names) ? names : [];
    for(var i=0;i<names.length;i+=1){
      if(text(row[names[i]])){ return row[names[i]]; }
    }
    return "";
  }

  function cleanIdentification(value){
    if(typeof utils.cleanIdentification === "function"){ return utils.cleanIdentification(value); }
    return text(value).replace(/[^\dA-Za-z]/g,"").toUpperCase();
  }

  function isValidEcuadorianCedula(value){
    if(typeof utils.isValidEcuadorianCedula === "function"){ return utils.isValidEcuadorianCedula(value); }
    var raw = cleanIdentification(value);
    if(!/^\d{10}$/.test(raw)){ return false; }
    var province = Number(raw.slice(0,2));
    var third = Number(raw.charAt(2));
    if(province < 1 || province > 24 || third > 5){ return false; }
    var coefficients = [2,1,2,1,2,1,2,1,2];
    var sum = 0;
    for(var i=0;i<9;i+=1){
      var product = Number(raw.charAt(i)) * coefficients[i];
      sum += product >= 10 ? product - 9 : product;
    }
    return ((10 - (sum % 10)) % 10) === Number(raw.charAt(9));
  }

  function analyzeIdentification(value){
    if(typeof utils.analyzeIdentification === "function"){ return utils.analyzeIdentification(value); }
    var raw = cleanIdentification(value);
    var result = { original:text(value),raw:raw,canonical:raw,changed:false,type:raw ? "OTHER_IDENTIFICATION" : "EMPTY",validEcuadorian:false,missingLeadingZero:false,safeAutoCorrection:false };
    if(/^\d{10}$/.test(raw) && isValidEcuadorianCedula(raw)){
      result.type="ECUADORIAN_CEDULA";result.validEcuadorian=true;result.safeAutoCorrection=true;return result;
    }
    if(/^\d{9}$/.test(raw) && isValidEcuadorianCedula("0"+raw)){
      result.canonical="0"+raw;result.changed=true;result.type="ECUADORIAN_CEDULA_MISSING_ZERO";result.validEcuadorian=true;result.missingLeadingZero=true;result.safeAutoCorrection=true;
    }
    return result;
  }

  function normalizeCedula(value){
    if(typeof utils.normalizeCedula === "function"){ return utils.normalizeCedula(value); }
    return analyzeIdentification(value).canonical;
  }

  function normalizeName(value){ return text(value).replace(/\s+/g," ").toUpperCase(); }
  function normalizeEmail(value){ return text(value).toLowerCase(); }

  function normalizeTelegramUser(value){
    return text(value)
      .replace(/^https?:\/\/(?:www\.)?t\.me\//i,"")
      .replace(/^tg:\/\/resolve\?domain=/i,"")
      .replace(/^@+/,"")
      .split(/[/?#]/)[0]
      .replace(/\s+/g,"");
  }

  function normalizeTelegramChatId(value){
    var chatId = text(value).replace(/\s+/g,"");
    if(!chatId){ return ""; }
    return /^-?\d+$/.test(chatId) ? chatId : text(value);
  }

  function telegramFrom(row){
    row = row || {};
    var user = normalizeTelegramUser(pick(row,[
      "telegramUser","_telegramUser","telegramUsername","usuarioTelegram",
      "TelegramUser","TelegramUsuario","telegram","Telegram"
    ]));
    var chatId = normalizeTelegramChatId(pick(row,[
      "telegramChatId","_telegramChatId","chatIdTelegram","telegramChatID",
      "TelegramChatId","chatId"
    ]));
    var updatedAt = text(pick(row,["telegramUpdatedAt","telegramActualizadoEn","updatedTelegramAt"]));
    var source = text(pick(row,["telegramSource","origenTelegram","telegramOrigen"]));
    var checkedAt = text(pick(row,["telegramCheckedAt","telegramRevisadoEn"]));
    var verifiedAt = text(pick(row,["telegramVerifiedAt","telegramVerificadoEn"]));

    return {
      telegramUser:user,
      telegramChatId:chatId,
      telegramUpdatedAt:updatedAt,
      telegramSource:source,
      telegramCheckedAt:checkedAt,
      telegramVerifiedAt:verifiedAt,
      telegramAvailable:!!(user || chatId)
    };
  }

  function buildPersona(row){
    row = row || {};
    var cedula = normalizeCedula(pick(row,fields.id || ["cedula"]));
    var nombreCompleto = normalizeName(pick(row,fields.names || ["nombres","Nombres","nombre"]));
    var correo = normalizeEmail(pick(row,fields.email || ["correo","email"]));
    var celular = text(pick(row,fields.phone || ["celular","telefono"])).replace(/\s+/g,"");
    var telegram = telegramFrom(row);

    var persona = Object.assign({
      cedula:cedula,
      numeroIdentificacion:cedula,
      nombres:nombreCompleto,
      nombreCompleto:nombreCompleto,
      correoInstitucional:normalizeEmail(row.CorreoInstitucional || row.correoInstitucional || ""),
      correoPersonal:normalizeEmail(row.CorreoPersonal || row.correoPersonal || correo || ""),
      celular:celular,
      updatedAt:text(row.updatedAt || "") || new Date().toISOString()
    },telegram);

    persona._telegramUser = persona.telegramUser;
    persona._telegramChatId = persona.telegramChatId;
    persona._bdlPersonaValid = !!persona.cedula;
    persona._bdlPersonaError = persona.cedula ? "" : "La persona no tiene cédula o identificación válida.";
    return persona;
  }

  function apply(payload){
    if(Array.isArray(payload)){
      return payload.map(function(row){
        var copy = Object.assign({},row || {});
        copy._bdlPersona = buildPersona(copy);
        copy.cedula = copy._bdlPersona.cedula;
        if(copy._bdlPersona.nombreCompleto){ copy.nombres = copy._bdlPersona.nombreCompleto; }
        return copy;
      });
    }

    var copy = Object.assign({},payload || {});
    copy._bdlPersona = buildPersona(copy);
    copy.cedula = copy._bdlPersona.cedula;
    if(copy._bdlPersona.nombreCompleto){ copy.nombres = copy._bdlPersona.nombreCompleto; }
    return copy;
  }

  Rules.register("persona.normalize",apply);

  window.BDLRulesPersona = {
    version:VERSION,
    pick:pick,
    cleanIdentification:cleanIdentification,
    isValidEcuadorianCedula:isValidEcuadorianCedula,
    analyzeIdentification:analyzeIdentification,
    normalizeCedula:normalizeCedula,
    normalizeName:normalizeName,
    normalizeTelegramUser:normalizeTelegramUser,
    normalizeTelegramChatId:normalizeTelegramChatId,
    telegramFrom:telegramFrom,
    buildPersona:buildPersona,
    apply:apply
  };
})(window);
