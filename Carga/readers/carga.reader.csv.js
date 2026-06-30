(function(window){
  "use strict";

  function detectDelimiter(text){
    var first = String(text || "").split(/\r?\n/).find(function(x){ return x.trim(); }) || "";
    var semis = (first.match(/;/g) || []).length;
    var commas = (first.match(/,/g) || []).length;
    var tabs = (first.match(/\t/g) || []).length;
    if(tabs >= semis && tabs >= commas){ return "\t"; }
    return semis > commas ? ";" : ",";
  }

  function splitLine(line, delimiter){
    var values = [];
    var current = "";
    var quoted = false;
    for(var i = 0; i < line.length; i += 1){
      var ch = line.charAt(i);
      if(ch === String.fromCharCode(34)){
        quoted = !quoted;
      }else if(ch === delimiter && !quoted){
        values.push(current.trim());
        current = "";
      }else{
        current += ch;
      }
    }
    values.push(current.trim());
    return values;
  }

  function parse(text){
    var delimiter = detectDelimiter(text);
    var lines = String(text || "").split(/\r?\n/).filter(function(line){ return line.trim(); });
    if(!lines.length){ return []; }
    var headers = splitLine(lines[0], delimiter);
    return lines.slice(1).map(function(line){
      var values = splitLine(line, delimiter);
      var row = {};
      headers.forEach(function(header, index){ row[header] = values[index] == null ? "" : values[index]; });
      return row;
    });
  }

  window.CargaReaderCSV = { parse: parse, detectDelimiter: detectDelimiter };
})(window);
