/* =========================================================
Nombre completo: ncomplex.parser.js
Ruta o ubicación: /Ncomplex/ncomplex.parser.js
Función o funciones:
- Leer el texto bruto copiado desde el libro de calificaciones de Moodle.
- Ignorar encabezados, iniciales, controles "Ocultar" y promedios generales.
- Reconocer estudiantes mediante nombre y correo, aun cuando no exista cédula.
- Convertir calificaciones de escala 0-100 a la escala institucional 0-10.
- Mantener compatibilidad con el formato tabular anterior basado en cédula.
========================================================= */
(function(window){
  "use strict";

  var Config = window.NcomplexConfig || {};
  var Calculator = window.NcomplexCalculator || {};

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function normalized(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function normalizeCedula(value){
    var central = window.BDLRulesEvaluacionesTitulacion;
    if(central && typeof central.normalizeCedula === "function"){
      return central.normalizeCedula(value);
    }
    var raw = text(value).replace(/[^0-9A-Za-z]/g, "").toUpperCase();
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function normalizeEmail(value){
    return text(value).toLowerCase().replace(/^mailto:/, "");
  }

  function splitTabs(line){
    return String(line == null ? "" : line)
      .split("\t")
      .map(function(value){ return text(value); });
  }

  function aliasKey(header){
    var value = normalized(header);
    var aliases = Config.headerAliases || {};
    var keys = Object.keys(aliases);
    for(var i = 0; i < keys.length; i += 1){
      var key = keys[i];
      var list = aliases[key] || [];
      if(list.some(function(alias){ return normalized(alias) === value; })){
        return key;
      }
    }
    return "column_" + value.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function findHeader(lines){
    for(var index = 0; index < lines.length; index += 1){
      var key = normalized(lines[index]);
      if(
        key.indexOf("cedula") >= 0 &&
        key.indexOf("nombre completo") >= 0 &&
        key.indexOf("horario") >= 0
      ){
        return index;
      }
    }
    return -1;
  }

  function looksLikeRowStart(line){
    var parts = splitTabs(line);
    if(parts.length < 4){ return false; }
    return /^\d+$/.test(parts[0]) && /^\d{9,10}$/.test(parts[1].replace(/\D/g, ""));
  }

  function collectChunks(lines, startIndex){
    var chunks = [];
    var current = null;

    for(var index = startIndex; index < lines.length; index += 1){
      var line = String(lines[index] == null ? "" : lines[index]);
      if(!text(line)){ continue; }

      if(looksLikeRowStart(line)){
        if(current){ chunks.push(current); }
        current = { firstLine: line, continuation: [] };
      }else if(current){
        current.continuation.push(line);
      }
    }

    if(current){ chunks.push(current); }
    return chunks;
  }

  function valuesFromChunk(chunk){
    var first = splitTabs(chunk.firstLine);
    var values = first.slice(0, 4);
    var remaining = first.slice(4);

    chunk.continuation.forEach(function(line){
      splitTabs(line).forEach(function(part){
        if(part !== "" || remaining.length){ remaining.push(part); }
      });
    });

    return values.concat(remaining);
  }

  function mapColumns(headers, values){
    var result = {};
    headers.forEach(function(header, index){
      result[header.key] = values[index] == null ? "" : values[index];
      result[header.original] = values[index] == null ? "" : values[index];
    });
    return result;
  }

  function parseRow(chunk, headers, rowNumber){
    var values = valuesFromChunk(chunk);
    var mapped = mapColumns(headers, values);
    var note = typeof Calculator.parse === "function"
      ? Calculator.parse
      : function(value){
          var number = Number(text(value).replace(/,/g, "."));
          return Number.isFinite(number) ? number : null;
        };

    var cedula = normalizeCedula(mapped.cedula || values[1]);
    var item = {
      rowNumber: rowNumber,
      format: "tabla_cedula",
      codigoTitulacion: text(mapped.codigoTitulacion || values[0]),
      cedula: cedula,
      correo: normalizeEmail(mapped.correo || mapped.email || ""),
      nombreCompleto: text(mapped.nombreCompleto || values[2]),
      horario: text(mapped.horario || values[3]),
      notaTeorica: note(mapped.nota1),
      notaPractica: note(mapped.nota2),
      notaSupletorio: note(mapped.supletorioComplexivo),
      notaTrabajoTitulacion: note(mapped.trabajoTitulacion),
      trabajoPromedioAcumulado: note(mapped.trabajoPromedioAcumulado),
      rawColumns: mapped,
      rawValues: values,
      rawText: [chunk.firstLine].concat(chunk.continuation).join("\n"),
      warnings: []
    };

    if(!item.cedula){ item.warnings.push("Cédula vacía."); }
    if(item.cedula && !/^\d{10}$/.test(item.cedula)){
      item.warnings.push("La identificación no tiene 10 dígitos.");
    }
    if(!item.nombreCompleto){ item.warnings.push("Nombre no detectado."); }

    var hasComplexivo = item.notaTeorica != null || item.notaPractica != null || item.notaSupletorio != null;
    var hasWork = item.notaTrabajoTitulacion != null;
    item.suggestedModality = hasWork && !hasComplexivo
      ? (Config.modalidades && Config.modalidades.TRABAJO)
      : (Config.modalidades && Config.modalidades.COMPLEXIVO);

    return item;
  }

  function isEmail(value){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(text(value));
  }

  function isNoiseLine(value){
    var key = normalized(value);
    if(!key){ return true; }
    if(key === "ocultar"){ return true; }
    if(key === "teorico" || key === "practico"){ return true; }
    if(key === "nombre / apellido(s)" || key === "nombre/apellido(s)"){ return true; }
    if(key === "direccion de correo" || key === "correo electronico"){ return true; }
    if(key.indexOf("mostrando calificaciones y totales") >= 0){ return true; }
    if(key.indexOf("promedio general") === 0){ return true; }
    if(key.indexOf("cuestionario") === 0){ return true; }
    if(key.indexOf("media de calificaciones") === 0){ return true; }
    if(key.indexOf("sumatotal del curso") === 0 || key.indexOf("suma total del curso") === 0){ return true; }
    if(key.indexOf("examen complexivo") === 0){ return true; }
    return false;
  }

  function isInitials(value){
    var raw = text(value);
    return /^[A-ZÁÉÍÓÚÜÑ]{1,3}$/.test(raw);
  }

  function isGradeToken(value){
    var raw = text(value).replace(/\s+/g, "");
    return raw === "-" || /^\d{1,3}(?:[.,]\d+)?$/.test(raw);
  }

  function rawNumber(value){
    var raw = text(value).replace(/\s+/g, "");
    if(!raw || raw === "-"){ return null; }
    var number = Number(raw.replace(/,/g, "."));
    return Number.isFinite(number) ? number : null;
  }

  function scoreToTen(value){
    var number = rawNumber(value);
    if(number == null){ return null; }
    var converted = number / 10;
    converted = Math.max(0, Math.min(10, converted));
    return Math.round(converted * 100) / 100;
  }

  function looksLikeName(value){
    var raw = text(value);
    if(!raw || isNoiseLine(raw) || isInitials(raw) || isEmail(raw) || isGradeToken(raw)){ return false; }
    if(/[0-9@]/.test(raw)){ return false; }
    var words = raw.split(/\s+/).filter(Boolean);
    return words.length >= 2 && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(raw);
  }

  function previousName(lines, emailIndex){
    for(var index = emailIndex - 1; index >= 0; index -= 1){
      var candidate = text(lines[index]);
      if(looksLikeName(candidate)){ return candidate; }
      if(isEmail(candidate)){ break; }
    }
    return "";
  }

  function gradeTokens(lines, startIndex, endIndex){
    var output = [];
    for(var index = startIndex; index < endIndex; index += 1){
      var line = text(lines[index]);
      if(!line || isNoiseLine(line)){ continue; }
      splitTabs(line).forEach(function(part){
        if(isGradeToken(part)){ output.push(part); }
      });
    }
    return output;
  }

  function findEmailIndexes(lines){
    var indexes = [];
    lines.forEach(function(line, index){
      splitTabs(line).forEach(function(part){
        if(isEmail(part)){ indexes.push({ index: index, email: normalizeEmail(part) }); }
      });
    });
    return indexes;
  }

  function moodleRow(lines, emailEntry, nextIndex, rowNumber){
    var tokens = gradeTokens(lines, emailEntry.index + 1, nextIndex);
    var warnings = [];
    if(tokens.length < 7){
      warnings.push("Solo se detectaron " + tokens.length + " de las 7 calificaciones esperadas.");
    }
    if(tokens.length > 7){
      warnings.push("Se detectaron valores adicionales; se utilizaron los primeros 7.");
    }
    while(tokens.length < 7){ tokens.push("-"); }

    var name = previousName(lines, emailEntry.index);
    if(!name){ warnings.push("Nombre no detectado antes del correo."); }

    var item = {
      rowNumber: rowNumber,
      format: "moodle_gradebook",
      codigoTitulacion: "",
      cedula: "",
      correo: emailEntry.email,
      nombreCompleto: name,
      horario: "",
      notaTeorica: scoreToTen(tokens[0]),
      notaTeoricaSupletorio: scoreToTen(tokens[1]),
      notaPractica: scoreToTen(tokens[3]),
      notaPracticaSupletorio: scoreToTen(tokens[4]),
      moodleTotalTeorico: scoreToTen(tokens[2]),
      moodleTotalPractico: scoreToTen(tokens[5]),
      moodleTotalCurso: scoreToTen(tokens[6]),
      rawScores: {
        teorico: rawNumber(tokens[0]),
        teoricoSupletorio: rawNumber(tokens[1]),
        totalTeorico: rawNumber(tokens[2]),
        practico: rawNumber(tokens[3]),
        practicoSupletorio: rawNumber(tokens[4]),
        totalPractico: rawNumber(tokens[5]),
        totalCurso: rawNumber(tokens[6])
      },
      rawValues: tokens.slice(0, 7),
      rawText: lines.slice(Math.max(0, emailEntry.index - 2), nextIndex).join("\n"),
      warnings: warnings,
      suggestedModality: Config.modalidades && Config.modalidades.COMPLEXIVO
    };

    if(
      item.notaTeorica == null &&
      item.notaTeoricaSupletorio == null &&
      item.notaPractica == null &&
      item.notaPracticaSupletorio == null
    ){
      item.warnings.push("No se detectaron notas de los componentes.");
    }

    return item;
  }

  function parseMoodle(lines, source){
    var emails = findEmailIndexes(lines);
    var result = {
      ok: false,
      format: "moodle_gradebook",
      headers: [
        "nombreCompleto",
        "correo",
        "notaTeorica",
        "notaTeoricaSupletorio",
        "moodleTotalTeorico",
        "notaPractica",
        "notaPracticaSupletorio",
        "moodleTotalPractico",
        "moodleTotalCurso"
      ],
      rows: [],
      errors: [],
      warnings: [],
      rawText: source,
      total: 0
    };

    if(!emails.length){
      result.errors.push("No se detectaron correos institucionales en el texto pegado.");
      return result;
    }

    emails.forEach(function(entry, index){
      var nextIndex = index + 1 < emails.length ? emails[index + 1].index : lines.length;
      result.rows.push(moodleRow(lines, entry, nextIndex, index + 1));
    });

    result.total = result.rows.length;
    var incomplete = result.rows.filter(function(row){
      return !row.nombreCompleto || row.rawValues.filter(function(value){ return value !== "-"; }).length < 3;
    }).length;
    if(incomplete){
      result.warnings.push(incomplete + " fila(s) requieren revisión porque tienen datos incompletos.");
    }
    result.ok = result.rows.length > 0;
    return result;
  }

  function parseTabular(lines, source, headerIndex){
    var result = {
      ok: false,
      format: "tabla_cedula",
      headers: [],
      rows: [],
      errors: [],
      warnings: [],
      rawText: source,
      total: 0
    };

    var headerValues = splitTabs(lines[headerIndex]);
    result.headers = headerValues.map(function(header){
      return { original: text(header), key: aliasKey(header) };
    });

    var chunks = collectChunks(lines, headerIndex + 1);
    if(!chunks.length){
      result.errors.push("No se detectaron filas de estudiantes después del encabezado.");
      return result;
    }

    result.rows = chunks.map(function(chunk, index){
      return parseRow(chunk, result.headers, index + 1);
    });
    result.total = result.rows.length;

    var invalid = result.rows.filter(function(row){ return !row.cedula; }).length;
    if(invalid){ result.warnings.push(invalid + " fila(s) no tienen una cédula reconocible."); }

    result.ok = result.rows.some(function(row){ return !!row.cedula; });
    return result;
  }

  function parse(input){
    var source = String(input == null ? "" : input)
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ");

    if(!text(source)){
      return {
        ok: false,
        format: "",
        headers: [],
        rows: [],
        errors: ["No hay texto para analizar."],
        warnings: [],
        rawText: source,
        total: 0
      };
    }

    var lines = source.split("\n");
    var headerIndex = findHeader(lines);
    if(headerIndex >= 0){
      return parseTabular(lines, source, headerIndex);
    }

    if(findEmailIndexes(lines).length){
      return parseMoodle(lines, source);
    }

    return {
      ok: false,
      format: "",
      headers: [],
      rows: [],
      errors: [
        "No se reconoció el formato. Pegue la tabla completa de Moodle o una tabla con Cédula, Nombre Completo y Horario."
      ],
      warnings: [],
      rawText: source,
      total: 0
    };
  }

  window.NcomplexParser = {
    version: "2.0.0-moodle-gradebook",
    parse: parse,
    parseMoodle: parseMoodle,
    normalizeCedula: normalizeCedula,
    normalizeEmail: normalizeEmail,
    scoreToTen: scoreToTen,
    findHeader: findHeader,
    looksLikeRowStart: looksLikeRowStart,
    findEmailIndexes: findEmailIndexes
  };
})(window);
