/* =========================================================
Nombre completo: ficha.periodo-normalizer.js
Ruta o ubicación: /Requisitos/Ficha/ficha.periodo-normalizer.js
Función o funciones:
- Normalizar visualmente el período en Ficha.
- Convertir IDs como 2025-11__2026-05 a "Noviembre 2025 a Mayo 2026".
- Mantener la lógica existente de FichaCore sin cambiar filtros ni datos guardados.
Con qué se conecta:
- ficha.core.js
- ficha.app.js
========================================================= */
(function (window) {
  "use strict";

  var MONTHS = {
    "01": "Enero",
    "1": "Enero",
    "enero": "Enero",
    "ene": "Enero",

    "02": "Febrero",
    "2": "Febrero",
    "febrero": "Febrero",
    "feb": "Febrero",

    "03": "Marzo",
    "3": "Marzo",
    "marzo": "Marzo",
    "mar": "Marzo",

    "04": "Abril",
    "4": "Abril",
    "abril": "Abril",
    "abr": "Abril",

    "05": "Mayo",
    "5": "Mayo",
    "mayo": "Mayo",
    "may": "Mayo",

    "06": "Junio",
    "6": "Junio",
    "junio": "Junio",
    "jun": "Junio",

    "07": "Julio",
    "7": "Julio",
    "julio": "Julio",
    "jul": "Julio",

    "08": "Agosto",
    "8": "Agosto",
    "agosto": "Agosto",
    "ago": "Agosto",

    "09": "Septiembre",
    "9": "Septiembre",
    "septiembre": "Septiembre",
    "setiembre": "Septiembre",
    "sep": "Septiembre",
    "sept": "Septiembre",

    "10": "Octubre",
    "octubre": "Octubre",
    "oct": "Octubre",

    "11": "Noviembre",
    "noviembre": "Noviembre",
    "nov": "Noviembre",

    "12": "Diciembre",
    "diciembre": "Diciembre",
    "dic": "Diciembre"
  };

  function text(value) {
    return String(value === null || value === undefined ? "" : value).trim();
  }

  function norm(value) {
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function monthName(value) {
    var raw = text(value);
    var normalized = norm(raw);
    var number = raw.replace(/^0+/, "");

    return MONTHS[raw] || MONTHS[number] || MONTHS[normalized] || "";
  }

  function titlePeriod(value) {
    var raw = text(value);
    if (!raw) return "";

    return raw
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/gi, function (match) {
        return monthName(match) || match;
      })
      .replace(/\s+a\s+/i, " a ");
  }

  function formatParts(startYear, startMonth, endYear, endMonth) {
    var m1 = monthName(startMonth);
    var m2 = monthName(endMonth);
    var y1 = text(startYear);
    var y2 = text(endYear);

    if (!m1 || !m2 || !/^\d{4}$/.test(y1) || !/^\d{4}$/.test(y2)) {
      return "";
    }

    return m1 + " " + y1 + " a " + m2 + " " + y2;
  }

  function parseNumericPeriod(raw) {
    raw = text(raw);
    if (!raw) return "";

    var match;

    // 2025-11__2026-05 / 2025_11__2026_05 / 2025/11 a 2026/05
    match = raw.match(/(20\d{2})\D+([01]?\d)\D+(20\d{2})\D+([01]?\d)/);
    if (match) {
      return formatParts(match[1], match[2], match[3], match[4]);
    }

    // 11-2025__05-2026 / 11/2025 a 05/2026
    match = raw.match(/([01]?\d)\D+(20\d{2})\D+([01]?\d)\D+(20\d{2})/);
    if (match) {
      return formatParts(match[2], match[1], match[4], match[3]);
    }

    return "";
  }

  function parseTextPeriod(raw) {
    raw = text(raw);
    if (!raw) return "";

    var monthPattern = "(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic)";
    var regex = new RegExp(monthPattern + "\\s+(20\\d{2}).*?" + monthPattern + "\\s+(20\\d{2})", "i");
    var match = raw.match(regex);

    if (match) {
      return formatParts(match[2], match[1], match[4], match[3]);
    }

    return "";
  }

  function candidateValues(rowOrValue) {
    if (!rowOrValue || typeof rowOrValue !== "object") {
      return [rowOrValue];
    }

    return [
      rowOrValue._periodoNormalizado,
      rowOrValue.periodoLabel,
      rowOrValue.PeriodoLabel,
      rowOrValue.label,
      rowOrValue.nombre,
      rowOrValue._periodo,
      rowOrValue.periodo,
      rowOrValue.Periodo,
      rowOrValue._bl2Periodo,
      rowOrValue.periodoId,
      rowOrValue._periodoId,
      rowOrValue._bl2PeriodoId,
      rowOrValue.ultimoPeriodoId,
      rowOrValue.id,
      rowOrValue.value
    ];
  }

  function normalizePeriodDisplay(rowOrValue) {
    var values = candidateValues(rowOrValue);

    for (var i = 0; i < values.length; i += 1) {
      var raw = text(values[i]);
      var normalized = parseNumericPeriod(raw) || parseTextPeriod(raw);

      if (normalized) {
        return normalized;
      }
    }

    for (var j = 0; j < values.length; j += 1) {
      var fallback = titlePeriod(values[j]);
      if (fallback) return fallback;
    }

    return "Sin período";
  }

  function patchStudent(row) {
    if (!row || typeof row !== "object") return row;

    var display = normalizePeriodDisplay(row);
    row._periodoNormalizado = display;
    row._periodoDisplay = display;

    return row;
  }

  function patchFichaCore() {
    if (!window.FichaCore || window.FichaCore.__periodoNormalizerInstalled) return false;

    var originalPeriodDisplay = window.FichaCore.periodDisplay;
    var originalNormalizeLight = window.FichaCore.normalizeLight;
    var originalNormalizeFull = window.FichaCore.normalizeFull;
    var originalGetById = window.FichaCore.getById;
    var originalFilter = window.FichaCore.filter;
    var originalStudents = window.FichaCore.students;
    var originalPeriods = window.FichaCore.periods;

    window.FichaCore.periodDisplay = function (rowOrValue) {
      var normalized = normalizePeriodDisplay(rowOrValue);

      if (normalized && normalized !== "Sin período") {
        return normalized;
      }

      if (typeof originalPeriodDisplay === "function") {
        return originalPeriodDisplay(rowOrValue);
      }

      return normalized;
    };

    if (typeof originalNormalizeLight === "function") {
      window.FichaCore.normalizeLight = function (row) {
        return patchStudent(originalNormalizeLight(row));
      };
    }

    if (typeof originalNormalizeFull === "function") {
      window.FichaCore.normalizeFull = function (row) {
        return patchStudent(originalNormalizeFull(row));
      };
    }

    if (typeof originalGetById === "function") {
      window.FichaCore.getById = function () {
        return patchStudent(originalGetById.apply(window.FichaCore, arguments));
      };
    }

    if (typeof originalFilter === "function") {
      window.FichaCore.filter = function () {
        var rows = originalFilter.apply(window.FichaCore, arguments) || [];
        return rows.map(patchStudent);
      };
    }

    if (typeof originalStudents === "function") {
      window.FichaCore.students = function () {
        var rows = originalStudents.apply(window.FichaCore, arguments) || [];
        return rows.map(patchStudent);
      };
    }

    if (typeof originalPeriods === "function") {
      window.FichaCore.periods = function () {
        return (originalPeriods.apply(window.FichaCore, arguments) || []).map(function (period) {
          if (!period || typeof period !== "object") {
            return period;
          }

          var display = normalizePeriodDisplay(period);
          return Object.assign({}, period, {
            label: display,
            periodoLabel: display
          });
        });
      };
    }

    window.FichaCore.__periodoNormalizerInstalled = true;
    window.FichaPeriodoNormalizer = {
      normalize: normalizePeriodDisplay,
      patchStudent: patchStudent
    };

    return true;
  }

  function start() {
    if (patchFichaCore()) return;

    var attempts = 0;
    var timer = window.setInterval(function () {
      attempts += 1;
      if (patchFichaCore() || attempts >= 30) {
        window.clearInterval(timer);
      }
    }, 150);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(window);
