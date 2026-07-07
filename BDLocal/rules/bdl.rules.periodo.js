/* =========================================================
Archivo: bdl.rules.periodo.js
Ruta: /BDLocal/rules/bdl.rules.periodo.js
Función:
- Validar y normalizar período antes de guardar.
- Evitar registros sin periodoId.
- Crear una regla reutilizable para Carga, Defensas, Tabla, Ficha y Sync.
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

  function normalizePeriodId(value, label){
    var id = text(value);
    if(id){ return id; }

    var periodLabel = text(label);
    if(periodLabel && typeof utils.makePeriodId === "function"){
      return utils.makePeriodId(periodLabel);
    }

    return "";
  }

  function periodLabelFrom(row, context){
    row = row || {};
    context = context || {};
    return text(
      row.periodoLabel ||
      row.periodo ||
      row.Periodo ||
      row.Período ||
      context.periodoLabel ||
      context.periodLabel ||
      ""
    );
  }

  function periodIdFrom(row, context){
    row = row || {};
    context = context || {};
    return normalizePeriodId(
      row.periodoId || row.periodId || row.PeriodoId || context.periodoId || context.periodId,
      periodLabelFrom(row, context)
    );
  }

  function ensure(row, context){
    row = row || {};
    context = context || {};

    var copy = Object.assign({}, row);
    var periodoId = periodIdFrom(copy, context);
    var periodoLabel = periodLabelFrom(copy, context);

    copy.periodoId = periodoId;
    if(periodoLabel){ copy.periodoLabel = periodoLabel; }

    copy._bdlPeriodoValid = !!periodoId;
    copy._bdlPeriodoError = periodoId ? "" : "No se puede guardar un registro sin período válido.";

    return copy;
  }

  function requirePeriod(payload, context){
    if(Array.isArray(payload)){
      return payload.map(function(row){ return ensure(row, context); });
    }
    return ensure(payload || {}, context || {});
  }

  Rules.register("periodo.require", requirePeriod);

  window.BDLRulesPeriodo = {
    normalizePeriodId: normalizePeriodId,
    periodLabelFrom: periodLabelFrom,
    periodIdFrom: periodIdFrom,
    ensure: ensure,
    requirePeriod: requirePeriod
  };
})(window);
