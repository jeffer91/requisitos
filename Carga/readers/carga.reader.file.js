/* =========================================================
Nombre completo: carga.reader.file.js
Ruta o ubicación: /Carga/readers/carga.reader.file.js
Función:
- Detectar el formato usando una muestra pequeña antes de leer todo.
- Enviar Excel real directamente a SheetJS sin decodificar el binario completo.
- Leer CSV, TXT, JSON y HTML completos con progreso.
- Reutilizar filas ya seguras para reducir memoria en archivos grandes.
========================================================= */
(function(window){
  "use strict";

  var VERSION="4.1.0-fast-full-reader";
  var PROBE_BYTES=16384;

  function text(value){return String(value==null?"":value).trim();}
  function lower(value){return text(value).toLowerCase();}
  function emit(percent,message,phase){
    try{window.dispatchEvent(new CustomEvent("carga:progress",{detail:{percent:Math.max(0,Math.min(100,Number(percent)||0)),message:message||"Leyendo archivo",phase:phase||"reading"}}));}catch(error){}
  }
  function extOf(file){var match=lower(file&&file.name).match(/\.([a-z0-9]+)$/);return match?match[1]:"";}
  function readBuffer(blob,progress){
    return new Promise(function(resolve,reject){
      var reader=new FileReader();
      reader.onprogress=function(event){if(progress&&event.lengthComputable){progress(event.loaded,event.total);}};
      reader.onload=function(){resolve(reader.result);};
      reader.onerror=function(){reject(reader.error||new Error("No se pudo leer el archivo."));};
      reader.readAsArrayBuffer(blob);
    });
  }
  function probe(file){return readBuffer(file.slice(0,Math.min(Number(file.size||0),PROBE_BYTES)));}
  function readAll(file){return readBuffer(file,function(loaded,total){emit(5+(loaded/Math.max(1,total))*40,"Leyendo archivo: "+Math.round(loaded/1048576)+" MB","reading");});}
  function decode(buffer,encoding){try{return new TextDecoder(encoding||"utf-8").decode(buffer);}catch(error){return new TextDecoder("utf-8").decode(buffer);}}
  function countMatches(source,regex){var match=String(source||"").match(regex);return match?match.length:0;}
  function decodeScore(value){var sample=String(value||"").slice(0,131072);return countMatches(sample,/\uFFFD/g)*1000+countMatches(sample,/Ã.|Â.|â.|�/g)*80-countMatches(sample,/[áéíóúÁÉÍÓÚñÑüÜ]/g)*4;}
  function bestDecodedText(buffer){
    var utf=decode(buffer,"utf-8"),best={text:utf,encoding:"UTF-8",score:decodeScore(utf)};
    if(best.score<=0){return best;}
    [{encoding:"windows-1252",label:"Windows-1252"},{encoding:"iso-8859-1",label:"ISO-8859-1"}].forEach(function(item){var value=decode(buffer,item.encoding),score=decodeScore(value);if(score<best.score){best={text:value,encoding:item.label,score:score};}});
    return best;
  }
  function bytes(buffer){return new Uint8Array(buffer||new ArrayBuffer(0));}
  function isZipXlsx(buffer){var b=bytes(buffer);return b.length>=2&&b[0]===0x50&&b[1]===0x4B;}
  function isOleXls(buffer){var b=bytes(buffer);return b.length>=8&&b[0]===0xD0&&b[1]===0xCF&&b[2]===0x11&&b[3]===0xE0&&b[4]===0xA1&&b[5]===0xB1&&b[6]===0x1A&&b[7]===0xE1;}
  function looksLikeHtml(source){source=String(source||"").slice(0,12000).toLowerCase();return source.indexOf("<!doctype html")>=0||source.indexOf("<html")>=0||source.indexOf("<table")>=0||source.indexOf("urn:schemas-microsoft-com:office:excel")>=0||source.indexOf("mso-")>=0&&source.indexOf("<td")>=0;}
  function looksLikeJson(source){source=text(source);return source.charAt(0)==="{"||source.charAt(0)==="[";}
  function safeKey(key){var lowerKey=String(key).trim().toLowerCase();return lowerKey!=="__proto__"&&lowerKey!=="prototype"&&lowerKey!=="constructor";}
  function alreadySafeRow(input){
    if(!input||typeof input!=="object"||Array.isArray(input)||Object.getPrototypeOf(input)!==null){return false;}
    return Object.keys(input).every(safeKey);
  }
  function safeRows(rows){
    return (Array.isArray(rows)?rows:[]).map(function(input){
      if(alreadySafeRow(input)){return input;}
      var row=Object.create(null);
      Object.keys(input||{}).forEach(function(key){if(safeKey(key)){row[String(key).trim()]=input[key];}});
      return row;
    });
  }
  function jsonRows(data){if(Array.isArray(data)){return data;}if(data&&Array.isArray(data.rows)){return data.rows;}if(data&&Array.isArray(data.estudiantes)){return data.estudiantes;}if(data&&data.tables&&Array.isArray(data.tables.estudiantes)){return data.tables.estudiantes;}return [];}
  function parseJson(source,fileName){emit(60,"Interpretando JSON...","reading");var rows=safeRows(jsonRows(JSON.parse(source)));emit(90,"JSON leído: "+rows.length+" filas","reading");return {rows:rows,fileName:fileName,origen:"json",detectedType:"json",warnings:rows.length?[]:[{tipo:"JSON_SIN_FILAS",mensaje:"El JSON no contiene filas reconocibles."}]};}
  function parseText(source,fileName,type,encoding,warnings){
    warnings=Array.isArray(warnings)?warnings:[];var reader=window.CargaReaderTXT;
    var task=reader&&typeof reader.parseAsync==="function"?reader.parseAsync(source||""):Promise.resolve(reader&&typeof reader.parse==="function"?reader.parse(source||""):[]);
    return task.then(function(rows){return {rows:safeRows(rows),fileName:fileName,origen:"archivo",detectedType:type||"txt",encoding:encoding||"",warnings:warnings};});
  }
  function parseCsv(source,fileName,encoding,warnings){
    warnings=Array.isArray(warnings)?warnings:[];var reader=window.CargaReaderCSV;
    var task=reader&&typeof reader.parseAsync==="function"?reader.parseAsync(source||""):Promise.resolve(reader&&typeof reader.parse==="function"?reader.parse(source||""):[]);
    return task.then(function(rows){return {rows:safeRows(rows),fileName:fileName,origen:"archivo",detectedType:"csv",encoding:encoding||"",warnings:warnings};});
  }
  function parseHtml(source,fileName,encoding,warnings){
    warnings=Array.isArray(warnings)?warnings:[];
    if(!window.CargaReaderHTML||typeof window.CargaReaderHTML.parse!=="function"){return Promise.reject(new Error("CargaReaderHTML no está disponible."));}
    emit(58,"Interpretando tabla HTML...","reading");
    return new Promise(function(resolve,reject){window.setTimeout(function(){try{var result=window.CargaReaderHTML.parse(source||"",{fileName:fileName,encoding:encoding||""})||{};result.rows=safeRows(result.rows);result.fileName=fileName;result.origen="html";result.detectedType="html";result.encoding=encoding||"";result.warnings=warnings.concat(result.warnings||[]);emit(90,"HTML leído: "+result.rows.length+" filas","reading");resolve(result);}catch(error){reject(error);}},0);});
  }
  function readTextFile(file,type,extraWarnings){
    return readAll(file).then(function(buffer){
      var decoded=bestDecodedText(buffer),source=decoded.text||"",warnings=Array.isArray(extraWarnings)?extraWarnings.slice():[];
      if(source.indexOf("\uFFFD")>=0){warnings.push({tipo:"ENCODING_REPARADO",mensaje:"El archivo tenía caracteres dañados. Se intentó reparar la lectura usando "+decoded.encoding+"."});}
      if(type==="html"||looksLikeHtml(source)){return parseHtml(source,file.name||"archivo",decoded.encoding,warnings);}
      if(type==="json"||looksLikeJson(source)){try{return Promise.resolve(parseJson(source,file.name||"archivo"));}catch(error){warnings.push({tipo:"JSON_INVALIDO",mensaje:"El archivo parecía JSON, pero no pudo interpretarse."});}}
      if(type==="csv"){return parseCsv(source,file.name||"archivo",decoded.encoding,warnings);}
      return parseText(source,file.name||"archivo",type||"txt",decoded.encoding,warnings);
    });
  }
  function readExcel(file){
    if(!window.CargaReaderXLSX||typeof window.CargaReaderXLSX.read!=="function"){return Promise.reject(new Error("CargaReaderXLSX no está disponible."));}
    return window.CargaReaderXLSX.read(file).then(function(result){result=result||{};result.origen=result.origen||"archivo";result.detectedType=result.detectedType||"xlsx";result.warnings=Array.isArray(result.warnings)?result.warnings:[];return result;});
  }
  function read(file){
    if(!file){return Promise.reject(new Error("Seleccione un archivo."));}
    var ext=extOf(file),fileName=file.name||"archivo";emit(1,"Detectando formato de "+fileName+"...","reading");
    return probe(file).then(function(sampleBuffer){
      var sampleDecoded=bestDecodedText(sampleBuffer),sampleText=sampleDecoded.text||"";
      if((ext==="xls"||ext==="xlsx")&&looksLikeHtml(sampleText)){return readTextFile(file,"html",[{tipo:"XLS_HTML_DETECTADO",mensaje:"El archivo parece ser XLS antiguo guardado como HTML. Se leyó como tabla HTML."}]);}
      if(ext==="xlsx"||ext==="xls"||isZipXlsx(sampleBuffer)||isOleXls(sampleBuffer)){return readExcel(file).catch(function(error){return readTextFile(file,ext||"txt",[{tipo:"XLSX_FALLBACK_TEXTO",mensaje:"No se pudo leer como Excel normal. Se intentó como texto. Detalle: "+(error.message||error)}]);});}
      if(ext==="html"||ext==="htm"||looksLikeHtml(sampleText)){return readTextFile(file,"html");}
      if(ext==="json"){return readTextFile(file,"json");}
      if(ext==="csv"){return readTextFile(file,"csv");}
      return readTextFile(file,ext||"txt");
    }).then(function(result){emit(100,"Archivo leído completamente","reading");return result;});
  }

  window.CargaReaderFile={version:VERSION,read:read,helpers:{extOf:extOf,bestDecodedText:bestDecodedText,looksLikeHtml:looksLikeHtml,isZipXlsx:isZipXlsx,isOleXls:isOleXls,alreadySafeRow:alreadySafeRow}};
})(window);