/* =========================================================
Nombre completo: infor.excel.js
Ruta o ubicación: /Requisitos/Titulacion/core/infor.excel.js
Función o funciones:
- Leer Excel/CSV cargado directamente desde Infor.
- Procesar varias hojas del archivo.
- Ignorar hojas vacías o sin registros de estudiantes.
- Normalizar encabezados y filas útiles para los siguientes bloques.
Con qué se conecta:
- Gestion/Excel/excel-xlsx-loader.js
- frontend/titulacion.app.js
- core/infor.state.js
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();}
  function compact(value){return norm(value).replace(/[^a-z0-9]/g, "");}

  var HEADER_HINTS = [
    "cedula", "identificacion", "estudiante", "nombre", "nombres", "apellido", "carrera", "programa",
    "titulo", "articulo", "trabajo", "tutor", "nota", "notafinal", "nfin", "nart", "ndef",
    "tribunal", "estado", "modalidad"
  ];

  function ensureXlsx(){
    if(window.ExcelXlsxLoader && typeof window.ExcelXlsxLoader.ensureXLSX === "function"){
      return window.ExcelXlsxLoader.ensureXLSX();
    }
    if(window.XLSX){return Promise.resolve(true);}
    return Promise.reject(new Error("XLSX no está disponible para leer el archivo."));
  }

  function rowValues(row){return Array.isArray(row) ? row.map(text) : [];}
  function nonEmptyCount(row){return rowValues(row).filter(Boolean).length;}

  function looksLikeHeader(row){
    var values = rowValues(row).map(compact).filter(Boolean);
    if(!values.length){return 0;}
    var hits = values.filter(function(value){
      return HEADER_HINTS.some(function(hint){return value.indexOf(hint) >= 0 || hint.indexOf(value) >= 0;});
    }).length;
    return hits;
  }

  function findHeaderIndex(rows){
    var best = {index:-1, score:0};
    rows.slice(0, 25).forEach(function(row, index){
      var score = looksLikeHeader(row);
      if(score > best.score){best = {index:index, score:score};}
    });
    return best.score >= 2 ? best.index : -1;
  }

  function uniqueHeaders(headerRow){
    var seen = Object.create(null);
    return rowValues(headerRow).map(function(value, index){
      var base = compact(value) || ("columna" + (index + 1));
      var key = base;
      var count = 2;
      while(seen[key]){key = base + count;count += 1;}
      seen[key] = true;
      return {key:key,label:text(value) || ("Columna " + (index + 1)),index:index};
    });
  }

  function cedulaLike(value){
    var digits = text(value).replace(/[^0-9]/g, "");
    return digits.length >= 8 && digits.length <= 13;
  }

  function hasNameLike(value){
    var raw = norm(value);
    if(raw.length < 8){return false;}
    var words = raw.split(/\s+/).filter(function(w){return w.length >= 3;});
    return words.length >= 2 && /[a-z]/.test(raw);
  }

  function likelyStudentObject(row){
    var keys = Object.keys(row || {});
    var joined = keys.map(function(k){return row[k];}).join(" ");
    var keyText = keys.join(" ");
    var hasId = keys.some(function(k){return compact(k).indexOf("cedula") >= 0 || compact(k).indexOf("identificacion") >= 0;}) || cedulaLike(joined);
    var hasName = keys.some(function(k){var c = compact(k);return c.indexOf("nombre") >= 0 || c.indexOf("estudiante") >= 0 || c.indexOf("apellido") >= 0;}) || hasNameLike(joined);
    var hasAcademic = /carrera|programa|nota|titulo|articulo|trabajo|tutor|tribunal|modalidad/i.test(keyText + " " + joined);
    return (hasId && hasName) || (hasName && hasAcademic);
  }

  function objectFromRow(headers, row){
    var obj = {};
    headers.forEach(function(header){
      var value = text(row[header.index]);
      if(value){obj[header.key] = value;}
    });
    return obj;
  }

  function rowsToObjects(rows, headerIndex){
    if(headerIndex < 0){return [];}
    var headers = uniqueHeaders(rows[headerIndex] || []);
    return rows.slice(headerIndex + 1).map(function(row, index){
      var obj = objectFromRow(headers, row || []);
      if(Object.keys(obj).length){obj._inforRowNumber = headerIndex + index + 2;}
      return obj;
    }).filter(function(obj){return Object.keys(obj).length > 1;});
  }

  function analyzeSheet(name, rows){
    rows = Array.isArray(rows) ? rows : [];
    var cleanRows = rows.filter(function(row){return nonEmptyCount(row) > 0;});
    if(!cleanRows.length){
      return {name:name,totalRows:0,headerIndex:-1,headers:[],rows:[],ignored:true,reason:"Hoja vacía"};
    }

    var headerIndex = findHeaderIndex(cleanRows);
    var headers = headerIndex >= 0 ? uniqueHeaders(cleanRows[headerIndex]) : [];
    var objects = rowsToObjects(cleanRows, headerIndex);
    var useful = objects.filter(likelyStudentObject);

    if(!useful.length){
      return {name:name,totalRows:cleanRows.length,headerIndex:headerIndex,headers:headers.map(function(h){return h.label;}),rows:[],ignored:true,reason:"Sin estudiantes detectados"};
    }

    return {
      name:name,
      totalRows:cleanRows.length,
      headerIndex:headerIndex,
      headers:headers.map(function(h){return h.label;}),
      rows:useful,
      ignored:false,
      reason:"",
      detectedStudents:useful.length
    };
  }

  async function readFile(file){
    if(!file){throw new Error("No se recibió archivo Excel.");}
    await ensureXlsx();
    var buffer = await file.arrayBuffer();
    var workbook = window.XLSX.read(buffer, {type:"array", cellDates:false});
    var sheetNames = workbook.SheetNames || [];
    var sheets = sheetNames.map(function(name){
      var rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[name], {header:1, raw:false, defval:""});
      return analyzeSheet(name, rows);
    });
    var useful = sheets.filter(function(sheet){return !sheet.ignored;});
    var ignored = sheets.filter(function(sheet){return sheet.ignored;});
    var rows = [];
    useful.forEach(function(sheet){
      (sheet.rows || []).forEach(function(row){
        var copy = Object.assign({_inforSheet:sheet.name}, row);
        rows.push(copy);
      });
    });
    return {
      fileName:file.name,
      size:file.size,
      type:file.type || "",
      loaded:true,
      sheetCount:sheetNames.length,
      usefulSheets:useful.length,
      ignoredSheets:ignored.length,
      totalRows:rows.length,
      sheets:sheets.map(function(sheet){
        return {
          name:sheet.name,
          totalRows:sheet.totalRows,
          detectedStudents:sheet.detectedStudents || 0,
          ignored:sheet.ignored,
          reason:sheet.reason || "",
          headers:sheet.headers || []
        };
      }),
      rows:rows,
      generatedAt:new Date().toISOString()
    };
  }

  window.InforExcel = {
    readFile:readFile,
    analyzeSheet:analyzeSheet,
    likelyStudentObject:likelyStudentObject
  };
})(window);
