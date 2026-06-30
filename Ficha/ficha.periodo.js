/* =========================================================
Nombre completo: ficha.periodo.js
Ruta o ubicación: /Requisitos/Ficha/ficha.periodo.js
Función o funciones:
- Normalizar períodos mostrados en Ficha.
- Convertir formatos mixtos a: Noviembre 2025 - Mayo 2026.
- Mantener el id original para que los filtros sigan funcionando.
- Normalizar encabezado, selector de período, mensajes copiados y textos de ficha.
Con qué se conecta:
- ficha.core.js
- ficha.app.js
========================================================= */
(function(window){
  "use strict";

  var MONTHS = {
    1:"Enero", 2:"Febrero", 3:"Marzo", 4:"Abril", 5:"Mayo", 6:"Junio",
    7:"Julio", 8:"Agosto", 9:"Septiembre", 10:"Octubre", 11:"Noviembre", 12:"Diciembre"
  };

  var MONTH_ALIASES = {
    enero:1, ene:1,
    febrero:2, feb:2,
    marzo:3, mar:3,
    abril:4, abr:4,
    mayo:5, may:5,
    junio:6, jun:6,
    julio:7, jul:7,
    agosto:8, ago:8,
    septiembre:9, setiembre:9, sept:9, sep:9, set:9,
    octubre:10, oct:10,
    noviembre:11, nov:11,
    diciembre:12, dic:12
  };

  function text(value){ return String(value == null ? "" : value).trim(); }
  function norm(value){ return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function monthName(number){ return MONTHS[Number(number)] || ""; }
  function validYear(year){ year = Number(year); return year >= 2000 && year <= 2100; }
  function validMonth(month){ month = Number(month); return month >= 1 && month <= 12; }
  function format(month1, year1, month2, year2){
    month1 = Number(month1); year1 = Number(year1); month2 = Number(month2); year2 = Number(year2);
    if(!validMonth(month1) || !validMonth(month2) || !validYear(year1) || !validYear(year2)){ return ""; }
    return monthName(month1) + " " + year1 + " - " + monthName(month2) + " " + year2;
  }

  function candidatesFromObject(value){
    if(!value || typeof value !== "object"){ return [value]; }
    return [
      value.label,
      value.periodoLabel,
      value.nombre,
      value.name,
      value.periodo,
      value.Periodo,
      value.value,
      value.id,
      value.periodoId,
      value.periodId,
      value.key
    ];
  }

  function parseNumeric(raw){
    raw = text(raw);
    if(!raw){ return ""; }

    var direct = raw.match(/((?:20|19)\d{2})\D{0,4}(0?[1-9]|1[0-2])\D+((?:20|19)\d{2})\D{0,4}(0?[1-9]|1[0-2])/);
    if(direct){ return format(direct[2], direct[1], direct[4], direct[3]); }

    var reverse = raw.match(/(0?[1-9]|1[0-2])\D{0,4}((?:20|19)\d{2})\D+(0?[1-9]|1[0-2])\D{0,4}((?:20|19)\d{2})/);
    if(reverse){ return format(reverse[1], reverse[2], reverse[3], reverse[4]); }

    return "";
  }

  function parseTextual(raw){
    var cleaned = norm(raw);
    if(!cleaned){ return ""; }

    var monthWords = Object.keys(MONTH_ALIASES).sort(function(a,b){ return b.length - a.length; }).join("|");
    var pairs = [];
    var reMonthYear = new RegExp("(" + monthWords + ")\\s*(?:de\\s*)?((?:20|19)\\d{2})", "g");
    var match;
    while((match = reMonthYear.exec(cleaned)) !== null){
      pairs.push({month:MONTH_ALIASES[match[1]], year:Number(match[2])});
    }
    if(pairs.length >= 2){ return format(pairs[0].month, pairs[0].year, pairs[1].month, pairs[1].year); }

    pairs = [];
    var reYearMonth = new RegExp("((?:20|19)\\d{2})\\s*(?:de\\s*)?(" + monthWords + ")", "g");
    while((match = reYearMonth.exec(cleaned)) !== null){
      pairs.push({month:MONTH_ALIASES[match[2]], year:Number(match[1])});
    }
    if(pairs.length >= 2){ return format(pairs[0].month, pairs[0].year, pairs[1].month, pairs[1].year); }

    return "";
  }

  function display(value){
    var values = candidatesFromObject(value);
    for(var i = 0; i < values.length; i += 1){
      var raw = text(values[i]);
      if(!raw){ continue; }
      var parsed = parseNumeric(raw) || parseTextual(raw);
      if(parsed){ return parsed; }
    }
    for(var j = 0; j < values.length; j += 1){
      if(text(values[j])){ return text(values[j]); }
    }
    return "Sin período";
  }

  function displayFromRow(row){
    row = row || {};
    return display({
      label: row._periodoNormalizado,
      periodoLabel: row._periodo,
      periodo: row.periodoLabel || row.periodo || row.Periodo,
      periodoId: row._periodoId || row.periodoId || row.ultimoPeriodoId || row.periodId,
      id: row._bl2PeriodoId || row._bl2Periodo
    });
  }

  function normalizePeriodObject(period){
    if(typeof period === "string"){
      return { id:period, periodoId:period, value:period, label:display(period), periodoLabel:display(period), rawLabel:period };
    }
    period = period || {};
    var id = text(period.id || period.periodoId || period.periodId || period.value || period.key || period.label || period.periodoLabel || period.nombre || period.name);
    var label = display(period);
    return Object.assign({}, period, {
      id:id,
      periodoId:id,
      value:id,
      label:label,
      periodoLabel:label,
      rawLabel:text(period.label || period.periodoLabel || period.nombre || period.name || id)
    });
  }

  function patchCore(){
    if(!window.FichaCore || window.FichaCore.__periodoNormalizadoPatched){ return false; }

    if(typeof window.FichaCore.periods === "function"){
      var originalPeriods = window.FichaCore.periods;
      window.FichaCore.periods = function(){
        return (originalPeriods.call(window.FichaCore) || []).map(normalizePeriodObject);
      };
    }

    if(typeof window.FichaCore.toText === "function"){
      var originalToText = window.FichaCore.toText;
      window.FichaCore.toText = function(row){
        var output = originalToText.call(window.FichaCore, row);
        var period = displayFromRow(row || {});
        return text(output).replace(/^Período:\s*.*$/m, "Período: " + period);
      };
    }

    if(typeof window.FichaCore.studentMessage === "function"){
      var originalStudentMessage = window.FichaCore.studentMessage;
      window.FichaCore.studentMessage = function(row){
        var output = originalStudentMessage.call(window.FichaCore, row);
        var period = displayFromRow(row || {});
        return text(output).replace(/^Período:\s*.*$/m, "Período: " + period);
      };
    }

    window.FichaCore.__periodoNormalizadoPatched = true;
    return true;
  }

  window.FichaPeriodo = {
    display:display,
    displayFromRow:displayFromRow,
    normalizePeriodObject:normalizePeriodObject,
    patchCore:patchCore,
    version:"1.0.0-ficha-periodo"
  };

  patchCore();
})(window);
