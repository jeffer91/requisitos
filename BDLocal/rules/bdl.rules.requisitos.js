/* =========================================================
Archivo: bdl.rules.requisitos.js
Ruta: /BDLocal/rules/bdl.rules.requisitos.js
Función:
- Detectar requisitos desde campos con valores CUMPLE, NO CUMPLE o PENDIENTE.
- Convertir cada requisito en registro independiente.
- Preparar la futura tabla requisitos_estudiante.
Con qué se conecta:
- BDLocal/rules/bdl.rules.index.js
- BDLocal/bl2.config.js
========================================================= */
(function(window){
  "use strict";

  var Rules = window.BDLRules;
  var Config = window.BL2Config || {};
  var utils = Config.utils || {};

  if(!Rules){ return; }

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function normalizeKey(value){
    if(typeof utils.normalizeKey === "function"){
      return utils.normalizeKey(value);
    }
    return text(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function normalizeEstado(value){
    var raw = text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    if(raw === "CUMPLE"){ return "CUMPLE"; }
    if(raw === "NO CUMPLE" || raw === "NOCUMPLE"){ return "NO CUMPLE"; }
    if(raw === "PENDIENTE"){ return "PENDIENTE"; }
    return "";
  }

  function isRequirement(field, value){
    if(typeof utils.isRequirementField === "function"){
      return utils.isRequirementField(field, value);
    }
    return !!normalizeEstado(value);
  }

  function makeId(periodoId, cedula, requisitoKey){
    periodoId = text(periodoId);
    cedula = text(cedula);
    requisitoKey = normalizeKey(requisitoKey);
    return periodoId && cedula && requisitoKey ? periodoId + "__" + cedula + "__" + requisitoKey : "";
  }

  function extract(row, context){
    row = row || {};
    context = context || {};

    var periodoId = text(row.periodoId || context.periodoId || "");
    var cedula = text(row.cedula || "");
    var idEstudiantePeriodo = text(row.idEstudiantePeriodo || (periodoId && cedula ? periodoId + "__" + cedula : ""));
    var list = [];

    Object.keys(row).forEach(function(field){
      if(field.charAt(0) === "_"){ return; }
      var estado = normalizeEstado(row[field]);
      if(!estado && !isRequirement(field, row[field])){ return; }
      if(!estado){ return; }

      var requisitoKey = normalizeKey(field);
      list.push({
        id: makeId(periodoId, cedula, requisitoKey),
        idEstudiantePeriodo: idEstudiantePeriodo,
        periodoId: periodoId,
        cedula: cedula,
        requisitoKey: requisitoKey,
        requisitoLabel: text(field),
        estado: estado,
        valorOriginal: row[field],
        origen: text(row.origen || context.origen || "excel"),
        updatedAt: text(row.updatedAt || "") || new Date().toISOString()
      });
    });

    return list;
  }

  function apply(payload, context){
    if(Array.isArray(payload)){
      return payload.map(function(row){
        var copy = Object.assign({}, row || {});
        copy._bdlRequisitos = extract(copy, context || {});
        return copy;
      });
    }

    var copy = Object.assign({}, payload || {});
    copy._bdlRequisitos = extract(copy, context || {});
    return copy;
  }

  Rules.register("requisitos.extract", apply);

  window.BDLRulesRequisitos = {
    normalizeKey: normalizeKey,
    normalizeEstado: normalizeEstado,
    isRequirement: isRequirement,
    makeId: makeId,
    extract: extract,
    apply: apply
  };
})(window);
