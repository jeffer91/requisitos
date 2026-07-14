/* =========================================================
Nombre completo: defart.periodo-normalizer.js
Ruta o ubicación: /Requisitos/defart/defart.periodo-normalizer.js
Función o funciones:
- Normalizar visualmente los períodos mostrados en Defensas.
- Convertir IDs como 2025-11__2026-05 en "Noviembre 2025 a Mayo 2026".
- Conservar intacto el ID técnico usado para filtrar, consultar y guardar.
- Aplicar la misma presentación a la ruta moderna y al respaldo legacy.
Con qué se conecta:
- defart.core.js
- defart.service-bridge.js
- defart.app.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.0-period-display";

  var MONTHS = {
    "01":"Enero", "1":"Enero", "enero":"Enero", "ene":"Enero",
    "02":"Febrero", "2":"Febrero", "febrero":"Febrero", "feb":"Febrero",
    "03":"Marzo", "3":"Marzo", "marzo":"Marzo", "mar":"Marzo",
    "04":"Abril", "4":"Abril", "abril":"Abril", "abr":"Abril",
    "05":"Mayo", "5":"Mayo", "mayo":"Mayo", "may":"Mayo",
    "06":"Junio", "6":"Junio", "junio":"Junio", "jun":"Junio",
    "07":"Julio", "7":"Julio", "julio":"Julio", "jul":"Julio",
    "08":"Agosto", "8":"Agosto", "agosto":"Agosto", "ago":"Agosto",
    "09":"Septiembre", "9":"Septiembre", "septiembre":"Septiembre", "setiembre":"Septiembre", "sep":"Septiembre", "sept":"Septiembre",
    "10":"Octubre", "octubre":"Octubre", "oct":"Octubre",
    "11":"Noviembre", "noviembre":"Noviembre", "nov":"Noviembre",
    "12":"Diciembre", "diciembre":"Diciembre", "dic":"Diciembre"
  };

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function norm(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function monthName(value){
    var raw = text(value);
    var number = raw.replace(/^0+/, "");
    return MONTHS[raw] || MONTHS[number] || MONTHS[norm(raw)] || "";
  }

  function formatParts(startYear, startMonth, endYear, endMonth){
    var first = monthName(startMonth);
    var last = monthName(endMonth);
    var year1 = text(startYear);
    var year2 = text(endYear);

    if(!first || !last || !/^\d{4}$/.test(year1) || !/^\d{4}$/.test(year2)){
      return "";
    }

    return first + " " + year1 + " a " + last + " " + year2;
  }

  function parseNumericPeriod(value){
    var raw = text(value);
    var match;

    if(!raw){ return ""; }

    match = raw.match(/(20\d{2})\D+([01]?\d)\D+(20\d{2})\D+([01]?\d)/);
    if(match){
      return formatParts(match[1], match[2], match[3], match[4]);
    }

    match = raw.match(/([01]?\d)\D+(20\d{2})\D+([01]?\d)\D+(20\d{2})/);
    if(match){
      return formatParts(match[2], match[1], match[4], match[3]);
    }

    return "";
  }

  function parseTextPeriod(value){
    var raw = text(value);
    var pattern = "(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic)";
    var regex = new RegExp(pattern + "\\s+(20\\d{2}).*?" + pattern + "\\s+(20\\d{2})", "i");
    var match = raw.match(regex);

    return match
      ? formatParts(match[2], match[1], match[4], match[3])
      : "";
  }

  function titlePeriod(value){
    var raw = text(value);

    if(!raw){ return ""; }

    return raw
      .replace(/_+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/gi, function(match){
        return monthName(match) || match;
      })
      .replace(/\s+a\s+/i, " a ");
  }

  function candidates(period){
    if(!period || typeof period !== "object"){
      return [period];
    }

    return [
      period.periodoLabel,
      period.label,
      period.nombre,
      period.name,
      period._periodoLabel,
      period._periodo,
      period.periodo,
      period.Periodo,
      period._bl2Periodo,
      period.periodoId,
      period.periodId,
      period._periodoId,
      period._bl2PeriodoId,
      period.id,
      period.value,
      period.key
    ];
  }

  function normalizeDisplay(period){
    var values = candidates(period);
    var i;
    var normalized;

    for(i = 0; i < values.length; i += 1){
      normalized = parseNumericPeriod(values[i]) || parseTextPeriod(values[i]);
      if(normalized){ return normalized; }
    }

    for(i = 0; i < values.length; i += 1){
      normalized = titlePeriod(values[i]);
      if(normalized){ return normalized; }
    }

    return "Sin período";
  }

  function periodId(period){
    if(!period || typeof period !== "object"){
      return text(period);
    }

    return text(
      period.id ||
      period.periodoId ||
      period.periodId ||
      period.value ||
      period.key ||
      ""
    );
  }

  function normalizeItem(period){
    var id = periodId(period);
    var label = normalizeDisplay(period || id);
    var base = period && typeof period === "object"
      ? Object.assign({}, period)
      : {};

    return Object.assign(base, {
      id:id,
      value:id,
      key:id,
      periodoId:id,
      label:label,
      periodoLabel:label,
      nombre:label
    });
  }

  function normalizePeriodList(list){
    var seen = Object.create(null);

    return (Array.isArray(list) ? list : [])
      .map(normalizeItem)
      .filter(function(period){
        if(!period.id || seen[period.id]){ return false; }
        seen[period.id] = true;
        return true;
      });
  }

  function normalizeSummary(summary){
    if(!summary || typeof summary !== "object"){
      return summary;
    }

    return Object.assign({}, summary, {
      periodList:normalizePeriodList(summary.periodList)
    });
  }

  function install(){
    if(!window.DefartCore || typeof window.DefartCore.summary !== "function"){
      return false;
    }

    if(window.DefartCore.__periodoNormalizerInstalled){
      return true;
    }

    var originalSummary = window.DefartCore.summary;

    window.DefartCore.summary = function(){
      return normalizeSummary(
        originalSummary.apply(window.DefartCore, arguments)
      );
    };

    window.DefartCore.__periodoNormalizerInstalled = true;
    return true;
  }

  function start(){
    if(install()){ return; }

    var attempts = 0;
    var timer = window.setInterval(function(){
      attempts += 1;
      if(install() || attempts >= 30){
        window.clearInterval(timer);
      }
    }, 100);
  }

  window.DefartPeriodoNormalizer = {
    version:VERSION,
    normalize:normalizeDisplay,
    normalizeItem:normalizeItem,
    normalizePeriodList:normalizePeriodList,
    normalizeSummary:normalizeSummary,
    install:install
  };

  start();
})(window);
