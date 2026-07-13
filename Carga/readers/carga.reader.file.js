/* =========================================================
Nombre completo: carga.reader.file.js
Ruta o ubicación: /Requisitos/Carga/readers/carga.reader.file.js
Función:
- Leer archivos cargados en Carga.
- Detectar XLS viejo guardado como HTML.
- Reparar lectura de tildes/ñ usando varios encodings.
- Enviar XLSX/XLS real al lector XLSX cuando corresponde.
- Enviar HTML disfrazado de XLS al lector HTML.
========================================================= */
(function(window){
  "use strict";

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function lower(value){
    return text(value).toLowerCase();
  }

  function extOf(file){
    var name = lower(file && file.name);
    var match = name.match(/\.([a-z0-9]+)$/);
    return match ? match[1] : "";
  }

  function readArrayBuffer(file){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();

      reader.onload = function(){
        resolve(reader.result);
      };

      reader.onerror = function(){
        reject(reader.error || new Error("No se pudo leer el archivo."));
      };

      reader.readAsArrayBuffer(file);
    });
  }

  function decode(buffer, encoding){
    try{
      return new TextDecoder(encoding || "utf-8").decode(buffer);
    }catch(error){
      try{
        return new TextDecoder("utf-8").decode(buffer);
      }catch(error2){
        return "";
      }
    }
  }

  function countMatches(source, regex){
    var match = String(source || "").match(regex);
    return match ? match.length : 0;
  }

  function decodeScore(value){
    value = String(value || "");

    var replacement = countMatches(value, /\uFFFD/g);
    var mojibake = countMatches(value, /Ã.|Â.|â.|�/g);
    var letters = countMatches(value, /[áéíóúÁÉÍÓÚñÑüÜ]/g);
    var htmlHints = countMatches(value, /<table|<html|<meta|<tr|<td|charset|mso-|excel/gi);

    return (replacement * 1000) + (mojibake * 80) - (letters * 4) - (htmlHints * 2);
  }

  function bestDecodedText(buffer){
    var options = [
      { encoding:"utf-8", label:"UTF-8" },
      { encoding:"windows-1252", label:"Windows-1252" },
      { encoding:"iso-8859-1", label:"ISO-8859-1" }
    ];

    var best = null;

    options.forEach(function(item){
      var value = decode(buffer, item.encoding);
      var score = decodeScore(value);

      if(!best || score < best.score){
        best = {
          text: value,
          encoding: item.label,
          score: score
        };
      }
    });

    return best || { text:"", encoding:"UTF-8", score:0 };
  }

  function bytesStart(buffer, max){
    var bytes = new Uint8Array(buffer || new ArrayBuffer(0));
    var limit = Math.min(bytes.length, max || 256);
    var out = "";

    for(var i = 0; i < limit; i += 1){
      out += String.fromCharCode(bytes[i]);
    }

    return out;
  }

  function isZipXlsx(buffer){
    var bytes = new Uint8Array(buffer || new ArrayBuffer(0));
    return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4B;
  }

  function looksLikeHtml(source){
    source = String(source || "").slice(0, 8000).toLowerCase();

    return (
      source.indexOf("<!doctype html") >= 0 ||
      source.indexOf("<html") >= 0 ||
      source.indexOf("<table") >= 0 ||
      source.indexOf("<meta") >= 0 && source.indexOf("<tr") >= 0 ||
      source.indexOf("urn:schemas-microsoft-com:office:excel") >= 0 ||
      source.indexOf("mso-") >= 0 && source.indexOf("<td") >= 0
    );
  }

  function looksLikeJson(source){
    source = text(source);
    return source.charAt(0) === "{" || source.charAt(0) === "[";
  }

  function parseJson(source, fileName){
    var data = JSON.parse(source);
    var rows = [];

    if(Array.isArray(data)){
      rows = data;
    }else if(Array.isArray(data.rows)){
      rows = data.rows;
    }else if(Array.isArray(data.estudiantes)){
      rows = data.estudiantes;
    }else if(data.tables && Array.isArray(data.tables.estudiantes)){
      rows = data.tables.estudiantes;
    }

    return {
      rows: rows,
      fileName: fileName,
      origen: "json",
      detectedType: "json",
      warnings: rows.length ? [] : [{ tipo:"JSON_SIN_FILAS", mensaje:"El JSON no contiene filas reconocibles." }]
    };
  }

  function parseText(source, fileName, detectedType, encoding, warnings){
    warnings = Array.isArray(warnings) ? warnings : [];

    if(window.CargaReaderTXT && typeof window.CargaReaderTXT.parse === "function"){
      return {
        rows: window.CargaReaderTXT.parse(source || ""),
        fileName: fileName,
        origen: "archivo",
        detectedType: detectedType || "txt",
        encoding: encoding || "",
        warnings: warnings
      };
    }

    if(window.CargaReaderCSV && typeof window.CargaReaderCSV.parse === "function"){
      return {
        rows: window.CargaReaderCSV.parse(source || ""),
        fileName: fileName,
        origen: "archivo",
        detectedType: detectedType || "csv",
        encoding: encoding || "",
        warnings: warnings
      };
    }

    return {
      rows: [],
      fileName: fileName,
      origen: "archivo",
      detectedType: detectedType || "txt",
      encoding: encoding || "",
      warnings: warnings.concat([{ tipo:"LECTOR_TEXTO_NO_DISPONIBLE", mensaje:"No hay lector TXT/CSV disponible." }])
    };
  }

  function parseCsv(source, fileName, encoding, warnings){
    warnings = Array.isArray(warnings) ? warnings : [];

    if(window.CargaReaderCSV && typeof window.CargaReaderCSV.parse === "function"){
      return {
        rows: window.CargaReaderCSV.parse(source || ""),
        fileName: fileName,
        origen: "archivo",
        detectedType: "csv",
        encoding: encoding || "",
        warnings: warnings
      };
    }

    return parseText(source, fileName, "csv", encoding, warnings);
  }

  function readWithXLSX(file){
    if(!window.CargaReaderXLSX || typeof window.CargaReaderXLSX.read !== "function"){
      return Promise.reject(new Error("CargaReaderXLSX no está disponible."));
    }

    return window.CargaReaderXLSX.read(file).then(function(result){
      result = result || {};
      result.origen = result.origen || "archivo";
      result.detectedType = result.detectedType || "xlsx";
      result.warnings = Array.isArray(result.warnings) ? result.warnings : [];
      return result;
    });
  }

  function readAsHtml(source, fileName, encoding, warnings){
    warnings = Array.isArray(warnings) ? warnings : [];

    if(!window.CargaReaderHTML || typeof window.CargaReaderHTML.parse !== "function"){
      return {
        rows: [],
        fileName: fileName,
        origen: "html",
        detectedType: "html",
        encoding: encoding || "",
        warnings: warnings.concat([{ tipo:"LECTOR_HTML_NO_DISPONIBLE", mensaje:"CargaReaderHTML no está disponible." }])
      };
    }

    var result = window.CargaReaderHTML.parse(source || "", {
      fileName: fileName,
      encoding: encoding || ""
    });

    result = result || {};
    result.rows = Array.isArray(result.rows) ? result.rows : [];
    result.fileName = fileName;
    result.origen = "html";
    result.detectedType = "html";
    result.encoding = encoding || "";
    result.warnings = warnings.concat(result.warnings || []);

    return result;
  }

  function read(file){
    if(!file){
      return Promise.reject(new Error("Seleccione un archivo."));
    }

    var fileName = file.name || "archivo";
    var ext = extOf(file);

    return readArrayBuffer(file).then(function(buffer){
      var decoded = bestDecodedText(buffer);
      var source = decoded.text || "";
      var warnings = [];

      if(source.indexOf("\uFFFD") >= 0){
        warnings.push({
          tipo: "ENCODING_REPARADO",
          mensaje: "El archivo tenía caracteres dañados. Se intentó reparar la lectura usando " + decoded.encoding + "."
        });
      }

      if((ext === "xls" || ext === "xlsx" || ext === "html" || ext === "htm") && looksLikeHtml(source)){
        warnings.push({
          tipo: "XLS_HTML_DETECTADO",
          mensaje: "El archivo parece ser XLS antiguo guardado como HTML. Se leyó como tabla HTML."
        });

        return readAsHtml(source, fileName, decoded.encoding, warnings);
      }

      if(ext === "html" || ext === "htm" || looksLikeHtml(source)){
        return readAsHtml(source, fileName, decoded.encoding, warnings);
      }

      if(ext === "json" || looksLikeJson(source)){
        try{
          return parseJson(source, fileName);
        }catch(error){
          warnings.push({
            tipo: "JSON_INVALIDO",
            mensaje: "El archivo parecía JSON, pero no pudo interpretarse."
          });
        }
      }

      if(ext === "xlsx" || ext === "xls" || isZipXlsx(buffer)){
        return readWithXLSX(file).catch(function(error){
          warnings.push({
            tipo: "XLSX_FALLBACK_TEXTO",
            mensaje: "No se pudo leer como Excel normal. Se intentará como texto/CSV. Detalle: " + (error.message || error)
          });

          return parseText(source, fileName, "texto_fallback", decoded.encoding, warnings);
        });
      }

      if(ext === "csv"){
        return parseCsv(source, fileName, decoded.encoding, warnings);
      }

      return parseText(source, fileName, ext || "txt", decoded.encoding, warnings);
    });
  }

  window.CargaReaderFile = {
    read: read,
    helpers: {
      extOf: extOf,
      bestDecodedText: bestDecodedText,
      looksLikeHtml: looksLikeHtml,
      isZipXlsx: isZipXlsx,
      bytesStart: bytesStart
    }
  };
})(window);