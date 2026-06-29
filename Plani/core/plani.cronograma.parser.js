/* =========================================================
Nombre completo: plani.cronograma.parser.js
Ruta o ubicacion: /Requisitos/Plani/core/plani.cronograma.parser.js
Funcion:
- Convertir cronogramas pegados o cargados en filas estructuradas.
- Detectar fechas, actividades, responsables y observaciones.
- Mantener la lectura del cronograma separada del motor documental.
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function clean(value){return text(value).replace(/\s+/g," ");}

  var DATE_PATTERNS = [
    /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/,
    /\b\d{1,2}\s+de\s+[a-záéíóúñ]+\s*(?:de\s*)?\d{0,4}\b/i,
    /\b(?:lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\s+\d{1,2}\b/i
  ];

  function looksHeader(line){
    var s = clean(line).toLowerCase();
    return s === "fecha actividad responsable observacion" || s.indexOf("cronograma") === 0 || (s.indexOf("fecha") >= 0 && s.indexOf("actividad") >= 0);
  }

  function splitLine(line){
    line = text(line);
    if(line.indexOf("\t") >= 0){return line.split("\t").map(clean).filter(Boolean);}
    if(line.indexOf("|") >= 0){return line.split("|").map(clean).filter(Boolean);}
    if(line.indexOf(";") >= 0){return line.split(";").map(clean).filter(Boolean);}
    var wide = line.split(/\s{2,}/).map(clean).filter(Boolean);
    if(wide.length > 1){return wide;}
    return [clean(line)];
  }

  function findDate(line){
    var value = text(line);
    for(var i = 0; i < DATE_PATTERNS.length; i += 1){
      var m = value.match(DATE_PATTERNS[i]);
      if(m){return clean(m[0]);}
    }
    return "";
  }

  function parseLine(line, index){
    var parts = splitLine(line);
    var date = parts.length > 1 ? parts[0] : findDate(line);
    var activity = "";
    var responsible = "";
    var observation = "";

    if(parts.length >= 4){
      date = parts[0]; activity = parts[1]; responsible = parts[2]; observation = parts.slice(3).join(" ");
    }else if(parts.length === 3){
      date = parts[0]; activity = parts[1]; responsible = parts[2];
    }else if(parts.length === 2){
      date = parts[0]; activity = parts[1];
    }else{
      activity = clean(line.replace(date, "")) || clean(line);
    }

    return {
      id:"cronograma-" + (index + 1),
      order:index + 1,
      fecha:clean(date),
      actividad:clean(activity),
      responsable:clean(responsible),
      observacion:clean(observation),
      raw:line
    };
  }

  function parse(raw){
    var lines = text(raw).split(/\r?\n/).map(clean).filter(Boolean).filter(function(line){return !looksHeader(line);});
    var rows = lines.map(parseLine).filter(function(row){return row.fecha || row.actividad;});
    return {
      ok:rows.length > 0,
      total:rows.length,
      rows:rows,
      generatedAt:new Date().toISOString()
    };
  }

  window.PlaniCronogramaParser = {parse:parse, splitLine:splitLine, findDate:findDate};
})(window);
