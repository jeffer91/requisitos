(function(window){
  "use strict";

  function parse(text){
    var raw = String(text || "").trim();
    if(!raw){ return []; }
    if(raw.charAt(0) === "[" || raw.charAt(0) === "{"){
      try{
        var parsed = JSON.parse(raw);
        if(Array.isArray(parsed)){ return parsed; }
        if(parsed && Array.isArray(parsed.rows)){ return parsed.rows; }
        return [parsed];
      }catch(error){}
    }
    if(window.CargaReaderCSV){ return window.CargaReaderCSV.parse(raw); }
    return raw.split(/\r?\n/).filter(Boolean).map(function(line){ return { texto: line }; });
  }

  window.CargaReaderTXT = { parse: parse };
})(window);
