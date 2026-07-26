(function(window){
  "use strict";

  function text(value){return String(value==null?"":value).trim();}
  function jsonRows(raw){
    var parsed=JSON.parse(raw);
    if(Array.isArray(parsed)){return parsed;}
    if(parsed&&Array.isArray(parsed.rows)){return parsed.rows;}
    if(parsed&&Array.isArray(parsed.estudiantes)){return parsed.estudiantes;}
    if(parsed&&parsed.tables&&Array.isArray(parsed.tables.estudiantes)){return parsed.tables.estudiantes;}
    return parsed&&typeof parsed==="object"?[parsed]:[];
  }
  function parse(value){
    var raw=text(value);
    if(!raw){return [];}
    if(raw.charAt(0)==="["||raw.charAt(0)==="{"){
      try{return jsonRows(raw);}catch(error){}
    }
    if(window.CargaReaderCSV){return window.CargaReaderCSV.parse(raw);}
    return raw.split(/\r?\n/).filter(Boolean).map(function(line){return {texto:line};});
  }
  function parseAsync(value){
    var raw=text(value);
    if(!raw){return Promise.resolve([]);}
    if(raw.charAt(0)==="["||raw.charAt(0)==="{"){
      return new Promise(function(resolve,reject){
        window.setTimeout(function(){try{resolve(jsonRows(raw));}catch(error){reject(error);}},0);
      });
    }
    if(window.CargaReaderCSV&&typeof window.CargaReaderCSV.parseAsync==="function"){return window.CargaReaderCSV.parseAsync(raw);}
    return Promise.resolve(parse(raw));
  }

  window.CargaReaderTXT={version:"2.0.0-full-async",parse:parse,parseAsync:parseAsync};
})(window);
