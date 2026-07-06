/* =========================================================
Nombre completo: carga.reader.html.js
Ruta o ubicación: /Requisitos/Carga/readers/carga.reader.html.js
Función:
- Leer tablas HTML.
- Soportar XLS viejo guardado como HTML.
- Limpiar encabezados y celdas.
- Reparar mojibake común cuando el archivo fue leído con codificación incorrecta.
========================================================= */
(function(window){
  "use strict";

  function text(value){
    return String(value == null ? "" : value)
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeKey(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
  }

  function repairMojibake(value){
    value = String(value == null ? "" : value);

    var replacements = {
      "Ã¡":"á",
      "Ã©":"é",
      "Ã­":"í",
      "Ã³":"ó",
      "Ãº":"ú",
      "ÃÁ":"Á",
      "Ã‰":"É",
      "Ã�":"Í",
      "Ã“":"Ó",
      "Ãš":"Ú",
      "Ã±":"ñ",
      "Ã‘":"Ñ",
      "Ã¼":"ü",
      "Ãœ":"Ü",
      "Â°":"°",
      "Âº":"º",
      "Âª":"ª",
      "Â¿":"¿",
      "Â¡":"¡",
      "â€“":"-",
      "â€”":"-",
      "â€œ":"“",
      "â€":"”",
      "â€˜":"‘",
      "â€™":"’"
    };

    Object.keys(replacements).forEach(function(bad){
      value = value.split(bad).join(replacements[bad]);
    });

    return value;
  }

  function cleanCell(value){
    value = repairMojibake(value);
    return text(value)
      .replace(/\s*\n+\s*/g, " ")
      .replace(/\t+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function uniqueHeader(header, used, index){
    header = cleanCell(header) || ("Columna" + (index + 1));

    var base = header;
    var count = 2;

    while(used[normalizeKey(header)]){
      header = base + "_" + count;
      count += 1;
    }

    used[normalizeKey(header)] = true;
    return header;
  }

  function cellsOf(row){
    return Array.prototype.slice.call(row.querySelectorAll("th,td")).map(function(cell){
      return cleanCell(cell.textContent || "");
    });
  }

  function tableScore(table){
    var rows = Array.prototype.slice.call(table.querySelectorAll("tr"));
    var score = rows.length * 10;

    rows.slice(0, 5).forEach(function(row){
      var cells = row.querySelectorAll("th,td").length;
      score += cells;
    });

    if(table.querySelector("th")){
      score += 30;
    }

    var txt = (table.textContent || "").toLowerCase();
    ["numeroidentificacion", "nombres", "codigocarrera", "nombrecarrera", "academico", "financiero"].forEach(function(key){
      if(normalizeKey(txt).indexOf(key) >= 0){
        score += 25;
      }
    });

    return score;
  }

  function bestTable(doc){
    var tables = Array.prototype.slice.call(doc.querySelectorAll("table"));
    if(!tables.length){ return null; }

    tables.sort(function(a, b){
      return tableScore(b) - tableScore(a);
    });

    return tables[0];
  }

  function headerRowIndex(rows){
    for(var i = 0; i < Math.min(rows.length, 12); i += 1){
      var values = cellsOf(rows[i]);
      var joined = normalizeKey(values.join(" "));

      if(
        joined.indexOf("numeroidentificacion") >= 0 ||
        joined.indexOf("nombres") >= 0 && joined.indexOf("nombrecarrera") >= 0 ||
        joined.indexOf("codigocarrera") >= 0 && joined.indexOf("nombrecarrera") >= 0
      ){
        return i;
      }
    }

    for(var j = 0; j < Math.min(rows.length, 8); j += 1){
      if(rows[j].querySelector("th")){
        return j;
      }
    }

    return 0;
  }

  function parseTable(table){
    var trs = Array.prototype.slice.call(table.querySelectorAll("tr")).filter(function(row){
      return cellsOf(row).some(function(value){ return text(value) !== ""; });
    });

    if(!trs.length){
      return [];
    }

    var hIndex = headerRowIndex(trs);
    var rawHeaders = cellsOf(trs[hIndex]);
    var used = {};
    var headers = rawHeaders.map(function(header, index){
      return uniqueHeader(header, used, index);
    });

    var rows = [];

    trs.slice(hIndex + 1).forEach(function(tr){
      var values = cellsOf(tr);

      if(!values.some(function(value){ return text(value) !== ""; })){
        return;
      }

      var row = {};

      headers.forEach(function(header, index){
        row[header] = values[index] == null ? "" : cleanCell(values[index]);
      });

      rows.push(row);
    });

    return rows;
  }

  function parseWithDOM(source){
    var parser = new DOMParser();
    var doc = parser.parseFromString(String(source || ""), "text/html");

    Array.prototype.slice.call(doc.querySelectorAll("script,style,noscript")).forEach(function(node){
      if(node.parentNode){
        node.parentNode.removeChild(node);
      }
    });

    var table = bestTable(doc);
    if(!table){
      return [];
    }

    return parseTable(table);
  }

  function splitLine(line, delimiter){
    var values = [];
    var current = "";
    var quoted = false;

    for(var i = 0; i < line.length; i += 1){
      var ch = line.charAt(i);

      if(ch === '"'){
        quoted = !quoted;
      }else if(ch === delimiter && !quoted){
        values.push(cleanCell(current));
        current = "";
      }else{
        current += ch;
      }
    }

    values.push(cleanCell(current));
    return values;
  }

  function detectDelimiter(source){
    var first = String(source || "").split(/\r?\n/).filter(function(line){
      return text(line);
    })[0] || "";

    var tabs = (first.match(/\t/g) || []).length;
    var semis = (first.match(/;/g) || []).length;
    var commas = (first.match(/,/g) || []).length;

    if(tabs >= semis && tabs >= commas){ return "\t"; }
    return semis > commas ? ";" : ",";
  }

  function parseFallbackText(source){
    var delimiter = detectDelimiter(source);
    var lines = String(source || "")
      .split(/\r?\n/)
      .map(cleanCell)
      .filter(Boolean);

    if(!lines.length){
      return [];
    }

    var headers = splitLine(lines[0], delimiter);
    var used = {};
    headers = headers.map(function(header, index){
      return uniqueHeader(header, used, index);
    });

    return lines.slice(1).map(function(line){
      var values = splitLine(line, delimiter);
      var row = {};

      headers.forEach(function(header, index){
        row[header] = values[index] == null ? "" : cleanCell(values[index]);
      });

      return row;
    });
  }

  function rowQuality(row){
    row = row || {};
    var keys = Object.keys(row);
    var filled = keys.filter(function(key){
      return text(row[key]) !== "";
    }).length;

    var known = keys.filter(function(key){
      var k = normalizeKey(key);
      return [
        "numeroidentificacion",
        "nombres",
        "codigocarrera",
        "nombrecarrera",
        "horariocomplexivo",
        "academico",
        "documentacion",
        "financiero"
      ].indexOf(k) >= 0;
    }).length;

    return filled + (known * 5);
  }

  function cleanupRows(rows){
    rows = Array.isArray(rows) ? rows : [];

    return rows.filter(function(row){
      return rowQuality(row) > 1;
    }).map(function(row){
      var clean = {};

      Object.keys(row || {}).forEach(function(key){
        var cleanKey = cleanCell(key);
        if(!cleanKey){ return; }
        clean[cleanKey] = cleanCell(row[key]);
      });

      return clean;
    });
  }

  function parse(source, options){
    options = options || {};
    source = String(source || "");

    var warnings = [];

    if(source.indexOf("\uFFFD") >= 0){
      warnings.push({
        tipo: "CARACTERES_DANADOS",
        mensaje: "El HTML contiene caracteres dañados. Se intentó limpiar el texto, pero revise tildes y ñ."
      });
    }

    var rows = [];

    try{
      rows = parseWithDOM(source);
    }catch(error){
      warnings.push({
        tipo: "HTML_DOM_ERROR",
        mensaje: "No se pudo leer la tabla HTML con DOMParser. Se intentó lectura por texto."
      });
    }

    if(!rows.length){
      rows = parseFallbackText(source);
      if(rows.length){
        warnings.push({
          tipo: "HTML_FALLBACK_TEXTO",
          mensaje: "El HTML se leyó mediante separadores de texto porque no se encontró una tabla clara."
        });
      }
    }

    rows = cleanupRows(rows);

    return {
      rows: rows,
      fileName: options.fileName || "archivo.html",
      origen: "html",
      detectedType: "html",
      encoding: options.encoding || "",
      warnings: warnings
    };
  }

  function isHtml(source){
    source = String(source || "").slice(0, 5000).toLowerCase();

    return (
      source.indexOf("<html") >= 0 ||
      source.indexOf("<table") >= 0 ||
      source.indexOf("<tr") >= 0 && source.indexOf("<td") >= 0 ||
      source.indexOf("urn:schemas-microsoft-com:office:excel") >= 0 ||
      source.indexOf("mso-") >= 0 && source.indexOf("<td") >= 0
    );
  }

  window.CargaReaderHTML = {
    parse: parse,
    isHtml: isHtml,
    helpers: {
      cleanCell: cleanCell,
      repairMojibake: repairMojibake,
      normalizeKey: normalizeKey,
      parseTable: parseTable,
      parseFallbackText: parseFallbackText
    }
  };
})(window);