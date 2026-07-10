/* =========================================================
Archivo: bdl.rules.retirados.js
Ruta: /BDLocal/rules/bdl.rules.retirados.js
Función:
- Detectar estudiantes que ya no aparecen en una nueva carga del mismo período.
- Marcar RETIRADO sin borrar datos.
- Reactivar como ACTIVO si vuelve a aparecer en el mismo período.
Con qué se conecta:
- BDLocal/rules/bdl.rules.index.js
- BDLocal/bl2.config.js
========================================================= */
(function(window){
  "use strict";

  var Rules = window.BDLRules;
  var Config = window.BL2Config || {};
  var status = Config.status || { active: "ACTIVO", retired: "RETIRADO" };

  if(!Rules){ return; }

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function keyOf(row){
    row = row || {};
    return text(row.periodoId) + "__" + text(row.cedula);
  }

  function mapKeys(rows){
    var map = Object.create(null);
    (Array.isArray(rows) ? rows : []).forEach(function(row){
      var key = keyOf(row);
      if(key && key !== "__"){ map[key] = row; }
    });
    return map;
  }

  function markRetired(existingRows, incomingRows, context){
    existingRows = Array.isArray(existingRows) ? existingRows : [];
    incomingRows = Array.isArray(incomingRows) ? incomingRows : [];
    context = context || {};

    var incoming = mapKeys(incomingRows);
    var periodoId = text(context.periodoId || "");
    var now = new Date().toISOString();
    var retired = [];

    existingRows.forEach(function(row){
      row = row || {};
      if(periodoId && text(row.periodoId) !== periodoId){ return; }
      if(!text(row.cedula)){ return; }
      if(incoming[keyOf(row)]){ return; }
      if(text(row.estadoMatricula).toUpperCase() === (status.retired || "RETIRADO")){ return; }

      var copy = Object.assign({}, row);
      copy.estadoMatricula = status.retired || "RETIRADO";
      copy.retirado = true;
      copy.retiradoEn = now;
      copy.updatedAt = now;
      retired.push(copy);
    });

    return retired;
  }

  function reactivate(incomingRows){
    var now = new Date().toISOString();
    return (Array.isArray(incomingRows) ? incomingRows : []).map(function(row){
      var copy = Object.assign({}, row || {});
      if(text(copy.estadoMatricula).toUpperCase() === (status.retired || "RETIRADO")){
        copy.estadoMatricula = status.active || "ACTIVO";
        copy.retirado = false;
        copy.reactivadoEn = now;
        copy.updatedAt = now;
      }
      return copy;
    });
  }

  function apply(payload, context){
    payload = payload || {};
    if(Array.isArray(payload)){
      return reactivate(payload);
    }

    return {
      retired: markRetired(payload.existingRows || [], payload.incomingRows || [], context || payload.context || {}),
      incomingRows: reactivate(payload.incomingRows || [])
    };
  }

  Rules.register("retirados.detect", apply);

  window.BDLRulesRetirados = {
    keyOf: keyOf,
    markRetired: markRetired,
    reactivate: reactivate,
    apply: apply
  };
})(window);
