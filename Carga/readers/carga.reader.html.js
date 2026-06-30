/* =========================================================
Nombre completo: carga.reader.html.js
Ruta: /Carga/readers/carga.reader.html.js
Función:
- Leer archivos HTML exportados como Excel viejo.
- Convertir la tabla principal HTML en filas JSON.
========================================================= */
(function(window){
  "use strict";

  function looksHtml(text){
    text = String(text || "").trim().slice(0, 1000).toLowerCase();
    return text.indexOf("<html") >= 0 || text.indexOf("<table") >= 0 || text.indexOf("<tr") >= 0 || text.indexOf("<!doctype") >= 0;
  }

  function cellText(cell){
    return String(cell ? (cell.textContent || cell.innerText || "") : "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeHeader(value, index){
    value = String(value || "").replace(/\s+/g, " ").trim();
    return value || ("Columna " + (index + 1));
  }

  function tableToRows(table){
    var trs = Array.prototype.slice.call(table.querySelectorAll("tr"));
    var matrix = trs.map(function(tr){ return Array.prototype.slice.call(tr.children).map(cellText); }).filter(function(row){ return row.some(function(v){ return v !== ""; }); });
    if(!matrix.length){ return []; }

    var headerIndex = 0;
    for(var i = 0; i < Math.min(matrix.length, 8); i += 1){
      var filled = matrix[i].filter(function(v){ return v !== ""; }).length;
      if(filled >= 3){ headerIndex = i; break; }
    }

    var headers = matrix[headerIndex].map(normalizeHeader);
    var used = {};
    headers = headers.map(function(h){
      var base = h;
      var n = 1;
      while(used[h]){ n += 1; h = base + " " + n; }
      used[h] = true;
      return h;
    });

    return matrix.slice(headerIndex + 1).map(function(row){
      var obj = {};
      headers.forEach(function(h, idx){ obj[h] = row[idx] == null ? "" : row[idx]; });
      return obj;
    }).filter(function(row){ return Object.keys(row).some(function(k){ return String(row[k] || "").trim() !== ""; }); });
  }

  function parse(text){
    if(!looksHtml(text)){ return []; }
    var parser = new DOMParser();
    var doc = parser.parseFromString(String(text || ""), "text/html");
    var tables = Array.prototype.slice.call(doc.querySelectorAll("table"));
    if(!tables.length){ return []; }
    tables.sort(function(a,b){ return b.querySelectorAll("tr").length - a.querySelectorAll("tr").length; });
    return tableToRows(tables[0]);
  }

  window.CargaReaderHTML = {
    looksHtml: looksHtml,
    parse: parse
  };
})(window);