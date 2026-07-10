/* =========================================================
Nombre completo: bdl.rules.requisitos.js
Ruta o ubicación: /BDLocal/rules/bdl.rules.requisitos.js
Función o funciones:
- Detectar requisitos desde campos con valores CUMPLE, NO CUMPLE o PENDIENTE.
- Convertir cada requisito en registro independiente.
- Usar idEstudiantePeriodo = cedula__periodoId.
- Usar la regla central de identificación validada.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.1.0-canonical-local-id";
  var Rules = window.BDLRules;
  var Config = window.BL2Config || {};
  var utils = Config.utils || {};

  if(!Rules){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }

  function normalizeKey(value){
    if(typeof utils.normalizeKey === "function"){ return utils.normalizeKey(value); }
    return text(value).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  }

  function normalizeCedula(value){
    var persona = window.BDLRulesPersona;
    if(persona && typeof persona.normalizeCedula === "function"){ return persona.normalizeCedula(value); }
    return typeof utils.normalizeCedula === "function" ? utils.normalizeCedula(value) : text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
  }

  function canonicalPeriodId(value){
    value = text(value);
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match ? match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4] : value.replace(/_+/g,"__");
  }

  function normalizeEstado(value){
    var raw = text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
    if(raw === "CUMPLE"){ return "CUMPLE"; }
    if(raw === "NO CUMPLE" || raw === "NOCUMPLE"){ return "NO CUMPLE"; }
    if(raw === "PENDIENTE"){ return "PENDIENTE"; }
    return "";
  }

  function isRequirement(field,value){
    if(typeof utils.isRequirementField === "function"){ return utils.isRequirementField(field,value); }
    return !!normalizeEstado(value);
  }

  function studentId(periodoId,cedula){
    periodoId = canonicalPeriodId(periodoId);
    cedula = normalizeCedula(cedula);
    return periodoId && cedula ? cedula + "__" + periodoId : "";
  }

  function makeId(periodoId,cedula,requisitoKey){
    var base = studentId(periodoId,cedula);
    requisitoKey = normalizeKey(requisitoKey);
    return base && requisitoKey ? base + "__" + requisitoKey : "";
  }

  function extract(row,context){
    row = row || {};
    context = context || {};

    var periodoId = canonicalPeriodId(row.periodoId || row.periodId || context.periodoId || context.periodId || "");
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || context.cedula || "");
    var idEstudiantePeriodo = studentId(periodoId,cedula);
    var list = [];

    Object.keys(row).forEach(function(field){
      if(field.charAt(0) === "_"){ return; }
      var estado = normalizeEstado(row[field]);
      if(!estado && !isRequirement(field,row[field])){ return; }
      if(!estado){ return; }

      var requisitoKey = normalizeKey(field);
      list.push({
        id:makeId(periodoId,cedula,requisitoKey),
        idEstudiantePeriodo:idEstudiantePeriodo,
        studentId:idEstudiantePeriodo,
        periodoId:periodoId,
        cedula:cedula,
        numeroIdentificacion:cedula,
        requisitoKey:requisitoKey,
        requisitoLabel:text(field),
        estado:estado,
        valor:estado,
        valorOriginal:row[field],
        origen:text(row.origen || context.origen || "excel"),
        updatedAt:text(row.updatedAt || "") || new Date().toISOString()
      });
    });

    return list;
  }

  function apply(payload,context){
    if(Array.isArray(payload)){
      return payload.map(function(row){
        var copy = Object.assign({},row || {});
        copy._bdlRequisitos = extract(copy,context || {});
        return copy;
      });
    }
    var copy = Object.assign({},payload || {});
    copy._bdlRequisitos = extract(copy,context || {});
    return copy;
  }

  Rules.register("requisitos.extract",apply);

  window.BDLRulesRequisitos = {
    version:VERSION,
    normalizeKey:normalizeKey,
    normalizeEstado:normalizeEstado,
    isRequirement:isRequirement,
    studentId:studentId,
    makeId:makeId,
    extract:extract,
    apply:apply
  };
})(window);
