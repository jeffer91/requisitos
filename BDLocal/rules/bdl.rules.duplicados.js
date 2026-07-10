/* =========================================================
Archivo: bdl.rules.duplicados.js
Ruta: /BDLocal/rules/bdl.rules.duplicados.js
Función:
- Detectar duplicados por periodoId + cedula.
- Fusionar filas repetidas sin perder campos manuales protegidos.
- Preparar reportes de duplicados para diagnóstico e importaciones.
Con qué se conecta:
- BDLocal/rules/bdl.rules.index.js
- BDLocal/bl2.config.js
========================================================= */
(function(window){
  "use strict";

  var Rules = window.BDLRules;
  var Config = window.BL2Config || {};
  var protectedFields = (Config.fields && Config.fields.protectedManual) || [];

  if(!Rules){ return; }

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function keyOf(row){
    row = row || {};
    return text(row.periodoId) + "__" + text(row.cedula);
  }

  function isProtected(field){
    return protectedFields.indexOf(field) >= 0 || field.charAt(0) === "_";
  }

  function isFilled(value){
    return value !== null && value !== undefined && text(value) !== "";
  }

  function mergeOne(base, incoming){
    base = Object.assign({}, base || {});
    incoming = incoming || {};

    Object.keys(incoming).forEach(function(field){
      var current = base[field];
      var next = incoming[field];

      if(isProtected(field) && isFilled(current)){ return; }
      if(!isFilled(current) && isFilled(next)){ base[field] = next; return; }
      if(isFilled(next) && text(next).length > text(current).length && !isProtected(field)){
        base[field] = next;
      }
    });

    base.updatedAt = text(base.updatedAt || incoming.updatedAt || "") || new Date().toISOString();
    return base;
  }

  function mergeRows(rows){
    rows = Array.isArray(rows) ? rows : [];

    var map = Object.create(null);
    var order = [];
    var duplicated = [];

    rows.forEach(function(row, index){
      row = row || {};
      var key = keyOf(row);

      if(!key || key === "__"){
        order.push("__row_" + index);
        map["__row_" + index] = row;
        return;
      }

      if(!map[key]){
        map[key] = Object.assign({}, row);
        order.push(key);
        return;
      }

      duplicated.push({ key: key, index: index, cedula: row.cedula, periodoId: row.periodoId });
      map[key] = mergeOne(map[key], row);
    });

    return {
      rows: order.map(function(key){ return map[key]; }),
      duplicated: duplicated,
      totalDuplicated: duplicated.length
    };
  }

  function apply(payload){
    if(Array.isArray(payload)){
      return mergeRows(payload);
    }
    return payload || {};
  }

  Rules.register("duplicados.merge", apply);

  window.BDLRulesDuplicados = {
    keyOf: keyOf,
    isProtected: isProtected,
    mergeOne: mergeOne,
    mergeRows: mergeRows,
    apply: apply
  };
})(window);
