/* =========================================================
Nombre completo: cronograma.parser.js
Ruta o ubicación: /Requisitos/Infor/sections/cronograma/cronograma.parser.js
Función o funciones:
- Interpretar cronogramas pegados por el usuario desde la carpeta definitiva /Requisitos/Infor.
- Convertir texto libre o texto tipo tabla en filas institucionales.
- Extraer columnas: fecha, actividad, responsable y observación.
- Ignorar líneas vacías o encabezados repetidos.
Con qué se conecta:
- ../../core/infor.state.js
- ../../frontend/titulacion.app.js
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();}

  var DATE_PATTERNS = [
    /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.](?:\d{2}|\d{4})\b/,
    /\b\d{1,2}\s+de\s+[a-záéíóúñ]+(?:\s+de\s+\d{4})?\b/i,
    /\b(?:lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\s+\d{1,2}\s+de\s+[a-záéíóúñ]+\b/i,
    /\b(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+\d{1,2}\b/i
  ];

  var HEADER_WORDS = ["fecha", "actividad", "responsable", "observacion", "observación", "cronograma", "nro", "no.", "numero", "número"];

  function isHeader(line){
    var n = norm(line);
    if(!n){return true;}
    var hits = HEADER_WORDS.filter(function(word){return n.indexOf(norm(word)) >= 0;}).length;
    return hits >= 2 && n.length < 120;
  }

  function splitColumns(line){
    var raw = text(line);
    if(raw.indexOf("\t") >= 0){return raw.split(/\t+/).map(text).filter(Boolean);}
    if(raw.indexOf("|") >= 0){return raw.split(/\|+/).map(text).filter(Boolean);}
    if(raw.indexOf(";") >= 0){return raw.split(/;+/).map(text).filter(Boolean);}
    if(raw.indexOf(",") >= 0 && raw.split(",").length >= 4){return raw.split(/,+/).map(text).filter(Boolean);}
    var spaces = raw.split(/\s{3,}/).map(text).filter(Boolean);
    if(spaces.length >= 3){return spaces;}
    return [raw];
  }

  function extractDate(line){
    var raw = text(line);
    for(var i = 0; i < DATE_PATTERNS.length; i += 1){
      var match = raw.match(DATE_PATTERNS[i]);
      if(match){return text(match[0]);}
    }
    return "";
  }

  function removeDate(line, date){
    if(!date){return text(line);}
    return text(line).replace(date, "").replace(/^[-–—:|;,.\s]+/, "").trim();
  }

  function cleanLabel(value){
    return text(value).replace(/^(fecha|actividad|responsable|observaci[oó]n)\s*[:\-]\s*/i, "").trim();
  }

  function findLabeled(line, label){
    var raw = text(line);
    var regex = new RegExp(label + "\\s*[:\\-]\\s*([^|;]+)", "i");
    var match = raw.match(regex);
    return match ? text(match[1]) : "";
  }

  function rowFromColumns(cols, line){
    cols = (cols || []).map(cleanLabel).filter(Boolean);
    var fecha = "", actividad = "", responsable = "", observacion = "";

    if(cols.length >= 4){
      fecha = extractDate(cols[0]) || cols[0];
      actividad = cols[1];
      responsable = cols[2];
      observacion = cols.slice(3).join(" | ");
      return normalizeRow({fecha:fecha, actividad:actividad, responsable:responsable, observacion:observacion, source:line, method:"columns"});
    }

    if(cols.length === 3){
      fecha = extractDate(cols[0]) || cols[0];
      actividad = cols[1];
      responsable = cols[2];
      return normalizeRow({fecha:fecha, actividad:actividad, responsable:responsable, observacion:"", source:line, method:"columns3"});
    }

    fecha = extractDate(line);
    var body = removeDate(line, fecha);
    responsable = findLabeled(line, "responsable");
    observacion = findLabeled(line, "observaci[oó]n");
    actividad = findLabeled(line, "actividad") || body;

    if(responsable){actividad = actividad.replace(/responsable\s*[:\-]\s*[^|;]+/i, "").trim();}
    if(observacion){actividad = actividad.replace(/observaci[oó]n\s*[:\-]\s*[^|;]+/i, "").trim();}

    return normalizeRow({fecha:fecha, actividad:actividad, responsable:responsable, observacion:observacion, source:line, method:"free"});
  }

  function normalizeRow(row){
    row = row || {};
    return {
      fecha:text(row.fecha),
      actividad:text(row.actividad),
      responsable:text(row.responsable),
      observacion:text(row.observacion),
      source:text(row.source),
      method:text(row.method),
      ok:!!(text(row.fecha) || text(row.actividad))
    };
  }

  function parse(rawText){
    var source = text(rawText);
    var lines = source.split(/\r?\n/).map(text).filter(Boolean);
    var rows = [];
    var ignored = [];

    lines.forEach(function(line, index){
      if(isHeader(line)){
        ignored.push({line:index + 1, text:line, reason:"encabezado_o_vacio"});
        return;
      }
      var cols = splitColumns(line);
      var row = rowFromColumns(cols, line);
      if(row.ok){rows.push(row);}else{ignored.push({line:index + 1, text:line, reason:"no_interpretable"});}
    });

    return {
      ok:rows.length > 0,
      totalLines:lines.length,
      rows:rows,
      ignored:ignored,
      columns:["fecha", "actividad", "responsable", "observacion"],
      generatedAt:new Date().toISOString()
    };
  }

  function parseMany(cronogramas){
    cronogramas = cronogramas || {};
    return {
      complexivo:parse(cronogramas.complexivo || ""),
      trabajoTitulacion:parse(cronogramas.trabajoTitulacion || ""),
      pvc:parse(cronogramas.pvc || "")
    };
  }

  window.InforCronogramaParser = {
    parse:parse,
    parseMany:parseMany,
    extractDate:extractDate,
    splitColumns:splitColumns
  };
})(window);
