/* =========================================================
Nombre completo: bdl.rules.persona.js
Ruta o ubicación: /BDLocal/rules/bdl.rules.persona.js
Función o funciones:
- Normalizar identidad y datos permanentes de la persona.
- Separar persona de matrícula y período académico.
- Normalizar telegramUser y telegramChatId sin perder campos parciales.
- Conservar metadatos de origen, revisión y verificación de Telegram.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.1.0-telegram-persona";
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

  function normalizeCedula(value){
    if(typeof utils.normalizeCedula === "function"){ return utils.normalizeCedula(value); }
    var raw = text(value).replace(/[^\dA-Za-z]/g,"");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function normalizeName(value){ return text(value).replace(/\s+/g," ").toUpperCase(); }
  function normalizeEmail(value){ return text(value).toLowerCase(); }

  function normalizeTelegramUser(value){
    var user = text(value)
      .replace(/^https?:\/\/(?:www\.)?t\.me\//i,"")
      .replace(/^tg:\/\/resolve\?domain=/i,"")
      .replace(/^@+/,"")
      .split(/[/?#]/)[0]
      .replace(/\s+/g,"");
    return user;
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
    normalizeCedula:normalizeCedula,
    normalizeName:normalizeName,
    normalizeTelegramUser:normalizeTelegramUser,
    normalizeTelegramChatId:normalizeTelegramChatId,
    telegramFrom:telegramFrom,
    buildPersona:buildPersona,
    apply:apply
  };
})(window);
