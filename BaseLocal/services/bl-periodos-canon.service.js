/* =========================================================
Nombre completo: bl-periodos-canon.service.js
Ruta o ubicación: /Requisitos/BaseLocal/services/bl-periodos-canon.service.js
Función o funciones:
- Crear una llave canónica única para períodos.
- Unir períodos duplicados por texto, ID técnico o rango de meses.
- Reasignar estudiantes al período canónico sin borrar datos.
Con qué se conecta:
- bl-periodos.service.js
- bl-normalizador.js
- excel-local.repo.js
- excel-periodos.js
- excel-local.storage.js
========================================================= */
(function(window){
  "use strict";

  var MONTHS = {
    enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6,
    julio:7, agosto:8, septiembre:9, setiembre:9,
    octubre:10, noviembre:11, diciembre:12
  };
  var MONTH_NAMES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  function text(value){return String(value == null ? "" : value).trim();}
  function now(){return new Date().toISOString();}
  function pad2(value){return String(value).padStart(2, "0");}
  function n(value){var x = parseInt(String(value == null ? "" : value).trim(), 10);return Number.isFinite(x) ? x : null;}
  function clone(value){try{return JSON.parse(JSON.stringify(value == null ? null : value));}catch(error){return value;}}

  function normalizeText(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function monthName(month){return MONTH_NAMES[month] || text(month);}
  function idFromParts(ia, im, fa, fm){return ia + "-" + pad2(im) + "__" + fa + "-" + pad2(fm);}
  function labelFromParts(ia, im, fa, fm){return monthName(im) + " " + ia + " a " + monthName(fm) + " " + fa;}

  function expandYear(year){
    year = n(year);
    if(!year){return null;}
    return year < 100 ? 2000 + year : year;
  }

  function parseTechnical(value){
    var raw = text(value);
    var match = raw.match(/(20\d{2})[-_\/]?(\d{1,2})\D+(20\d{2}|\d{2})[-_\/]?(\d{1,2})/);
    if(!match){return null;}
    var ia = expandYear(match[1]);
    var im = n(match[2]);
    var fa = expandYear(match[3]);
    var fm = n(match[4]);
    if(!ia || !fa || im < 1 || im > 12 || fm < 1 || fm > 12){return null;}
    return {inicioAnio:ia, inicioMes:im, finAnio:fa, finMes:fm};
  }

  function parseTextual(value){
    var clean = normalizeText(value);
    if(!clean){return null;}
    var names = Object.keys(MONTHS).join("|");
    var reg = new RegExp("\\b(" + names + ")\\b\\s+(20\\d{2}|\\d{2}).*?\\b(" + names + ")\\b\\s+(20\\d{2}|\\d{2})", "i");
    var match = clean.match(reg);
    if(!match){return null;}
    var im = MONTHS[match[1]];
    var ia = expandYear(match[2]);
    var fm = MONTHS[match[3]];
    var fa = expandYear(match[4]);
    if(!ia || !fa || !im || !fm){return null;}
    return {inicioAnio:ia, inicioMes:im, finAnio:fa, finMes:fm};
  }

  function parsePeriod(value){
    return parseTechnical(value) || parseTextual(value);
  }

  function keyFromPeriod(period){
    var src = period || {};
    var raw = text(src.id || src.periodoId || src.value || src.label || src.periodoLabel || src.periodo || src.nombrePeriodo);
    var label = text(src.label || src.periodoLabel || src.periodo || src.nombrePeriodo || raw);
    var parsed = parsePeriod(raw) || parsePeriod(label);
    if(parsed){return idFromParts(parsed.inicioAnio, parsed.inicioMes, parsed.finAnio, parsed.finMes);}
    return normalizeText(label || raw).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || raw;
  }

  function normalizePeriod(period){
    var source = Object.assign({}, period || {});
    var raw = text(source.id || source.periodoId || source.value || source.label || source.periodoLabel || source.periodo || source.nombrePeriodo);
    var label = text(source.label || source.periodoLabel || source.periodo || source.nombrePeriodo || raw);
    var parsed = parsePeriod(raw) || parsePeriod(label);
    var id = parsed ? idFromParts(parsed.inicioAnio, parsed.inicioMes, parsed.finAnio, parsed.finMes) : (keyFromPeriod(source) || raw || label);
    var pretty = parsed ? labelFromParts(parsed.inicioAnio, parsed.inicioMes, parsed.finAnio, parsed.finMes) : (label || id);

    return Object.assign({}, source, {
      id:id,
      periodoId:id,
      label:pretty,
      periodoLabel:pretty,
      inicioAnio:parsed ? parsed.inicioAnio : source.inicioAnio,
      inicioMes:parsed ? parsed.inicioMes : source.inicioMes,
      finAnio:parsed ? parsed.finAnio : source.finAnio,
      finMes:parsed ? parsed.finMes : source.finMes,
      updatedAt:text(source.updatedAt || source.actualizadoEn || source.creadoEn) || now()
    });
  }

  function mergeValue(base, incoming){
    if(incoming === undefined || incoming === null || text(incoming) === ""){return base;}
    if(base === undefined || base === null || text(base) === ""){return incoming;}
    return incoming;
  }

  function mergePeriod(base, incoming){
    var out = Object.assign({}, base || {});
    Object.keys(incoming || {}).forEach(function(key){out[key] = mergeValue(out[key], incoming[key]);});
    return normalizePeriod(out);
  }

  function dedupe(periods){
    var map = {};
    var list = [];
    (periods || []).forEach(function(period){
      var normalized = normalizePeriod(period);
      var key = keyFromPeriod(normalized);
      if(!key){return;}
      if(map[key]){
        map[key] = mergePeriod(map[key], normalized);
      }else{
        map[key] = normalized;
        list.push(key);
      }
    });
    return list.map(function(key){return map[key];}).sort(function(a,b){return String(a.label || a.id).localeCompare(String(b.label || b.id), "es");});
  }

  function periodIdMap(periods){
    var map = {};
    dedupe(periods || []).forEach(function(period){
      var normalized = normalizePeriod(period);
      map[keyFromPeriod(period)] = normalized;
      map[text(period && period.id)] = normalized;
      map[text(period && period.periodoId)] = normalized;
      map[text(period && period.label)] = normalized;
      map[text(period && period.periodoLabel)] = normalized;
    });
    return map;
  }

  function normalizeStudentPeriod(student, periodMap){
    var out = Object.assign({}, student || {});
    var raw = text(out.periodoId || out.ultimoPeriodoId || out.periodId || out.periodo || out.Periodo || out.periodoLabel);
    var byKey = periodMap[keyFromPeriod({id:raw})] || periodMap[raw];
    if(byKey){
      out.periodoId = byKey.id;
      out.ultimoPeriodoId = text(out.ultimoPeriodoId) ? byKey.id : byKey.id;
      out.periodoLabel = byKey.label;
    }
    return out;
  }

  function canonicalizeSnapshot(snapshot){
    var snap = clone(snapshot || {}) || {};
    snap.periods = Array.isArray(snap.periods) ? snap.periods : [];
    snap.students = Array.isArray(snap.students) ? snap.students : [];
    snap.history = Array.isArray(snap.history) ? snap.history : [];
    snap.diagnostics = Array.isArray(snap.diagnostics) ? snap.diagnostics : [];
    snap.meta = snap.meta && typeof snap.meta === "object" ? snap.meta : {};

    var originalPeriods = snap.periods.length;
    var cleanPeriods = dedupe(snap.periods);
    var map = periodIdMap(snap.periods.concat(cleanPeriods));
    snap.periods = cleanPeriods;
    snap.students = snap.students.map(function(student){return normalizeStudentPeriod(student, map);});
    snap.meta.totalPeriods = snap.periods.length;
    snap.meta.totalStudents = snap.students.length;
    snap.meta.updatedAt = snap.meta.updatedAt || now();
    snap.meta.periodosCanonicos = true;
    snap.meta.periodosUnidos = Math.max(0, originalPeriods - cleanPeriods.length);
    return snap;
  }

  function samePeriod(a, b){return keyFromPeriod({id:a}) === keyFromPeriod({id:b});}

  window.BLPeriodosCanon = {
    version:"1.0.0",
    text:text,
    normalizeText:normalizeText,
    parsePeriod:parsePeriod,
    keyFromPeriod:keyFromPeriod,
    normalizePeriod:normalizePeriod,
    dedupe:dedupe,
    periodIdMap:periodIdMap,
    normalizeStudentPeriod:normalizeStudentPeriod,
    canonicalizeSnapshot:canonicalizeSnapshot,
    samePeriod:samePeriod,
    idFromParts:idFromParts,
    labelFromParts:labelFromParts
  };
})(window);
