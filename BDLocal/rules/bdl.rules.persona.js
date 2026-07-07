/* =========================================================
Archivo: bdl.rules.persona.js
Ruta: /BDLocal/rules/bdl.rules.persona.js
Función:
- Normalizar identidad de persona.
- Separar datos propios de la persona de datos de matrícula/período.
- Preparar la futura tabla personas sin romper la tabla estudiantes actual.
Con qué se conecta:
- BDLocal/rules/bdl.rules.index.js
- BDLocal/bl2.config.js
========================================================= */
(function(window){
  "use strict";

  var Rules = window.BDLRules;
  var Config = window.BL2Config || {};
  var utils = Config.utils || {};
  var fields = Config.fields || {};

  if(!Rules){ return; }

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function pick(row, names){
    row = row || {};
    names = Array.isArray(names) ? names : [];
    for(var i = 0; i < names.length; i++){
      if(text(row[names[i]])){ return row[names[i]]; }
    }
    return "";
  }

  function normalizeCedula(value){
    if(typeof utils.normalizeCedula === "function"){
      return utils.normalizeCedula(value);
    }
    return text(value).replace(/[^\dA-Za-z]/g, "");
  }

  function normalizeName(value){
    return text(value).replace(/\s+/g, " ").toUpperCase();
  }

  function normalizeEmail(value){
    return text(value).toLowerCase();
  }

  function buildPersona(row){
    row = row || {};

    var cedula = normalizeCedula(pick(row, fields.id || ["cedula"]));
    var nombreCompleto = normalizeName(pick(row, fields.names || ["nombres", "Nombres", "nombre"]));
    var correo = normalizeEmail(pick(row, fields.email || ["correo", "email"]));
    var celular = text(pick(row, fields.phone || ["celular", "telefono"])).replace(/\s+/g, "");

    var persona = {
      cedula: cedula,
      nombres: nombreCompleto,
      nombreCompleto: nombreCompleto,
      correoInstitucional: normalizeEmail(row.CorreoInstitucional || row.correoInstitucional || ""),
      correoPersonal: normalizeEmail(row.CorreoPersonal || row.correoPersonal || correo || ""),
      celular: celular,
      telegramUser: text(row.telegramUser || row._telegramUser || ""),
      telegramChatId: text(row.telegramChatId || row._telegramChatId || ""),
      updatedAt: text(row.updatedAt || "") || new Date().toISOString()
    };

    persona._bdlPersonaValid = !!persona.cedula;
    persona._bdlPersonaError = persona.cedula ? "" : "La persona no tiene cédula o identificación válida.";

    return persona;
  }

  function apply(payload){
    if(Array.isArray(payload)){
      return payload.map(function(row){
        var copy = Object.assign({}, row || {});
        copy._bdlPersona = buildPersona(copy);
        copy.cedula = copy._bdlPersona.cedula;
        if(copy._bdlPersona.nombreCompleto){ copy.nombres = copy._bdlPersona.nombreCompleto; }
        return copy;
      });
    }

    var copy = Object.assign({}, payload || {});
    copy._bdlPersona = buildPersona(copy);
    copy.cedula = copy._bdlPersona.cedula;
    if(copy._bdlPersona.nombreCompleto){ copy.nombres = copy._bdlPersona.nombreCompleto; }
    return copy;
  }

  Rules.register("persona.normalize", apply);

  window.BDLRulesPersona = {
    pick: pick,
    normalizeCedula: normalizeCedula,
    normalizeName: normalizeName,
    buildPersona: buildPersona,
    apply: apply
  };
})(window);
