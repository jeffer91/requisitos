/* =========================================================
Nombre completo: infor.excel.js
Ruta o ubicación: /Requisitos/Infor/core/infor.excel.js
Función o funciones:
- Leer Excel/CSV cargado directamente desde Infor.
- Procesar hojas oficiales del informe regular: NÚCLEOS y notas_complexivo.
- Ignorar Hoja3 mientras la información de Trabajo de Titulación/defensa no sea confiable.
- Normalizar encabezados, valores NULL y campos clave para los siguientes bloques.
- Detectar filas útiles aunque una hoja tenga cédula y notas, pero no nombres.
Con qué se conecta:
- ../../Gestion/Excel/excel-xlsx-loader.js
- ../frontend/titulacion.app.js
- infor.state.js
========================================================= */
(function(window){
  "use strict";

  function text(value){
    var out = String(value == null ? "" : value).trim();
    return /^(null|undefined|nan|n\/a|s\/n)$/i.test(out) ? "" : out;
  }
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();}
  function compact(value){return norm(value).replace(/[^a-z0-9]/g, "");}
  function onlyDigits(value){return text(value).replace(/[^0-9]/g, "");}

  var HEADER_HINTS = [
    "cedula", "identificacion", "numeroidentificacion", "identificacionestudiante", "estudiante", "nombre", "nombres", "apellido", "carrera", "programa",
    "materia", "titulo", "articulo", "trabajo", "tutor", "nota", "notafinal", "notafinal", "nfin", "nart", "ndef",
    "notapractico", "notateorico", "notasupletorio", "practico", "teorico", "supletorio", "modalidad"
  ];

  var FIELD_ALIASES = {
    cedula:["cedula", "cédula", "identificacion", "identificación", "identificacionestudiante", "identificacion estudiante", "numeroidentificacion", "numero identificacion", "documento", "dni"],
    nombres:["nombre_est", "nombre est", "nombres", "nombre", "estudiante", "apellidosynombres", "apellidos nombres"],
    materia:["materia", "nucleo", "núcleo", "asignatura"],
    notaFinal:["nota_final", "nota final", "notafinal", "nfin", "final"],
    notaTeorico:["notaTeorico", "nota teorico", "nota teórico", "teorico", "teórico"],
    notaPractico:["notaPractico", "nota practico", "nota práctico", "practico", "práctico"],
    notaSupletorio:["notaSupletorio", "nota supletorio"],
    supletorio:["supletorio", "supetorio"],
    carrera:["carrera", "nombrecarrera", "programa"],
    modalidad:["modalidad", "modalidadtitulacion", "modalidad titulacion"]
  };

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
    return values.filter(function(value){
      return HEADER_HINTS.some(function(hint){return value.indexOf(hint) >= 0 || hint.indexOf(value) >= 0;});
    }).length;
  }

  function findHeaderIndex(rows){
    var best = {index:-1, score:0};
    rows.slice(0, 30).forEach(function(row, index){
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

  function findValue(row, aliases){
    row = row || {};
    var keys = Object.keys(row);
    for(var i = 0; i < aliases.length; i += 1){
      var wanted = compact(aliases[i]);
      for(var j = 0; j < keys.length; j += 1){
        var key = compact(keys[j]);
        if(key === wanted || key.indexOf(wanted) >= 0 || wanted.indexOf(key) >= 0){
          var value = text(row[keys[j]]);
          if(value){return value;}
        }
      }
    }
    return "";
  }

  function cedulaLike(value){
    var digits = onlyDigits(value);
    return digits.length >= 8 && digits.length <= 13;
  }

  function hasNameLike(value){
    var raw = norm(value);
    if(raw.length < 8){return false;}
    var words = raw.split(/\s+/).filter(function(w){return w.length >= 3;});
    return words.length >= 2 && /[a-z]/.test(raw);
  }

  function sheetKindByName(name){
    var c = compact(name);
    if(c.indexOf("nucleo") >= 0 || c.indexOf("nucleos") >= 0){return "NUCLEOS";}
    if(c.indexOf("complexivo") >= 0){return "COMPLEXIVO";}
    if(c === "hoja3" || c.indexOf("hoja3") >= 0){return "IGNORADA_HOJA3";}
    return "DESCONOCIDA";
  }

  function sheetKindByHeaders(headers){
    var joined = compact((headers || []).join(" "));
    if(joined.indexOf("materia") >= 0 && (joined.indexOf("identificacionestudiante") >= 0 || joined.indexOf("cedula") >= 0) && joined.indexOf("notafinal") >= 0){return "NUCLEOS";}
    if(joined.indexOf("numeroidentificacion") >= 0 && joined.indexOf("notateorico") >= 0 && joined.indexOf("notapractico") >= 0){return "COMPLEXIVO";}
    return "DESCONOCIDA";
  }

  function normalizeKnownFields(obj, kind){
    var out = Object.assign({}, obj || {});
    out._inforSheetType = kind;
    out.cedula = out.cedula || findValue(out, FIELD_ALIASES.cedula);
    out.nombres = out.nombres || findValue(out, FIELD_ALIASES.nombres);
    out.materia = out.materia || findValue(out, FIELD_ALIASES.materia);
    out.notaFinal = out.notaFinal || findValue(out, FIELD_ALIASES.notaFinal);
    out.notaTeorico = out.notaTeorico || findValue(out, FIELD_ALIASES.notaTeorico);
    out.notaPractico = out.notaPractico || findValue(out, FIELD_ALIASES.notaPractico);
    out.notaSupletorio = out.notaSupletorio || findValue(out, FIELD_ALIASES.notaSupletorio);
    out.supletorio = out.supletorio || findValue(out, FIELD_ALIASES.supletorio);
    out.carrera = out.carrera || findValue(out, FIELD_ALIASES.carrera);
    out.modalidadTitulacion = out.modalidadTitulacion || findValue(out, FIELD_ALIASES.modalidad);
    return out;
  }

  function likelyStudentObject(row, kind){
    row = row || {};
    var keys = Object.keys(row || {});
    var joined = keys.map(function(k){return row[k];}).join(" ");
    var keyText = keys.join(" ");
    var hasId = !!findValue(row, FIELD_ALIASES.cedula) || cedulaLike(joined);
    var hasName = !!findValue(row, FIELD_ALIASES.nombres) || hasNameLike(joined);
    var hasAcademic = /materia|carrera|programa|nota|nfin|nart|ndef|practico|teorico|supletorio|titulo|articulo|trabajo|tutor|modalidad/i.test(keyText + " " + joined);
    if(kind === "NUCLEOS"){return hasId && !!findValue(row, FIELD_ALIASES.materia) && !!findValue(row, FIELD_ALIASES.notaFinal);}
    if(kind === "COMPLEXIVO"){return hasId && (!!findValue(row, FIELD_ALIASES.notaTeorico) || !!findValue(row, FIELD_ALIASES.notaPractico) || !!findValue(row, FIELD_ALIASES.notaSupletorio));}
    return (hasId && hasName) || (hasId && hasAcademic) || (hasName && hasAcademic);
  }

  function objectFromRow(headers, row){
    var obj = {};
    headers.forEach(function(header){
      var value = text(row[header.index]);
      if(value){obj[header.key] = value;}
    });
    return obj;
  }

  function rowsToObjects(rows, headerIndex, kind){
    if(headerIndex < 0){return [];} 
    var headers = uniqueHeaders(rows[headerIndex] || []);
    return rows.slice(headerIndex + 1).map(function(row, index){
      var obj = normalizeKnownFields(objectFromRow(headers, row || []), kind);
      if(Object.keys(obj).some(function(k){return k.indexOf("_infor") !== 0 && text(obj[k]);})){obj._inforRowNumber = headerIndex + index + 2;}
      return obj;
    }).filter(function(obj){return Object.keys(obj).length > 2;});
  }

  function countUnique(rows){
    var map = Object.create(null);
    (rows || []).forEach(function(row){var d = onlyDigits(row.cedula || findValue(row, FIELD_ALIASES.cedula));if(d){map[d] = true;}});
    return Object.keys(map).length;
  }

  function analyzeSheet(name, rows){
    rows = Array.isArray(rows) ? rows : [];
    var cleanRows = rows.filter(function(row){return nonEmptyCount(row) > 0;});
    if(!cleanRows.length){return {name:name,totalRows:0,headerIndex:-1,headers:[],rows:[],ignored:true,kind:"VACIA",reason:"Hoja vacía"};}

    var headerIndex = findHeaderIndex(cleanRows);
    var headers = headerIndex >= 0 ? uniqueHeaders(cleanRows[headerIndex]) : [];
    var headerLabels = headers.map(function(h){return h.label;});
    var kind = sheetKindByName(name);
    if(kind === "DESCONOCIDA"){kind = sheetKindByHeaders(headerLabels);}

    if(kind === "IGNORADA_HOJA3"){
      return {name:name,totalRows:cleanRows.length,headerIndex:headerIndex,headers:headerLabels,rows:[],ignored:true,kind:kind,reason:"Hoja3 ignorada temporalmente"};
    }
    if(kind === "DESCONOCIDA"){
      return {name:name,totalRows:cleanRows.length,headerIndex:headerIndex,headers:headerLabels,rows:[],ignored:true,kind:kind,reason:"Hoja no corresponde a NÚCLEOS ni notas_complexivo"};
    }

    var objects = rowsToObjects(cleanRows, headerIndex, kind);
    var useful = objects.filter(function(obj){return likelyStudentObject(obj, kind);});
    if(!useful.length){
      return {name:name,totalRows:cleanRows.length,headerIndex:headerIndex,headers:headerLabels,rows:[],ignored:true,kind:kind,reason:"Sin estudiantes detectados"};
    }

    return {name:name,totalRows:cleanRows.length,headerIndex:headerIndex,headers:headerLabels,rows:useful,ignored:false,kind:kind,reason:"",detectedStudents:useful.length,uniqueStudents:countUnique(useful)};
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
      (sheet.rows || []).forEach(function(row){rows.push(Object.assign({_inforSheet:sheet.name,_inforSheetType:sheet.kind}, row));});
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
      totalUniqueStudents:countUnique(rows),
      sheets:sheets.map(function(sheet){return {name:sheet.name,kind:sheet.kind,totalRows:sheet.totalRows,detectedStudents:sheet.detectedStudents || 0,uniqueStudents:sheet.uniqueStudents || 0,ignored:sheet.ignored,reason:sheet.reason || "",headers:sheet.headers || []};}),
      rows:rows,
      generatedAt:new Date().toISOString()
    };
  }

  window.InforExcel = {readFile:readFile,analyzeSheet:analyzeSheet,likelyStudentObject:likelyStudentObject};
})(window);
