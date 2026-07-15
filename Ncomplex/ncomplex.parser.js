/* =========================================================
Nombre completo: ncomplex.parser.js
Ruta o ubicación: /Ncomplex/ncomplex.parser.js
Función o funciones:
- Leer texto copiado desde tablas externas.
- Reconocer encabezados y filas aunque las notas aparezcan en líneas separadas.
- Conservar las columnas originales y normalizar cédula, horario y notas detectadas.
- Entregar errores y advertencias sin guardar información automáticamente.
Con qué se conecta:
- ncomplex.config.js
- ncomplex.calculator.js
- ncomplex.matcher.js
- ncomplex.app.js
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

  function splitTabs(line){
    return String(line == null ? "" : line)
      .split("\t")
      .map(function(value){ return String(value == null ? "" : value).trim(); });
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
      var line = lines[index];
      var key = normalized(line);
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
      var parts = splitTabs(line);
      if(parts.length){
        parts.forEach(function(part){
          if(part !== "" || remaining.length){ remaining.push(part); }
        });
      }
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
      codigoTitulacion: text(mapped.codigoTitulacion || values[0]),
      cedula: cedula,
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

  function parse(input){
    var source = String(input == null ? "" : input)
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ");

    var result = {
      ok: false,
      headers: [],
      rows: [],
      errors: [],
      warnings: [],
      rawText: source,
      total: 0
    };

    if(!text(source)){
      result.errors.push("No hay texto para analizar.");
      return result;
    }

    var lines = source.split("\n");
    var headerIndex = findHeader(lines);
    if(headerIndex < 0){
      result.errors.push("No se encontró el encabezado con Cédula, Nombre Completo y Horario.");
      return result;
    }

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

  window.NcomplexParser = {
    version: "1.0.0-bloque-2",
    parse: parse,
    normalizeCedula: normalizeCedula,
    findHeader: findHeader,
    looksLikeRowStart: looksLikeRowStart
  };
})(window);